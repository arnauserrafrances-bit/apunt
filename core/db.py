"""Capa de dades: esquema SQLite i totes les operacions sobre alumnes, àrees i notes.

Els noms reals dels alumnes només viuen en aquesta base de dades local.
"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime
from pathlib import Path

from core import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
    id          INTEGER PRIMARY KEY,
    code        TEXT NOT NULL UNIQUE,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    position  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY,
    student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    area_id     INTEGER NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    text        TEXT NOT NULL,
    date        TEXT NOT NULL,
    term        INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_student ON notes(student_id);
CREATE INDEX IF NOT EXISTS idx_notes_area ON notes(area_id);
"""


class DataError(ValueError):
    """Error de validació amb un missatge en català per mostrar a la tutora."""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def connect(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Obre la base de dades (i la crea amb les àrees per defecte si no existeix)."""
    path = Path(db_path) if db_path else config.DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    _init(conn)
    return conn


def _init(conn: sqlite3.Connection) -> None:
    with conn:
        conn.executescript(SCHEMA)
        seeded = conn.execute("SELECT value FROM meta WHERE key = 'areas_seeded'").fetchone()
        if not seeded:
            for pos, name in enumerate(config.DEFAULT_AREAS):
                conn.execute(
                    "INSERT OR IGNORE INTO areas (name, position) VALUES (?, ?)", (name, pos)
                )
            conn.execute("INSERT INTO meta (key, value) VALUES ('areas_seeded', '1')")
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('next_student_number', '1')"
        )


# ---------------------------------------------------------------- Alumnes


def _clean(text: str) -> str:
    return " ".join(text.split())


def _name_key(first_name: str, last_name: str) -> str:
    return f"{_clean(first_name)} {_clean(last_name)}".casefold()


def format_code(number: int) -> str:
    return f"{config.STUDENT_CODE_PREFIX}{number:0{config.STUDENT_CODE_DIGITS}d}"


def full_name(student: sqlite3.Row) -> str:
    return f"{student['first_name']} {student['last_name']}"


def parse_name_line(line: str) -> tuple[str, str] | None:
    """Converteix una línia en (nom, cognoms).

    Formats acceptats:
      - "Nom Cognom1 Cognom2"  -> la primera paraula és el nom
      - "Cognom1 Cognom2, Nom" -> amb coma, el nom va després
    Retorna None si no hi ha com a mínim nom i un cognom.
    """
    line = _clean(line)
    if "," in line:
        last, _, first = (part.strip() for part in line.partition(","))
        if first and last:
            return first, last
        return None
    words = line.split(" ")
    if len(words) < 2:
        return None
    return words[0], " ".join(words[1:])


def _existing_name_keys(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT first_name, last_name FROM students").fetchall()
    return {_name_key(r["first_name"], r["last_name"]) for r in rows}


def _insert_student(conn: sqlite3.Connection, first_name: str, last_name: str) -> sqlite3.Row:
    number = int(
        conn.execute("SELECT value FROM meta WHERE key = 'next_student_number'").fetchone()[0]
    )
    code = format_code(number)
    cur = conn.execute(
        "INSERT INTO students (code, first_name, last_name, created_at) VALUES (?, ?, ?, ?)",
        (code, _clean(first_name), _clean(last_name), _now()),
    )
    conn.execute(
        "UPDATE meta SET value = ? WHERE key = 'next_student_number'", (str(number + 1),)
    )
    return conn.execute("SELECT * FROM students WHERE id = ?", (cur.lastrowid,)).fetchone()


def add_student(conn: sqlite3.Connection, first_name: str, last_name: str) -> sqlite3.Row:
    if not _clean(first_name) or not _clean(last_name):
        raise DataError("El nom i els cognoms són obligatoris.")
    if _name_key(first_name, last_name) in _existing_name_keys(conn):
        raise DataError(
            f"Ja hi ha un alumne anomenat «{_clean(first_name)} {_clean(last_name)}» a la classe."
        )
    with conn:
        return _insert_student(conn, first_name, last_name)


def add_students_bulk(conn: sqlite3.Connection, text: str) -> dict[str, list]:
    """Afegeix una llista enganxada (un alumne per línia).

    Retorna {"added": [Row], "invalid": [línia], "duplicates": [línia]}.
    """
    result: dict[str, list] = {"added": [], "invalid": [], "duplicates": []}
    seen = _existing_name_keys(conn)
    with conn:
        for raw in text.splitlines():
            line = _clean(raw)
            if not line:
                continue
            parsed = parse_name_line(line)
            if parsed is None:
                result["invalid"].append(line)
                continue
            key = _name_key(*parsed)
            if key in seen:
                result["duplicates"].append(line)
                continue
            seen.add(key)
            result["added"].append(_insert_student(conn, *parsed))
    return result


def list_students(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT s.*, COUNT(n.id) AS note_count
        FROM students s LEFT JOIN notes n ON n.student_id = s.id
        GROUP BY s.id
        ORDER BY s.code
        """
    ).fetchall()


def get_student(conn: sqlite3.Connection, student_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()


def count_student_notes(conn: sqlite3.Connection, student_id: int) -> int:
    return conn.execute(
        "SELECT COUNT(*) FROM notes WHERE student_id = ?", (student_id,)
    ).fetchone()[0]


def delete_student(conn: sqlite3.Connection, student_id: int) -> None:
    """Esborra l'alumne i totes les seves notes. El codi no es reutilitza mai."""
    with conn:
        conn.execute("DELETE FROM students WHERE id = ?", (student_id,))


# ---------------------------------------------------------------- Àrees


def list_areas(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT a.*, COUNT(n.id) AS note_count
        FROM areas a LEFT JOIN notes n ON n.area_id = a.id
        GROUP BY a.id
        ORDER BY a.position, a.id
        """
    ).fetchall()


def _area_name_taken(conn: sqlite3.Connection, name: str, exclude_id: int | None = None) -> bool:
    row = conn.execute(
        "SELECT id FROM areas WHERE name = ? COLLATE NOCASE AND id IS NOT ?", (name, exclude_id)
    ).fetchone()
    return row is not None


def add_area(conn: sqlite3.Connection, name: str) -> None:
    name = _clean(name)
    if not name:
        raise DataError("El nom de l'àrea no pot estar buit.")
    if _area_name_taken(conn, name):
        raise DataError(f"Ja existeix l'àrea «{name}».")
    with conn:
        pos = conn.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM areas").fetchone()[0]
        conn.execute("INSERT INTO areas (name, position) VALUES (?, ?)", (name, pos))


def rename_area(conn: sqlite3.Connection, area_id: int, new_name: str) -> None:
    new_name = _clean(new_name)
    if not new_name:
        raise DataError("El nom de l'àrea no pot estar buit.")
    if _area_name_taken(conn, new_name, exclude_id=area_id):
        raise DataError(f"Ja existeix l'àrea «{new_name}».")
    with conn:
        conn.execute("UPDATE areas SET name = ? WHERE id = ?", (new_name, area_id))


def delete_area(conn: sqlite3.Connection, area_id: int) -> None:
    """Només es pot esborrar una àrea sense notes."""
    count = conn.execute("SELECT COUNT(*) FROM notes WHERE area_id = ?", (area_id,)).fetchone()[0]
    if count:
        raise DataError(
            f"Aquesta àrea té {count} {'nota' if count == 1 else 'notes'}. "
            "Abans d'esborrar-la, esborra o mou les seves notes a una altra àrea, "
            "o bé canvia-li el nom."
        )
    with conn:
        conn.execute("DELETE FROM areas WHERE id = ?", (area_id,))


def move_area_notes(conn: sqlite3.Connection, from_area_id: int, to_area_id: int) -> int:
    """Mou totes les notes d'una àrea a una altra. Retorna quantes s'han mogut."""
    if from_area_id == to_area_id:
        return 0
    with conn:
        cur = conn.execute(
            "UPDATE notes SET area_id = ?, updated_at = ? WHERE area_id = ?",
            (to_area_id, _now(), from_area_id),
        )
    return cur.rowcount


def move_area(conn: sqlite3.Connection, area_id: int, direction: int) -> None:
    """Mou l'àrea una posició amunt (-1) o avall (+1)."""
    ids = [r["id"] for r in list_areas(conn)]
    i = ids.index(area_id)
    j = i + direction
    if not 0 <= j < len(ids):
        return
    ids[i], ids[j] = ids[j], ids[i]
    with conn:
        for pos, aid in enumerate(ids):
            conn.execute("UPDATE areas SET position = ? WHERE id = ?", (pos, aid))


# ---------------------------------------------------------------- Notes


def _validate_note(text: str, term: int) -> str:
    text = text.strip()
    if not text:
        raise DataError("La nota no pot estar buida.")
    if term not in config.TERMS:
        raise DataError("Trimestre no vàlid.")
    return text


def add_note(
    conn: sqlite3.Connection,
    student_id: int,
    area_id: int,
    text: str,
    note_date: date,
    term: int,
) -> int:
    text = _validate_note(text, term)
    now = _now()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO notes (student_id, area_id, text, date, term, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (student_id, area_id, text, note_date.isoformat(), term, now, now),
        )
    return cur.lastrowid


def update_note(
    conn: sqlite3.Connection,
    note_id: int,
    area_id: int,
    text: str,
    note_date: date,
    term: int,
) -> None:
    text = _validate_note(text, term)
    with conn:
        conn.execute(
            """
            UPDATE notes SET area_id = ?, text = ?, date = ?, term = ?, updated_at = ?
            WHERE id = ?
            """,
            (area_id, text, note_date.isoformat(), term, _now(), note_id),
        )


def delete_note(conn: sqlite3.Connection, note_id: int) -> None:
    with conn:
        conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))


def list_notes(
    conn: sqlite3.Connection,
    student_id: int | None = None,
    area_id: int | None = None,
    term: int | None = None,
) -> list[sqlite3.Row]:
    sql = """
        SELECT n.*, a.name AS area_name, s.code AS student_code
        FROM notes n
        JOIN areas a ON a.id = n.area_id
        JOIN students s ON s.id = n.student_id
        WHERE 1 = 1
    """
    params: list = []
    if student_id is not None:
        sql += " AND n.student_id = ?"
        params.append(student_id)
    if area_id is not None:
        sql += " AND n.area_id = ?"
        params.append(area_id)
    if term is not None:
        sql += " AND n.term = ?"
        params.append(term)
    sql += " ORDER BY a.position, n.date DESC, n.id DESC"
    return conn.execute(sql, params).fetchall()
