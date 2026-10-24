# Apunt

AI-drafted term reports for primary tutors in Catalonia. During the term the tutor writes very short notes about each student; at report time the AI turns them into 6–8 sentences per subject area in Catalan, **using only her notes**. Real student names never reach the AI, and the tutor reviews and approves every sentence.

**Live demo (fake data only): https://apunt-ecru.vercel.app**
Open it and press **"Carrega dades de prova"** to load 25 invented students. The interface is in Catalan.

## Documents
- [architecturedoc.md](architecturedoc.md) – principles, stack, tradeoffs, plan and session log
- [scope.md](scope.md) – what the MVP does, what it deliberately does not do, and when features get added
- [security-note.md](security-note.md) – how student data is protected and the known limitations

## What works today
- Clickable prototype in Catalan: Nota ràpida, Classe, Fitxa de l'alumne, Àrees, Alumnes and Informe.
- Name replacement (student names → codes A-01, A-02…, asking the teacher when a name is unclear).
- End-to-end encryption and backup module (libsodium), tested but not yet connected to the screens.
- 40 automated tests.

## What does not work yet (honestly)
- The report on the Informe screen is **simulated**: the real AI is not connected yet. It is being tested by hand first with a real tutor (see the plan in architecturedoc.md).
- No accounts, sync or phone version. Data stays in your own browser (localStorage).

## Run it locally
```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # 40 tests
```
