# Apunt — Security note

Apunt stores notes about children (students aged 6–12) written by their tutor. That is sensitive personal data under GDPR, so the design starts from one rule: **nobody except the teacher can read it — not the AI, not the server, not us.**

## 1. Student names never reach the AI
- Every student gets a code (A-01, A-02…). Codes come from a counter and are never reused.
- Before any text is sent to the AI, the device replaces full names, name + surname and first names with the code (`lib/anonymize.ts`, 11 tests).
- If a name is ambiguous (e.g. "Pau" = name or "peace"; two students with the same name), the app **asks the teacher instead of guessing**.
- The teacher sees the exact anonymised text before it is sent. Names are put back only on her device, at the end.
- No API key is in the frontend. The AI runs in a Vercel server function (`frontend/api/report.ts`) that only receives anonymised text, needs an access code, limits the size of each request, and does not store or log the notes. The key lives only in Vercel's environment variables.
- Names are put back on the device with the right Catalan article (`lib/articles.ts`); the AI only ever sees "la A-01" or "en A-01".

## 2. End-to-end encryption (built and tested)
Only standard primitives from libsodium and WebCrypto; no home-made cryptography (`lib/crypto.ts`, 18 tests; `lib/backup.ts`, 5 tests).
- **Password → keys on the device.** Argon2id (64 MB, 3 passes) turns the password into a master key, which is split into two separate keys: `authKey` (sent to Supabase as the login password) and `wrapKey` (never leaves the device). The plain password is never sent.
- **Data key.** All records are encrypted with a random `dataKey` using XChaCha20-Poly1305. Each record is bound to its user and record id, so encrypted records cannot be swapped between users or items.
- **Keyring.** The `dataKey` is stored on the server only in wrapped (encrypted) form: once with `wrapKey` and once with a recovery code (160 bits) shown to the teacher when she signs up. Changing the password only re-wraps the key.
- **Backups (.apunt file).** Contain the wrapped keyring and the encrypted records; they open only with the password or the recovery code, even if Supabase data is lost.
- **"Remember this device"** is optional and off by default. If on, the `dataKey` is kept in IndexedDB wrapped with a non-exportable WebCrypto key; "Log out" deletes it.

## 3. Server side (Supabase, planned)
- Free plan, **EU region**. Email + password authentication.
- **Row Level Security on every table:** each user can only read and write her own rows.
- The server only stores encrypted blobs; even with full database access, notes and reports cannot be read.

## 4. Current state of the MVP
- The prototype that runs today uses **fake data only** (25 invented students), stored in the browser. No real student data has been entered or uploaded anywhere.
- Accounts, sync and the AI are not live yet. Testers (the real tutor) will use real data only once encryption and sync are connected.

## 5. Known limitations (honest list)
- **Malicious code:** whoever controls the code that is served (Vercel or GitHub) could serve a version that steals the password. Mitigation: strict Content Security Policy; open question for later.
- **Metadata:** the server can see the teacher's email, how many records she has, their size and when they change — but not their content.
- **Lost password + lost recovery code = lost data.** The server cannot recover it. This is the price of end-to-end encryption.
- **Name check:** it only knows names in the class list. Nicknames, siblings or parents are not caught unless the teacher adds them; the preview step is the safety net.
- **Email confirmation** is off temporarily for MVP testers (Supabase free email limit); it comes back with our own SMTP.
- **Email change is blocked** in the MVP, because the Argon2id salt is derived from the email.
