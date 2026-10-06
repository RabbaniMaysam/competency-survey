// Readable CSV copies of a database dump, written by backup.ps1 after each daily dump.
//   node --no-warnings backup/export_csv.mjs [dump.sql]
// Without an argument it reads the newest dump in ..\backups\competency-survey. The files go to
// ..\backups\competency-survey\csv\ and replace the previous set; to see an older day, run it on that day's dump.
// Per class: the answers (the columns of the Responses tab's "Download CSV") and the log.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sv from '../worker/src/survey.js';
import { ITEMS } from '../worker/src/items.js';

const here = dirname(fileURLToPath(import.meta.url));
const store = join(here, '..', '..', 'backups', 'competency-survey');
const dump = process.argv[2] || join(store, readdirSync(store).filter(f => /^competency-survey_.*\.sql$/.test(f)).sort().pop());
const out = join(store, 'csv');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(dump, 'utf8'));
const all = (sql, ...a) => db.prepare(sql).all(...a);

const TZ = 'America/New_York';
const isoFull = iso => (iso ? new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date(iso)) : '');
const safe = k => String(k).replace(/[^A-Za-z0-9_.-]/g, '_');

let files = 0;
function write(name, rows) {
  const csv = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  writeFileSync(join(out, name), '﻿' + csv + '\r\n');  // the byte-order mark makes Excel read the names as UTF-8
  files++;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const row of all('SELECT key, state FROM classes ORDER BY key')) {
  const k = row.key, s = sv.upgrade(JSON.parse(row.state));
  const resp = all('SELECT round, email, answers, saved, submitted FROM responses WHERE class = ? ORDER BY round, email', k)
    .map(r => Object.assign({}, r, { answers: JSON.parse(r.answers || '{}') }));
  const people = s.roster.map(r => ({ r, email: r.email, gone: false }));
  resp.forEach(x => { if (!people.some(p => p.email === x.email)) people.push({ r: null, email: x.email, gone: true }); });
  const cols = ITEMS.filter(i => s.off.indexOf(i.comp) === -1 || resp.some(x => i.id in x.answers));
  const rows = [['Last name', 'First name', 'Email', 'On roster', 'Survey', 'Status', 'Submitted', 'Last change'].concat(cols.map(i => i.compName + ': ' + i.dimName))];
  people.forEach(p => s.rounds.forEach(r => {
    const x = resp.find(y => y.round === r.id && y.email === p.email);
    if (!x && p.gone) return;
    rows.push([p.r ? p.r.last : '', p.r ? p.r.first : '', p.email, p.gone ? 'no' : 'yes', r.name,
      !x ? 'not started' : x.submitted ? 'submitted' : 'started', x ? isoFull(x.submitted) : '', x ? isoFull(x.saved) : '']
      .concat(cols.map(i => { const v = x ? x.answers[i.id] : undefined; return v === undefined ? '' : v === 'na' ? 'NA' : v; })));
  }));
  write(safe(k) + '_answers.csv', rows);
  write(safe(k) + '_log.csv', [['Time (New York)', 'Time (ISO)', 'Account', 'Action', 'Detail']].concat(
    all('SELECT time, actor, action, detail FROM log WHERE class = ? ORDER BY time, id', k).map(r => [isoFull(r.time), r.time, r.actor, r.action, r.detail])));
}
console.log('CSV: ' + files + ' files in ' + out);
