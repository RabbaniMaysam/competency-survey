// Checks the survey rules (worker/src/survey.js) and the item list (worker/src/items.js).  node test/test_survey.mjs
import fs from 'node:fs';
import * as sv from '../worker/src/survey.js';
import { COMPETENCIES, LEVELS, TEXTS, NA_LABEL, UNIT, defaultSurvey } from '../worker/src/items.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('FAIL:', label)); };
const throws = (fn, re, label) => { try { fn(); ok(false, label + ' (did not throw)'); } catch (e) { ok(re.test(e.message), label + ' (' + e.message + ')'); } };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);
const T0 = Date.parse('2026-09-01T12:00:00Z');

// the default survey: 18 one-sentence statements in 6 blocks, five levels, no question with the sixth option
const DEF = defaultSurvey(), DEF_ITEMS = sv.surveyItems(DEF);
ok(COMPETENCIES.length === 6 && DEF.blocks.length === 6 && DEF_ITEMS.length === 18 && COMPETENCIES.every(c => /2$/.test(c.code) && c.dims.length === 3 && c.dims.every(d => !('name' in d) && /^[A-Z].*\.$/.test(d.text) && d.text.length < 160)), '6 blocks of 3 one-sentence statements');
ok(new Set(DEF_ITEMS.map(i => i.id)).size === 18 && DEF_ITEMS.every(i => /^[a-z]+2\.[a-z]+$/.test(i.id) && i.text && i.na === false), 'item ids are unique; no sixth option by default');
ok(LEVELS.length === 5 && LEVELS[0] === 'Not at all' && LEVELS[4] === 'Fully' && DEF.levels.join() === LEVELS.join() && DEF.naLabel === NA_LABEL && NA_LABEL === 'Didn\'t have a chance to try', 'five confidence levels; the sixth option "Didn\'t have a chance to try"');
ok(sv.upgrade({ title: 'x', survey: Object.assign(defaultSurvey(), { naLabel: 'No chance to try' }) }).survey.naLabel === NA_LABEL && sv.upgrade({ title: 'x', survey: Object.assign(defaultSurvey(), { naLabel: 'N/A' }) }).survey.naLabel === 'N/A', 'upgrade renames the old default label only');
ok(TEXTS.title === 'Career skills self-assessment' && TEXTS.intro.start && TEXTS.intro.end && TEXTS.instruction && TEXTS.prompt && DEF.heading === TEXTS.title && DEF.unit.one === UNIT.one, 'the student page texts');
ok(defaultSurvey() !== DEF && defaultSurvey().blocks[0] !== DEF.blocks[0], 'each call gives a fresh copy');

// a new class
const s = sv.newClass('  BUS 101  ', T0);
ok(s.title === 'BUS 101' && s.roster.length === 0 && !('off' in s) && s.retired.length === 0 && !('version' in s) && s.rounds.map(r => r.id).join() === 'start,end' && s.rounds.every(r => !r.open), 'new class: the default survey, two closed rounds');
ok(sv.activeItems(s).length === 18 && s.survey.blocks.length === 6 && JSON.stringify(s.survey) === JSON.stringify(DEF), 'new class: 18 items in 6 blocks');
// a class saved before the Questions tab: the default survey without the blocks it had turned off, whose questions are retired
const old = sv.upgrade({ title: 'x', version: 1, off: ['equity', 'career2'] });
ok(!('off' in old) && !('version' in old) && old.survey.blocks.length === 5 && !old.survey.blocks.some(b => b.id === 'career2') && old.rounds.length === 2 && Array.isArray(old.roster),
  'upgrade: the default survey without the blocks turned off; off and version dropped');
ok(old.retired.map(r => r.id).join() === 'career2.strengths,career2.requirements,career2.outreach' && old.retired.every(r => r.blockName === 'Career and self-development' && !('name' in r) && r.text),
  'upgrade: the questions of a block turned off are retired, with their labels');
// a class saved before the advice field: the short labels dropped, each question given the placeholder;
// a numbered placeholder of the first version loses its number
{
  const pre = sv.newClass('x', T0);
  pre.survey.blocks.forEach(b => b.items.forEach(i => { i.name = 'label'; delete i.advice; }));
  pre.survey.blocks[1].items[2].advice = 'Kept.';
  pre.survey.blocks[2].items[0].advice = 'Placeholder advice 3.1';
  pre.survey.blocks[2].items[1].advice = 'Placeholder advice 3.2, then practice.';
  pre.retired.push({ id: 'old.q', blockName: 'Old', name: 'old label', text: 'Old question.' });
  sv.upgrade(pre);
  ok(pre.survey.blocks.every(b => b.items.every(i => !('name' in i))) && pre.survey.blocks[0].items[0].advice === 'Placeholder advice' && pre.survey.blocks[5].items[2].advice === 'Placeholder advice'
    && pre.survey.blocks[1].items[2].advice === 'Kept.' && pre.survey.blocks[2].items[0].advice === 'Placeholder advice' && pre.survey.blocks[2].items[1].advice === 'Placeholder advice 3.2, then practice.'
    && !('name' in pre.retired[0]) && sv.allItems(pre).slice(-1)[0].name === 'Old question.', 'upgrade: short labels dropped; placeholder advice, numbers dropped; stored advice kept');
}
ok(DEF.blocks.every(b => b.items.every(i => i.advice === 'Placeholder advice')) && DEF_ITEMS.every(i => i.name === i.text), 'the default advice: the placeholder; an item\'s label is its statement');
ok(sv.allItems(old).length === 18 && sv.allItems(old).slice(15).every(i => i.retired) && sv.activeItems(old).length === 15, 'allItems lists the survey, then the retired questions');
ok(sv.upgrade({ title: 'x' }).survey.blocks.length === 6 && sv.upgrade({ title: 'x' }).retired.length === 0, 'upgrade: a class without an off list has the full default survey');
ok(sv.upgrade({ title: 'x', off: COMPETENCIES.map(c => c.code) }).survey.blocks.length === 6, 'upgrade: a class with every block off (not possible before) keeps the full survey');
const up2 = sv.upgrade(JSON.parse(JSON.stringify(old)));
ok(JSON.stringify(up2.survey) === JSON.stringify(old.survey) && up2.retired.length === 3, 'upgrade is idempotent');

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
ok(Object.keys(sv.cleanAnswers(s, { 'career2.strengths': 'na' })).length === 0, 'the sixth option to a question without it is dropped');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 'n/a' }), /not valid/, 'other text refused');
throws(() => sv.cleanAnswers(s, { 'career2.strengths': 2.5 }), /not valid/, 'a fraction refused');
ok(Object.keys(sv.cleanAnswers(s, null)).length === 0 && Object.keys(sv.cleanAnswers(s, [1, 2])).length === 0, 'no answers from junk');
ok(sv.missing(s, { 'career2.strengths': 1 }).length === 17, 'missing items listed');

// student view: heading, intro per round, instruction, prompt, five levels, statements
const v = sv.studentView(s, 'bo@montclair.edu', [{ round: 'start', answers: { 'career2.strengths': 2 }, saved: 'x', submitted: '' }], T0);
ok(v.authorized && v.name === 'Bo Abe' && v.blocks.length === 6 && v.blocks.every(c => c.items.length === 3 && c.items.every(d => d.id && d.text && d.na === false)), 'student view lists the blocks, with their statements');
ok(v.heading === 'Career skills self-assessment' && v.levels.length === 5 && v.naLabel === 'Didn\'t have a chance to try' && v.instruction && v.prompt === 'Rate your confidence in doing the following'
  && v.rounds[0].intro && v.rounds[1].intro && v.rounds[0].intro !== v.rounds[1].intro && !('version' in v) && !('na' in v) && v.unit.many === 'Competencies' && v.goalsMax === 3, 'student view: heading, scale, texts, the section word, and the goal limit');
ok(v.rounds[0].open && v.rounds[0].answers['career2.strengths'] === 2 && !v.rounds[1].open && v.rounds[1].saved === '', 'student view: round status and own answers');
ok(v.rounds[0].scores.length === 0 && v.rounds[0].goals.length === 0 && v.rounds[1].goals.length === 0, 'student view: no scores before submission, no goals');

// the results page: a score per section (the mean of the answers on the scale), and the goals (up to 3 sections)
{
  const e = JSON.parse(JSON.stringify(s.survey)); e.blocks[0].items[0].na = true; sv.ADMIN.saveSurvey(s, e);
  const a = {}; sv.activeItems(s).forEach((i, k) => { a[i.id] = (k % 5) + 1; });
  a['communication2.present'] = 'na';
  const sc = sv.blockScores(s, a);
  ok(sc.length === 6 && sc[0].id === 'communication2' && sc[0].name === 'Communication' && sc[0].n === 2 && sc[0].na === 1 && near(sc[0].score, (2 + 3) / 2)
    && sc[1].n === 3 && near(sc[1].score, (4 + 5 + 1) / 3) && sc.every(x => x.na === 0 || x === sc[0]), 'scores: the mean per section, the sixth option counted apart');
  ok(sv.blockScores(s, { 'communication2.present': 'na', 'communication2.memo': 7, 'career.x': 3 })[0].score === null && sv.blockScores(s, {})[0].n === 0, 'a section without an answer on the scale has no score; junk ignored');
  ok(sv.cleanGoals(s, ['teamwork2', 'communication2', 'teamwork2']).join() === 'communication2,teamwork2', 'goals: distinct ids in the survey\'s order');
  ok(sv.cleanGoals(s, []).length === 0 && sv.GOALS_MAX === 3, 'no goals is allowed');
  throws(() => sv.cleanGoals(s, ['communication2', 'teamwork2', 'thinking2', 'technology2']), /at most 3 competencies/, 'four goals refused');
  throws(() => sv.cleanGoals(s, ['nope']), /not a section/, 'an unknown section refused');
  throws(() => sv.cleanGoals(s, 'communication2'), /list/, 'a string refused');
  const row = { round: 'start', answers: a, saved: 'x', submitted: 'y', goals: ['thinking2', 'communication2', 'gone'] };
  ok(sv.goalsOf(s, row).join() === 'communication2,thinking2' && sv.goalsOf(s, null).length === 0 && sv.goalsOf(s, { goals: 'x' }).length === 0, 'the goals of a row: the ids in the survey now, in its order');
  const sv2 = sv.studentView(s, 'bo@montclair.edu', [row], T0);
  ok(sv2.rounds[0].goals.join() === 'communication2,thinking2' && sv2.rounds[0].scores.length === 6 && near(sv2.rounds[0].scores[0].score, 2.5) && sv2.rounds[0].scores[0].na === 1, 'the student view sends the submitted round\'s scores and goals');
  ok(sv2.rounds[0].advice.professionalism2 && sv2.blocks[0].items[0].advice === 'Placeholder advice', 'the student view sends the advice and the questions it applies to');
  const off = JSON.parse(JSON.stringify(s.survey)); off.blocks[0].items[0].na = false; sv.ADMIN.saveSurvey(s, off);
}

// the advice of the results page: the questions of each section the student rated low (3 or lower, or the sixth option)
{
  const q = sv.newClass('Advice', T0);
  const e = JSON.parse(JSON.stringify(q.survey)); e.blocks[0].items.forEach(i => { i.na = true; }); e.blocks[2].items[1].advice = ''; sv.ADMIN.saveSurvey(q, e);
  const a = {};
  sv.activeItems(q).forEach(i => { a[i.id] = 5; });
  Object.assign(a, { 'professionalism2.deadlines': 2, 'professionalism2.check': 5, 'professionalism2.email': 5 });  // the example: only deadlines is low
  Object.assign(a, { 'communication2.present': 'na', 'communication2.memo': 3, 'communication2.summarize': 1 });    // all low: 1, 3, then the sixth option
  Object.assign(a, { 'teamwork2.share': 4, 'teamwork2.disagree': 5, 'teamwork2.plan': 4 });                       // none low: the first of the lowest
  Object.assign(a, { 'thinking2.parts': 5, 'thinking2.numbers': 1, 'thinking2.sources': 5 });                     // the low one has no advice
  const ad = sv.adviceItems(q, a);
  ok(ad.professionalism2.ids.join() === 'professionalism2.deadlines' && ad.professionalism2.high === false, 'the example: only the deadlines question is advised');
  ok(ad.communication2.ids.join() === 'communication2.summarize,communication2.memo,communication2.present' && !ad.communication2.high, 'lowest first, the sixth option after the levels');
  ok(ad.teamwork2.ids.join() === 'teamwork2.share' && ad.teamwork2.high === true, 'nothing low: the lowest-rated question, marked high');
  ok(ad.thinking2.ids.join() === 'thinking2.parts' && ad.thinking2.high === true, 'a question without advice is skipped');
  ok(ad.career2.ids.length === 1 && ad.career2.high && Object.keys(sv.adviceItems(q, {})).length === 0, 'all at the top: one question; no answers: nothing');
  const four = JSON.parse(JSON.stringify(q.survey)); four.blocks[0].items.push({ id: '', text: 'A fourth question.', advice: 'Do it.' }); sv.ADMIN.saveSurvey(q, four);
  const id4 = q.survey.blocks[0].items[3].id;
  ok(sv.adviceItems(q, Object.assign({}, a, { [id4]: 2 })).communication2.ids.length === sv.ADVICE_MAX, 'at most 3 questions per section');
  // the advice turned off: the student page receives neither the advice texts nor the choice; the texts stay stored
  q.roster = [{ first: 'A', last: 'B', email: 'a@x.edu' }];
  const row = [{ round: 'start', answers: a, saved: 'x', submitted: 'x', goals: [] }];
  ok(q.survey.showAdvice === true && sv.studentView(q, 'a@x.edu', row, T0).showAdvice === true && Object.keys(sv.studentView(q, 'a@x.edu', row, T0).rounds[0].advice).length === 6, 'the advice is shown by default');
  const offA = JSON.parse(JSON.stringify(q.survey)); offA.showAdvice = false;
  const dOff = sv.ADMIN.saveSurvey(q, offA), vOff = sv.studentView(q, 'a@x.edu', row, T0);
  ok(q.survey.showAdvice === false && dOff.adviceShown === 'off' && dOff.advised.length === 0 && vOff.showAdvice === false && Object.keys(vOff.rounds[0].advice).length === 0
    && vOff.blocks.every(b => b.items.every(i => i.advice === '')) && q.survey.blocks[4].items[0].advice === 'Placeholder advice', 'advice turned off: none sent, the texts kept');
  const onA = JSON.parse(JSON.stringify(q.survey)); delete onA.showAdvice;
  ok(sv.ADMIN.saveSurvey(q, onA).adviceShown === 'on' && q.survey.showAdvice === true, 'a survey sent without the setting shows the advice');
  ok(sv.upgrade({ title: 'x' }).survey.showAdvice === true && sv.upgrade({ title: 'x', survey: Object.assign(sv.newClass('y', T0).survey, { showAdvice: false }) }).survey.showAdvice === false, 'upgrade: on unless turned off');
}
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

// settings: the title; an off list sent by an old page is ignored
throws(() => sv.ADMIN.saveSettings(s, { title: ' ' }), /title/, 'empty title refused');
sv.ADMIN.saveSettings(s, { title: 'New title', version: '1', off: ['teamwork2'] });
ok(s.title === 'New title' && !('off' in s) && sv.activeItems(s).length === 18 && s.code === true && !('version' in s), 'title alone changes only the title; a version or off list sent by an old page is ignored');

// the questions: edit, add, remove, reorder, and the sixth option
{
  const q = sv.newClass('Questions', T0);
  const ed = JSON.parse(JSON.stringify(q.survey));
  ed.blocks[0].items[0].text = 'Presenting to a group without notes.';            // reworded: keeps its id
  ed.blocks[0].items[1].na = true;                                                 // the sixth option
  ed.blocks[0].items.push({ id: '', name: 'ignored', text: 'Listening without interrupting.', advice: ' Listen to a podcast. ', na: true });  // added
  ed.blocks[0].items[2].advice = 'New advice.';                                    // advice changed
  ed.blocks[1].items.splice(2, 1);                                                 // teamwork2.plan removed
  ed.blocks.splice(5, 1);                                                          // the career block removed
  ed.blocks.push({ id: '', name: '  Ethics  ', items: [{ text: 'Citing every source you use.' }] });  // a new block, minimal fields
  [ed.blocks[2], ed.blocks[3]] = [ed.blocks[3], ed.blocks[2]];                    // two blocks swapped
  ed.unit = { one: 'Skill', many: 'Skills' };
  const d = sv.ADMIN.saveSurvey(q, ed);
  const items = sv.activeItems(q), ids = items.map(i => i.id);
  ok(items.length === 18 - 1 - 3 + 1 + 1 && q.survey.blocks.length === 6 && q.survey.blocks[5].name === 'Ethics' && /^s/.test(q.survey.blocks[5].id), 'saved: 17 questions in 6 blocks; the new block named and given an id');
  ok(ids[0] === 'communication2.present' && items[0].text === 'Presenting to a group without notes.' && items[1].na === true && /^q[a-z0-9]{6}$/.test(ids[3]) && items[3].na === true,
    'a reworded question keeps its id; the sixth option stored; a new question receives an id');
  ok(q.survey.blocks[2].id === 'technology2' && q.survey.blocks[3].id === 'thinking2' && q.survey.unit.many === 'Skills', 'block order and the section word saved');
  ok(q.retired.map(r => r.id).join() === 'teamwork2.plan,career2.strengths,career2.requirements,career2.outreach' && q.retired[0].blockName === 'Teamwork and leadership', 'removed questions retired with their labels');
  ok(d.added.length === 2 && d.removed.length === 4 && d.reworded.length === 1 && d.reworded[0].id === 'communication2.present' && d.naOn.length === 2 && d.naOff.length === 0 && d.order && d.texts && !d.scale
    && d.advised.length === 1 && d.advised[0].id === 'communication2.summarize', 'the change summary: added, removed, reworded, advice, sixth option, order, texts');
  ok(q.survey.blocks[0].items[3].advice === 'Listen to a podcast.' && !('name' in q.survey.blocks[0].items[3]) && q.survey.blocks[5].items[0].advice === '' && !('name' in q.retired[0]),
    'advice stored trimmed (empty when not sent); no short label stored');
  // answers: 'na' to a question with the sixth option counts; a retired question's answers are not the survey's
  const ans = {}; items.forEach(i => { ans[i.id] = 3; }); ans[ids[1]] = 'na';
  const c = sv.cleanAnswers(q, Object.assign({ 'teamwork2.plan': 4 }, ans));
  ok(c[ids[1]] === 'na' && !('teamwork2.plan' in c) && sv.missing(q, c).length === 0, 'the sixth option is an answer; answers to a retired question are not sent on');
  ok(sv.missing(q, Object.assign({}, c, { [ids[0]]: 'na' })).length === 1, 'the sixth option to a question without it is missing');
  const sv1 = sv.studentView(Object.assign(q, { roster: [{ first: 'A', last: 'B', email: 'a@x.edu' }] }), 'a@x.edu', [{ round: 'start', answers: Object.assign({}, c, { [ids[0]]: 'na', 'teamwork2.plan': 4 }), saved: 'x', submitted: '' }], T0);
  ok(sv1.rounds[0].answers[ids[1]] === 'na' && !(ids[0] in sv1.rounds[0].answers) && !('teamwork2.plan' in sv1.rounds[0].answers) && sv1.blocks[0].items[1].na === true, 'the student view sends only valid answers, and which questions offer the sixth option');
  // a retired question returns: it leaves the retired list and keeps its id (its answers attach again)
  const back = JSON.parse(JSON.stringify(q.survey));
  back.blocks[1].items.push({ id: 'teamwork2.plan', name: 'Set up a plan', text: 'Setting up a plan.', na: false });
  const d2 = sv.ADMIN.saveSurvey(q, back);
  ok(sv.activeItems(q).some(i => i.id === 'teamwork2.plan') && !q.retired.some(r => r.id === 'teamwork2.plan') && q.retired.length === 3 && d2.added.length === 1, 'a retired question sent again returns with its id');
  // a new question never takes a retired question's id, nor a duplicate one
  const dup = JSON.parse(JSON.stringify(q.survey));
  dup.blocks[0].items.push({ id: dup.blocks[0].items[0].id, text: 'A copy with the same id.' });
  sv.ADMIN.saveSurvey(q, dup);
  ok(new Set(sv.activeItems(q).map(i => i.id)).size === sv.activeItems(q).length, 'a duplicate id is replaced by a new one');
  // refusals
  const bad = (f, re, label) => { const e = JSON.parse(JSON.stringify(q.survey)); f(e); const before = JSON.stringify(q); throws(() => sv.ADMIN.saveSurvey(q, e), re, label); ok(JSON.stringify(q) === before, label + ': nothing changed'); };
  bad(e => { e.blocks = []; }, /at least one section/, 'no section refused');
  bad(e => { e.blocks[0].items = []; }, /has no questions/, 'an empty section refused');
  bad(e => { e.blocks[0].items[0].text = '  '; }, /Question 1 of "Communication" is empty/, 'an empty question refused');
  bad(e => { e.blocks[0].items[0].advice = 'x'.repeat(1501); }, /\(advice\) has 1501 characters/, 'advice over 1500 characters refused');
  bad(e => { e.blocks[0].name = ''; }, /name of section 1 is empty/, 'a section without a name refused');
  bad(e => { e.levels = e.levels.slice(0, 4); }, /exactly five/, 'four options refused');
  bad(e => { e.levels[4] = ''; }, /Option 5 of the scale is empty/, 'an empty option refused');
  bad(e => { e.naLabel = 'fully'; }, /must differ/, 'a sixth option equal to a level refused');
  bad(e => { e.blocks[0].items[0].text = 'x'.repeat(401); }, /limit is 400/, 'a question over 400 characters refused');
  bad(e => { e.unit.one = ''; }, /word for one section/, 'an empty section word refused');
  // the scale's labels change; the levels stay 1 to 5
  const lv = JSON.parse(JSON.stringify(q.survey)); lv.levels = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']; lv.naLabel = 'Not applicable';
  ok(sv.ADMIN.saveSurvey(q, lv).scale && q.survey.levels[4] === 'Always' && sv.studentView(q, 'a@x.edu', [], T0).naLabel === 'Not applicable', 'the option labels change');
  // a new class copies another class's survey and session-code settings, not its roster or retired list
  q.code = false; q.codeSec = 45;
  const cp = sv.newClass('Copy', T0, q);
  ok(JSON.stringify(cp.survey) === JSON.stringify(q.survey) && cp.survey !== q.survey && cp.code === false && cp.codeSec === 45 && cp.roster.length === 0 && cp.retired.length === 0 && cp.secret !== q.secret && cp.title === 'Copy',
    'a class created from another copies the questions and settings, with its own roster, secret, and title');
  cp.survey.blocks[0].name = 'Changed';
  ok(q.survey.blocks[0].name !== 'Changed', 'the copy is independent');
}
throws(() => sv.ADMIN.resetRound(s, 'start', T0), /Close the start of semester survey first/, 'an open round cannot be reset');
sv.ADMIN.closeRound(s, 'start', T0);
sv.ADMIN.resetRound(s, 'start', T0 + 1);
ok(['open', 'closes', 'openedAt', 'closedAt'].every(k => !sv.round(s, 'start')[k]), 'a closed round resets to not opened');
sv.ADMIN.saveSettings(s, { code: false });
ok(s.code === false && sv.studentView(s, 'bo@montclair.edu', [], T0).needCode === false, 'session code turned off');

console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
