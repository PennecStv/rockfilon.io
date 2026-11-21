# Projet : rockfilon.io

Tu vas construire **rockfilon.io**, un jeu de culture générale quotidien **en français** où l'on gagne en donnant des réponses **valides mais rares**. Les réponses évidentes rapportent peu ; les réponses obscures font creuser plus profond dans la roche.

Inspiration : le principe de krillion.io (jeu anglophone, thème océan). **Ne copie ni son code, ni ses textes, ni son identité visuelle** : rockfilon a sa propre identité, son propre thème (creuser sous terre) et doit atteindre un niveau de finition au moins équivalent.

Commence en **mode plan** : lis tout ce document, propose une architecture et un découpage en étapes, pose-moi tes questions bloquantes, puis attends ma validation avant de coder.

---

## 1. Règles du jeu

- **Plongée du jour** : 7 questions, les mêmes pour tout le monde, renouvelées à **minuit heure de Paris** (Europe/Paris).
- **25 secondes** par question, **une seule réponse** par question.
- Questions ouvertes à réponses multiples, ex. : « Cite un os du corps humain », « Cite un fromage français », « Cite une commune de Bretagne », « Cite un instrument à cordes ».
- Réponse valide → points selon sa **rareté** + gain de profondeur (en mètres). Réponse invalide ou temps écoulé → 0, on reste sur place.
- Fin de partie : récapitulatif (profondeur atteinte, minerai obtenu par question, réponses les plus rares que les autres ont trouvées), et **résultat partageable** façon Wordle, sans spoiler les réponses :
  ```
  rockfilon #12 — 1 840 m ⛏️
  ⬛🟫🟨🟩💎⬛🔴
  rockfilon.io
  ```
- Une partie par jour et par joueur (stockage local + identifiant anonyme ; comptes facultatifs plus tard).

## 2. Paliers de rareté (du plus commun au plus rare)

| Palier | Minerai | Points | Emoji partage | Sens |
|---|---|---|---|---|
| 1 | **Charbon** | 5 | ⬛ | réponse évidente |
| 2 | **Fer** | 15 | 🟫 | courante |
| 3 | **Or** | 35 | 🟨 | peu courante |
| 4 | **Émeraude** | 60 | 🟩 | rare |
| 5 | **Diamant** | 85 | 💎 | très rare |
| 6 | **Béryl rouge** (bixbite) | 100 | 🔴 | **la pépite du jour** : une seule réponse par question, choisie à la main |

- Les paliers 1 à 5 sont calculés (cf. §4). Le **béryl rouge** n'est pas seulement « le plus rare » : c'est la réponse que je désigne pour chaque question parce qu'elle est à la fois obscure, juste et satisfaisante à trouver. Il doit rester trouvable par au moins quelques joueurs.
- Profondeur : `mètres = points × 4` (paramètre ajustable). Les valeurs sont à centraliser dans une config.

## 3. Validation des réponses

La validation **ne passe pas par un LLM en direct**. Chaque question a une **liste fermée de réponses acceptées**, préparée hors ligne, avec ses alias.

Normalisation (même fonction côté pipeline et côté serveur, testée unitairement) :
- minuscules, suppression des accents (`écureuil` = `ecureuil`), des espaces superflus, de la ponctuation, des traits d'union (`saint-nectaire` = `saint nectaire`) ;
- suppression des articles et déterminants en tête : le, la, l', les, un, une, des, du, de la ;
- singulier/pluriel ramenés à la même forme (règles simples : -s, -x, -aux/-al…, plus les alias explicites) ;
- ligatures : `œ` = `oe`, `æ` = `ae`.

Tolérance aux fautes : distance de Damerau-Levenshtein ≤ 0 si moins de 5 caractères, ≤ 1 jusqu'à 8, ≤ 2 au-delà. **Garde-fou** : au moment de construire une question, détecter les paires de réponses ou d'alias trop proches qui produiraient une fausse correspondance (piège type « sea donkey » / « sea monkey ») et les signaler dans un rapport ; dans ce cas, exiger une correspondance exacte.

La liste des réponses **ne doit jamais être envoyée au navigateur** : le client envoie la saisie, le serveur répond (valide ? forme canonique, palier, points, % des joueurs). Une seule soumission par question et par joueur, contrôlée côté serveur, chronomètre vérifié côté serveur (marge de 2 s).

## 4. Rareté

Deux sources, combinées :

**a) Rareté a priori** (indispensable au lancement, calculée par le pipeline) :
- noms communs → fréquence dans **Lexique 3** (lexique.org, colonnes `freqfilms2` / `freqlivres`) ;
- noms propres et entités → **vues des pages Wikipédia FR** sur 12 mois (API Wikimedia Pageviews) et/ou nombre de liens Wikidata (`wikibase:sitelinks`) ;
- cas qui ne se réduisent pas à un chiffre → score proposé par un LLM, puis relu par moi ;
- chaque réponse reçoit un score de familiarité normalisé, converti en palier 1 à 5 **par quantiles propres à chaque question** (seuils ajustables dans le fichier de la question).

**b) Rareté observée** (une fois qu'il y a des joueurs) : % des joueurs du jour ayant donné cette réponse. Palier final = mélange des deux, avec un poids de l'observé qui augmente avec le nombre de joueurs (ex. `w = min(1, n / 500)`). Les paliers affichés en fin de partie peuvent évoluer pendant la journée ; les points d'un joueur sont figés au moment où il répond.

## 5. Pipeline de contenu (le cœur du projet)

Script Python en ligne de commande (`content/`) qui, pour une question décrite en YAML, produit un JSON prêt à charger :

```yaml
id: os-du-corps-humain
prompt: "Cite un os du corps humain"
sources:
  - type: wikidata_sparql
    query: |  # instances/sous-classes de « os » (Q265868), libellés et alias FR
      ...
  - type: liste_manuelle
    fichier: extras/os.txt
rarete: lexique        # lexique | pageviews | sitelinks | llm
pepite: "os hyoïde"     # béryl rouge
exclure: [...]
```

Étapes : récupération → fusion → normalisation → dédoublonnage par forme canonique → calcul de rareté → attribution des paliers → rapport de contrôle (nombre de réponses, répartition par palier, collisions de fautes de frappe, 30 exemples par palier) que je relis avant publication.

Livre **20 questions françaises** de catégories variées (corps humain, gastronomie, géographie de France, animaux, musique, sciences, histoire, langue française…), chacune avec au moins 150 réponses valides et une vraie longue traîne. Mets le cache des requêtes sur disque pour ne pas réinterroger Wikidata à chaque build.

Un petit outil d'admin (CLI suffit) : planifier les questions par date, désigner/changer la pépite, ajouter un alias ou une réponse oubliée signalée par un joueur.

## 6. Stack technique

- **Backend** : Python 3.12, FastAPI, PostgreSQL (SQLAlchemy 2 + Alembic), Pydantic. Je connais bien cette stack.
- **Frontend** : React + TypeScript + Vite, Tailwind CSS, Motion (Framer Motion) pour les animations. Propose une alternative si tu as un meilleur argument.
- Docker Compose pour le dev (api + db + front). Tests : pytest (normalisation, fautes de frappe, paliers, anti-triche) et Playwright pour un parcours de partie complet.
- Endpoints indicatifs : `GET /api/daily`, `POST /api/answer`, `GET /api/daily/results`, `GET /api/archive`.

## 7. Design : exigence haute

Le jeu doit être **beau, singulier et soigné**, pas un template générique. Mobile d'abord (on joue sur téléphone), parfait aussi sur desktop.

Direction artistique :
- **Coupe géologique verticale** : l'écran est une tranche de terrain. On part de la surface (herbe, ciel) et chaque bonne réponse fait descendre la caméra à travers des **strates** successives : terre végétale → argile → calcaire → grès → schiste → granite → roche profonde rougeoyante près du magma. Le dégradé et la texture changent avec la profondeur ; un compteur de mètres s'anime.
- Chaque réponse validée fait **apparaître le minerai correspondant** incrusté dans la roche (charbon mat, fer rouillé, pépite d'or, cristal d'émeraude, diamant, béryl rouge qui brille), avec une animation de coup de pioche, des éclats et un léger tremblement. Le béryl rouge a droit à un moment spécial : lueur, particules, son.
- Palette sombre et minérale, accents lumineux pour les gemmes. Lumière de lampe frontale ou de casque de mineur qui éclaire la zone de jeu.
- Typographie avec du caractère (une display pour les titres et les chiffres, une sans-serif très lisible pour le texte) ; choisis des polices libres (Google Fonts ou Fontshare) et justifie ton choix.
- Le chronomètre doit être lisible et tendu (ex. une mèche ou une lampe qui faiblit), sans être stressant à l'excès.
- Micro-interactions partout : saisie, validation, erreur (la pioche rebondit sur la roche), transitions entre questions. Respecter `prefers-reduced-motion`.
- Sons discrets désactivables (coup de pioche, tintement de gemme).
- Illustrations en **SVG** faites maison, pas d'images génériques, pas d'emojis dans l'interface (seulement dans le texte de partage).
- Accessibilité : contrastes AA, navigation clavier, saisie avec le clavier mobile bien gérée (pas de saut de mise en page quand le clavier s'ouvre).

Écrans à livrer : accueil (avec la « plongée du jour » et le numéro), règles en 3 étapes illustrées, partie, fin de partie et partage, archive, statistiques personnelles (série, profondeur max, collection de minerais trouvés).

Tous les textes de l'interface sont en français naturel, tutoiement, ton complice et un peu mineur de fond (« Bien creusé ! », « Filon épuisé », « Tu as touché le béryl rouge »).

## 8. Ordre de travail souhaité

1. Plan + questions → validation.
2. Pipeline de contenu + 3 questions de test + rapport de contrôle.
3. Backend (modèles, API, validation, anti-triche, tests).
4. Frontend : d'abord une maquette statique de l'écran de jeu pour valider la direction artistique, **montre-la-moi avant d'aller plus loin**, puis le jeu complet.
5. Les 17 autres questions, l'archive, les stats, le partage.
6. README : lancer le projet, ajouter une question, déployer.

Fais des commits petits et clairs à chaque étape.
