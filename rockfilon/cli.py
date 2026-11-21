"""`uv run rockfilon <commande>` : outils de contenu et d'admin."""

import argparse
import datetime as dt
import json
import re

from rockfilon import config, pipeline

CONTENT = pipeline.CONTENT


def all_ids() -> list[str]:
    return sorted(p.stem for p in (CONTENT / "questions").glob("*.yaml"))


def build(ids: list[str]) -> None:
    for qid in ids:
        path = pipeline.build(qid)
        print(f"{qid} -> {path.relative_to(CONTENT.parent)}  (rapport : content/reports/{qid}.md)")


def load(ids: list[str]) -> None:
    """Charge content/build/<id>.json en base. Les id des réponses restent stables (upsert par libellé)."""
    from sqlalchemy import select

    from rockfilon.models import Answer, Question, Session

    with Session() as s:
        for qid in ids:
            data = json.loads((CONTENT / "build" / f"{qid}.json").read_text("utf-8"))
            s.merge(Question(id=qid, prompt=data["prompt"], categorie=data["categorie"], built_at=dt.datetime.fromisoformat(data["built_at"])))
            s.flush()
            existing = {a.display: a for a in s.scalars(select(Answer).where(Answer.question_id == qid))}
            for a in data["answers"]:
                row = existing.pop(a["display"], None) or Answer(question_id=qid, display=a["display"])
                row.tier, row.forms, row.exact = a["tier"], a["forms"], a["exact"]
                s.add(row)
            for row in existing.values():  # réponses retirées du contenu
                s.delete(row)
            print(f"{qid} : {len(data['answers'])} réponses chargées")
        s.commit()


def schedule(date: dt.date, ids: list[str]) -> None:
    from sqlalchemy import func, select
    from sqlalchemy.dialects.postgresql import insert

    from rockfilon.models import Attempt, Daily, Question, Session

    if len(set(ids)) != config.QUESTIONS_PER_DAY:
        raise SystemExit(f"Il faut {config.QUESTIONS_PER_DAY} questions différentes.")
    with Session() as s:
        missing = set(ids) - set(s.scalars(select(Question.id)))
        if missing:
            raise SystemExit(f"Questions non chargées (rockfilon load) : {', '.join(sorted(missing))}")
        if s.scalar(select(func.count()).select_from(Attempt).where(Attempt.date == date)):
            raise SystemExit(f"Des joueurs ont déjà creusé le {date} : planning figé.")
        s.execute(
            insert(Daily)
            .values(date=date, question_ids=ids, recycled=False)
            .on_conflict_do_update(index_elements=[Daily.date], set_={"question_ids": ids, "recycled": False})
        )
        s.commit()
    print(f"{date} planifié.")


def planning(days: int = 30) -> None:
    from sqlalchemy import select

    from rockfilon.api import number, today
    from rockfilon.models import Daily, Session

    start = today()
    with Session() as s:
        rows = {d.date: d for d in s.scalars(select(Daily).where(Daily.date >= start, Daily.date < start + dt.timedelta(days=days)))}
    ahead = 0
    while (d := rows.get(start + dt.timedelta(days=ahead))) and not d.recycled:
        ahead += 1
    for i in range(days):
        day = start + dt.timedelta(days=i)
        d = rows.get(day)
        label = "recyclée" if d and d.recycled else ", ".join(d.question_ids) if d else "— (recyclage automatique)"
        print(f"{day}  n°{number(day):<4} {label}")
    if ahead < 7:
        print(f"\n⚠ Seulement {ahead} jour(s) planifié(s) d'avance : le serveur recyclera d'anciennes questions.")


def set_pepite(qid: str, answer: str) -> None:
    path = CONTENT / "questions" / f"{qid}.yaml"
    text, n = re.subn(r"(?m)^pepite:.*$", f"pepite: {json.dumps(answer, ensure_ascii=False)}", path.read_text("utf-8"))
    if n != 1:
        raise SystemExit(f"Pas de ligne « pepite: » dans {path.name}")
    path.write_text(text, "utf-8")


def add(qid: str, answer: str, aliases: list[str], score: float | None) -> None:
    """Réponse oubliée ou alias signalés par un joueur : ligne de confiance dans content/corrections/<id>.txt."""
    path = CONTENT / "corrections" / f"{qid}.txt"
    path.parent.mkdir(exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(" | ".join([answer, *aliases]) + "\n")
    if score is not None:
        scores = CONTENT / "scores" / f"{qid}.csv"
        if not scores.exists():
            scores.write_text("reponse;score;justification\n", "utf-8")
        with scores.open("a", encoding="utf-8") as f:
            f.write(f"{answer};{score:g};ajout admin\n")


def main() -> None:
    parser = argparse.ArgumentParser(prog="rockfilon")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("build", help="construit le JSON et le rapport de contrôle (défaut : toutes les questions)")
    p.add_argument("ids", nargs="*")
    p = sub.add_parser("load", help="charge les JSON construits en base (défaut : toutes les questions)")
    p.add_argument("ids", nargs="*")
    p = sub.add_parser("schedule", help="planifie les 7 questions d'un jour : schedule 2026-12-01 id1 … id7")
    p.add_argument("date", type=dt.date.fromisoformat)
    p.add_argument("ids", nargs=config.QUESTIONS_PER_DAY)
    sub.add_parser("planning", help="affiche les 30 prochains jours et prévient si le planning s'épuise")
    p = sub.add_parser("pepite", help="désigne la pépite (béryl rouge) d'une question, puis build + load")
    p.add_argument("id")
    p.add_argument("reponse")
    p = sub.add_parser("add", help="ajoute une réponse oubliée ou des alias à une réponse existante, puis build + load")
    p.add_argument("id")
    p.add_argument("reponse")
    p.add_argument("alias", nargs="*")
    p.add_argument("--score", type=float, help="familiarité 0-100 (100 = tout le monde la cite)")
    args = parser.parse_args()

    if args.cmd == "build":
        build(args.ids or all_ids())
    elif args.cmd == "load":
        load(args.ids or all_ids())
    elif args.cmd == "schedule":
        schedule(args.date, args.ids)
    elif args.cmd == "planning":
        planning()
    elif args.cmd == "pepite":
        set_pepite(args.id, args.reponse)
        build([args.id])
        load([args.id])
    elif args.cmd == "add":
        add(args.id, args.reponse, args.alias, args.score)
        build([args.id])
        load([args.id])


if __name__ == "__main__":
    main()
