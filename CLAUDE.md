# Apunt

Nom provisional. El nom només es defineix a `core/config.py` (`APP_NAME`); no l'escriguis enlloc més al codi.

## Producte
Eina local per a tutors de primària a Catalunya per redactar els informes d'avaluació.
- Durant el trimestre, la tutora escriu notes breus de cada alumne per àrea.
- Per a l'informe, la IA escriu 6-8 frases per àrea en català, fent servir NOMÉS la informació de les notes.
- La tutora sempre revisa i aprova el text final.

## Regles que no es poden trencar mai
1. **Els noms reals dels alumnes no s'envien mai a l'API.** Cada alumne té un codi (A-01, A-02...). Els noms només es guarden a la base de dades local (`data/apunt.db`) i es tornen a posar al final, a l'ordinador.
2. **La IA no inventa mai informació.** Si una àrea no té notes, no s'escriu res i s'avisa la tutora.
3. **La interfície és en català.** Tots els textos visibles, missatges d'error inclosos.

## Tecnologia
- Python + Streamlit, només en local. Navegació amb `st.navigation` (`app.py`); les pantalles són a `views/`.
- SQLite (`core/db.py`) per a alumnes, codis, àrees i notes.
- API d'Anthropic: `claude-sonnet-5` per redactar i `claude-haiku-4-5-20251001` per revisar (constants a `core/config.py`).
- La clau de l'API es llegeix de `.env` (a `.gitignore`). La base de dades també és a `.gitignore` perquè conté noms reals.

## Pla
1. ✅ Llista de classe + notes per alumne i àrea
2. Control de noms: substituir noms per codis abans d'enviar i mostrar a la tutora el text exacte que s'enviarà
3. Generar l'informe amb Sonnet (6-8 frases per àrea)
4. Revisor amb Haiku (cada frase surt de les notes, 6-8 frases, sense exagerar)
5. Edició, substitució de codis per noms i copiar l'informe final

## Decisions preses (pas 1)
- **Codis d'alumne:** surten d'un comptador a la taula `meta` (`next_student_number`) i no es reutilitzen mai, encara que s'esborrin alumnes.
- **Noms:** nom i cognoms obligatoris, en camps separats (`first_name`, `last_name`). En enganxar una llista, cada línia necessita com a mínim dues paraules: «Nom Cognoms» (la primera paraula és el nom) o «Cognoms, Nom» (per a noms compostos). Les línies d'una sola paraula no s'afegeixen i es mostren a la tutora. Si el nom complet ja existeix a la classe (sense distingir majúscules ni espais), no s'afegeix i s'avisa.
- **Esborrar un alumne:** es demana confirmació indicant quantes notes es perdran, i s'esborren en cascada.
- **Esborrar una àrea:** NO es permet si té notes. Cal esborrar-les, moure-les a una altra àrea (hi ha una eina a la pantalla Àrees) o canviar el nom de l'àrea.
- **Trimestre:** selector «Trimestre actual» a la barra lateral, compartit per totes les pantalles. A «Nota ràpida» es mostra al costat del botó Desa.
- **Notes:** alumne, àrea, text, data i trimestre (1-3).

## Ordres
```bash
source .venv/bin/activate
streamlit run app.py      # executar l'app
pytest                    # proves de la capa de dades
```
