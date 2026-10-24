# Apunt

Nom provisional. Només es defineix a `frontend/src/config.ts` i `core/config.py` (`APP_NAME`); no l'escriguis enlloc més.

## Producte
Aplicació web (amb comptes i sincronització entre dispositius) per a tutors de primària a Catalunya per redactar els informes d'avaluació.
- Durant el trimestre, la tutora escriu notes breus de cada alumne per àrea.
- Per a l'informe, la IA escriu 6-8 frases per àrea en català, fent servir NOMÉS la informació de les notes.
- La tutora sempre revisa i aprova el text final.
- Ús previst: notes dictades des del mòbil durant el dia; revisió i informes des de l'ordinador.

## Regles que no es poden trencar mai
1. **Els noms reals dels alumnes no s'envien mai a l'API.** Cada alumne té un codi (A-01, A-02...). Els noms només es guarden en local i es tornen a posar al final, a l'ordinador.
2. **La IA no inventa mai informació.** Si una àrea no té notes, no s'escriu res i s'avisa la tutora.
3. **La interfície és en català.** Tots els textos visibles, missatges d'error inclosos.
4. **Xifrat d'extrem a extrem.** Alumnes, àrees, notes i informes es xifren al dispositiu abans d'enviar-se. El servidor (Supabase) només guarda dades xifrades que no pot llegir.
5. **La contrasenya en clar i la clau de xifrat no surten mai del dispositiu.** De la contrasenya es deriven al dispositiu (Argon2id + `crypto_kdf_derive_from_key`) dues claus separades: `authKey`, que s'envia a Supabase com a contrasenya, i `wrapKey`, que no s'envia mai.
6. **Les dades es xifren amb una clau aleatòria** (`dataKey`), guardada embolicada dues vegades: amb `wrapKey` i amb el codi de recuperació que es mostra a la tutora en registrar-se. Canviar la contrasenya només torna a embolicar la clau; no es tornen a xifrar les dades.
7. **Només primitives estàndard:** libsodium (`libsodium-wrappers-sumo`) i WebCrypto. Res de criptografia inventada. El codi és a `frontend/src/lib/crypto.ts` i `backup.ts`, amb proves.
8. **Cap clau d'API (Anthropic o una altra) al frontend.** La IA anirà en una funció de servidor que rebrà el text ja anonimitzat.
9. **Row Level Security a totes les taules:** cada usuari només pot llegir i escriure les seves files.

## Principi de disseny
Escriure una nota ha de costar menys de 10 segons i s'ha de poder fer només amb el teclat. Disseny tranquil: lletra gran (Atkinson Hyperlegible, 18 px), pocs colors, ambre només per a avisos i vermell només per esborrar. Ha de funcionar bé en portàtil i en mòbil, i la nota ràpida s'ha de poder dictar amb el micròfon del teclat del mòbil.

## Tecnologia
- **Interfície:** React + Vite + Tailwind 4 + TypeScript a `frontend/`. Ara és un prototip amb dades falses guardades al navegador (localStorage). Es publicarà a Vercel com a PWA.
- **Comptes i dades:** Supabase (pla gratuït, regió UE): autenticació amb email i contrasenya, i Postgres amb RLS. Cada canvi es desa primer al dispositiu (IndexedDB, xifrat) i després es puja: una nota no es pot perdre per falta de connexió.
- **Xifrat:** vegeu les regles 4-7. Paràmetres d'Argon2id versionats a `KDF_V1`; `frontend/bench.html` mesura quant triguen en un dispositiu real.
- **Python (`core/`, `tests/`):** la capa SQLite antiga. Ja no s'utilitzarà (el servidor no pot llegir les dades) i s'esborrarà a la fase 9.
- **IA:** API d'Anthropic, `Codex-sonnet-5` per redactar i `Codex-haiku-4-5-20251001` per revisar (constants a `core/config.py`). Anirà en una funció de servidor, mai al frontend.
- Streamlit es va fer servir al pas 1 original i es va abandonar (és a l'historial de git).

## Pla
Fet: prototip visual amb dades falses i substitució de noms.

Comptes, sincronització i xifrat (ordre: 1, 2, 3, 4, 6, 7; després la IA; 5, 8 i 9 més endavant):
1. Mòdul de xifrat, còpies i proves; mesura d'Argon2id al mòbil
2. Store preparat per sincronitzar (ids UUID, comença buit, dades de prova només si es demanen)
3. Comptes i clauer (Supabase): registre, entrada, pantalla del codi de recuperació
4. Sincronització xifrada, primer en local (IndexedDB); pantalla Compte amb exportar/importar còpia
5. Canvi de contrasenya, recuperació per email i SMTP propi
6. Mòbil i dictat
7. PWA i publicació (Vercel)
8. Indicador de pendents d'enviar i poliment
9. Neteja (esborrar Python) i documentació

IA (després de la fase 7): control de noms abans d'enviar → informe amb Sonnet → revisor amb Haiku → tornar a posar els noms i copiar.

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
- **Compte nou:** comença buit. Les dades de prova només es carreguen si la tutora ho demana («Carrega dades de prova», amb confirmació; si ja hi ha dades, les substitueix). A Àrees, si no n'hi ha cap, es proposen les 7 àrees habituals de primària (`DEFAULT_AREAS`).
- **Ids:** UUID v4 generats amb `newId()` (`lib/id.ts`), no amb `crypto.randomUUID()`, que falla fora d'HTTPS (p. ex. provant des del mòbil amb la IP local).
- **Sal d'Argon2id:** es deriva de l'email (BLAKE2b). Per això **el canvi d'email està bloquejat** al MVP.
- **«Recorda aquest dispositiu»:** casella opcional, desmarcada per defecte. Si es marca, `dataKey` es guarda a IndexedDB embolicada amb una clau WebCrypto no exportable; «Surt» l'esborra.
- **Còpia (.apunt):** inclou el clauer embolicat i els registres xifrats; s'obre només amb la contrasenya o amb el codi de recuperació, encara que es perdin les dades de Supabase.
- **Confirmació per email:** desactivada temporalment per als testers del MVP (l'email de Supabase gratuït només envia 2 per hora). Es tornarà a activar amb un SMTP propi a la fase 5.
- **Limitacions conegudes:** qui controli el codi servit (Vercel o GitHub) podria servir-ne un de maliciós; es mitiga amb una CSP estricta. El servidor veu l'email, quants registres hi ha, la seva mida i quan canvien.

## Ordres
```bash
# Interfície
cd frontend && npm install
npm run dev          # obre http://localhost:5173
npm test             # proves de xifrat, còpies, noms i anonimització (vitest)
npm run dev -- --host   # per provar des del mòbil; mesura: http://<IP>:5173/bench.html
npm run typecheck

# Python
source .venv/bin/activate
pytest               # proves de la capa de dades
```
