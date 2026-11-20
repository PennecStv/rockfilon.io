import pytest

from rockfilon.text import distance, match, normalize, tolerance


@pytest.mark.parametrize(
    "a, b",
    [
        ("Écureuil", "ecureuil"),
        ("saint-nectaire", "saint nectaire"),
        ("  Saint   Nectaire !", "saint nectaire"),
        ("l'os hyoïde", "os hyoïde"),
        ("Le fémur", "fémur"),
        ("de la mimolette", "mimolette"),
        ("des tibias", "tibia"),
        ("les chevaux", "cheval"),
        ("bateaux", "bateau"),
        ("cheveux", "cheveu"),
        ("bijoux", "bijou"),
        ("Œsophage", "oesophage"),
        ("ex æquo", "ex aequo"),
    ],
)
def test_normalize_equivalences(a, b):
    assert normalize(a) == normalize(b)


def test_normalize_keeps_short_words_and_lone_articles():
    assert normalize("os") == "os"
    assert normalize("La") == "la"  # la note, pas un article
    assert normalize("Le Havre") == "havre"
    assert normalize("") == ""


def test_tolerance_thresholds():
    assert [tolerance(n) for n in (3, 4, 5, 8, 9, 15)] == [0, 0, 1, 1, 2, 2]


@pytest.mark.parametrize(
    "a, b, d",
    [("femur", "femur", 0), ("femur", "femru", 1), ("clavicule", "clavicle", 1), ("tibia", "tbiai", 2), ("abc", "xyz", 3)],
)
def test_distance(a, b, d):
    assert distance(a, b) == d


FORMS = {
    normalize(k): v
    for k, v in {
        "fémur": (1, False),
        "clavicule": (2, False),
        "tibia": (3, False),
        "os": (4, False),
        "radius": (5, True),  # proche de « radis » : correspondance exacte exigée
        "rocher": (6, False),
        "rochet": (7, False),
    }.items()
}


@pytest.mark.parametrize(
    "typed, expected",
    [
        ("Fémur", 1),
        ("femru", 1),  # transposition, 5 lettres -> 1 faute
        ("clavicle", 2),
        ("clavcle", 2),  # 9 lettres -> 2 fautes
        ("tibai", 3),
        ("o", None),  # moins de 5 lettres : exact seulement
        ("radius", 5),
        ("radis", None),  # exact_only
        ("rochez", None),  # à égale distance de deux réponses : refusé
        ("", None),
    ],
)
def test_match(typed, expected):
    assert match(typed, FORMS) == expected
