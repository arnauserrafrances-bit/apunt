"""Configuració central de l'aplicació.

Canvia APP_NAME aquí per reanomenar l'aplicació a tot arreu.
"""

import os
from pathlib import Path

APP_NAME = "Apunt"
APP_TAGLINE = "Notes i informes d'avaluació per a tutors de primària"

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
# APUNT_DB permet fer servir una altra base de dades (p. ex. per a proves)
DB_PATH = Path(os.environ.get("APUNT_DB", DATA_DIR / "apunt.db"))

# Codis d'alumne: A-01, A-02... (mínim 2 dígits)
STUDENT_CODE_PREFIX = "A-"
STUDENT_CODE_DIGITS = 2

DEFAULT_AREAS = [
    "Llengua catalana i literatura",
    "Llengua castellana i literatura",
    "Llengua estrangera (anglès)",
    "Matemàtiques",
    "Coneixement del medi natural, social i cultural",
    "Educació artística",
    "Educació física",
]

TERMS = {1: "1r trimestre", 2: "2n trimestre", 3: "3r trimestre"}

# Models (s'utilitzaran als passos 3 i 4)
WRITER_MODEL = "claude-sonnet-5"
REVIEWER_MODEL = "claude-haiku-4-5-20251001"
