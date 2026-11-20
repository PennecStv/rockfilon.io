"""`uv run rockfilon <commande>` : outils de contenu et d'admin."""

import argparse

from rockfilon import pipeline


def main() -> None:
    parser = argparse.ArgumentParser(prog="rockfilon")
    sub = parser.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="construit le JSON et le rapport de contrôle d'une ou plusieurs questions")
    b.add_argument("ids", nargs="*", help="identifiants (défaut : toutes les questions)")
    args = parser.parse_args()

    if args.cmd == "build":
        ids = args.ids or sorted(p.stem for p in (pipeline.CONTENT / "questions").glob("*.yaml"))
        for qid in ids:
            path = pipeline.build(qid)
            print(f"{qid} -> {path.relative_to(pipeline.CONTENT.parent)}")


if __name__ == "__main__":
    main()
