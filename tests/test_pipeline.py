from collections import defaultdict

from rockfilon.pipeline import _item, familiarity, merge, tier_of, typo_traps


def _merge(items, exclure=(), alias=None):
    log = defaultdict(list)
    return merge(items, list(exclure), alias or {}, log), log


def test_merge_dedups_by_canonical_form_and_trusts_manual_aliases():
    items = [
        _item("Côte", ["côte humaine"], article="Côte_(anatomie)", sitelinks=110),
        _item("onzième côte", sitelinks=1),
        _item("cote", sitelinks=3),  # même forme canonique que « Côte »
        _item("scapula", ["omoplate"], sitelinks=84),
        _item("os long", sitelinks=25),
        _item("côte", ["onzième côte", "côte flottante"], trusted=True),
    ]
    answers, log = _merge(items, exclure=["os long"])
    by_display = {a["display"]: a for a in answers}
    assert set(by_display) == {"côte", "scapula"}
    cote = by_display["côte"]
    assert {"cote", "onzieme cote", "cote flottante", "cote humaine"} <= cote["forms"]
    assert cote["sitelinks"] == 110 and cote["article"] == "Côte_(anatomie)"
    assert "omoplate" in by_display["scapula"]["forms"]
    assert log["exclues"] == ["os long"] and log["absorbees"] == []


def test_yaml_alias_absorbs_a_wikidata_answer_and_enrich_only_adds_nothing():
    items = [
        _item("guitare basse", sitelinks=88),
        _item("basse électrique", ["basse"], sitelinks=19),
        _item("tibia", ["os du tibia"], enrich_only=True),
        _item("surface du calcanéus", enrich_only=True),
    ]
    answers, log = _merge(items, alias={"guitare basse": ["basse électrique"]})
    assert [a["display"] for a in answers] == ["guitare basse"]
    assert answers[0]["forms"] == {"guitare basse", "basse electrique", "basse"}
    assert log["hors_liste"] == ["tibia", "surface du calcanéus"]


def test_untrusted_alias_never_steals_a_form():
    answers, log = _merge([_item("radius"), _item("ulna", ["radius", "cubitus"])])
    ulna = next(a for a in answers if a["display"] == "ulna")
    assert ulna["forms"] == {"ulna", "cubitu"} and len(log["alias_ignores"]) == 1


def test_yaml_alias_must_target_a_known_answer():
    try:
        _merge([_item("tibia")], alias={"péroné": ["fibula"]})
    except ValueError:
        return
    raise AssertionError("alias vers une réponse inconnue accepté")


def test_familiarity_percentiles_and_csv_override():
    answers = [{"display": d, "forms": {d}, "sitelinks": s, "article": None} for d, s in [("a", 1), ("b", 5), ("c", 5), ("d", 9)]]
    log = defaultdict(list)
    familiarity(answers, "sitelinks", {"a": 80, "zz": 10}, log)
    assert [a["p"] for a in answers] == [0.8, 0.5, 0.5, 1.0]
    assert log["scores_orphelins"] == ["zz"]


def test_tier_of_quantiles():
    q = (0.97, 0.90, 0.75, 0.50)
    assert [tier_of(p, q) for p in (1.0, 0.97, 0.95, 0.8, 0.6, 0.1)] == [1, 1, 2, 3, 4, 5]


def test_typo_traps_flags_close_answers_and_common_words():
    answers = [{"forms": {f}} for f in ("rocher", "rochet", "radiu", "clavicule")]
    exact, lines = typo_traps(answers, {"radi": 30.0, "rare": 0.1, "clavicule": 5.0})
    # « rocher »/« rochet » trop proches ; « radiu » (radius) proche du mot courant « radi » (radis)
    assert exact == {"rocher", "rochet", "radiu"}
    assert len(lines) == 2
