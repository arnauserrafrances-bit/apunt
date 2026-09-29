"""Llista de clase: enganxar la llista sencera, afegir i esborrar alumnes."""

import streamlit as st

from core import db, ui

conn = ui.get_conn()

st.title("Alumnes")
ui.show_flash()


def add_bulk() -> None:
    result = db.add_students_bulk(conn, st.session_state["bulk_text"])
    st.session_state["bulk_result"] = {
        "added": [ui.student_label(s) for s in result["added"]],
        "invalid": result["invalid"],
        "duplicates": result["duplicates"],
    }
    # Deixem a la caixa només les línies que han fallat, per poder-les corregir.
    st.session_state["bulk_text"] = "\n".join(result["invalid"] + result["duplicates"])


def add_one() -> None:
    try:
        student = db.add_student(conn, st.session_state["new_first"], st.session_state["new_last"])
    except db.DataError as e:
        ui.flash(str(e), "error")
        return
    ui.flash(f"Afegit: {ui.student_label(student)}")
    st.session_state["new_first"] = ""
    st.session_state["new_last"] = ""


def confirm_delete(student_id: int) -> None:
    student = db.get_student(conn, student_id)
    db.delete_student(conn, student_id)
    st.session_state.pop("pending_delete", None)
    ui.flash(f"S'ha esborrat {ui.student_label(student)}.")


tab_bulk, tab_one = st.tabs(["Enganxa la llista", "Afegeix un alumne"])

with tab_bulk:
    st.text_area(
        "Un alumne per línia",
        key="bulk_text",
        height=200,
        placeholder="Maria Puig Soler\nJordi Vila Roca\nGarcía López, Ana María",
        help="Formats: «Nom Cognoms» (la primera paraula és el nom) o «Cognoms, Nom» "
        "si el nom és compost.",
    )
    st.button("Afegeix alumnes", on_click=add_bulk, type="primary")

    result = st.session_state.pop("bulk_result", None)
    if result:
        if result["added"]:
            st.success(
                f"S'han afegit {len(result['added'])} alumnes: " + ", ".join(result["added"])
            )
        if result["invalid"]:
            st.error(
                "No s'han afegit aquestes línies perquè falta el nom o els cognoms "
                "(cal com a mínim dues paraules):\n\n"
                + "\n".join(f"- {line}" for line in result["invalid"])
            )
        if result["duplicates"]:
            st.warning(
                "No s'han afegit aquests alumnes perquè ja són a la classe:\n\n"
                + "\n".join(f"- {line}" for line in result["duplicates"])
            )
        if not any(result.values()):
            st.info("La llista estava buida.")

with tab_one:
    col1, col2 = st.columns(2)
    col1.text_input("Nom", key="new_first")
    col2.text_input("Cognoms", key="new_last")
    st.button("Afegeix", on_click=add_one, type="primary")

st.divider()
students = db.list_students(conn)
st.subheader(f"Classe ({len(students)} alumnes)")

if not students:
    st.caption("Encara no hi ha cap alumne.")

pending = st.session_state.get("pending_delete")

for s in students:
    col_code, col_name, col_notes, col_del = st.columns(
        [1, 4, 1.4, 1.2], vertical_alignment="center"
    )
    col_code.markdown(f"**{s['code']}**")
    col_name.write(db.full_name(s))
    col_notes.caption(ui.n_notes(s['note_count']))
    if col_del.button("Esborra", key=f"del_{s['id']}"):
        st.session_state["pending_delete"] = s["id"]
        st.rerun()

    if pending == s["id"]:
        n = s["note_count"]
        with st.container(border=True):
            st.warning(
                f"Segur que vols esborrar **{ui.student_label(s)}**? "
                + (
                    f"Això també esborrarà **{n} {'nota' if n == 1 else 'notes'}**."
                    if n
                    else "No té cap nota."
                )
                + f" El codi {s['code']} no es tornarà a fer servir."
            )
            c1, c2, _ = st.columns([1.3, 1, 3])
            c1.button(
                "Sí, esborra",
                key=f"confirm_{s['id']}",
                type="primary",
                on_click=confirm_delete,
                args=(s["id"],),
            )
            if c2.button("Cancel·la", key=f"cancel_{s['id']}"):
                st.session_state.pop("pending_delete", None)
                st.rerun()
