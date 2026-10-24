# architecturedoc.md

## Venture
Apunt (working name). A tool for primary tutors in Catalonia: during the term the tutor writes very short notes about each student (typed on the computer or dictated on the phone), and at report time the AI turns those notes into 6–8 sentences per subject area in Catalan. Real student names never reach the AI, and the server only ever stores encrypted data it cannot read.

## Architectural principles
- Real student names never go to the AI. Each student has a code (A-01, A-02…). Names are replaced on the device before anything is sent, and put back at the very end.
- The AI never invents. Every sentence must come from the teacher's notes. If an area has no notes, nothing is written and the teacher is told.
- When the app is not sure, it asks; it never guesses. Example: "Pau" can be a name or the word for "peace", so the teacher decides.
- Writing a note takes less than 10 seconds and can be done with the keyboard only (or by voice on the phone).
- The teacher always has the last word: she reads, edits and approves every area before copying the report.
- End-to-end encryption: students, areas, notes and reports are encrypted on the device before upload. The password and the encryption keys never leave the device.
- Offline first: every change is saved on the device first and uploaded later, so a note is never lost because of a bad connection.

## Stack and key dependencies
- Interface: React + Vite + Tailwind 4 + TypeScript. A public demo with fake data runs on Vercel (https://apunt-ecru.vercel.app), deployed automatically from GitHub on every push; the real PWA for teachers is still planned. Calm, easy-to-read design (Atkinson Hyperlegible, 18 px, few colours). Works on laptop and phone.
- Accounts and data: Supabase free plan, EU region (planned, phases 3–4). Email + password login, Postgres with Row Level Security on every table. Supabase only receives encrypted records.
- Local storage: today localStorage with fake data (prototype); next, encrypted IndexedDB behind the same `Repository` interface, so the screens do not change.
- Encryption: libsodium (`libsodium-wrappers-sumo`) + WebCrypto only — Argon2id for the password, XChaCha20-Poly1305 for the data, BLAKE2b for salts. Built and tested (`lib/crypto.ts`, `lib/backup.ts`). Details in `security-note.md`.
- AI (planned, after phase 7): Anthropic API. Claude Sonnet 5 writes the draft; Claude Haiku 4.5 checks every sentence against the notes. It runs in a server function that only receives anonymised text; no API key is ever in the frontend.
- Tests: vitest, 40 tests (encryption, backups, name parsing, name replacement, fake data).
- Python + SQLite (`core/`, `tests/`): the first data layer. No longer used, because the server cannot read the data; it will be deleted in phase 9.

## Dependencies to avoid
- Streamlit: tried in step 1 and dropped. It decides the look for us and makes a keyboard-first flow hard.
- Any server or database that can read the notes in clear text. Accounts and sync are needed (phone + computer), so the server must be "blind".
- Home-made cryptography: only standard libsodium and WebCrypto primitives.
- Connecting to the school's official platform: slow to build, and the real user writes her reports in a blank document anyway.
- A chat box where the teacher writes prompts: the whole point is zero prompting.
- AI agent frameworks (LangChain and similar): two plain API calls are enough and much easier to understand and change.

## Tradeoffs consciously accepted
- End-to-end encryption means the server cannot help: if the teacher loses both her password and her recovery code, the data is gone. We gain: a data leak at Supabase exposes nothing readable about children.
- Argon2id is slow on purpose (64 MB, 3 passes). Logging in takes a moment on older phones; `bench.html` measures it on real devices.
- The Argon2id salt comes from the email, so changing the email is blocked in the MVP.
- Email confirmation is temporarily off for the MVP testers (free Supabase email only sends 2 per hour). It comes back with our own SMTP in phase 5.
- The name check only knows the names in the class list. It cannot catch nicknames, siblings or parents unless the teacher adds them. We cover the gap by showing the teacher the exact text before anything is sent.
- Catalan only, one teacher, one class. We gain: we build for the real user we have, not for an imagined school.
- The final report is plain text to copy and paste; no Word or PDF export.
- The prototype still runs with fake data in the browser and needs a terminal to start (`npm run dev`). We gain: we test the design with a real tutor before building the back end.

## Plan
Done: clickable prototype with fake data; name replacement; encryption and backup module with tests (phase 1).

New order (changed after the Session 5 feedback): the riskiest guess is that the AI can write a report good enough for a tutor to check in under 15 minutes per student. Everything else is safe engineering, so the AI is tested first.
1. Test the AI report by hand, without code: a tutor's real notes for 3 students (names replaced by codes) through Claude with Apunt's rules; she corrects each report and we time it.
2. If it works: connect the real AI to the Informe screen (name check → Sonnet draft → Haiku checker → names back), still on one computer.
3. If it does not work: fix the prompt and the note format before building anything else.
4. Only after that: store ready to sync (phase 2, half done) → accounts and keyring → encrypted sync → phone and dictation → PWA and publishing on Vercel → password change and recovery email → pending-upload indicator → clean-up.

## Defense: the teacher-memory data cycle (Session 5)
- What: for every report Apunt keeps the AI draft and the final text the teacher sends, plus how much of the draft she kept (% kept). Together with the term's tagged notes (student, area, date), this teaches Apunt her students and her writing style, so each term's drafts need fewer edits.
- Where: a new encrypted record type `report_version` (student, term, area, draft, final, % kept, date). Like everything else it is encrypted on the device and stored in Supabase as an unreadable blob; the % kept is calculated on the device.
- Why it grows: every term adds observations and edited reports; a new tool starts from zero.
- First step (planned, after the real AI is connected): save the draft and the final version when the teacher approves a report, and show the % kept on the Informe screen.

## Open assumptions
- Teachers will write notes during the term, not only the week before the reports.
- Checking our draft takes less than 15 minutes per student (today: about 30 minutes with ChatGPT).
- Teachers will pay around €9 per term out of their own pocket.
- Teachers will trust an app with notes about children if it is end-to-end encrypted and names never reach the AI.
- The name replacement catches enough names that teachers trust it, and the preview step does not annoy them.
- 6–8 sentences per area written from short notes will sound like the teacher, not like an AI.
- Dictating notes on the phone during the school day is easier than typing them later.
- The % kept goes up from one term to the next (this is what makes the defense real).

## Session log
- Session 4: Dropped Streamlit after step 1 and moved the interface to React + Vite + Tailwind; Python + SQLite stays for data. Built a clickable prototype in Catalan with fake data (25 students, 7 areas, about 60 notes): Nota ràpida, Classe, Fitxa de l'alumne, Àrees, Alumnes and Informe (with a fake report and fake checker flags). Wrote and tested the name-replacement logic (it asks the teacher when a name is unclear). New guesses: the number-key flow for areas is fast enough; the final report should use first names only.
- Between sessions 4 and 5: Decided the real use is notes from the phone and reports on the computer, so the app needs accounts and sync. To keep children's data safe, chose end-to-end encryption with Supabase as a "blind" server. Built and tested the encryption and backup module (phase 1). Started phase 2 (UUID ids, empty store, fake data only on request).
- Session 5: Copycat test — an AI rebuilt the interface, notes and report generation in minutes, so features are not a defense. Chose a per-teacher data cycle ("teacher memory") as the one defense, and added the `report_version` record and the % kept metric to the plan. Honest gaps: no distribution beyond one school, no network effects, and the defense only protects a teacher after a full term of use.
