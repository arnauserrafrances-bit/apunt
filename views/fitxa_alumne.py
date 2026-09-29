"""Fitxa de l'alumne: notes agrupades per àrea, amb filtres, edició i esborrat."""

from datetime import date

import streamlit as st

from core import config, db, ui

conn = ui.get_conn()
students = db.list_students(conn)
areas = db.list_areas(conn)

st.title("Fitxa de l'alumne")
ui.show_flash()

if not students:
    st.info("Encara no hi ha alumnes a la classe.")
    st.page_link("views/alumnes.py", label="Afegeix alumnes", icon="👥")
    st.stop()

student_by_id = {s["id"]: s for s in students}
area_by_id = {a["id"]: a for a in areas}
ALL = 0  # valor per a «Totes» / «Tots» als filtres

if st.session_state.get("fx_student") not in student_by_id:
    st.session_state.pop("fx_student", None)
if st.session_state.get("fx_area", ALL) not in [ALL, *area_by_id]:
    st.session_state.pop("fx_area", None)

st.selectbox(
    "Alumne",
    options=list(student_by_id),
    format_func=lambda sid: ui.student_label(student_by_id[sid]),
    key="fx_student",
)
col_area, col_term = st.columns(2)
col_area.selectbox(
    "Àrea",
    options=[ALL, *area_by_id],
    format_func=lambda aid: "Totes les àrees" if aid == ALL else area_by_id[aid]["name"],
    key="fx_area",
)
col_term.selectbox(
    "Trimestre",
    options=[ALL, *config.TERMS],
    format_func=lambda t: "Tots els trimestres" if t == ALL else config.TERMS[t],
    key="fx_term",
)

student_id = st.session_state["fx_student"]
area_filter = st.session_state["fx_area"] or None
term_filter = st.session_state["fx_term"] or None

notes = db.list_notes(conn, student_id=student_id, area_id=area_filter, term=term_filter)
notes_by_area: dict[int, list] = {}
for n in notes:
    notes_by_area.setdefault(n["area_id"], []).append(n)

shown_areas = [a for a in areas if area_filter is None or a["id"] == area_filter]
empty = [a["name"] for a in shown_areas if a["id"] not in notes_by_area]

st.caption(f"{ui.n_notes(len(notes))} amb aquests filtres")
if empty:
    st.warning(
        "Àrees sense cap nota"
        + (f" al {config.TERMS[term_filter]}" if term_filter else "")
        + ":\n\n"
        + "\n".join(f"- {name}" for name in empty)
    )


def save_edit(note_id: int) -> None:
    try:
        db.update_note(
            conn,
            note_id,
            area_id=st.session_state[f"ed_area_{note_id}"],
            text=st.session_state[f"ed_text_{note_id}"],
            note_date=st.session_state[f"ed_date_{note_id}"],
            term=st.session_state[f"ed_term_{note_id}"],
        )
    except db.DataError as e:
        ui.flash(str(e), "error")
        return
    st.session_state.pop("editing", None)
    ui.flash("Nota actualitzada.")


def confirm_delete(note_id: int) -> None:
    db.delete_note(conn, note_id)
    st.session_state.pop("deleting", None)
    ui.flash("Nota esborrada.")


def render_note(n) -> None:
    nid = n["id"]
    with st.container(border=True):
        if st.session_state.get("editing") == nid:
            st.selectbox(
                "Àrea", options=list(area_by_id), key=f"ed_area_{nid}",
                index=list(area_by_id).index(n["area_id"]),
                format_func=lambda aid: area_by_id[aid]["name"],
            )
            st.text_area("Nota", value=n["text"], key=f"ed_text_{nid}")
            c_date, c_term = st.columns(2)
            c_date.date_input(
                "Data", value=date.fromisoformat(n["date"]), key=f"ed_date_{nid}",
                format="DD/MM/YYYY",
            )
            c_term.selectbox(
                "Trimestre", options=list(config.TERMS), key=f"ed_term_{nid}",
                index=list(config.TERMS).index(n["term"]), format_func=config.TERMS.get,
            )
            c1, c2, _ = st.columns([1, 1, 3])
            c1.button("Desa", key=f"save_{nid}", type="primary", on_click=save_edit, args=(nid,))
            if c2.button("Cancel·la", key=f"cancel_ed_{nid}"):
                st.session_state.pop("editing", None)
                st.rerun()
            return

        d = date.fromisoformat(n["date"]).strftime("%d/%m/%Y")
        st.caption(f"{d} · {config.TERMS[n['term']]}")
        st.write(n["text"])

        if st.session_state.get("deleting") == nid:
            st.warning("Segur que vols esborrar aquesta nota?")
            c1, c2, _ = st.columns([1.3, 1, 3])
            c1.button(
                "Sí, esborra", key=f"confirm_del_{nid}", type="primary",
                on_click=confirm_delete, args=(nid,),
            )
            if c2.button("Cancel·la", key=f"cancel_del_{nid}"):
                st.session_state.pop("deleting", None)
                st.rerun()
            return

        c1, c2, _ = st.columns([1, 1, 4])
        if c1.button("Edita", key=f"edit_{nid}"):
            st.session_state["editing"] = nid
            st.session_state.pop("deleting", None)
            st.rerun()
        if c2.button("Esborra", key=f"del_{nid}"):
            st.session_state["deleting"] = nid
            st.session_state.pop("editing", None)
            st.rerun()


for a in shown_areas:
    area_notes = notes_by_area.get(a["id"], [])
    st.subheader(f"{a['name']} ({len(area_notes)})")
    if not area_notes:
        st.caption("Cap nota.")
    for n in area_notes:
        render_note(n)
