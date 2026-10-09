// Tests the Worker end to end against a local copy (sign-in check, storage, every action of both pages).
// It signs its own test tokens and serves the matching public key, so no Google account is involved.
//
//   cd worker      (wrangler = C:\Users\rabba\tools\wrangler\node_modules\.bin\wrangler; npx's cached copy broke on 2026-10-09)
//   wrangler d1 execute competency-survey --local --file schema.sql
//   wrangler dev --port 8791 --var GOOGLE_CLIENT_ID:test-client --var ADMIN_EMAILS:prof@gmail.com --var GOOGLE_CERTS_URL:http://127.0.0.1:8799/certs --var SESSION_SECRET:test-secret
//   node ../test/test_worker.mjs        (in a second terminal; another port: API=http://127.0.0.1:PORT node ../test/test_worker.mjs)
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as sv from '../worker/src/survey.js';

const API = process.env.API || 'http://127.0.0.1:8791';
// The Worker keeps the public key it fetched for an hour, so the test key is kept between runs.
const keyFile = path.join(os.tmpdir(), 'competency_survey_test_key.pem');
if (!fs.existsSync(keyFile)) {
  fs.writeFileSync(keyFile, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }));
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyFile));
const publicKey = crypto.createPublicKey(privateKey);
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'test-key', alg: 'RS256', use: 'sig' });
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ keys: [jwk] })); });
await new Promise(r => server.listen(8799, '127.0.0.1', r));

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(email, over = {}, key = privateKey) {
  const body = b64({ alg: 'RS256', kid: 'test-key', typ: 'JWT' }) + '.' + b64(Object.assign({
    iss: 'https://accounts.google.com', aud: 'test-client', email: email, email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600 }, over));
  return body + '.' + crypto.sign('RSA-SHA256', Buffer.from(body), key).toString('base64url');
}

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('FAIL:', label)); };
const post = async (p, body) => (await fetch(API + p, { method: 'POST', body: JSON.stringify(body) })).json();
const PROF = token('Prof@Gmail.com');
const m = i => 's' + i + '@x.edu';
const K = 'c' + Date.now();
const adm = (action, args = [], key = K) => post('/admin', { token: PROF, class: key, action: action, args: args });
const stu = (i, action, args = []) => post('/survey', { token: token(m(i)), class: K, action: action, args: args });

// sign-in checks
let r = await fetch(API + '/config');
const conf = await r.json();
ok(r.headers.get('access-control-allow-origin') === '*' && conf.clientId === 'test-client' && conf.sessions === true, 'config is public and readable across origins');
const bad = async (tok, label) => ok((await post('/survey', { token: tok, class: K, action: 'state' })).error === 'SIGNIN', label);
await bad('', 'no token');
await bad('a.b.c', 'garbage token');
await bad(token(m(1), {}, other.privateKey), 'token signed by another key');
await bad(token(m(1), { aud: 'someone-else' }), 'token issued for another site');
await bad(token(m(1), { exp: Math.floor(Date.now() / 1000) - 5 }), 'expired token');
await bad(token(m(1), { email_verified: false }), 'unverified email');
await bad(token(m(1), { iss: 'https://evil.example' }), 'wrong issuer');
const forged = token(m(1)).split('.');
forged[1] = b64({ iss: 'https://accounts.google.com', aud: 'test-client', email: 'prof@gmail.com', email_verified: true, exp: Math.floor(Date.now() / 1000) + 600 });
await bad(forged.join('.'), 'payload altered after signing');

// class, roster
ok(/not an instructor/.test((await post('/admin', { token: token(m(1)), class: K, action: 'whoami' })).error), 'the instructor API needs an instructor');
r = await adm('createClass', [K, 'Survey test'], '');
ok(r.ok && r.data.key === K && (await (await fetch(API + '/config')).json()).classes.some(c => c.key === K && c.title === 'Survey test'), 'class created and listed');
ok(/exists/.test((await adm('createClass', [K, 'again'], '')).error), 'duplicate class key refused');
ok(/lowercase/.test((await adm('createClass', ['Bad Key!', 'x'], '')).error), 'bad class key refused');
r = await adm('get');
ok(r.ok && !('off' in r.data.state) && !('version' in r.data.state) && r.data.state.survey.blocks.length === 6 && r.data.state.retired.length === 0 && r.data.items.length === 18
  && r.data.defaultSurvey.blocks.length === 6 && r.data.state.survey.levels.length === 5 && r.data.open.length === 0, 'new class: the default survey, nothing open; 18 questions, five levels');
ok(/create class/.test((await adm('log', ['create class', 'all', 5])).data.rows[0].action) && /default questions$/.test((await adm('log', ['create class', 'all', 5])).data.rows[0].detail), 'the creation logged with the default questions');
ok((await adm('saveSettings', [{ version: '1' }])).ok && !('version' in (await adm('get')).data.state), 'a version sent by an old page is ignored');
r = await adm('importRoster', ['first,last,email\nF1,L1,' + m(1) + '\nF2,L2,' + m(2) + '\nF3,L3,' + m(3)]);
ok(r.ok && r.data.state.roster.length === 3, 'roster imported');
r = await adm('previewRoster', ['first,last,email\nF1,L1,' + m(1) + '\nF2,L2,' + m(2)]);
ok(r.ok && r.data.file === 2 && r.data.matched === 2 && r.data.added.length === 0 && r.data.missing.map(x => x.email).join() === m(3)
  && (await adm('get')).data.state.roster.length === 3, 'roster preview lists the student not in the file and changes nothing');
r = await adm('importRoster', ['first,last,email\nF1,L1,' + m(1) + '\nF2,L2,' + m(2), [m(3)]]);
ok(r.ok && r.data.state.roster.length === 3, 'import keeps the student the instructor chose to keep');
ok((await stu(9, 'state')).state.authorized === false && !(await stu(9, 'state')).state.instructor, 'account outside the roster is blocked and not flagged as instructor');
r = await post('/survey', { token: PROF, class: K, action: 'state' });
ok(r.state.authorized === false && r.state.instructor === true, 'an instructor account on the student page is flagged for the link to the instructor page');
ok(/does not match any class/.test((await post('/survey', { token: token(m(1)), class: 'nope', action: 'state' })).error), 'unknown class');

// session tokens
r = await stu(1, 'state');
const sess = r.session;
ok(r.ok && typeof sess === 'string' && /^s1\.[\w-]+\.[\w-]+$/.test(sess), 'a Google sign-in answer carries a session token');
r = await post('/survey', { token: sess, class: K, action: 'state' });
ok(r.ok && r.state.authorized === true && !('session' in r), 'the session token signs the student in (and is not reissued)');
const sp = sess.split('.');
const sPayload = JSON.parse(Buffer.from(sp[1], 'base64url').toString());
ok(sPayload.e === m(1) && sPayload.x > Date.now() + 170 * 86400000 && sPayload.x < Date.now() + 190 * 86400000, 'the session lasts about 180 days');
await bad('s1.' + Buffer.from(JSON.stringify({ e: 'prof@gmail.com', x: sPayload.x })).toString('base64url') + '.' + sp[2], 'session token with an altered account');
await bad(sp[0] + '.' + sp[1] + '.' + sp[2].slice(0, -2) + 'AA', 'session token with a bad signature');
ok(/not an instructor/.test((await post('/admin', { token: sess, class: K, action: 'whoami' })).error), 'a student session cannot use the instructor API');

// the student view: 18 statements in 6 sections, five levels, both rounds closed
r = await stu(1, 'state');
const items = r.state.blocks.flatMap(c => c.items.map(d => d.id));
ok(r.state.name === 'F1 L1' && items.length === 18 && items[0] === 'communication2.present' && r.state.blocks.length === 6 && r.state.rounds.every(x => !x.open) && r.state.levels.length === 5
  && !('version' in r.state) && r.state.naLabel === 'No chance to try' && r.state.heading === 'Career skills self-assessment' && r.state.prompt && r.state.instruction
  && r.state.rounds[0].intro && r.state.rounds[1].intro && r.state.blocks.every(c => c.items.every(d => d.text && d.na === false)), 'student sees 18 statements, five levels, intros; both rounds closed');
ok(/closed/.test((await stu(1, 'save', ['start', { 'career2.strengths': 2 }])).error), 'saving refused while closed');

// open the start round; draft, submit, change
r = await adm('openRound', ['start', '']);
ok(r.ok && r.data.open.join() === 'start' && r.data.state.rounds[0].openedAt, 'start round opened');

// session code: required by default, typed once per round
const secret = r.data.secret;
ok(r.data.state.code === true && /^[0-9a-f]{32}$/.test(secret) && !('secret' in r.data.state) && Math.abs(Date.parse(r.data.now) - Date.now()) < 5000, 'the secret and the server clock are sent apart from the state');
ok(/session code first/.test((await stu(1, 'save', ['start', { 'career2.strengths': 2 }])).error), 'saving refused before the session code');
r = await stu(1, 'state');
ok(r.state.needCode === true && r.state.rounds[0].started === false, 'the student page asks for the code');
const slotNow = sv.codeSlot(Date.now()), good = sv.sessionCode({ secret: secret }, slotNow);
const near = [-1, 0, 1].map(k => sv.sessionCode({ secret: secret }, slotNow + k));
const wrong = ['0000', '1111', '2222', '3333'].find(c => near.indexOf(c) === -1);
ok(/Wrong session code/.test((await stu(1, 'unlock', ['start', wrong])).error), 'wrong code refused');
ok(/not on the class roster/.test((await stu(9, 'unlock', ['start', good])).error), 'a stranger cannot start with the right code');
ok(/closed/.test((await stu(1, 'unlock', ['end', good])).error), 'a closed round cannot be started');
r = await stu(1, 'unlock', ['start', good]);
ok(r.ok && r.state.rounds[0].started === true && Object.keys(r.state.rounds[0].answers).length === 0, 'right code starts the round');
ok((await stu(1, 'unlock', ['start', good])).ok, 'typing the code again is harmless');
r = await stu(1, 'save', ['start', { 'career2.strengths': '5', 'career.strengths': 3 }]);
ok(r.ok && r.state.rounds[0].answers['career2.strengths'] === 5 && !('career.strengths' in r.state.rounds[0].answers) && r.state.rounds[0].saved && !r.state.rounds[0].submitted, 'draft saved; an answer to an item of the removed survey dropped');
ok(/not valid/.test((await stu(1, 'save', ['start', { 'career2.strengths': 6 }])).error), 'level 6 refused');
r = await stu(1, 'save', ['start', { 'career2.strengths': 'na' }]);
ok(r.ok && !('career2.strengths' in r.state.rounds[0].answers), 'the sixth option to a question without it is dropped');
r = await stu(1, 'submit', ['start', { 'career2.strengths': 2 }]);
ok(/^17 questions have no answer\.$/.test(r.error), 'incomplete submission refused');
ok(/^One question has no answer: /.test((await stu(1, 'submit', ['start', Object.fromEntries(items.slice(1).map(id => [id, 3]))])).error), 'one missing answer named');
const all = {}; items.forEach((id, k) => { all[id] = (k % 5) + 1; });
r = await stu(1, 'submit', ['start', all]);
const first = r.state && r.state.rounds[0].submitted;
ok(r.ok && first && r.state.rounds[0].answers[items[0]] === 1 && Object.keys(r.state.rounds[0].answers).length === 18, 'complete submission accepted');
ok(/submitted/.test((await stu(1, 'save', ['start', all])).error), 'draft saves refused after submission');
await new Promise(res => setTimeout(res, 20));
r = await stu(1, 'submit', ['start', Object.assign({}, all, { [items[1]]: 4 })]);
ok(r.ok && r.state.rounds[0].submitted === first && r.state.rounds[0].answers[items[1]] === 4, 'changes submitted; the first submission time is kept');
ok(/not on the class roster/.test((await stu(9, 'save', ['start', all])).error), 'a stranger cannot save');
ok(/closed/.test((await stu(2, 'save', ['end', all])).error), 'the end round is closed');
// the interval between codes: 30 seconds by default, a setting sent to the student page and used by the Worker
r = await adm('saveSettings', [{ codeSec: '20' }]);
ok(r.ok && r.data.state.codeSec === 20 && (await stu(2, 'state')).state.codeSec === 20, 'interval saved as 20 seconds and sent to the student page');
const near20 = [-1, 0, 1].map(k => sv.sessionCode({ secret: secret }, sv.codeSlot(Date.now(), { codeSec: 20 }) + k));
// student 1 has started the round, so typing the code again checks it without adding a response row
ok(/every 20 seconds/.test((await stu(1, 'unlock', ['start', ['0000', '1111', '2222', '3333'].find(c => near20.indexOf(c) === -1)])).error), 'a wrong code is refused with the interval in the message');
ok((await stu(1, 'unlock', ['start', sv.sessionCode({ secret: secret }, sv.codeSlot(Date.now(), { codeSec: 20 }))])).ok, 'the 20-second code is accepted');
ok(/from 3 to 300/.test((await adm('saveSettings', [{ codeSec: '1' }])).error), 'a 1-second interval is refused');
r = await adm('saveSettings', [{ code: false }]);
ok(r.ok && r.data.state.code === false && (await stu(2, 'state')).state.needCode === false, 'session code turned off');
ok((await stu(2, 'save', ['start', { 'career2.strengths': 1 }])).ok, 'without the code requirement a student saves directly');

// the questions: teamwork removed and the sixth option added to the first question while open; student 1 resubmits
// without teamwork and the teamwork answers are kept
const S0 = (await adm('get')).data.state.survey, clone = o => JSON.parse(JSON.stringify(o));
ok((await adm('saveSettings', [{ title: 'Survey test 2', off: ['teamwork2'] }])).ok && (await stu(1, 'state')).state.blocks.length === 6, 'an off list sent by an old page is ignored');
const ed = clone(S0); ed.blocks = ed.blocks.filter(b => b.id !== 'teamwork2'); ed.blocks[0].items[0].na = true;
r = await adm('saveSurvey', [ed]);
ok(r.ok && r.data.state.survey.blocks.length === 5 && r.data.state.retired.map(x => x.id).join() === S0.blocks.find(b => b.id === 'teamwork2').items.map(i => i.id).join()
  && r.data.items.length === 18 && r.data.items.filter(i => i.retired).length === 3 && r.data.state.title === 'Survey test 2', 'teamwork removed: its questions retired, still listed for the answers');
let st = (await stu(1, 'state')).state;
ok(st.blocks.length === 5 && st.blocks[0].items[0].na === true && !('teamwork2.share' in st.rounds[0].answers),'student now sees 5 sections and the sixth option on the first question');
const ql = (await adm('log', ['save questions', 'instructor', 5])).data.rows[0].detail;
ok(/^15 questions in 5 sections; removed: Teamwork and leadership: /.test(ql) && /sixth option added: Communication: /.test(ql), 'the change is logged by name: ' + ql);
ok(/has no questions/.test((await adm('saveSurvey', [Object.assign(clone(S0), { blocks: [{ id: '', name: 'Empty', items: [] }] })])).error) && (await adm('get')).data.state.survey.blocks.length === 5, 'an empty section refused; nothing changed');
const noTeam = {}; items.filter(id => !/^teamwork2\./.test(id)).forEach(id => { noTeam[id] = all[id]; });
ok((await stu(1, 'submit', ['start', noTeam])).ok, 'resubmitted without the teamwork items');
r = await adm('get');
const row1 = r.data.responses.find(x => x.email === m(1) && x.round === 'start');
ok(row1.answers['teamwork2.share'] === all['teamwork2.share'] && Object.keys(row1.answers).length === 18, 'answers to removed questions are kept on later submissions');
r = await stu(2, 'save', ['start', { [items[0]]: 'na' }]);
ok(r.ok && r.state.rounds[0].answers[items[0]] === 'na', 'the sixth option saved where offered');
ok(/^14 questions have no answer\.$/.test((await stu(2, 'submit', ['start', { [items[0]]: 'na' }])).error), 'the sixth option counts as an answer');
r = await adm('saveSurvey', [S0]);
ok(r.ok && r.data.state.survey.blocks.length === 6 && r.data.state.retired.length === 0 && (await stu(1, 'state')).state.blocks.length === 6, 'teamwork back with its ids; nothing retired');
st = (await stu(2, 'state')).state;
ok(!(items[0] in st.rounds[0].answers) && st.blocks[0].items[0].na === false, 'a stored sixth-option answer is not sent once the option is removed');
// another class's questions, and a new class copying them with the session-code settings
r = await adm('surveyOf', [K], '');
ok(r.ok && JSON.stringify(r.data.survey) === JSON.stringify(S0), 'surveyOf sends a class\'s questions');
const K2 = K + 'b';
ok(/does not match/.test((await adm('createClass', [K2, 'Copy', 'nope'], '')).error), 'copying from an unknown class refused');
r = await adm('createClass', [K2, 'Copy of the test', K], '');
const c2 = r.ok && (await adm('get', [], K2)).data;
ok(c2 && JSON.stringify(c2.state.survey) === JSON.stringify(S0) && c2.state.code === false && c2.state.codeSec === 20 && c2.state.roster.length === 0 && c2.responses.length === 0 && c2.secret !== secret,
  'a new class copies the questions and the session-code settings, not the roster or answers');
ok((await adm('log', ['create class', 'all', 5], K2)).data.rows[0].detail === 'Copy of the test; questions and settings copied from Survey test 2 (' + K + ')', 'the copy is logged with its source');
ok((await adm('deleteClass', [K2], K2)).ok, 'the copy deleted');

// the report: student 1 submitted the start round (levels 1 to 5 in turn), student 2 started it
r = await adm('report');
ok(r.ok && r.data.title === 'Survey test 2' && r.data.generated && r.data.rounds[0].submitted === 1 && r.data.rounds[0].started === 1 && r.data.rounds[1].submitted === 0
  && r.data.items.length === 18 && r.data.competencies.length === 6 && r.data.levels.length === 5 && r.data.pairs.both === 0 && !('version' in r.data) && r.data.hasNa === false && r.data.unit.many === 'Competencies', 'report: counts of the start round');
ok(r.data.items[0].start.n === 1 && r.data.items[0].start.dist.join() === '1,0,0,0,0' && r.data.items[4].start.dist.join() === '0,0,0,0,1' && r.data.items[1].start.mean === 2
  && r.data.overall.start.n === 1 && Math.abs(r.data.overall.start.mean - 51 / 18) < 1e-9 && r.data.overall.start.dist.join() === '4,4,4,3,3'
  && r.data.students.length === 1 && r.data.students[0].email === m(1) && r.data.students[0].end === null, 'report: item statistics and the student\'s scores');
ok((await adm('log', ['', 'all', 50])).data.rows.every(x => x.action !== 'report'), 'the report is a read: not logged');

// closing time and closing
r = await adm('setCloses', ['start', new Date(Date.now() + 3600000).toISOString()]);
ok(r.ok && r.data.state.rounds[0].closes && r.data.open.join() === 'start', 'closing time set');
ok(/has passed/.test((await adm('setCloses', ['start', new Date(Date.now() - 1000).toISOString()])).error), 'past closing time refused');
ok(/Close the start of semester survey first/.test((await adm('deleteRoundAnswers', ['start'])).error), 'all answers of an open survey cannot be deleted');
r = await adm('closeRound', ['start']);
ok(r.ok && r.data.open.length === 0 && r.data.state.rounds[0].closedAt, 'start round closed');
ok(/closed/.test((await stu(2, 'save', ['start', { 'career2.strengths': 3 }])).error), 'saving refused after closing');
ok(/not open/.test((await adm('closeRound', ['start'])).error), 'closing twice refused');
r = await adm('openRound', ['end', new Date(Date.now() + 2000).toISOString()]);
ok(r.ok && r.data.open.join() === 'end', 'end round opened with a closing time');
ok((await stu(3, 'save', ['end', { 'career2.strengths': 4 }])).ok, 'saving while open');
await new Promise(res => setTimeout(res, 2200));
ok(/closed/.test((await stu(3, 'save', ['end', { 'career2.strengths': 3 }])).error) && (await adm('get')).data.open.length === 0, 'the round closes by itself at its closing time');

// responses, delete answers, remove a student (answers kept)
r = await adm('get');
ok(r.data.responses.length === 3 && r.data.responses.filter(x => x.submitted).length === 1, 'three response rows, one submitted');
r = await adm('deleteResponse', ['start', m(2)]);
ok(r.ok && !r.data.responses.some(x => x.email === m(2)), 'answers deleted');
ok(/no answers/.test((await adm('deleteResponse', ['start', m(2)])).error), 'deleting twice refused');
r = await adm('removeStudent', [m(1)]);
ok(r.ok && r.data.state.roster.length === 2 && r.data.responses.some(x => x.email === m(1)), 'student removed; answers kept');
r = await adm('addStudent', ['Al', 'Ash', 'ASH1@mail.montclair.edu']);
ok(r.ok && r.data.state.roster.some(x => x.email === 'ash1@montclair.edu'), 'student added, address folded');
await adm('addStudent', ['Bo', 'Bash', 'bashb1@montclair.edu']);
ok(/nobody@x.edu is not on the roster/.test((await adm('removeStudents', [['bashb1@montclair.edu', 'nobody@x.edu']])).error) && (await adm('get')).data.state.roster.length === 4, 'bulk removal with an unknown student refused and changes nothing');
r = await adm('removeStudents', [['ash1@mail.montclair.edu', 'bashb1@montclair.edu']]);
ok(r.ok && r.data.state.roster.length === 2 && !r.data.state.roster.some(x => /ash1|bashb1/.test(x.email)), 'two students removed at once');
ok(/^2 students: Al Ash \(ash1@montclair.edu\), Bo Bash/.test((await adm('log', ['remove students', 'all', 5])).data.rows[0].detail), 'one log line names the removed students');
r = await adm('deleteRoundAnswers', ['end']);
const endRound = r.data && r.data.state.rounds.find(x => x.id === 'end');
ok(r.ok && !r.data.responses.some(x => x.round === 'end') && r.data.responses.length === 1 && !endRound.openedAt && !endRound.closedAt, 'all answers to the closed end survey deleted; it is not opened again');

// export and log
r = await adm('export');
ok(r.ok && r.data.state.title === 'Survey test 2' && r.data.responses.length === 1 && r.data.log.length > 5, 'export holds the state, responses, and log');
ok(!JSON.stringify(r.data).includes(secret), 'export leaves out the secret');
const lg = (await adm('log', ['', 'all', 5000])).data.rows;
const acts = lg.map(x => x.action);
['create class', 'import roster', 'open', 'close', 'set closing time', 'save settings', 'save questions', 'refused: saveSurvey', 'delete answers', 'remove student', 'add student', 'start', 'submit', 'submit changes', 'refused: save', 'refused: submit', 'refused: unlock', 'refused: closeRound', 'delete all answers', 'refused: deleteRoundAnswers']
  .forEach(a => ok(acts.indexOf(a) !== -1, 'logged: ' + a));
ok(acts.indexOf('export') === -1 && acts.indexOf('get') === -1 && acts.indexOf('state') === -1, 'reads are not logged');
ok(lg.filter(x => x.action === 'start').length === 3, 'a draft start is logged once per student and round');
ok((await adm('log', ['', 'instructor', 5000])).data.rows.every(x => /\(instructor\)$/.test(x.actor)) && (await adm('log', ['', 'students', 5000])).data.rows.every(x => !/\(instructor\)/.test(x.actor)), 'log filtered by who');

// the end round on its own: student 2 submits levels 1 to 5 in turn; a competency turned off while open leaves the report
r = await adm('openRound', ['end', '']);
ok(r.ok && r.data.open.join() === 'end', 'end round opened again');
r = await stu(2, 'submit', ['end', Object.assign({ 'career.strengths': 2 }, all)]);
ok(r.ok && r.state.rounds[1].submitted && Object.keys(r.state.rounds[1].answers).length === 18, 'end survey submitted; the answer to an item of the removed survey dropped');
r = await adm('report');
ok(r.ok && r.data.rounds[1].submitted === 1 && r.data.items[0].end.dist.join() === '1,0,0,0,0' && r.data.overall.end.n === 1
  && Math.abs(r.data.overall.end.mean - 51 / 18) < 1e-9 && r.data.overall.end.dist.join() === '4,4,4,3,3', 'report of the end round');
r = await adm('saveSurvey', [Object.assign(clone(S0), { blocks: S0.blocks.filter(b => b.id !== 'career2') })]);
ok(r.ok && r.data.state.survey.blocks.length === 5 && (await stu(2, 'state')).state.blocks.length === 5 && (await adm('report')).data.items.length === 15, 'a section removed while open leaves the student page and the report');
r = await adm('closeRound', ['end']);
r = await adm('get');
ok(r.data.responses.some(x => x.email === m(2) && x.round === 'end' && x.answers['career2.outreach'] === 3 && x.answers['communication2.summarize'] === 3), 'the answers to the removed section are kept in the rows');

// delete
r = await adm('deleteInfo');
ok(r.ok && r.data.state === undefined && r.data.roster === 2 && r.data.responses > 0 && r.data.submitted > 0 && r.data.submitted <= r.data.responses
  && r.data.log === (await adm('log', ['', 'all', 20000])).data.rows.length && typeof r.data.title === 'string', 'deleteInfo counts: ' + JSON.stringify(r.data));
ok(/Type the class key/.test((await adm('deleteClass', ['wrong'])).error), 'delete needs the key typed');
r = await adm('deleteClass', [K]);
ok(r.ok && !r.data.classes.some(c => c.key === K) && /does not match/.test((await adm('get')).error), 'class deleted');
ok((await adm('log', ['', 'all', 10])).data.rows.length === 0, 'its log is deleted with it');

server.close();
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
