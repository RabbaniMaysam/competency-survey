-- One row per class: settings and roster as JSON (see src/survey.js).
CREATE TABLE IF NOT EXISTS classes (
  key   TEXT PRIMARY KEY,
  state TEXT NOT NULL
);

-- One row per student and round: answers = {itemId: 1..4 or "na"} (item ids in src/items.js),
-- saved = time of the last change, submitted = time of the first complete submission ('' before it).
CREATE TABLE IF NOT EXISTS responses (
  class     TEXT NOT NULL,
  round     TEXT NOT NULL,
  email     TEXT NOT NULL,
  answers   TEXT NOT NULL DEFAULT '{}',
  saved     TEXT NOT NULL,
  submitted TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (class, round, email)
);

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
