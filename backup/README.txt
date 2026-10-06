Backups of the competency survey database
=========================================

Where the data lives
  Everything of the tool (classes with their settings and rosters, students'
  answers, the activity log) is stored in the Cloudflare D1 database
  "competency-survey". It is persistent: signing out or closing the page
  changes nothing. Cloudflare also keeps its own point-in-time history of the
  database for 30 days (D1 Time Travel), restorable with:
    npx wrangler d1 time-travel restore competency-survey --timestamp <ISO time>

Daily dump into Google Drive
  backup.ps1 exports the whole database as SQL into backups\competency-survey\
  of the tools folder that contains this repository
  (F:\GDriveMay\Maysam\01_online_tools\backups\competency-survey). That folder
  is in Google Drive, so the dumps are synced, and it is outside the
  repository, so they never reach the public repository. The newest 90 dumps
  are kept, plus the first dump of every month, which is never deleted.
  A failed export is retried up to five attempts, 10 minutes apart;
  last_run.log has the output of every attempt of the last run. If all five
  fail, the run writes BACKUP_FAILED.txt into that folder (the next good run
  deletes it).

  After each dump, export_csv.mjs writes readable CSV copies of it into the
  csv\ subfolder of that folder (replacing the previous set): per class the
  answers (the columns of the Responses tab's "Download CSV") and the log.
  For an older day, from this repository's folder:
    node --no-warnings backup/export_csv.mjs "<path of that day's .sql file>"

  Scheduled task "competency-survey backup" starts it daily at 03:20 (and on
  the next start-up if the PC was off; not on battery). Manage it in Task
  Scheduler, or:
    schtasks /Query /TN "competency-survey backup"
    schtasks /Run   /TN "competency-survey backup"
    schtasks /Delete /TN "competency-survey backup" /F

Per-class download from the instructor page
  The Settings tab has "Download JSON": one file with the class's settings,
  roster, every answer, and the whole log.

Restoring a dump
  From the worker/ folder:
    npx wrangler d1 execute competency-survey --remote --file "../../backups/competency-survey/<file>.sql"
  The dump recreates the tables, so drop them first if they exist
  (npx wrangler d1 execute competency-survey --remote --command "DROP TABLE classes; DROP TABLE responses; DROP TABLE log"),
  or restore a single class by copying its INSERT lines (responses rows are
  keyed by class, round, and email; log rows by class).
