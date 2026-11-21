import datetime as dt
import socket
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from rockfilon import api, config
from rockfilon.models import Answer, Base, Question, Session, engine
from rockfilon.text import normalize

T0 = dt.datetime(2026, 12, 3, 9, 0, tzinfo=dt.UTC)
SECRET = ["clavicule", "os hyoïde", "radius", "os hyoide"]


@pytest.fixture(scope="module", autouse=True)
def schema():
    try:  # sonde TCP courte : sous Windows, psycopg met des minutes à abandonner un port fermé
        socket.create_connection((engine.url.host, engine.url.port or 5432), timeout=1).close()
    except OSError:
        pytest.skip("Postgres injoignable : lance `docker compose up -d db`")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture(autouse=True)
def clock(monkeypatch):
    with engine.begin() as c:
        c.execute(text("TRUNCATE attempt, daily, answer, question RESTART IDENTITY CASCADE"))
    api._cache.clear()
    clock = {"t": T0}
    monkeypatch.setattr(api, "now", lambda: clock["t"])
    with Session() as s:
        s.add_all(Question(id=f"q{i}", prompt=f"Cite un os n°{i}", categorie="test", built_at=T0) for i in range(8))
        s.flush()
        for i in range(8):
            for display, tier in [("fémur", 1), ("clavicule", 3), ("os hyoïde", 6), ("radius", 5)]:
                f = normalize(display)
                s.add(Answer(question_id=f"q{i}", display=display, tier=tier, forms=[f], exact=[f] if display == "radius" else []))
        s.commit()
    return clock


def player():
    c = TestClient(api.app)
    c.headers["X-Player-Id"] = str(uuid.uuid4())
    return c


def play(c, idx, text):
    assert c.post(f"/api/daily/question/{idx}/start").status_code == 200
    return c.post("/api/answer", json={"idx": idx, "text": text})


def test_full_game_then_results_and_stats():
    c = player()
    daily = c.get("/api/daily").json()
    assert daily["number"] == (T0.date() - config.LAUNCH_DATE).days + 1 and daily["questions"] == 7
    assert [p["status"] for p in daily["progress"]] == ["todo"] * 7
    answers = ["Fémur", "femru", "radis", "radius", "os hyoïde", "n'importe quoi", "clavicule"]
    got = [play(c, i, a).json() for i, a in enumerate(answers)]
    assert [g["valid"] for g in got] == [True, True, False, True, True, False, True]
    assert got[0]["canonical"] == "fémur" and got[0]["points"] == 5 and got[0]["meters"] == 20
    assert got[4]["tier"] == 6 and got[4]["points"] == 100
    res = c.get("/api/daily/results").json()
    assert res["points"] == 5 + 5 + 85 + 100 + 35
    assert res["questions"][0]["pepite"]["display"] == "os hyoïde"
    assert res["questions"][3]["mine"]["raw"] == "radius"
    assert res["questions"][0]["rare_finds"] == []  # seul joueur : personne d'autre n'a rien trouvé
    me = c.get("/api/me").json()
    assert me["streak"] == 1 and me["best_meters"] == res["meters"] and me["collection"]["6"] == 1


def test_answers_never_leak_before_the_end():
    c = player()
    bodies = [c.get("/api/daily").text]
    for i in range(3):
        bodies.append(c.post(f"/api/daily/question/{i}/start").text)
        bodies.append(c.post("/api/answer", json={"idx": i, "text": "zzz"}).text)
    bodies.append(c.get("/api/daily").text)
    bodies.append(c.get("/api/daily/results").text)  # refusé tant que la plongée n'est pas finie
    assert not [s for s in SECRET for b in bodies if s in b]


def test_results_locked_until_finished():
    c = player()
    play(c, 0, "fémur")
    assert c.get("/api/daily/results").status_code == 403


def test_one_answer_per_question():
    c = player()
    assert play(c, 0, "zzz").json()["valid"] is False
    assert c.post("/api/answer", json={"idx": 0, "text": "fémur"}).status_code == 409
    assert c.post("/api/daily/question/0/start").status_code == 409


def test_order_is_enforced_and_start_is_idempotent(clock):
    c = player()
    assert c.post("/api/daily/question/1/start").status_code == 409
    first = c.post("/api/daily/question/0/start").json()
    clock["t"] += dt.timedelta(seconds=10)
    again = c.post("/api/daily/question/0/start").json()
    assert again["deadline"] == first["deadline"]  # recharger ne relance pas le chrono
    assert c.post("/api/daily/question/1/start").status_code == 409  # la 0 est encore en cours
    assert c.post("/api/answer", json={"idx": 5, "text": "fémur"}).status_code == 409


def test_server_clock_with_grace(clock):
    c = player()
    c.post("/api/daily/question/0/start")
    clock["t"] += dt.timedelta(seconds=26)  # 25 s + 1 s de latence : accepté
    assert c.post("/api/answer", json={"idx": 0, "text": "fémur"}).json()["valid"] is True
    c.post("/api/daily/question/1/start")
    clock["t"] += dt.timedelta(seconds=28)  # au-delà de la marge de 2 s
    late = c.post("/api/answer", json={"idx": 1, "text": "fémur"}).json()
    assert late["late"] is True and late["valid"] is False and late["points"] == 0


def test_abandoned_question_counts_as_timeout(clock):
    c = player()
    c.post("/api/daily/question/0/start")
    clock["t"] += dt.timedelta(minutes=5)
    assert c.post("/api/daily/question/1/start").status_code == 200
    assert c.get("/api/daily").json()["progress"][0] == {
        "status": "done", "valid": False, "canonical": None, "tier": None, "points": 0,
    }


def test_same_daily_for_everyone_and_bad_player_id():
    a, b = player(), player()
    pa = [a.post(f"/api/daily/question/0/start").json()["prompt"]]
    pb = [b.post(f"/api/daily/question/0/start").json()["prompt"]]
    assert pa == pb
    assert TestClient(api.app).get("/api/daily", headers={"X-Player-Id": "nope"}).status_code == 400


def test_archive_only_shows_past_days(clock):
    c = player()
    c.get("/api/daily")
    assert c.get("/api/archive").json() == []
    assert c.get("/api/archive/2026-12-03").status_code == 403
    clock["t"] += dt.timedelta(days=1)
    past = c.get("/api/archive").json()
    assert [d["number"] for d in past] == [(T0.date() - config.LAUNCH_DATE).days + 1]
    assert c.get("/api/archive/2026-12-03").json()["questions"][0]["pepite"]["display"] == "os hyoïde"
