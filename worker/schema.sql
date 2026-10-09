-- One row per class: settings, roster, and the class's survey (its questions) as JSON (see src/survey.js).
CREATE TABLE IF NOT EXISTS classes (
  key   TEXT PRIMARY KEY,
  state TEXT NOT NULL
);

-- One row per student and round: answers = {questionId: 1..5, or "na" for the sixth option} (ids in the class's survey),
-- saved = time of the last change, submitted = time of the first complete submission ('' before it),
-- goals = JSON list of the section ids the student chose to improve on the results page (up to 3).
CREATE TABLE IF NOT EXISTS responses (
  class     TEXT NOT NULL,
  round     TEXT NOT NULL,
  email     TEXT NOT NULL,
  answers   TEXT NOT NULL DEFAULT '{}',
  saved     TEXT NOT NULL,
  submitted TEXT NOT NULL DEFAULT '',
  goals     TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (class, round, email)
);
-- A database created before 2026-10-09 (goals added) is migrated with:
--   ALTER TABLE responses ADD COLUMN goals TEXT NOT NULL DEFAULT '[]';

-- Activity history: sign-in actions of students and every instructor change, with refused attempts.
CREATE TABLE IF NOT EXISTS log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  time   TEXT NOT NULL,
  class  TEXT NOT NULL,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS log_class ON log (class, id);
