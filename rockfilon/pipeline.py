"""Pipeline de contenu : content/questions/<id>.yaml -> content/build/<id>.json + content/reports/<id>.md.

récupération -> fusion -> normalisation -> dédoublonnage -> rareté -> paliers -> garde-fous -> rapport.
"""

import csv
import datetime as dt
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from itertools import combinations
from pathlib import Path

import yaml

from rockfilon import config
from rockfilon.text import distance, normalize, tolerance

CONTENT = Path(__file__).resolve().parent.parent / "content"
CACHE = CONTENT / ".cache"
HEADERS = {"User-Agent": "rockfilon-content-pipeline/0.1 (https://rockfilon.io)"}
LEXIQUE_URL = "https://www.lexique.org/databases/Lexique383/Lexique383.tsv"
STOPWORDS = {"de", "du", "des", "d", "la", "le", "l", "a", "au", "en", "et", "sur"}


# --- récupération (avec cache disque) ------------------------------------------------------------


def _fetch(url: str, attempts: int = 4) -> bytes:
    for i in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as r:
                return r.read()
        except (urllib.error.HTTPError, TimeoutError) as e:
            retriable = isinstance(e, TimeoutError) or e.code in (429, 503)
            if not retriable or i == attempts - 1:
                raise
            wait = getattr(e, "headers", None) and e.headers.get("Retry-After")
            time.sleep(int(wait or 10 * (i + 1)))  # limite de débit / lenteur de Wikimedia


def _max(a, b):
    return b if a is None else a if b is None else max(a, b)


def _item(label, aliases=(), article=None, sitelinks=None, trusted=False, qid=None, enrich_only=False):
    label = re.sub(r"\s*\([^)]*\)$", "", label)  # « Requinto (cordes) » -> « Requinto »
    return {"label": label, "aliases": set(aliases), "article": article, "sitelinks": sitelinks, "trusted": trusted, "qid": qid, "enrich_only": enrich_only}


def wikidata_sparql(query: str) -> list[dict]:
    """La requête doit sélectionner ?item et ?label, et peut sélectionner ?alias, ?article, ?sitelinks."""
    cache = CACHE / "sparql" / f"{hashlib.sha256(query.encode()).hexdigest()[:16]}.json"
    if not cache.exists():
        url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query, "format": "json"})
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(_fetch(url))
    items: dict[str, dict] = {}
    for row in json.loads(cache.read_bytes())["results"]["bindings"]:
        v = {k: x["value"] for k, x in row.items()}
        it = items.setdefault(v["item"], _item(v["label"], sitelinks=0, qid=v["item"].rsplit("/", 1)[1]))
        if "alias" in v:
            it["aliases"].add(v["alias"])
        if "article" in v:
            it["article"] = urllib.parse.unquote(v["article"].rsplit("/wiki/", 1)[1])
        if "sitelinks" in v:
            it["sitelinks"] = int(v["sitelinks"])
    return list(items.values())


def liste_manuelle(path: str) -> list[dict]:
    """Une réponse par ligne : `libellé | alias | alias`, `#` pour commenter. Fait foi sur Wikidata."""
    out = []
    for line in (CONTENT / path).read_text("utf-8").splitlines():
        parts = [p.strip() for p in line.split("#", 1)[0].split("|")]
        if parts[0]:
            out.append(_item(parts[0], [p for p in parts[1:] if p], trusted=True))
    return out


def lexique() -> dict[str, float]:
    """Forme normalisée -> fréquence par million (moyenne films/livres, max sur les homographes)."""
    path = CACHE / "Lexique383.tsv"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_fetch(LEXIQUE_URL))
    freqs: dict[str, float] = {}
    with path.open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE):
            key = normalize(row["ortho"])
            freq = (float(row["freqfilms2"]) + float(row["freqlivres"])) / 2
            if key and freq > freqs.get(key, -1):
                freqs[key] = freq
    return freqs


def pageviews(titles: set[str]) -> dict[str, int]:
    """Vues fr.wikipedia (utilisateurs humains) sur les 12 derniers mois complets."""
    end = dt.date.today().replace(day=1) - dt.timedelta(days=1)
    start = dt.date(end.year - (end.month < 12), (end.month % 12) + 1, 1)  # 12 mois pile
    period = f"{start:%Y%m%d}00/{end:%Y%m%d}00"
    cache = CACHE / f"pageviews-{start:%Y%m}-{end:%Y%m}.json"
    views = json.loads(cache.read_text("utf-8")) if cache.exists() else {}

    def one(title):
        url = (
            "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/"
            f"{urllib.parse.quote(title.replace(' ', '_'), safe='')}/monthly/{period}"
        )
        try:
            return title, sum(i["views"] for i in json.loads(_fetch(url))["items"])
        except urllib.error.HTTPError as e:
            if e.code == 404:  # pas de vue enregistrée sur la période
                return title, 0
            raise

    try:
        with ThreadPoolExecutor(8) as pool:  # l'API tolère ~100 req/s ; on reste poli
            views.update(pool.map(one, sorted(titles - views.keys())))
    finally:
        cache.write_text(json.dumps(views, ensure_ascii=False), "utf-8")
    return views


# --- fusion et dédoublonnage ---------------------------------------------------------------------


def merge(items: list[dict], exclure: list[str], alias: dict[str, list[str]], log: dict) -> list[dict]:
    """Dédoublonne par forme canonique.

    Ordre : listes manuelles (libellés puis alias) > libellés Wikidata > alias du YAML > alias Wikidata.
    Un libellé Wikidata déjà connu comme forme d'une réponse s'y fusionne (« onzième côte » -> « côte »),
    un alias du YAML absorbe la réponse qui porte cette forme, un alias Wikidata ne s'ajoute que s'il est libre.
    Une source `enrichir_seulement` n'ajoute jamais de réponse, seulement des alias.
    """
    excluded = {normalize(x) for x in exclure}
    answers: list[dict | None] = []
    owner: dict[str, int] = {}

    def absorb(dst: int, src: int):
        a, b = answers[dst], answers[src]
        for f in b["forms"]:
            owner[f] = dst
        a["forms"] |= b["forms"]
        a["sitelinks"] = _max(a["sitelinks"], b["sitelinks"])
        a["article"] = a["article"] or b["article"]
        log["absorbees"].append(f"{b['display']} → {a['display']}")
        answers[src] = None

    def add_form(key: str, form: str, steal: bool):
        idx, f = owner[key], normalize(form)
        if not f or f in excluded or owner.get(f) == idx:
            return
        if f in owner:
            if not steal:
                log["alias_ignores"].append(f"« {f} » ({answers[idx]['display']}) déjà pris par {answers[owner[f]]['display']}")
                return
            absorb(idx, owner[f])
        owner[f] = idx
        answers[idx]["forms"].add(f)

    def add_label(it: dict) -> bool:
        key = normalize(it["label"])
        if key in owner:
            a = answers[owner[key]]
            a["sitelinks"] = _max(a["sitelinks"], it["sitelinks"])
            a["article"] = a["article"] or it["article"]
            if it["qid"] not in a["qids"]:  # le même élément Wikidata vu par deux requêtes n'est pas un doublon
                log["fusions"].append(f"{it['label']} ({it['qid'] or 'liste'}) = {a['display']}")
            a["qids"].add(it["qid"])
        elif it["enrich_only"]:
            log["hors_liste"].append(it["label"])
            return False
        else:
            owner[key] = len(answers)
            answers.append(
                {"display": it["label"], "forms": {key}, "article": it["article"], "sitelinks": it["sitelinks"], "qids": {it["qid"]}}
            )
        return True

    kept = [it for it in items if normalize(it["label"]) not in excluded]
    log["exclues"] = sorted({it["label"] for it in items} - {it["label"] for it in kept})
    for it in (it for it in kept if it["trusted"]):
        add_label(it)
        for f in it["aliases"]:
            add_form(normalize(it["label"]), f, steal=True)
    wikidata = [it for it in kept if not it["trusted"] and add_label(it)]
    for label, forms in alias.items():  # alias ajoutés dans le YAML (ou par la CLI admin)
        if normalize(label) not in owner:
            raise ValueError(f"alias : réponse inconnue « {label} »")
        for f in forms:
            add_form(normalize(label), f, steal=True)
    for it in wikidata:
        for f in it["aliases"]:
            add_form(normalize(it["label"]), f, steal=False)
    return [a for a in answers if a]


# --- rareté --------------------------------------------------------------------------------------


def familiarity(answers: list[dict], method: str, llm_scores: dict[str, float], log: dict) -> None:
    """Ajoute a["p"] : percentile de familiarité dans la question (1 = la plus connue), ou None."""
    if method == "lexique":
        lex = lexique()
        for a in answers:
            freqs = [lex.get(w) for w in normalize(a["display"]).split() if w not in STOPWORDS]
            a["raw"] = None if not freqs or None in freqs else min(freqs)  # le mot le plus rare décide
    elif method == "pageviews":
        views = pageviews({a["article"] for a in answers if a["article"]})
        for a in answers:
            a["raw"] = views.get(a["article"]) if a["article"] else None
    elif method == "sitelinks":
        for a in answers:
            a["raw"] = a["sitelinks"]
    elif method == "llm":
        for a in answers:
            a["raw"] = None
    else:
        raise ValueError(f"rarete inconnue : {method}")

    scored = sorted(a["raw"] for a in answers if a["raw"] is not None)
    for a in answers:  # percentile de rang, ex aequo au même rang moyen
        if a["raw"] is not None and len(scored) > 1:
            below = sum(1 for x in scored if x < a["raw"])
            ties = sum(1 for x in scored if x == a["raw"])
            a["p"] = (below + (ties - 1) / 2) / (len(scored) - 1)
        else:
            a["p"] = None
    owner = {f: a for a in answers for f in a["forms"]}
    for label, score in llm_scores.items():  # le score relu à la main l'emporte
        a = owner.get(normalize(label))
        if a is None:
            log["scores_orphelins"].append(label)
        else:
            a["p"], a["llm"] = score / 100, True


def tier_of(p: float, quantiles) -> int:
    return next((i + 1 for i, q in enumerate(quantiles) if p >= q), len(quantiles) + 1)


# --- garde-fous fautes de frappe ----------------------------------------------------------------


def _deletes(s: str, k: int) -> set[str]:
    out, frontier = {s}, {s}
    for _ in range(k):
        frontier = {w[:i] + w[i + 1 :] for w in frontier for i in range(len(w))}
        out |= frontier
    return out


def typo_traps(answers: list[dict], lex: dict[str, float] | None) -> tuple[set[str], list[str]]:
    """Formes qui doivent exiger une saisie exacte, et la liste lisible des paires en cause.

    Deux formes à distance <= tolérance appartenant à deux réponses différentes, ou une forme proche
    d'un mot courant du Lexique qui n'est pas une réponse (le piège « radis » -> « radius »).
    """
    owner = {f: i for i, a in enumerate(answers) for f in a["forms"]}
    index = defaultdict(set)  # recherche par voisinage de suppressions (SymSpell)
    for f in owner:
        # suppressions nécessaires pour croiser tout voisin à portée de tolérance (cf. tolerance())
        for d in _deletes(f, 0 if len(f) < 4 else 1 if len(f) < 7 else 2):
            index[d].add(f)
    exact, pairs, seen = set(), set(), set()
    for bucket in index.values():
        for f1, f2 in combinations(sorted(bucket), 2):
            if owner[f1] == owner[f2] or (f1, f2) in seen:
                continue
            seen.add((f1, f2))
            tol = max(tolerance(len(f1)), tolerance(len(f2)))
            if tol and distance(f1, f2, tol) <= tol:
                pairs.add((f1, f2))
                exact |= {f1, f2}
    lines = [f"{f1} ↔ {f2}" for f1, f2 in sorted(pairs)]
    if lex:
        for word, freq in lex.items():
            if freq < config.LEXIQUE_NEIGHBOR_MIN_FREQ or word in owner or len(word) < 4:
                continue
            for d in _deletes(word, 2):
                for f in index.get(d, ()):
                    tol = tolerance(len(f))
                    if f not in exact and tol and distance(word, f, tol) <= tol:
                        exact.add(f)
                        lines.append(f"{f} ↔ mot courant « {word} » ({freq:.1f}/M)")
    return exact, lines


# --- build ---------------------------------------------------------------------------------------


def build(qid: str) -> Path:
    spec = yaml.safe_load((CONTENT / "questions" / f"{qid}.yaml").read_text("utf-8"))
    assert spec["id"] == qid, f"{qid}.yaml déclare id={spec['id']}"
    log = defaultdict(list)

    items = []
    for src in spec["sources"]:
        if src["type"] == "wikidata_sparql":
            items += [it | {"enrich_only": src.get("enrichir_seulement", False)} for it in wikidata_sparql(src["query"])]
        elif src["type"] == "liste_manuelle":
            items += liste_manuelle(src["fichier"])
        else:
            raise ValueError(f"source inconnue : {src['type']}")
    answers = merge(items, spec.get("exclure", []), spec.get("alias", {}), log)

    scores_path = CONTENT / "scores" / f"{qid}.csv"
    llm_scores = {}
    if scores_path.exists():
        with scores_path.open(encoding="utf-8") as f:
            llm_scores = {r["reponse"]: float(r["score"]) for r in csv.DictReader(f, delimiter=";")}
    familiarity(answers, spec["rarete"], llm_scores, log)

    quantiles = spec.get("quantiles", config.DEFAULT_QUANTILES)
    pepite = normalize(spec["pepite"])
    if not any(pepite in a["forms"] for a in answers):
        raise ValueError(f"pépite « {spec['pepite']} » absente des réponses")
    for a in answers:
        if a["p"] is None:
            log["sans_score"].append(a["display"])
        a["tier"] = config.PEPITE_TIER if pepite in a["forms"] else tier_of(a["p"] if a["p"] is not None else 0.5, quantiles)

    exact, traps = typo_traps(answers, lexique() if spec.get("garde_fou_lexique", True) else None)
    log["pieges"] = traps

    answers.sort(key=lambda a: normalize(a["display"]))
    out = {
        "id": qid,
        "prompt": spec["prompt"],
        "categorie": spec.get("categorie", ""),
        "built_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "answers": [
            {
                "display": a["display"],
                "tier": a["tier"],
                "score": None if a["p"] is None else round(a["p"], 4),
                "forms": sorted(a["forms"]),
                "exact": sorted(a["forms"] & exact),
            }
            for a in answers
        ],
    }
    path = CONTENT / "build" / f"{qid}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), "utf-8")
    write_report(spec, answers, exact, log)
    return path


def _section(title: str, lines: list[str], cap: int = 200) -> str:
    if not lines:
        return f"\n## {title} (0)\n\nRien à signaler.\n"
    body = "\n".join(f"- {x}" for x in lines[:cap])
    more = f"\n- … et {len(lines) - cap} autres" if len(lines) > cap else ""
    return f"\n## {title} ({len(lines)})\n\n{body}{more}\n"


def write_report(spec: dict, answers: list[dict], exact: set[str], log: dict) -> Path:
    by_tier = defaultdict(list)
    for a in answers:
        by_tier[a["tier"]].append(a)
    n_forms = sum(len(a["forms"]) for a in answers)
    md = [
        f"# Rapport — {spec['prompt']}\n",
        f"- id : `{spec['id']}` · rareté : **{spec['rarete']}** · généré le {dt.date.today():%d/%m/%Y}",
        f"- **{len(answers)} réponses** valides, {n_forms} formes acceptées, {len(exact)} en correspondance exacte",
        f"- pépite (béryl rouge) : **{spec['pepite']}**",
        f"- scores relus (CSV) appliqués : {sum(1 for a in answers if a.get('llm'))}",
        "\n## Répartition par palier\n",
        "| Palier | Minerai | Réponses | Part |",
        "|---|---|---|---|",
    ]
    for t, (name, _, _) in config.TIERS.items():
        md.append(f"| {t} | {name} | {len(by_tier[t])} | {len(by_tier[t]) / len(answers):.0%} |")
    md.append(_section("Sans score (palier par défaut : milieu de tableau)", sorted(log["sans_score"])))
    md.append(_section("Pièges à fautes de frappe → correspondance exacte exigée", log["pieges"]))
    md.append(_section("Réponses absorbées par un alias de confiance", log["absorbees"]))
    md.append(_section("Doublons fusionnés (même forme canonique)", log["fusions"]))
    md.append(_section("Alias Wikidata ignorés (déjà pris)", log["alias_ignores"]))
    md.append(_section("Écartées : source d'enrichissement, absentes de la liste de référence", sorted(log["hors_liste"])))
    md.append(_section("Scores CSV sans réponse correspondante", log["scores_orphelins"]))
    md.append(_section("Exclues", log["exclues"]))
    md.append("\n## Exemples par palier (30 au plus, du plus connu au plus rare)\n")
    for t, (name, _, _) in config.TIERS.items():
        tier = sorted(by_tier[t], key=lambda a: -(a["p"] if a["p"] is not None else 0.5))
        step = max(1, len(tier) / 30)
        sample = [tier[int(i * step)] for i in range(min(30, len(tier)))]
        fmt = lambda a: f"{a['display']}" + (f" ({a['p']:.2f})" if a["p"] is not None else " (?)")
        md.append(f"**{t}. {name}** — " + (", ".join(map(fmt, sample)) or "—") + "\n")
    path = CONTENT / "reports" / f"{spec['id']}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(md), "utf-8")
    return path
