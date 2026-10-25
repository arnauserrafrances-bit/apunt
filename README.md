# Apunt

AI-drafted term reports for primary tutors in Catalonia. During the term the tutor writes very short notes about each student; at report time the AI turns them into 6–8 sentences per subject area in Catalan, **using only her notes**. Real student names never reach the AI, and the tutor reviews and approves every sentence.

**Live demo (fake data only): https://apunt-ecru.vercel.app**
Open it and press **"Carrega dades de prova"** to load 25 invented students. The interface is in Catalan.

## Documents
- [architecturedoc.md](architecturedoc.md) – principles, stack, tradeoffs, plan and session log
- [scope.md](scope.md) – what the MVP does, what it deliberately does not do, and when features get added
- [security-note.md](security-note.md) – how student data is protected and the known limitations

## What works today
- **Questionnaire** per student (7 blocks, built from a real tutor's questions) and a free paragraph; notes during the term also work.
- **Real AI report** (Vercel function: Claude Sonnet drafts, Claude Haiku checks every sentence against the tutor's answers). Student names are replaced by codes (A-01…) on the device before anything is sent, and put back at the end with the correct Catalan article.
- **School model and example report**: the tutor pastes her school's guidelines and a report she likes; the AI follows them.
- **Letter format** ready to copy: greeting, one paragraph per area, farewell for the term.
- **Assistant chat** beside the report: select text → «Assistència» → ask for synonyms or a rewrite → apply.
- End-to-end encryption and backup module (libsodium), tested but not yet connected to accounts.
- 87 automated tests.

## What does not work yet (honestly)
- No accounts, sync or phone version: data stays in the tutor's own browser.
- The AI does not yet learn the tutor's preferences from her edits (next step).
- The AI part of the demo needs an access code, so the public demo does not spend credits. Without it, the report is simulated.

## Run it locally
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # 40 tests
```
