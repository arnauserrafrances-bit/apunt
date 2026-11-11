# architecturedoc.md

## Venture
Apunt (working name). A tool for primary tutors in Catalonia to write term reports: the tutor answers a short questionnaire about each student (and/or writes a free paragraph or notes during the term), and the AI writes the report as a letter to the family, in Catalan, following the school's model and the tutor's own style. The tutor reviews it with an AI assistant chat beside the text, and Apunt learns the style preferences she approves. Real student names never reach the AI, and today all data stays in the tutor's own browser (when accounts arrive, the server will only store encrypted data it cannot read).

## Architectural principles
- Real student names never go to the AI. Each student has a code (A-01, A-02…). Names are replaced on the device before anything is sent, and put back at the very end.
- The AI never invents. Every sentence must come from the teacher's notes. If an area has no notes, nothing is written and the teacher is told.
- Red lines are checked by a fixed rule, not only by the AI (Session 8): before a report reaches the tutor, any sentence with a number grade, a comparison with other students or an academic decision (repeating the year) is deleted, whatever the notes, the school model or the example report say.
- When the app is not sure, it asks; it never guesses. Example: "Pau" can be a name or the word for "peace", so the teacher decides.
- Writing a note takes less than 10 seconds: by voice (say the student's name and what you saw; Apunt finds the student and splits the note by area) or with the keyboard only.
- The teacher always has the last word: she reads, edits and approves every area before copying the report.
- End-to-end encryption: students, areas, notes and reports are encrypted on the device before upload. The password and the encryption keys never leave the device.
- Offline first: every change is saved on the device first and uploaded later, so a note is never lost because of a bad connection.

## Stack and key dependencies
- Interface: React + Vite + Tailwind 4 + TypeScript. A public demo with fake data runs on Vercel (https://apunt-ecru.vercel.app), deployed automatically from GitHub on every push; the real PWA for teachers is still planned. Calm, easy-to-read design (Atkinson Hyperlegible, 18 px, few colours). Works on laptop and phone.
- Accounts and sync (Session 9): Supabase free plan, EU region. Email + password login, Postgres with Row Level Security on every table (`keyrings`, `items`). Supabase only receives encrypted records: each student, note, report, preference and setting is one row, encrypted on the device (`lib/vault.ts`, `lib/cloud.ts`). Changes upload by themselves and other devices' changes download every 20 s; if the same thing changed on two devices, the device that syncs it wins. The account part (Supabase + libsodium) loads only when accounts are switched on.
- Local storage: localStorage on each device (works offline, as before); the encrypted copy in the account is what moves data between devices. With «Remember me», the data key is kept in IndexedDB wrapped with a non-exportable WebCrypto key.
- Encryption: libsodium (`libsodium-wrappers-sumo`) + WebCrypto only — Argon2id for the password, XChaCha20-Poly1305 for the data, BLAKE2b for salts. Built and tested (`lib/crypto.ts`, `lib/backup.ts`). Details in `security-note.md`.
- AI (live): Anthropic API in three Vercel server functions (`api/report.ts`, `api/edit.ts`, `api/classify.ts`) that only receive anonymised text and need an access code. Claude Sonnet writes the draft and answers the assistant chat; Claude Haiku checks every sentence against the tutor's answers. For voice notes, Claude Sonnet splits the dictated text into one note per area (`api/classify.ts`). Models are set by environment variables; the API key lives only in Vercel, never in the frontend.
- Tests: vitest, 99 tests (encryption, backups, names and Catalan articles, AI functions with a simulated API, learning metrics, red-line guardrail), plus a 15-case eval run on the live app (see "Workflow and evals"). Server functions are also tested the way Vercel runs them (Node ESM).
- Python + SQLite (`core/`, `tests/`): the first data layer. No longer used, because the server cannot read the data; it will be deleted in phase 9.

- Voice to text: the browser's speech recognition (Web Speech API, Chrome and Safari, computer and phone), wrapped in `lib/speech.ts` so it can be swapped for the phone's native on-device recognition when Apunt becomes a downloadable app (Capacitor). No audio is stored.

## Dependencies to avoid
- Streamlit: tried in step 1 and dropped. It decides the look for us and makes a keyboard-first flow hard.
- Any server or database that can read the notes in clear text. Accounts and sync are needed (phone + computer), so the server must be "blind".
- Home-made cryptography: only standard libsodium and WebCrypto primitives.
- Connecting to the school's official platform: slow to build, and the real user writes her reports in a blank document anyway.
- A blank chat where the teacher has to write the whole prompt herself: the report is generated from the questionnaire with zero prompting. (Changed in Session 6: there is now an assistant chat, but only to edit the report the AI already wrote, because the tutor asked for it.)
- AI agent frameworks (LangChain and similar): two plain API calls are enough and much easier to understand and change.

## Tradeoffs consciously accepted
- End-to-end encryption means the server cannot help: if the teacher loses both her password and her recovery code, the data is gone. We gain: a data leak at Supabase exposes nothing readable about children.
- Argon2id is slow on purpose (64 MB, 3 passes). Logging in takes a moment on older phones; `bench.html` measures it on real devices.
- The Argon2id salt comes from the email, so changing the email is blocked in the MVP.
- Email confirmation is temporarily off for the MVP testers (free Supabase email only sends 2 per hour). It comes back with our own SMTP in phase 5.
- The name check only knows the names in the class list. It cannot catch nicknames, siblings or parents unless the teacher adds them. We cover the gap by showing the teacher the exact text before anything is sent.
- Catalan only, one teacher, one class. We gain: we build for the real user we have, not for an imagined school.
- The final report is plain text to copy and paste; no Word or PDF export.
- Voice notes use the browser's dictation for now: the audio (with the student's name) is turned into text by Google (Chrome) or Apple (Safari), not by Apunt's AI. After that, the name is replaced by the code on the device and only the code goes to Claude. We gain: it works today on computer and phone, in Catalan, for free. In the downloadable app it will move to the phone's on-device recognition, so the audio never leaves the phone.
- Without an account, data lives only in the tutor's browser. With an account it is in Supabase, but encrypted: if she loses both her password and her recovery code, nobody can recover it. «I forgot my password» works with the recovery code: the code opens the data key on the device, a new password wraps it again, and a server function (`api/recover.ts`, with Supabase's secret key, only in Vercel) checks a proof against a stored hash and changes the Supabase password. The server never sees the code, the password or the data.
- «Remember me on this device» is on by default (the tutor uses her own computer and phone); she unticks it on a shared computer.

## Plan
Done: clickable prototype; name replacement with correct Catalan articles; encryption and backup module (phase 1); real AI connected (Vercel function: Sonnet drafts, Haiku checks); questionnaire mode (7 blocks, the tutor's own questions); free paragraph; school model and example report; letter format; AI assistant chat beside the report; public demo on Vercel.

Next, in this order (riskiest first):
1. (Built in Session 7) Learn the tutor's preferences from her chat corrections, with her approval: see "Learning loop" below. Next: collect real numbers from her next reports.
2. (Built in Session 9) Voice notes: big microphone in «Nota ràpida»; the tutor says the student's name and what she saw; Apunt finds the student, replaces names with codes, the AI splits the note by area, and she reviews before saving. Next: test it with her for two weeks on her phone: does she really record notes, and does the report take less time?
3. Test with more tutors (her school's staff), using the school's standard model per course and term.
4. (Built in Session 9) Accounts and encrypted sync between computer and phone. «Forgot password» with the recovery code is built too. Next: phone app (PWA, then downloadable app) → clean-up.

## Workflow and evals (Session 8)
Workflow for one report:
1. Tutor input — questionnaire, free text or notes (human).
2. Names → codes — on her computer; asks her when a word can be a name; she sees exactly what is sent (fixed rule + human).
3. AI draft — Claude Sonnet, one paragraph per area in the school's style (AI).
4. AI checker — Claude Haiku flags every sentence that does not come from the notes (AI).
5. Names back + letter — Catalan articles, greeting, intro, farewell (fixed rule).
6. Tutor review — approve/edit, chat assistant (human + AI).

Eval: 15 cases (10 normal, 5 attacks: direct injection, indirect injection in the example report, out of scope, red line, data exposure), invented class, real school model, run on the live app; the output of every step is read. Sheet: `apunt_session8_error_analysis.xlsx`.
- Before: 0/10 normal reports could be approved as they came, 5/5 attacks handled safely. The AI draft invented sentences in all 14 reports (49 sentences: encouragement, predictions, the school's feelings); the checker caught 44. Name replacement: 0 errors. Cause: the draft prompt contradicted itself (it asked for "a message of encouragement" and "never add advice").
- Fix (draft step only): encouragement, advice and predictions only if the tutor wrote them; examples of forbidden additions; "check every sentence before answering". Guardrail: fixed red-line check on the output (above).
- After: 5/10 normal OK, 5/5 attacks safe; invented sentences 49 → 4, all flagged by the checker.
- Found by the eval, next fix (step 5): when the draft cannot tell the gender it writes «l'A-02», and the letter then says «Pau» / «Marta» with no article. The letter step should take the article from the class list. Also: the checker sometimes flags words that come from the question itself («cada matí»); and in the rerun of the «pau» case the second name question did not clear in my automated run, so the generate button stayed blocked (safe, but it must be checked by hand).

## Learning loop (Session 7)
- Behaviour: the corrections the tutor asks for in the assistant chat and applies (her main complaint: "it doesn't learn my changes as fast as ChatGPT").
- Loop: she applies a chat correction → the assistant proposes a general preference (for example «Avoid the word "adequat"») → she clicks "Remember" or "No" → approved preferences are sent with every new report and with the chat. No model is trained: the preferences go into the prompt.
- Human check: nothing is learned without her click. She can edit, delete or add preferences in the Model screen, or switch learning off (then nothing is proposed or sent).
- Red lines that a preference can never change: the AI never writes about a child anything the teacher did not say; names never go to the AI; no grades. Preferences are about style for all reports, never about one student.
- Metrics (saved on the device in a learning log that survives "start again"): share of the AI draft she keeps when she copies the report (word-level), assistant corrections applied per report, and preferences used. If the loop works, the first goes up and the second goes down.
- Data stays in her browser: `preferences`, `learningEnabled` and `learningLog` in the local state.

## Defense: the teacher-memory data cycle (Session 5)
- What: for every report Apunt keeps the AI draft and the final text the teacher sends, plus how much of the draft she kept (% kept). Together with the term's tagged notes (student, area, date), this teaches Apunt her students and her writing style, so each term's drafts need fewer edits.
- Where: a new encrypted record type `report_version` (student, term, area, draft, final, % kept, date). Like everything else it is encrypted on the device and stored in Supabase as an unreadable blob; the % kept is calculated on the device.
- Why it grows: every term adds observations and edited reports; a new tool starts from zero.
- Status (Session 7): the first version is built on the device. Apunt saves the AI draft and, when the tutor copies the report, the share she kept, in the learning log shown in the Model screen. The encrypted `report_version` on the server comes with accounts.

## Open assumptions
- (Session 6: NOT confirmed) Teachers will write notes during the term. The real tutor does not; she answers a questionnaire at report time. She says she would take notes if she could dictate them by voice: still to test.
- Checking our draft takes less than 15 minutes per student. Session 6 test: exactly 15 minutes per student (3 students), plus 10–15 minutes for the questionnaire; about 28 minutes in total versus about 45 with her ChatGPT method.
- Teachers will pay for Apunt. Session 6: the tutor says she would pay, above all with voice notes (no amount discussed). Plan: one free trial term, then a subscription; price to be set from the real AI cost per report and what the first tutors are willing to pay.
- Teachers will trust an app with notes about children if it is end-to-end encrypted and names never reach the AI.
- The name replacement catches enough names that teachers trust it, and the preview step does not annoy them.
- One paragraph per area (up to 12 sentences), written from her answers and her example report, will sound like the teacher, not like an AI.
- Dictating notes on the phone during the school day is easier than typing them later.
- The % kept goes up from one term to the next (this is what makes the defense real).

## Session log
- Session 4: Dropped Streamlit after step 1 and moved the interface to React + Vite + Tailwind; Python + SQLite stays for data. Built a clickable prototype in Catalan with fake data (25 students, 7 areas, about 60 notes): Nota ràpida, Classe, Fitxa de l'alumne, Àrees, Alumnes and Informe (with a fake report and fake checker flags). Wrote and tested the name-replacement logic (it asks the teacher when a name is unclear). New guesses: the number-key flow for areas is fast enough; the final report should use first names only.
- Between sessions 4 and 5: Decided the real use is notes from the phone and reports on the computer, so the app needs accounts and sync. To keep children's data safe, chose end-to-end encryption with Supabase as a "blind" server. Built and tested the encryption and backup module (phase 1). Started phase 2 (UUID ids, empty store, fake data only on request).
- Session 5: Copycat test — an AI rebuilt the interface, notes and report generation in minutes, so features are not a defense. Chose a per-teacher data cycle ("teacher memory") as the one defense, and added the `report_version` record and the % kept metric to the plan. Honest gaps: no distribution beyond one school, no network effects, and the defense only protects a teacher after a full term of use.
- Session 6 (13 Oct, in class): moved the prototype to React and built the encryption and backup module (commits 44edec4 and 045ca51).
- Session 6 follow-up (24–25 Oct), after the professor's feedback to test the riskiest guess first: connected the real AI and ran a test with a real tutor (my mother, 5th grade) on 3 real students, with names replaced by codes on her computer. What we learned changed the product: she does not take notes during the term, she answers a questionnaire, so Apunt now has her questionnaire; she wanted help while editing, so Apunt now has an assistant chat (select text → «Assistència» → apply). Result: about 28 minutes per student versus about 45 with ChatGPT; review exactly 15 minutes. Her corrections: repeated words and ideas, negative sentences; both are now rules in the prompt. Commitment: she will use Apunt for her 25 students this term and show it to the whole staff; she would pay, above all if it has voice notes during the term, which is now step 2 of the plan. Weak point she named: it does not learn her preferences as fast as ChatGPT, which becomes the Session 7 learning loop.
- Session 7 (27 Oct – 1 Nov): from the Session 6 test, chose the behaviour for the learning loop (her chat corrections) and built it: tutor-approved preferences, a switch to stop learning, and learning metrics (share of the draft kept, chat corrections per report). Tested end to end in the browser and as Vercel runs the functions; 96 automated tests. Fixed a design problem found in testing: metrics were stored inside each report and were lost on "start again", so they now live in a separate learning log. Competitor map: strongest competitor is ChatGPT (the tutor's previous tool); our advantage is trust (names never reach the AI). Next: real numbers from the tutor's next reports, then voice notes.
- Session 8 (2–8 Nov): mapped the product as a 6-step workflow and ran a 15-case eval (10 normal + 5 attacks) on the live app, reading every step. The AI draft was the step that failed most (invented sentences in every report, caused by a contradiction in our own prompt), not the name replacement we trusted least (0 errors). Fixed only the draft prompt and added a fixed red-line output check; reran the same 15 cases: normal reports OK 0 → 5 of 10, invented sentences 49 → 4, attacks 5/5 safe before and after. The rerun showed one thing that got worse (missing article when the draft writes the neutral «l'A-0x»), which is the next fix.
- Session 9 (10 Nov): voice notes (dictate → find the student → names to codes → AI splits the note by area → tutor reviews and saves) and accounts with end-to-end encrypted sync (Supabase EU + the libsodium module from phase 1). Tested with 118 automated tests and two browser runs (voice flow on computer and phone with a fake microphone; accounts on 5 simulated devices with a fake Supabase: the server only ever saw encrypted text and never the real password).
- Session 9 (11 Nov): redesign with the Apunt brand (ink #1B2F5E + yellow marker #FFD23F, Bricolage Grotesque titles, Atkinson Hyperlegible text). Mobile: floating tab bar with a bigger mic button in the centre, full-screen recording screen. Computer: side menu with «Grava una nota», smaller corners and thin borders for a calmer work-tool look. Each area has its own colour; all e2e and unit tests pass on the new design.
