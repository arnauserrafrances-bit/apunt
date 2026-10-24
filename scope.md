# Scope Definition Sheet — Apunt

## What the MVP does (the thinnest version that gives real proof)
One tutor, one class, on her own computer, in Catalan:
- She keeps a class list and the usual primary areas (Llengua catalana, Matemàtiques, Medi…).
- During the term she writes very short notes per student and area (keyboard only, under 10 seconds per note).
- At report time Apunt replaces every student name with a code (A-01, A-02…), asking her when a name is unclear, and shows her the exact text before it leaves the computer.
- The AI writes 6–8 sentences per area **only from her notes**. A second check flags any sentence that does not come from a note ("No surt de les notes", "Exagera"). Areas with no notes get no text.
- She edits, keeps or deletes each sentence, the names are put back, and she copies the final report.

The one thing this MVP must prove: **a tutor can check and fix an AI report in under 15 minutes per student** (today it takes her about 30 minutes with ChatGPT).

## What the MVP deliberately does NOT do (thrown away for now)
- Accounts, login and sync between devices (Supabase). The encryption module is built and tested, but it is not connected until the AI report is proven.
- Phone app, voice dictation and a real PWA for teachers. (A public demo link with fake data exists only so others can try the prototype.)
- Learning the teacher's style from her edits (the Session 5 "teacher memory" defense).
- Word or PDF export (the report is plain text to copy).
- Connecting to the school's official platform.
- More than one class or teacher, other languages, a chat box for prompts, statistics or dashboards.

## Rule for adding features later
We will only add a new feature if a real user does this:
- **Accounts + sync + phone:** my mother (and at least one colleague) write real notes for two weeks in a row without me asking, and say they would write more if they could do it from the phone.
- **Publishing for real teachers (with real data):** a second teacher who is not my mother wants to use it on her own computer.
- **Style learning:** a teacher has corrected at least 10 real reports, so there is real draft-vs-final data to learn from.
- **Export to Word/PDF:** a teacher has to submit reports in a format where copy-paste does not work.
