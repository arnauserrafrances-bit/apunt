"""Gestió de les àrees: afegir, reanomenar, reordenar, esborrar i moure notes."""

import streamlit as st

from core import db, ui

conn = ui.get_conn()

st.title("Àrees")
ui.show_flash()


def add() -> None:
    try:
        db.add_area(conn, st.session_state["new_area"])
    except db.DataError as e:
        ui.flash(str(e), "error")
        return
    ui.flash(f"Àrea afegida: {st.session_state['new_area'].strip()}")
    st.session_state["new_area"] = ""


def rename(area_id: int) -> None:
    try:
        db.rename_area(conn, area_id, st.session_state[f"rename_{area_id}"])
    except db.DataError as e:
        ui.flash(str(e), "error")
        return
    ui.flash("Nom de l'àrea actualitzat.")


def delete(area_id: int, name: str) -> None:
    try:
        db.delete_area(conn, area_id)
    except db.DataError as e:
        ui.flash(f"No es pot esborrar «{name}». {e}", "error")
        return
    ui.flash(f"Àrea esborrada: {name}")


def move_notes() -> None:
    moved = db.move_area_notes(conn, st.session_state["move_from"], st.session_state["move_to"])
    ui.flash(f"S'han mogut {ui.n_notes(moved)}.")


areas = db.list_areas(conn)

for i, a in enumerate(areas):
    col_up, col_down, col_name, col_count, col_ren, col_del = st.columns(
        [0.5, 0.5, 5, 1.2, 0.6, 0.6], vertical_alignment="center"
    )
    col_up.button(
        "↑", key=f"up_{a['id']}", disabled=i == 0,
        on_click=db.move_area, args=(conn, a["id"], -1), help="Puja",
    )
    col_down.button(
        "↓", key=f"down_{a['id']}", disabled=i == len(areas) - 1,
        on_click=db.move_area, args=(conn, a["id"], 1), help="Baixa",
    )
    col_name.write(a["name"])
    col_count.caption(ui.n_notes(a['note_count']))
    with col_ren.popover("✏️", help="Canvia el nom"):
        st.text_input("Nou nom", value=a["name"], key=f"rename_{a['id']}")
        st.button("Desa", key=f"rename_btn_{a['id']}", on_click=rename, args=(a["id"],))
    col_del.button(
        "🗑️", key=f"del_{a['id']}", help="Esborra",
        on_click=delete, args=(a["id"], a["name"]),
    )

st.divider()
st.subheader("Afegeix una àrea")
col_in, col_btn = st.columns([4, 1], vertical_alignment="bottom")
col_in.text_input("Nom de l'àrea", key="new_area")
col_btn.button("Afegeix", on_click=add, type="primary", use_container_width=True)

if len(areas) >= 2:
    st.divider()
    st.subheader("Mou totes les notes d'una àrea a una altra")
    st.caption("Útil per fusionar dues àrees o per poder esborrar-ne una que té notes.")
    area_by_id = {a["id"]: a for a in areas}
    for key in ("move_from", "move_to"):
        if st.session_state.get(key) not in area_by_id:
            st.session_state.pop(key, None)
    col_from, col_to = st.columns(2)
    col_from.selectbox(
        "Des de", options=list(area_by_id), key="move_from",
        format_func=lambda aid: f"{area_by_id[aid]['name']} ({area_by_id[aid]['note_count']})",
    )
    col_to.selectbox(
        "Cap a", options=list(area_by_id), key="move_to",
        format_func=lambda aid: area_by_id[aid]["name"],
    )
    same = st.session_state.get("move_from") == st.session_state.get("move_to")
    st.button("Mou les notes", on_click=move_notes, disabled=same)
