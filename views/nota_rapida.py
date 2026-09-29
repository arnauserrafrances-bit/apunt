"""Nota ràpida: alumne → àrea → text → Desa."""

from datetime import date

import streamlit as st

from core import config, db, ui

conn = ui.get_conn()
students = db.list_students(conn)
areas = db.list_areas(conn)

st.title("Nota ràpida")
ui.show_flash()

if not students:
    st.info("Encara no hi ha alumnes a la classe.")
    st.page_link("views/alumnes.py", label="Afegeix alumnes", icon="👥")
    st.stop()
if not areas:
    st.info("No hi ha cap àrea definida.")
    st.page_link("views/arees.py", label="Afegeix àrees", icon="📚")
    st.stop()

student_by_id = {s["id"]: s for s in students}
area_by_id = {a["id"]: a for a in areas}
term = ui.current_term()


def save() -> None:
    try:
        db.add_note(
            conn,
            student_id=st.session_state["qn_student"],
            area_id=st.session_state["qn_area"],
            text=st.session_state["qn_text"],
            note_date=st.session_state["qn_date"],
            term=term,
        )
    except db.DataError as e:
        ui.flash(str(e), "error")
        return
    student = student_by_id[st.session_state["qn_student"]]
    area = area_by_id[st.session_state["qn_area"]]
    ui.flash(f"Nota desada: {student['code']} · {area['name']} · {config.TERMS[term]}")
    st.session_state["qn_text"] = ""


# Si s'ha esborrat l'alumne o l'àrea seleccionats, tornem a la primera opció.
if st.session_state.get("qn_student") not in student_by_id:
    st.session_state.pop("qn_student", None)
if st.session_state.get("qn_area") not in area_by_id:
    st.session_state.pop("qn_area", None)

with st.form("quick_note"):
    col1, col2 = st.columns(2)
    col1.selectbox(
        "Alumne",
        options=list(student_by_id),
        format_func=lambda sid: ui.student_label(student_by_id[sid]),
        key="qn_student",
    )
    col2.selectbox(
        "Àrea",
        options=list(area_by_id),
        format_func=lambda aid: area_by_id[aid]["name"],
        key="qn_area",
    )
    st.text_area(
        "Nota",
        key="qn_text",
        height=110,
        placeholder="Què has observat? (Ctrl/Cmd + Enter per desar)",
    )
    col_btn, col_term, col_date = st.columns([1, 2, 1.3], vertical_alignment="bottom")
    col_btn.form_submit_button("Desa", type="primary", on_click=save, use_container_width=True)
    col_term.markdown(
        f"Es desarà al **:blue-background[{config.TERMS[term]}]**  \n"
        ":gray[Canvia'l a la barra lateral]"
    )
    col_date.date_input("Data", value=date.today(), key="qn_date", format="DD/MM/YYYY")

recent = db.list_notes(conn)
recent = sorted(recent, key=lambda n: n["created_at"], reverse=True)[:5]
if recent:
    st.divider()
    st.caption("Últimes notes desades")
    for n in recent:
        st.markdown(
            f"**{n['student_code']}** · {n['area_name']} · {config.TERMS[n['term']]}  \n{n['text']}"
        )
