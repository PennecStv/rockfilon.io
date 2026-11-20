"""Normalisation et correspondance des réponses. Partagé par le pipeline et l'API : ne pas dupliquer."""

import re
import unicodedata

_LIGATURES = str.maketrans({"œ": "oe", "Œ": "oe", "æ": "ae", "Æ": "ae"})
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_ARTICLE = re.compile(r"^(?:de la|le|la|les|l|un|une|des|du) ")


def _singular(word: str) -> str:
    if len(word) <= 3:  # « os », « pis » restent tels quels
        return word
    if word.endswith("eaux"):
        return word[:-1]
    if word.endswith("aux"):
        return word[:-3] + "al"
    if word.endswith(("eux", "oux")):
        return word[:-1]
    if word.endswith("s"):
        return word[:-1]
    return word


def normalize(text: str) -> str:
    s = unicodedata.normalize("NFKD", text.translate(_LIGATURES).lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = _NON_ALNUM.sub(" ", s).strip()
    s = _ARTICLE.sub("", s, count=1) or s
    return " ".join(_singular(w) for w in s.split())


def tolerance(length: int) -> int:
    """Fautes tolérées selon la longueur de la forme attendue."""
    return 0 if length < 5 else 1 if length <= 8 else 2


def distance(a: str, b: str, limit: int = 2) -> int:
    """Damerau-Levenshtein (variante OSA), plafonnée à limit + 1 pour sortir tôt."""
    if abs(len(a) - len(b)) > limit:
        return limit + 1
    prev2: list[int] = []
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                cur[j] = min(cur[j], prev2[j - 2] + 1)
        if min(cur) > limit:
            return limit + 1
        prev2, prev = prev, cur
    return min(prev[-1], limit + 1)


def match(text: str, forms: dict[str, tuple[int, bool]]) -> int | None:
    """forms : forme normalisée -> (id de réponse, exact_only). Renvoie l'id trouvé, ou None.

    Exact d'abord, puis flou. Si deux réponses différentes sont aussi proches l'une que l'autre, on refuse.
    """
    q = normalize(text)
    if not q:
        return None
    if q in forms:
        return forms[q][0]
    best, ids = 3, set()
    for form, (answer_id, exact_only) in forms.items():
        tol = tolerance(len(form))
        if exact_only or tol == 0:
            continue
        d = distance(q, form, tol)
        if d > tol:
            continue
        if d < best:
            best, ids = d, {answer_id}
        elif d == best:
            ids.add(answer_id)
    return ids.pop() if len(ids) == 1 else None
