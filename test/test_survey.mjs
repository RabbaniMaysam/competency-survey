// Checks the survey rules (worker/src/survey.js) and the item list (worker/src/items.js).  node test/test_survey.mjs
import fs from 'node:fs';
import * as sv from '../worker/src/survey.js';
import { COMPETENCIES, ITEMS, LEVELS, TEXTS } from '../worker/src/items.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('FAIL:', label)); };
const throws = (fn, re, label) => { try { fn(); ok(false, label + ' (did not throw)'); } catch (e) { ok(re.test(e.message), label + ' (' + e.message + ')'); } };
const T0 = Date.parse('2026-09-01T12:00:00Z');

// items: 18 one-sentence statements in 6 blocks, five levels
ok(COMPETENCIES.length === 6 && ITEMS.length === 18 && COMPETENCIES.every(c => /2$/.test(c.code) && c.dims.length === 3 && c.dims.every(d => d.name && /^[A-Z].*\.$/.test(d.text) && d.text.length < 160)), '6 blocks of 3 one-sentence statements');
ok(new Set(ITEMS.map(i => i.id)).size === 18 && ITEMS.every(i => /^[a-z]+2\.[a-z]+$/.test(i.id) && i.text), 'item ids are unique');
ok(LEVELS.length === 5 && LEVELS[0] === 'Not at all' && LEVELS[4] === 'Fully', 'five confidence levels');
ok(TEXTS.title === 'Career skills self-assessment' && TEXTS.intro.start && TEXTS.intro.end && TEXTS.instruction && TEXTS.prompt, 'the student page texts');

// a new class
const s = sv.newClass('  BUS 101  ', T0);
ok(s.title === 'BUS 101' && s.roster.length === 0 && s.off.length === 0 && !('version' in s) && s.rounds.map(r => r.id).join() === 'start,end' && s.rounds.every(r => !r.open), 'new class: every competency on, two closed rounds');
ok(sv.activeItems(s).length === 18 && sv.activeCompetencies(s).length === 6, 'new class: 18 items in 6 blocks');
const old = sv.upgrade({ title: 'x', version: 1, off: ['equity', 'career2'] });
ok(old.off.join() === 'career2' && !('version' in old) && old.rounds.length === 2 && Array.isArray(old.roster), 'upgrade: drops the stored version and off codes of the removed survey');
ok(sv.upgrade({ title: 'x' }).off.length === 0, 'upgrade: a class without an off list has every competency on');

// roster
sv.ADMIN.importRoster(s, 'first,last,email\nAmy,Zed,AZ@mail.montclair.edu\nBo,Abe,bo@montclair.edu');
ok(s.roster.map(r => r.email).join() === 'bo@montclair.edu,az@montclair.edu', 'roster imported, folded, sorted by last name');
sv.ADMIN.addStudent(s, 'Cy', 'Moe', 'cy@montclair.edu');
throws(() => sv.ADMIN.addStudent(s, 'Cy', 'Moe', 'CY@mail.montclair.edu'), /on the roster/, 'duplicate student refused');
throws(() => sv.ADMIN.addStudent(s, 'X', 'Y', 'nope'), /not valid/, 'bad email refused');
ok(sv.student(s, 'AZ@MAIL.montclair.edu').first === 'Amy', 'student found by either address form');
sv.ADMIN.removeStudent(s, 'cy@montclair.edu');
ok(s.roster.length === 2, 'student removed');
throws(() => sv.ADMIN.removeStudent(s, 'cy@montclair.edu'), /not on the roster/, 'removing twice refused');
// Removing several students at once: all must be on the roster, duplicates count once, nothing changes on a refusal.
throws(() => sv.ADMIN.removeStudents(s, []), /No student is selected/, 'bulk removal of nobody refused');
throws(() => sv.ADMIN.removeStudents(s, ['bo@montclair.edu', 'cy@montclair.edu']), /cy@montclair.edu is not on the roster/, 'bulk removal with an unknown email refused');
ok(s.roster.length === 2, 'a refused bulk removal changes nothing');
{
  const copy = JSON.parse(JSON.stringify(s));
  const gone = sv.ADMIN.removeStudents(copy, ['AZ@mail.montclair.edu', 'az@montclair.edu']);
  ok(copy.roster.length === 1 && copy.roster[0].email === 'bo@montclair.edu' && gone.length === 1 && gone[0].first === 'Amy', 'bulk removal by either address form, duplicates once; the removed rows are returned');
}
// Import with a choice: a preview lists the students not in the file; the ones the instructor keeps stay unchanged.
{
  const k = sv.newClass('Keep test', T0);
  sv.ADMIN.importRoster(k, 'first,last,email\nAmy,Zed,az@x.edu\nBo,Abe,bo@x.edu\nCy,Moe,cy@x.edu');
  const csv2 = 'first,last,email\nAmy,Zed,AZ@x.edu\nDi,Oak,di@x.edu';
  const p = sv.previewRoster(k.roster, csv2);
  ok(p.file === 2 && p.matched === 1 && p.added.map(r => r.email).join() === 'di@x.edu' && p.missing.map(r => r.email).join() === 'bo@x.edu,cy@x.edu' && k.roster.length === 3,
    'preview: file count, matched, new, and missing students; nothing changes');
  sv.ADMIN.importRoster(k, csv2, ['CY@x.edu']);
  ok(k.roster.map(r => r.email).join() === 'cy@x.edu,di@x.edu,az@x.edu', 'a kept student stays, an unchecked one is dropped, sorted by last name');
  sv.ADMIN.importRoster(k, csv2);
  ok(k.roster.map(r => r.email).join() === 'di@x.edu,az@x.edu', 'without a keep list (older page) every student not in the file is dropped');
}

// rounds
const start = sv.round(s, 'start');
throws(() => sv.round(s, 'middle'), /no survey round/, 'unknown round');
ok(!sv.isOpen(start, T0), 'closed at first');
throws(() => sv.ADMIN.openRound(s, 'start', '2026-08-01T00:00:00Z', T0), /has passed/, 'closing time in the past refused');
throws(() => sv.ADMIN.openRound(s, 'start', 'soon', T0), /not valid/, 'bad closing time refused');
sv.ADMIN.openRound(s, 'start', '', T0);
ok(sv.isOpen(start, T0 + 1e10) && start.closes === '' && start.openedAt === new Date(T0).toISOString(), 'open without a closing time stays open');
sv.ADMIN.setCloses(s, 'start', new Date(T0 + 3600000).toISOString(), T0);
ok(sv.isOpen(start, T0 + 3599999) && !sv.isOpen(start, T0 + 3600000), 'closes by itself at the closing time');
throws(() => sv.ADMIN.closeRound(s, 'start', T0 + 3600001), /not open/, 'closing a lapsed round refused');
throws(() => sv.ADMIN.setCloses(s, 'end', '', T0), /not open/, 'closing time of a closed round refused');
sv.ADMIN.openRound(s, 'start', '', T0 + 7200000);
ok(sv.isOpen(start, T0 + 7200001) && start.closes === '', 'reopened');
sv.ADMIN.closeRound(s, 'start', T0 + 7300000);
ok(!sv.isOpen(start, T0 + 7300001) && start.closedAt === new Date(T0 + 7300000).toISOString(), 'closed by hand');
sv.ADMIN.openRound(s, 'start', '', T0);

// answers
const full = {};
sv.activeItems(s).forEach((i, k) => { full[i.id] = (k % 5) + 1; });
ok(Object.keys(sv.cleanAnswers(s, full)).length === 18 && sv.missing(s, sv.cleanAnswers(s, full)).length === 0, 'a full answer set has nothing missing');
ok(sv.cleanAnswers(s, { 'career2.strengths': '3', 'nope.x': 1, 'career.strengths': 2, 'thinking2.parts': '' })['career2.strengths'] === 3
  && Object.keys(sv.cleanAnswers(s, { 'nope.x': 1, 'career.strengths': 2, 'thinking2.parts': '' })).length === 0, 'answers cleaned: numbers kept; unknown items and items of the removed survey dropped');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 6 }), /not valid/, 'level 6 refused');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 0 }), /not valid/, 'level 0 refused');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 'na' }), /not valid/, 'N/A refused');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 2.5 }), /not valid/, 'a fraction refused');
ok(Object.keys(sv.cleanAnswers(s, null)).length === 0 && Object.keys(sv.cleanAnswers(s, [1, 2])).length === 0, 'no answers from junk');
ok(sv.missing(s, { 'career2.strengths': 1 }).length === 17, 'missing items listed');

// student view: heading, intro per round, instruction, prompt, five levels, statements
const v = sv.studentView(s, 'bo@montclair.edu', [{ round: 'start', answers: { 'career2.strengths': 2 }, saved: 'x', submitted: '' }], T0);
ok(v.authorized && v.name === 'Bo Abe' && v.competencies.length === 6 && v.competencies.every(c => c.dims.every(d => d.text)), 'student view lists the competencies turned on, with their statements');
ok(v.heading === 'Career skills self-assessment' && v.levels.length === 5 && v.instruction && v.prompt === 'Rate your confidence in doing the following'
  && v.rounds[0].intro && v.rounds[1].intro && v.rounds[0].intro !== v.rounds[1].intro && !('version' in v) && !('na' in v), 'student view: heading, scale, and texts');
ok(v.rounds[0].open && v.rounds[0].answers['career2.strengths'] === 2 && !v.rounds[1].open && v.rounds[1].saved === '', 'student view: round status and own answers');
ok(sv.studentView(s, 'stranger@x.edu', [], T0).authorized === false && !('rounds' in sv.studentView(s, 'stranger@x.edu', [], T0)), 'a stranger sees nothing');
ok(v.needCode === true && v.rounds[0].started === true && v.rounds[1].started === false, 'student view: session code needed, a round with a stored row is started');

// session code: 4 digits from the secret and the slot (30 seconds by default); the current and the previous code are accepted
ok(s.code === true && s.codeSec === 30 && /^[0-9a-f]{32}$/.test(s.secret) && sv.newClass('x', T0).secret !== s.secret, 'new class: code required, 30-second interval, random secret');
const T30 = T0 - (T0 % 30000);
ok(sv.codeMs(s) === 30000 && sv.codeSlot(T30 + 29999, s) === sv.codeSlot(T30, s) && sv.codeSlot(T30 + 30000, s) === sv.codeSlot(T30, s) + 1, '30-second slots');
const slot = sv.codeSlot(T0, s), codes = [-2, -1, 0, 1].map(k => sv.sessionCode(s, slot + k));
ok(codes.every(c => /^\d{4}$/.test(c)) && sv.sessionCode(s, slot) === codes[2] && sv.sessionCode({ secret: 'other' }, slot) !== codes[2], 'codes are 4 digits, fixed per slot, differ by secret');
sv.checkCode(s, codes[2], T0); sv.checkCode(s, ' ' + codes[1] + ' ', T0);
ok(true, 'current and previous code accepted');
if (codes[0] !== codes[1] && codes[0] !== codes[2]) throws(() => sv.checkCode(s, codes[0], T0), /changes every 30 seconds/, 'a code two slots old refused, with the interval in the message');
if (codes[3] !== codes[1] && codes[3] !== codes[2]) throws(() => sv.checkCode(s, codes[3], T0), /Wrong session code/, 'the next code refused');
throws(() => sv.checkCode(s, '', T0), /Wrong session code/, 'empty code refused');
ok(sv.upgrade({ title: 'x' }).code === true && sv.upgrade({ title: 'x', code: false }).code === false, 'upgrade: code required unless turned off');
ok(sv.upgrade({ title: 'x' }).codeSec === 30 && sv.upgrade({ title: 'x', codeSec: 12 }).codeSec === 12, 'upgrade: a class without an interval receives 30 seconds');
// the instructor page's copy of sessionCode gives the same codes
const admin = fs.readFileSync(new URL('../docs/survey_admin.html', import.meta.url), 'utf8');
const copy = new Function(admin.match(/function sessionCode\(secret, slot\) \{[\s\S]*?\n  \}/)[0] + '; return sessionCode;')();
ok([0, 1, 2, 999, 123456].every(k => copy(s.secret, slot + k) === sv.sessionCode(s, slot + k)), 'the instructor page computes the same codes');
const pageSec = new Function('D', admin.match(/function codeSec\(\) \{[^\n]*\}/)[0] + '; return codeSec();');
ok(pageSec({ state: { codeSec: 12 } }) === 12 && pageSec({ state: {} }) === 30 && pageSec(null) === 30, 'the instructor page reads the interval, 30 seconds by default');

// the interval between codes is a setting: slots, validity, and the error text follow it
const g = sv.newClass('Interval', T0);
sv.ADMIN.saveSettings(g, { codeSec: '12' });
const T12 = T0 - (T0 % 12000) + 1000, g12 = sv.codeSlot(T12, g);
ok(g.codeSec === 12 && sv.codeMs(g) === 12000 && sv.codeSlot(T12 + 10999, g) === g12 && sv.codeSlot(T12 + 11000, g) === g12 + 1
  && sv.studentView(Object.assign(g, { roster: [{ first: 'A', last: 'B', email: 'a@x.edu' }] }), 'a@x.edu', [], T12).codeSec === 12, 'a 12-second interval: slots, and sent to the student page');
sv.checkCode(g, sv.sessionCode(g, g12 - 1), T12);
ok(true, 'the previous 12-second code accepted');
const c12old = sv.sessionCode(g, g12 - 2);
if (c12old !== sv.sessionCode(g, g12) && c12old !== sv.sessionCode(g, g12 - 1)) throws(() => sv.checkCode(g, c12old, T12), /changes every 12 seconds/, 'refused two slots later, with the interval in the message');
sv.ADMIN.saveSettings(g, { title: 'Interval 2' });
ok(g.codeSec === 12, 'saving without the interval keeps it');
['2', '301', '6.5', 'x'].forEach(bad => throws(() => sv.ADMIN.saveSettings(g, { codeSec: bad }), /whole number of seconds from 3 to 300/, 'interval "' + bad + '" refused'));
ok(g.codeSec === 12, 'a refused interval changes nothing');

// settings: competencies turned off and on, at least one stays on
sv.ADMIN.saveSettings(s, { off: ['career2', 'teamwork2'] });
ok(s.off.join() === 'teamwork2,career2' && sv.activeItems(s).length === 12 && sv.studentView(s, 'bo@montclair.edu', [], T0).competencies.length === 4, 'off list stored in survey order; 12 items left');
sv.ADMIN.saveSettings(s, { off: [] });
ok(sv.activeItems(s).length === 18, 'every competency turned on again');
sv.ADMIN.saveSettings(s, { off: ['teamwork2'] });
throws(() => sv.ADMIN.saveSettings(s, { off: ['bogus'] }), /Unknown competency/, 'unknown competency refused');
throws(() => sv.ADMIN.saveSettings(s, { off: ['career'] }), /Unknown competency/, 'a competency of the removed survey refused');
throws(() => sv.ADMIN.saveSettings(s, { off: COMPETENCIES.map(c => c.code) }), /at least one/i, 'turning all off refused');
throws(() => sv.ADMIN.saveSettings(s, { title: ' ' }), /title/, 'empty title refused');
sv.ADMIN.saveSettings(s, { title: 'New title', version: '1' });
ok(s.title === 'New title' && s.off.join() === 'teamwork2' && s.code === true && !('version' in s), 'title alone changes only the title; a version sent by an old page is ignored');
throws(() => sv.ADMIN.resetRound(s, 'start', T0), /Close the start of semester survey first/, 'an open round cannot be reset');
sv.ADMIN.closeRound(s, 'start', T0);
sv.ADMIN.resetRound(s, 'start', T0 + 1);
ok(['open', 'closes', 'openedAt', 'closedAt'].every(k => !sv.round(s, 'start')[k]), 'a closed round resets to not opened');
sv.ADMIN.saveSettings(s, { code: false });
ok(s.code === false && sv.studentView(s, 'bo@montclair.edu', [], T0).needCode === false, 'session code turned off');

console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
