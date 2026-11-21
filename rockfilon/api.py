"""API du jeu. Le serveur garde les réponses, le chrono et l'unicité des soumissions."""

import datetime as dt
import uuid
from collections import Counter
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from rockfilon import config
from rockfilon.models import Answer, Attempt, Daily, Question, Session
from rockfilon.text import match

app = FastAPI(title="rockfilon")
PARIS = ZoneInfo(config.TIMEZONE)
TIME_LIMIT = dt.timedelta(seconds=config.SECONDS_PER_QUESTION + config.GRACE_SECONDS)


def now() -> dt.datetime:  # remplacé dans les tests
    return dt.datetime.now(dt.UTC)


def today() -> dt.date:
    return now().astimezone(PARIS).date()


def number(d: dt.date) -> int:
    return (d - config.LAUNCH_DATE).days + 1


def db():
    with Session() as s:
        yield s


def player(x_player_id: str = Header()) -> uuid.UUID:
    try:
        return uuid.UUID(x_player_id)
    except ValueError:
        raise HTTPException(400, "Identifiant de joueur invalide.") from None


def final_tier(apriori: int, count: int, n: int) -> int:
    """Mélange rareté a priori et part observée des joueurs ; le poids de l'observé croît avec n."""
    if apriori == config.PEPITE_TIER or n == 0:
        return apriori
    share = count / n
    th = config.OBSERVED_THRESHOLDS
    observed = next((i + 1 for i, t in enumerate(th) if share >= t), len(th) + 1)
    w = min(1.0, n / config.OBSERVED_FULL_WEIGHT_PLAYERS)
    return int((1 - w) * apriori + w * observed + 0.5)


# --- réponses d'une question, en cache tant que `rockfilon load` ne l'a pas rechargée ------------

_cache: dict[str, tuple] = {}


def answers_of(s, qid: str) -> tuple[dict[str, tuple[int, bool]], dict[int, tuple[str, int]]]:
    """(forme -> (id, exact_only), id -> (libellé, palier a priori))."""
    built = s.scalar(select(Question.built_at).where(Question.id == qid))
    hit = _cache.get(qid)
    if hit is None or hit[0] != built:
        rows = s.scalars(select(Answer).where(Answer.question_id == qid)).all()
        forms = {f: (a.id, f in a.exact) for a in rows for f in a.forms}
        hit = _cache[qid] = (built, forms, {a.id: (a.display, a.tier) for a in rows})
    return hit[1], hit[2]


# --- plongée du jour ----------------------------------------------------------------------------


def daily_for(s, d: dt.date) -> Daily:
    """Plongée planifiée, sinon tirage des 7 questions les moins récemment jouées (le même pour tous)."""
    daily = s.get(Daily, d)
    if daily:
        return daily
    last_used = func.max(Daily.date)
    ids = s.scalars(
        select(Question.id)
        .outerjoin(Daily, Question.id == func.any(Daily.question_ids))
        .group_by(Question.id)
        .order_by(last_used.asc().nulls_first(), func.random())
        .limit(config.QUESTIONS_PER_DAY)
    ).all()
    if len(ids) < config.QUESTIONS_PER_DAY:
        raise HTTPException(503, "Mine fermée : pas assez de questions chargées.")
    s.execute(insert(Daily).values(date=d, question_ids=ids, recycled=True).on_conflict_do_nothing())
    s.commit()
    return s.get(Daily, d)


def attempts_of(s, pid: uuid.UUID, d: dt.date) -> dict[int, Attempt]:
    atts = {a.idx: a for a in s.scalars(select(Attempt).where(Attempt.player_id == pid, Attempt.date == d))}
    t = now()
    for a in atts.values():  # une question abandonnée compte comme un temps écoulé
        if a.answered_at is None and t > a.started_at + TIME_LIMIT:
            a.answered_at, a.points = a.started_at + TIME_LIMIT, 0
    s.commit()
    return atts


def progress(a: Attempt | None, by_id: dict) -> dict:
    if a is None:
        return {"status": "todo"}
    if a.answered_at is None:
        return {"status": "started"}
    canonical = by_id[a.answer_id][0] if a.answer_id in by_id else None
    return {"status": "done", "valid": a.answer_id is not None, "canonical": canonical, "tier": a.tier, "points": a.points}


@app.get("/api/daily")
def get_daily(pid: uuid.UUID = Depends(player), s=Depends(db)):
    d = today()
    daily = daily_for(s, d)
    atts = attempts_of(s, pid, d)
    return {
        "number": number(d),
        "date": d,
        "questions": len(daily.question_ids),
        "seconds": config.SECONDS_PER_QUESTION,
        "meters_per_point": config.METERS_PER_POINT,
        "tiers": [{"tier": t, "name": n, "points": p, "emoji": e} for t, (n, p, e) in config.TIERS.items()],
        "miss_emoji": config.MISS_EMOJI,
        "progress": [progress(atts.get(i), answers_of(s, q)[1]) for i, q in enumerate(daily.question_ids)],
    }


@app.post("/api/daily/question/{idx}/start")
def start_question(idx: int, pid: uuid.UUID = Depends(player), s=Depends(db)):
    d = today()
    daily = daily_for(s, d)
    if not 0 <= idx < len(daily.question_ids):
        raise HTTPException(404, "Pas de question à ce numéro.")
    atts = attempts_of(s, pid, d)
    a = atts.get(idx)
    if a is not None and a.answered_at is not None:
        raise HTTPException(409, "Tu as déjà creusé ici.")
    if a is None:
        if any(i not in atts or atts[i].answered_at is None for i in range(idx)):
            raise HTTPException(409, "Termine d'abord les questions précédentes.")
        a = Attempt(player_id=pid, date=d, idx=idx, started_at=now())
        s.add(a)
        try:
            s.commit()
        except IntegrityError:  # double clic : l'autre requête a déjà lancé le chrono
            s.rollback()
            a = s.get(Attempt, (pid, d, idx))
    prompt = s.scalar(select(Question.prompt).where(Question.id == daily.question_ids[idx]))
    # recharger la page renvoie le même started_at : le chrono ne repart pas de zéro
    return {
        "idx": idx,
        "prompt": prompt,
        "deadline": a.started_at + dt.timedelta(seconds=config.SECONDS_PER_QUESTION),
        "now": now(),
    }


class AnswerIn(BaseModel):
    idx: int
    text: str = Field(max_length=100)


@app.post("/api/answer")
def post_answer(body: AnswerIn, pid: uuid.UUID = Depends(player), s=Depends(db)):
    d, t = today(), now()
    a = s.get(Attempt, (pid, d, body.idx))
    if a is None:
        raise HTTPException(409, "Cette question n'a pas commencé.")
    if a.answered_at is not None:
        raise HTTPException(409, "Une seule réponse par question.")
    qid = s.get(Daily, d).question_ids[body.idx]
    forms, by_id = answers_of(s, qid)
    late = t > a.started_at + TIME_LIMIT
    answer_id = None if late else match(body.text, forms)

    tier, points, share, canonical = None, 0, None, None
    if answer_id is not None:
        same_q = (Attempt.date == d, Attempt.idx == body.idx, Attempt.answered_at.is_not(None))
        n, count = s.execute(
            select(func.count(), func.count().filter(Attempt.answer_id == answer_id)).where(*same_q)
        ).one()
        canonical, apriori = by_id[answer_id]
        tier = final_tier(apriori, count + 1, n + 1)  # en se comptant soi-même
        points, share = config.TIERS[tier][1], round(100 * (count + 1) / (n + 1))

    done = s.execute(
        update(Attempt)
        .where(Attempt.player_id == pid, Attempt.date == d, Attempt.idx == body.idx, Attempt.answered_at.is_(None))
        .values(answered_at=t, raw=body.text.strip(), answer_id=answer_id, tier=tier, points=points)
    )
    if done.rowcount != 1:  # deux envois simultanés : seul le premier compte
        s.rollback()
        raise HTTPException(409, "Une seule réponse par question.")
    s.commit()
    return {
        "valid": answer_id is not None,
        "late": late,
        "canonical": canonical,
        "tier": tier,
        "points": points,
        "meters": points * config.METERS_PER_POINT,
        "share": share,
    }


# --- résultats, archive, stats ------------------------------------------------------------------


def day_summary(s, pid: uuid.UUID, d: dt.date, require_finished: bool) -> dict:
    daily = s.get(Daily, d)
    if daily is None:
        raise HTTPException(404, "Pas de plongée ce jour-là.")
    atts = attempts_of(s, pid, d)
    if require_finished and any(i not in atts or atts[i].answered_at is None for i in range(len(daily.question_ids))):
        raise HTTPException(403, "Termine d'abord ta plongée.")
    questions = []
    for i, qid in enumerate(daily.question_ids):
        _, by_id = answers_of(s, qid)
        counts = dict(
            s.execute(
                select(Attempt.answer_id, func.count())
                .where(Attempt.date == d, Attempt.idx == i, Attempt.answered_at.is_not(None))
                .group_by(Attempt.answer_id)
            ).all()
        )
        n = sum(counts.values())
        pct = lambda aid: round(100 * counts.get(aid, 0) / n) if n else 0  # noqa: E731
        pepite_id = next((aid for aid, (_, tier) in by_id.items() if tier == config.PEPITE_TIER), None)
        mine = atts.get(i)
        # ce que les AUTRES ont trouvé : ni la pépite (révélée à part) ni sa propre réponse
        found = [aid for aid in counts if aid in by_id and aid not in (pepite_id, mine and mine.answer_id)]
        found.sort(key=lambda aid: (-final_tier(by_id[aid][1], counts[aid], n), counts[aid]))
        questions.append(
            {
                "prompt": s.scalar(select(Question.prompt).where(Question.id == qid)),
                "players": n,
                "mine": mine
                and {
                    **progress(mine, by_id),
                    "raw": mine.raw,
                    "tier_now": final_tier(by_id[mine.answer_id][1], counts[mine.answer_id], n) if mine.answer_id in by_id else None,
                    "share": pct(mine.answer_id) if mine.answer_id else None,
                },
                "rare_finds": [
                    {"display": by_id[aid][0], "tier": final_tier(by_id[aid][1], counts[aid], n), "share": pct(aid)} for aid in found[:5]
                ],
                "pepite": pepite_id and {"display": by_id[pepite_id][0], "share": pct(pepite_id)},
            }
        )
    points = sum(a.points for a in atts.values())
    return {"number": number(d), "date": d, "points": points, "meters": points * config.METERS_PER_POINT, "questions": questions}


@app.get("/api/daily/results")
def daily_results(pid: uuid.UUID = Depends(player), s=Depends(db)):
    return day_summary(s, pid, today(), require_finished=True)


@app.get("/api/archive")
def archive(pid: uuid.UUID = Depends(player), s=Depends(db)):
    dailies = s.scalars(select(Daily).where(Daily.date < today()).order_by(Daily.date.desc())).all()
    prompts = dict(s.execute(select(Question.id, Question.prompt)).all())
    mine = dict(
        s.execute(select(Attempt.date, func.sum(Attempt.points)).where(Attempt.player_id == pid).group_by(Attempt.date)).all()
    )
    return [
        {
            "number": number(dl.date),
            "date": dl.date,
            "prompts": [prompts.get(q) for q in dl.question_ids],
            "meters": mine[dl.date] * config.METERS_PER_POINT if dl.date in mine else None,
        }
        for dl in dailies
    ]


@app.get("/api/archive/{d}")
def archive_day(d: dt.date, pid: uuid.UUID = Depends(player), s=Depends(db)):
    if d >= today():
        raise HTTPException(403, "Ce jour n'est pas encore dans l'archive.")
    return day_summary(s, pid, d, require_finished=False)


@app.get("/api/me")
def me(pid: uuid.UUID = Depends(player), s=Depends(db)):
    rows = s.execute(select(Attempt.date, Attempt.tier, Attempt.points).where(Attempt.player_id == pid)).all()
    per_day = Counter()
    for date, _, pts in rows:
        per_day[date] += pts
    streak, day = 0, today()
    if day not in per_day:  # la série tient encore tant qu'on n'a pas raté hier
        day -= dt.timedelta(days=1)
    while day in per_day:
        streak, day = streak + 1, day - dt.timedelta(days=1)
    return {
        "days_played": len(per_day),
        "streak": streak,
        "best_meters": max(per_day.values(), default=0) * config.METERS_PER_POINT,
        "collection": {t: n for t, n in Counter(tier for _, tier, _ in rows if tier).items()},
    }


# Le site construit (web/dist) est servi par la même origine que l'API : une seule image, pas de CORS.
# Monté en dernier pour que les routes /api passent avant.
WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
