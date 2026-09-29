"""Punt d'entrada: configura la pàgina, el trimestre actual i la navegació.

Executa-ho amb:  streamlit run app.py
"""

import streamlit as st

from core import config, ui

st.set_page_config(page_title=config.APP_NAME, page_icon="📝", layout="centered")

pages = [
    st.Page("views/nota_rapida.py", title="Nota ràpida", icon="✏️", default=True),
    st.Page("views/fitxa_alumne.py", title="Fitxa de l'alumne", icon="🗂️"),
    st.Page("views/alumnes.py", title="Alumnes", icon="👥"),
    st.Page("views/arees.py", title="Àrees", icon="📚"),
]
nav = st.navigation(pages)

st.sidebar.markdown(f"### {config.APP_NAME}")
st.sidebar.caption(config.APP_TAGLINE)
ui.term_selector()

nav.run()
