from rockfilon.api import final_tier


def test_apriori_rules_when_few_players():
    assert final_tier(5, count=1, n=1) == 5  # 100 % des joueurs, mais n=1 : w presque nul


def test_observed_takes_over_with_many_players():
    assert final_tier(5, count=400, n=1000) == 1  # 40 % des joueurs : charbon
    assert final_tier(1, count=5, n=1000) == 5  # 0,5 % : diamant
    assert final_tier(3, count=60, n=250) == 3  # w = 0,5 : moitié or (a priori), moitié fer (24 %) -> 2,5 arrondi à 3


def test_pepite_never_moves():
    assert final_tier(6, count=900, n=1000) == 6
