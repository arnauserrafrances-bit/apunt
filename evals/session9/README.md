# Session 9 eval: AI judge

Invented class (A-01 Marta, A-02 Pau, A-03 Oriol, A-04 Iolanda, A-05 Anna), no real children's data. Re-run on the live app on 17 Nov 2026.

- `cases.json`: the 15 requests exactly as the app sends them to `/api/report` (and `/api/edit` for cases 13-15), names already replaced by codes, with the school model as `guide`.
- `results.json`: what the live app answered (sentences, checker flags, chat replies).
- `case_texts.json`: each case written as REQUEST / ANSWER for the judge, plus 6 seeded failures (S1-S6).
- `judgeprompt.md`: the judge prompt, all versions.
- `judge_results.json`: our verdicts with reasons and the judge's verdict in each round.

The judge is `frontend/api/judge.ts` (POST with the access code, body `{ "prompt": "..." }`).
