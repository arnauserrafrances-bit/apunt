from datetime import date

import pytest

from core import config, db


@pytest.fixture
def conn(tmp_path):
    return db.connect(tmp_path / "test.db")


# ---------------------------------------------------------------- Alumnes


def test_default_areas_loaded_once(conn, tmp_path):
    assert [a["name"] for a in db.list_areas(conn)] == config.DEFAULT_AREAS
    # Tornar a obrir no les duplica ni les torna a crear si s'han esborrat.
    db.delete_area(conn, db.list_areas(conn)[0]["id"])
    again = db.connect(tmp_path / "test.db")
    assert len(db.list_areas(again)) == len(config.DEFAULT_AREAS) - 1


def test_codes_are_sequential_and_never_reused(conn):
    a = db.add_student(conn, "Maria", "Puig")
    b = db.add_student(conn, "Jordi", "Vila")
    assert (a["code"], b["code"]) == ("A-01", "A-02")
    db.delete_student(conn, b["id"])
    c = db.add_student(conn, "Laia", "Roca")
    assert c["code"] == "A-03"


def test_single_student_requires_first_and_last_name(conn):
    with pytest.raises(db.DataError):
        db.add_student(conn, "Maria", "  ")
    with pytest.raises(db.DataError):
        db.add_student(conn, "", "Puig")


def test_single_student_duplicate_rejected(conn):
    db.add_student(conn, "Maria", "Puig Soler")
    with pytest.raises(db.DataError):
        db.add_student(conn, " maria ", "puig  soler")


def test_parse_name_line():
    assert db.parse_name_line("Maria Puig Soler") == ("Maria", "Puig Soler")
    assert db.parse_name_line("García López, Ana María") == ("Ana María", "García López")
    assert db.parse_name_line("Maria") is None
    assert db.parse_name_line("Puig,") is None


def test_bulk_add_reports_invalid_and_duplicates(conn):
    db.add_student(conn, "Maria", "Puig")
    text = "Maria Puig\n\nJordi Vila\nPau\nJordi  Vila\nGarcía López, Ana María\n"
    result = db.add_students_bulk(conn, text)
    assert [db.full_name(s) for s in result["added"]] == ["Jordi Vila", "Ana María García López"]
    assert result["invalid"] == ["Pau"]
    assert result["duplicates"] == ["Maria Puig", "Jordi Vila"]
    assert [s["code"] for s in db.list_students(conn)] == ["A-01", "A-02", "A-03"]


def test_delete_student_cascades_notes(conn):
    s = db.add_student(conn, "Maria", "Puig")
    area = db.list_areas(conn)[0]["id"]
    db.add_note(conn, s["id"], area, "Llegeix amb fluïdesa", date(2026, 10, 1), 1)
    db.add_note(conn, s["id"], area, "Participa molt", date(2026, 10, 2), 1)
    assert db.count_student_notes(conn, s["id"]) == 2
    db.delete_student(conn, s["id"])
    assert db.list_notes(conn) == []


# ---------------------------------------------------------------- Àrees


def test_area_add_rename_and_uniqueness(conn):
    db.add_area(conn, "Tutoria")
    with pytest.raises(db.DataError):
        db.add_area(conn, "tutoria")
    area = db.list_areas(conn)[-1]
    assert area["name"] == "Tutoria"
    db.rename_area(conn, area["id"], "Acció tutorial")
    assert db.list_areas(conn)[-1]["name"] == "Acció tutorial"
    with pytest.raises(db.DataError):
        db.rename_area(conn, area["id"], "Matemàtiques")


def test_cannot_delete_area_with_notes_until_moved(conn):
    s = db.add_student(conn, "Maria", "Puig")
    src, dst = [a["id"] for a in db.list_areas(conn)[:2]]
    db.add_note(conn, s["id"], src, "Nota", date(2026, 10, 1), 1)
    with pytest.raises(db.DataError, match="esborra o mou"):
        db.delete_area(conn, src)
    assert db.move_area_notes(conn, src, dst) == 1
    db.delete_area(conn, src)
    assert db.list_notes(conn)[0]["area_id"] == dst


def test_move_area_order(conn):
    first, second = db.list_areas(conn)[:2]
    db.move_area(conn, second["id"], -1)
    assert [a["id"] for a in db.list_areas(conn)[:2]] == [second["id"], first["id"]]


# ---------------------------------------------------------------- Notes


def test_note_crud_and_filters(conn):
    s1 = db.add_student(conn, "Maria", "Puig")
    s2 = db.add_student(conn, "Jordi", "Vila")
    cat, mat = [a["id"] for a in db.list_areas(conn)[:4:3]]
    n1 = db.add_note(conn, s1["id"], cat, "Lectura", date(2026, 10, 1), 1)
    db.add_note(conn, s1["id"], mat, "Càlcul", date(2027, 1, 20), 2)
    db.add_note(conn, s2["id"], cat, "Escriptura", date(2026, 10, 3), 1)

    assert len(db.list_notes(conn, student_id=s1["id"])) == 2
    assert len(db.list_notes(conn, student_id=s1["id"], term=1)) == 1
    assert len(db.list_notes(conn, area_id=cat)) == 2
    assert len(db.list_notes(conn, student_id=s1["id"], area_id=mat, term=2)) == 1

    db.update_note(conn, n1, mat, "Lectura revisada", date(2026, 10, 5), 1)
    note = db.list_notes(conn, student_id=s1["id"], term=1)[0]
    assert (note["text"], note["area_id"], note["date"]) == ("Lectura revisada", mat, "2026-10-05")

    db.delete_note(conn, n1)
    assert len(db.list_notes(conn, student_id=s1["id"])) == 1


def test_empty_note_rejected(conn):
    s = db.add_student(conn, "Maria", "Puig")
    with pytest.raises(db.DataError):
        db.add_note(conn, s["id"], db.list_areas(conn)[0]["id"], "   ", date.today(), 1)
