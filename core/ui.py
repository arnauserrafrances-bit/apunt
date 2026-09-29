"""Utilitats compartides per a les pantalles de Streamlit."""

from __future__ import annotations

import sqlite3
from datetime import date

import streamlit as st

from core import config, db

TERM_KEY = "current_term"


def get_conn() -> sqlite3.Connection:
    return db.connect()


def default_term(today: date | None = None) -> int:
    """Trimestre escolar aproximat segons la data (setembre-desembre = 1r...)."""
    month = (today or date.today()).month
    if month >= 9:
        return 1
    if month <= 3:
        return 2
    return 3


def term_selector() -> None:
    """Selector «Trimestre actual» a la barra lateral, compartit per totes les pantalles."""
    if TERM_KEY not in st.session_state:
        st.session_state[TERM_KEY] = default_term()
    st.sidebar.radio(
        "Trimestre actual",
        options=list(config.TERMS),
        format_func=config.TERMS.get,
        key=TERM_KEY,
    )


def current_term() -> int:
    return st.session_state.get(TERM_KEY, default_term())


def student_label(student: sqlite3.Row) -> str:
    return f"{student['code']} · {db.full_name(student)}"


def flash(message: str, kind: str = "success") -> None:
    """Guarda un missatge per mostrar-lo a la següent execució de la pàgina."""
    st.session_state.setdefault("_flash", []).append((kind, message))


def show_flash() -> None:
    for kind, message in st.session_state.pop("_flash", []):
        getattr(st, kind)(message)


def n_notes(n: int) -> str:
    return f"{n} {'nota' if n == 1 else 'notes'}"
