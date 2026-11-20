"""Tous les réglages du jeu au même endroit (API, pipeline et front via /api/daily)."""

import datetime as dt

QUESTIONS_PER_DAY = 7
SECONDS_PER_QUESTION = 25
GRACE_SECONDS = 2  # marge réseau tolérée par le serveur
TIMEZONE = "Europe/Paris"
LAUNCH_DATE = dt.date(2026, 12, 1)  # plongée n° 1 ; les numéros suivent le calendrier

METERS_PER_POINT = 4

# palier: (minerai, points, emoji de partage)
TIERS = {
    1: ("Charbon", 5, "⬛"),
    2: ("Fer", 15, "🟫"),
    3: ("Or", 35, "🟨"),
    4: ("Émeraude", 60, "🟩"),
    5: ("Diamant", 85, "💎"),
    6: ("Béryl rouge", 100, "🔴"),
}
PEPITE_TIER = 6
MISS_EMOJI = "⬜"

# Rareté a priori : rang de familiarité (1 = la plus connue de la question) à partir duquel
# on bascule vers le palier suivant. Défaut : 3 % charbon, 7 % fer, 15 % or, 25 % émeraude, 50 % diamant.
DEFAULT_QUANTILES = (0.97, 0.90, 0.75, 0.50)

# Rareté observée : part minimale des joueurs du jour pour rester dans le palier 1, 2, 3, 4 (sinon 5).
OBSERVED_THRESHOLDS = (0.25, 0.10, 0.04, 0.01)
OBSERVED_FULL_WEIGHT_PLAYERS = 500  # w = min(1, n / 500)

# Garde-fou fautes de frappe : mots du Lexique (fréquence par million) assez courants pour être tapés par erreur.
LEXIQUE_NEIGHBOR_MIN_FREQ = 1.0
