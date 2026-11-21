# rockfilon

Jeu quotidien de culture générale en français : chaque jour, 7 questions ouvertes. Les réponses évidentes grattent la surface, les réponses valides mais rares font creuser profond.

Le principe s'inspire de krillion.io. Le code, les textes et l'identité visuelle (une mine en pixel art) sont propres à rockfilon.

## Le jeu

- **7 questions par jour**, les mêmes pour tout le monde, renouvelées à minuit (heure de Paris).
- **25 secondes** par question et une seule réponse. Le chrono est vérifié par le serveur.
- Une réponse valide rapporte des points selon sa rareté et fait descendre de `points × 4` mètres :

| Minerai | Points | Sens |
|---|---|---|
| Charbon | 5 | réponse évidente |
| Fer | 15 | courante |
| Or | 35 | peu courante |
| Émeraude | 60 | rare |
| Diamant | 85 | très rare |
| Béryl rouge | 100 | la pépite du jour, une par question, choisie à la main |

- En fin de partie : la coupe du terrain creusé, la pépite révélée, ce que les autres ont trouvé et un résultat à partager sans spoiler.

Tous ces réglages sont dans `rockfilon/config.py`.

## Stack

- **Backend** : Python 3.12, FastAPI, PostgreSQL (SQLAlchemy 2, Alembic), géré avec [uv](https://docs.astral.sh/uv/).
- **Front** : Vite, React, TypeScript, Tailwind CSS v4, Motion. Le décor est dessiné sur un canvas basse résolution ; polices Jersey 10 et Pixelify Sans.
- **Contenu** : pipeline Python qui construit les listes de réponses depuis Wikidata et des listes manuelles.

```
rockfilon/      API, modèles, normalisation des réponses (text.py), pipeline, CLI
content/        questions (YAML), listes manuelles, scores relus, JSON construits, rapports
web/            le site (Vite + React)
alembic/        migrations
tests/          pytest
scripts/        partager.ps1 (tunnel de test)
```

## Lancer le projet

Prérequis : Docker Desktop, uv et Node 24.

```bash
docker compose up
```

Cette commande démarre Postgres, applique les migrations, charge les questions construites, puis sert l'API et le site sur **http://127.0.0.1:8000**.

Pour travailler sur le front avec rechargement à chaud, en laissant l'API tourner :

```bash
cd web
npm install
npm run dev        # http://localhost:5173, /api est relayé vers 127.0.0.1:8000
```

Pour lancer les tests :

```bash
docker compose up -d db   # les tests d'API ont besoin de Postgres, sinon ils sont sautés
uv run pytest
```

## Ajouter une question

1. Crée `content/questions/<id>.yaml` :

   ```yaml
   id: instruments-a-cordes
   prompt: "Cite un instrument à cordes"
   categorie: musique
   sources:
     - type: wikidata_sparql          # doit sélectionner ?item et ?label ; ?alias, ?article, ?sitelinks au choix
       query: |
         SELECT ?item ?label ?alias ?sitelinks WHERE { … }
     - type: liste_manuelle           # une réponse par ligne : « libellé | alias | alias »
       fichier: extras/instruments-a-cordes.txt
   rarete: sitelinks                  # lexique | pageviews | sitelinks | llm
   pepite: "épinette des Vosges"      # le béryl rouge
   exclure: [cordophone]              # libellés à écarter
   alias:                             # alias de confiance ; ils peuvent absorber une autre réponse
     guitare basse: [basse électrique]
   quantiles: [0.97, 0.90, 0.75, 0.50]  # facultatif : seuils charbon / fer / or / émeraude
   ```

   Une liste manuelle fait foi sur Wikidata. Avec `enrichir_seulement: true`, une source Wikidata n'apporte que des alias aux réponses déjà connues.

2. Construis la question et relis son rapport :

   ```bash
   uv run rockfilon build <id>      # -> content/build/<id>.json et content/reports/<id>.md
   ```

   Le rapport donne le nombre de réponses, la répartition par palier, les réponses sans score, les pièges à fautes de frappe et des exemples par palier. Les requêtes Wikidata et Pageviews sont mises en cache dans `content/.cache/`.

3. Si la rareté calculée sonne faux, corrige-la dans `content/scores/<id>.csv`. Ce fichier contient une ligne `reponse;score;justification` par réponse, avec un score de 0 à 100, où 100 signifie que tout le monde la cite. Il l'emporte sur la source automatique, et `rarete: llm` l'utilise seul.

4. Charge la question en base :

   ```bash
   uv run rockfilon load <id>
   ```

### Administration

```bash
uv run rockfilon planning                          # les 30 prochains jours, alerte si le planning s'épuise
uv run rockfilon schedule 2026-12-01 id1 … id7     # planifie les 7 questions d'un jour
uv run rockfilon pepite <id> "réponse"             # change la pépite, puis build + load
uv run rockfilon add <id> "réponse" [alias…] [--score 40]   # réponse oubliée ou alias signalé par un joueur
```

Un jour sans planning, le serveur tire automatiquement 7 questions parmi les moins récemment jouées.

## Faire tester à distance

```powershell
.\scripts\partager.ps1
```

Le script lance l'API et le site dans Docker, puis ouvre un tunnel Cloudflare gratuit et sans compte. Il affiche une adresse `https://….trycloudflare.com` à envoyer ; `Ctrl+C` coupe le tunnel. Seul le port 8000 est exposé, et l'adresse change à chaque lancement.

## Déployer

Le `Dockerfile` produit une seule image : le site est construit puis servi par l'API, sur la même origine. Il faut :

1. **Une base PostgreSQL**, managée ou non.
2. **L'image lancée** sur n'importe quel hébergeur de conteneurs, avec la variable `DATABASE_URL=postgresql+psycopg://utilisateur:motdepasse@hôte:5432/base`. Au démarrage, elle applique les migrations (`alembic upgrade head`) et sert le jeu sur le port 8000.
3. **Le contenu chargé** une première fois, puis à chaque nouvelle question :

   ```bash
   docker run --rm -e DATABASE_URL=… <image> rockfilon load
   ```

Avant l'ouverture au public, fixe `LAUNCH_DATE` dans `rockfilon/config.py` : c'est la date de la plongée n°1.

## Données et licences

- Réponses : [Wikidata](https://www.wikidata.org) (CC0) et listes manuelles du projet.
- Rareté : [Lexique 3](http://www.lexique.org), statistiques de consultation de Wikipédia (API Wikimedia), nombre de liens interlangues Wikidata, et scores relus à la main.
- Polices : Jersey 10 et Pixelify Sans, sous licence SIL Open Font License.
- Code : licence MIT, voir `LICENSE`.
