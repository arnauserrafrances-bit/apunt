# architecturedoc.md

## Venture
Apunt (working name). A tool for primary tutors in Catalonia: during the term the tutor writes very short notes about each student, and at report time the AI turns those notes into 6–8 sentences per subject area in Catalan, without the students' real names ever leaving the teacher's computer.

## Architectural principles
- Real student names never go to the AI. Each student has a code (A-01, A-02…). Names stay only on the teacher's computer and are put back at the very end.
- The AI never invents. Every sentence must come from the teacher's notes. If an area has no notes, nothing is written and the teacher is told.
- When the app is not sure, it asks; it never guesses. Example: "Pau" can be a name or the word for "peace", so the teacher decides.
- Writing a note takes less than 10 seconds and can be done with the keyboard only.
- The teacher always has the last word: she reads, edits and approves every area before copying the report.

## Stack and key dependencies
- Interface: React + Vite + Tailwind + TypeScript. It gives full control over keyboard shortcuts and a calm, easy-to-read design (big font, few colours).
- Data: SQLite, one local file (core/db.py), with 12 tests. Simple, no server, and the data never leaves the computer. Not connected to the interface yet.
- Local API (planned): FastAPI, only to connect the interface to SQLite.
- AI (planned): Anthropic API. Claude Sonnet 5 writes the draft; Claude Haiku 4.5 checks every sentence against the notes. The API key is kept in a .env file that is not in git.
- Tests: vitest (15 tests for name parsing and name replacement) and pytest (data layer).

## Dependencies to avoid
- Streamlit: tried in step 1 and dropped. It decides the look for us and makes a keyboard-first flow hard.
- Cloud database, user accounts and login: they would put real children's names on a server we would have to protect.
- Connecting to the school's official platform: slow to build, and the real user writes her reports in a blank document anyway.
- A chat box where the teacher writes prompts: the whole point is zero prompting.
- AI agent frameworks (LangChain and similar): two plain API calls are enough and much easier to understand and change.

## Tradeoffs consciously accepted
- It only runs on one computer, with no sync and no phone version. We gain: names never leave the device and there is no server to secure.
- The prototype keeps fake data in the browser (localStorage), and the database is not connected yet. We gain: we can test if the design is comfortable for a real tutor before building the back end.
- The name check only knows the names in the class list. It cannot catch nicknames, siblings or parents unless the teacher adds them. We gain: simple code. We cover the gap by showing the teacher the exact text before anything is sent.
- Catalan only, one teacher, one class. We gain: we build for the real user we have, not for an imagined school.
- The final report is plain text to copy and paste; no Word or PDF export.
- Today it needs a terminal to start (npm run dev). We gain: no time spent on installers before we know people want it.

## Open assumptions
- Teachers will write notes during the term, not only the week before the reports.
- Checking our draft takes less than 15 minutes per student (today: about 30 minutes with ChatGPT).
- Teachers will pay around €9 per term out of their own pocket.
- The name replacement catches enough names that teachers trust it, and the preview step does not annoy them.
- 6–8 sentences per area written from short notes will sound like the teacher, not like an AI.
- Choosing an area with a number key and keeping it selected while going through the class is the fastest way to write notes.

## Session log
- Session 4: Dropped Streamlit after step 1 and moved the interface to React + Vite + Tailwind; Python + SQLite stays for data. Built a clickable prototype in Catalan with fake data (25 students, 7 areas, about 60 notes): Nota ràpida, Classe, Fitxa de l'alumne, Àrees, Alumnes and Informe (with a fake report and fake checker flags). Wrote and tested the name-replacement logic (it asks the teacher when a name is unclear). New guesses: the number-key flow for areas is fast enough; the final report should use first names only.
