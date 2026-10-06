# Competency survey

A web page where students rate their own career competencies at the start and at the end of the semester, with an instructor page to open and close the two surveys, see who submitted, read each student's answers, compare the two rounds, and download everything as CSV.

The items are the NACE Career Competency Assessment Tool (student version, 2024): 8 competencies with 25 items (Communication has 4, the others 3), each rated on four levels (Emerging Knowledge, Understanding, Early Application, Advanced Application) or N/A. The text is in `worker/src/items.js`; the source PDF is not in the repository.

- `docs/` holds the two pages, served by GitHub Pages: `survey.html` for students (link `survey.html?c=key`) and `survey_admin.html` for the instructor.
- `worker/` is the backend, a Cloudflare Worker with a D1 database.
- `backup/` has the daily dump of the database and its restore notes.
- `test/` holds the checks (see Tests).

No student data is stored in this repository. Each class's roster, answers, and activity log are in the database.

## How it works

A class has a roster, a title, the list of competencies turned off, and two survey rounds, "Start of semester" and "End of semester". The instructor opens a round by hand, with an optional closing time at which it closes by itself, and can close it, reopen it, or change the closing time. A student signs in, sees the open survey (each competency's definition, then each item with its four level descriptions and N/A as buttons), and answers. Answers are saved as the student goes, so the survey can be finished later. Submit is accepted once every item has an answer (N/A counts). While the round is open, the student can change answers and submit again; the first submission time is kept. If both rounds are open at once, the student chooses which one to answer.

Equity & Inclusion is off by default (`offByDefault` in `items.js`). The Settings tab turns any competency on or off for the class, for both rounds; at least one stays on. Turning a competency off keeps the answers already given to it. Turning one on adds its items, so a student who has submitted answers them by submitting again.

The instructor page has six tabs. Overview: the two rounds with their status, submission counts, and open and close controls. Responses: one row per student with each round's status, each student's answers on request, a "Delete answers" button per round (the student starts that round again), and a CSV with one row per student and round and one column per item. Results: per item, the mean level of each round's submitted answers (N/A left out and counted), and the mean change for students who submitted both, as a table and a CSV. Settings: the title, the competencies, a full JSON download, and deleting the class. Roster: import (Canvas gradebook export or first, last, email columns), add, remove; a removed student's answers are kept and listed as not on the roster. Log: students' first answer to a round, each submission, every instructor change, and every refused attempt, with search and CSV.

Rules are in `worker/src/survey.js`; storage is the `classes`, `responses`, and `log` tables (`worker/schema.sql`). Only the accounts in the Worker's `ADMIN_EMAILS` secret can use the instructor page.

## Roster files

The import (`parseRoster` in `worker/src/roster.js`, a copy of the attendance tool's) reads the Canvas gradebook export, with a "Student" column ("Last, First") and a "SIS Login ID" column (the address before the @, completed with `@montclair.edu`; the "Points Possible" row and Canvas's test student are skipped), or a CSV with first name, last name, and email columns in any order. Addresses are lowercased, and `@mail.montclair.edu` is stored as `@montclair.edu`; a student may sign in with either form.

## Sign-in

The pages use the "Sign in with Google" button. The Worker verifies Google's signature on the sign-in token and that the token was issued for this tool's client ID, then answers with a session token of its own (signed with the `SESSION_SECRET` secret, valid 180 days), which the page keeps in the browser's storage, so a student signs in with Google once per browser. "Sign out" deletes it. The client ID (`GOOGLE_CLIENT_ID` in `worker/wrangler.toml`) is the one the group sign-up and attendance tools use; Google Cloud Console lists `https://rabbanimaysam.github.io` under its "Authorized JavaScript origins" and the student page's full address, `https://rabbanimaysam.github.io/competency-survey/survey.html`, under "Authorized redirect URIs". The redirect URI serves the "Choose or add the university account" link under the button, which opens Google's account chooser for a browser signed into a personal account. The tool holds no permission on any Google account.

## Deployment

From `worker/`, with a Cloudflare account:

```
npx wrangler d1 create competency-survey     # once; copy the database_id into wrangler.toml
npx wrangler d1 execute competency-survey --remote --file schema.sql
npx wrangler secret put ADMIN_EMAILS         # comma-separated instructor emails
npx wrangler secret put SESSION_SECRET       # any long random string (signs the session tokens)
npx wrangler deploy
```

Then write the Worker's address into `docs/config.js`. Adding an instructor is a new value of `ADMIN_EMAILS`.

## Tests

- `node test/test_survey.mjs` checks the item list and the rules (rounds, closing times, answers, settings, roster, the student view).
- `node test/test_worker.mjs` checks a local copy of the Worker end to end (its header lists the commands).
- `node test/check_pages.mjs` checks that the page scripts parse and reference no undeclared names.
