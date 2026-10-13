# Apunt

Nom provisional. Només es defineix a `frontend/src/config.ts` i `core/config.py` (`APP_NAME`); no l'escriguis enlloc més.

## Producte
Eina local per a tutors de primària a Catalunya per redactar els informes d'avaluació.
- Durant el trimestre, la tutora escriu notes breus de cada alumne per àrea.
- Per a l'informe, la IA escriu 6-8 frases per àrea en català, fent servir NOMÉS la informació de les notes.
- La tutora sempre revisa i aprova el text final.

## Regles que no es poden trencar mai
1. **Els noms reals dels alumnes no s'envien mai a l'API.** Cada alumne té un codi (A-01, A-02...). Els noms només es guarden en local i es tornen a posar al final, a l'ordinador.
2. **La IA no inventa mai informació.** Si una àrea no té notes, no s'escriu res i s'avisa la tutora.
3. **La interfície és en català.** Tots els textos visibles, missatges d'error inclosos.

## Principi de disseny
Escriure una nota ha de costar menys de 10 segons i s'ha de poder fer només amb el teclat. Disseny tranquil: lletra gran (Atkinson Hyperlegible, 18 px), pocs colors, ambre només per a avisos i vermell només per esborrar. Ha de funcionar bé en portàtil i en mòbil.

## Tecnologia
- **Interfície:** React + Vite + Tailwind 4 + TypeScript a `frontend/`. Ara és un prototip amb dades falses guardades al navegador (localStorage).
- **Dades:** SQLite a `core/db.py` (Python), amb proves a `tests/`. Encara no està connectada a la interfície; es farà amb una API local (FastAPI).
- **IA:** API d'Anthropic, `claude-sonnet-5` per redactar i `claude-haiku-4-5-20251001` per revisar (constants a `core/config.py`). La clau es llegeix de `.env` (a `.gitignore`). La base de dades també és a `.gitignore` perquè conté noms reals.
- Streamlit es va fer servir al pas 1 original i es va abandonar (és a l'historial de git).

## Pla
1. ✅ Prototip visual amb dades falses
2. Prova d'ús amb una tutora real i ajustos de disseny
3. Connectar la interfície a la base de dades existent (FastAPI)
4. Control de noms (noms -> codis abans d'enviar a la IA)
5. Generar l'informe amb Sonnet (6-8 frases per àrea)
6. Revisor amb Haiku
7. Canviar codis per noms i copiar l'informe final

## Decisions preses
- **Codis d'alumne:** surten d'un comptador i no es reutilitzen mai, encara que s'esborrin alumnes.
- **Noms:** nom i cognoms obligatoris (camps separats). En enganxar una llista: «Nom Cognoms» (la primera paraula és el nom) o «Cognoms, Nom» (per a noms compostos). Les línies d'una sola paraula i els noms complets duplicats no s'afegeixen i es mostren a la tutora.
- **Esborrar un alumne:** confirmació indicant quantes notes es perdran; s'esborren en cascada.
- **Esborrar una àrea:** NO es permet si té notes. Cal esborrar-les, moure-les a una altra àrea o canviar el nom de l'àrea.
- **Trimestre:** selector «Trimestre actual» sempre visible a la capçalera; a Nota ràpida es repeteix al costat de Desa.
- **Nota ràpida:** cercador → número d'àrea (1-9) → text → Enter. Després de desar, el focus torna al cercador i l'àrea es manté (per repassar la classe per àrees). Pendent de validar amb la tutora.
- **Substitució de noms** (`frontend/src/lib/anonymize.ts`, amb proves): nom complet o nom + primer cognom → codi. Nom de pila sol → codi, excepte:
  - Noms que també són paraules (Pau, Mar, Neus, Rosa, Estel, Clara...; llista `COMMON_WORD_NAMES`): en minúscula i sense article es deixen com a paraula; amb majúscula i article personal (la/el/en/na/l'/n') són nom; **qualsevol altre cas es pregunta a la tutora**.
  - Dos alumnes amb el mateix nom: es pregunta quin és.
  - Mai s'endevina: si hi ha dubte, es pregunta. Es manté l'article ("la A-02") perquè la IA sàpiga el gènere.
- **Informe:** en tornar a posar els noms es fa servir el nom de pila.

## Ordres
```bash
# Interfície
cd frontend && npm install
npm run dev          # obre http://localhost:5173
npm test             # proves de noms i anonimització (vitest)
npm run typecheck

# Python
source .venv/bin/activate
pytest               # proves de la capa de dades
```
