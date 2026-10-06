// Tests the Worker end to end against a local copy (sign-in check, storage, every action of both pages).
// It signs its own test tokens and serves the matching public key, so no Google account is involved.
//
//   cd worker
//   npx wrangler d1 execute competency-survey --local --file schema.sql
//   npx wrangler dev --port 8791 --var GOOGLE_CLIENT_ID:test-client --var ADMIN_EMAILS:prof@gmail.com --var GOOGLE_CERTS_URL:http://127.0.0.1:8799/certs --var SESSION_SECRET:test-secret
//   node ../test/test_worker.mjs        (in a second terminal)
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
ok(r.ok && r.data.state.off.join() === 'equity' && r.data.items.length === 25 && r.data.competencies.length === 8 && r.data.levels.length === 4 && r.data.open.length === 0, 'new class: equity off, nothing open');
r = await adm('importRoster', ['first,last,email\nF1,L1,' + m(1) + '\nF2,L2,' + m(2) + '\nF3,L3,' + m(3)]);
ok(r.ok && r.data.state.roster.length === 3, 'roster imported');
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

// the student view: 22 items in 7 competencies, both rounds closed
r = await stu(1, 'state');
const items = r.state.competencies.flatMap(c => c.dims.map(d => c.code + '.' + d.code));
ok(r.state.name === 'F1 L1' && items.length === 22 && !items.some(i => /^equity\./.test(i)) && r.state.rounds.every(x => !x.open) && r.state.levels.length === 4, 'student sees 22 items, equity left out, both rounds closed');
ok(/closed/.test((await stu(1, 'save', ['start', { 'career.strengths': 2 }])).error), 'saving refused while closed');

// open the start round; draft, submit, change
r = await adm('openRound', ['start', '']);
ok(r.ok && r.data.open.join() === 'start' && r.data.state.rounds[0].openedAt, 'start round opened');

// session code: required by default, typed once per round
const secret = r.data.secret;
ok(r.data.state.code === true && /^[0-9a-f]{32}$/.test(secret) && !('secret' in r.data.state) && Math.abs(Date.parse(r.data.now) - Date.now()) < 5000, 'the secret and the server clock are sent apart from the state');
ok(/session code first/.test((await stu(1, 'save', ['start', { 'career.strengths': 2 }])).error), 'saving refused before the session code');
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
r = await stu(1, 'save', ['start', { 'career.strengths': 2, 'equity.perspectives': 3 }]);
ok(r.ok && r.state.rounds[0].answers['career.strengths'] === 2 && !('equity.perspectives' in r.state.rounds[0].answers) && r.state.rounds[0].saved && !r.state.rounds[0].submitted, 'draft saved; equity answer dropped');
ok(/not valid/.test((await stu(1, 'save', ['start', { 'career.strengths': 7 }])).error), 'invalid level refused');
ok(/21 items have no answer/.test((await stu(1, 'submit', ['start', { 'career.strengths': 2 }])).error), 'incomplete submission refused');
const all = {}; items.forEach((id, k) => { all[id] = k === 0 ? 'na' : (k % 4) + 1; });
r = await stu(1, 'submit', ['start', all]);
const first = r.state && r.state.rounds[0].submitted;
ok(r.ok && first && r.state.rounds[0].answers[items[0]] === 'na', 'complete submission accepted (N/A counts)');
ok(/submitted/.test((await stu(1, 'save', ['start', all])).error), 'draft saves refused after submission');
await new Promise(res => setTimeout(res, 20));
r = await stu(1, 'submit', ['start', Object.assign({}, all, { [items[1]]: 4 })]);
ok(r.ok && r.state.rounds[0].submitted === first && r.state.rounds[0].answers[items[1]] === 4, 'changes submitted; the first submission time is kept');
ok(/not on the class roster/.test((await stu(9, 'save', ['start', all])).error), 'a stranger cannot save');
ok(/closed/.test((await stu(2, 'save', ['end', all])).error), 'the end round is closed');
r = await adm('saveSettings', [{ code: false }]);
ok(r.ok && r.data.state.code === false && (await stu(2, 'state')).state.needCode === false, 'session code turned off');
ok((await stu(2, 'save', ['start', { 'career.strengths': 1 }])).ok, 'without the code requirement a student saves directly');

// equity turned on: student 1 now has 3 items missing; turned off again, the answers are kept
r = await adm('saveSettings', [{ title: 'Survey test 2', off: [] }]);
ok(r.ok && r.data.state.off.length === 0 && r.data.state.title === 'Survey test 2', 'equity turned on');
ok((await stu(1, 'state')).state.competencies.length === 8, 'student now sees 8 competencies');
ok(/3 items have no answer/.test((await stu(1, 'submit', ['start', all])).error), 'resubmitting needs the equity items');
const withEq = Object.assign({}, all, { 'equity.perspectives': 1, 'equity.practices': 2, 'equity.advocate': 'na' });
ok((await stu(1, 'submit', ['start', withEq])).ok, 'submitted with the equity items');
await adm('saveSettings', [{ off: ['equity'] }]);
await stu(1, 'submit', ['start', all]);
r = await adm('get');
const row1 = r.data.responses.find(x => x.email === m(1) && x.round === 'start');
ok(row1.answers['equity.practices'] === 2 && Object.keys(row1.answers).length === 25, 'answers to a competency turned off are kept on later submissions');
ok(/at least one/i.test((await adm('saveSettings', [{ off: r.data.competencies.map(c => c.code) }])).error), 'turning every competency off refused');
ok(/Unknown competency/.test((await adm('saveSettings', [{ off: ['nope'] }])).error), 'unknown competency refused');

// closing time and closing
r = await adm('setCloses', ['start', new Date(Date.now() + 3600000).toISOString()]);
ok(r.ok && r.data.state.rounds[0].closes && r.data.open.join() === 'start', 'closing time set');
ok(/has passed/.test((await adm('setCloses', ['start', new Date(Date.now() - 1000).toISOString()])).error), 'past closing time refused');
ok(/Close the start of semester survey first/.test((await adm('deleteRoundAnswers', ['start'])).error), 'all answers of an open survey cannot be deleted');
r = await adm('closeRound', ['start']);
ok(r.ok && r.data.open.length === 0 && r.data.state.rounds[0].closedAt, 'start round closed');
ok(/closed/.test((await stu(2, 'save', ['start', { 'career.strengths': 3 }])).error), 'saving refused after closing');
ok(/not open/.test((await adm('closeRound', ['start'])).error), 'closing twice refused');
r = await adm('openRound', ['end', new Date(Date.now() + 2000).toISOString()]);
ok(r.ok && r.data.open.join() === 'end', 'end round opened with a closing time');
ok((await stu(3, 'save', ['end', { 'career.strengths': 4 }])).ok, 'saving while open');
await new Promise(res => setTimeout(res, 2200));
ok(/closed/.test((await stu(3, 'save', ['end', { 'career.strengths': 3 }])).error) && (await adm('get')).data.open.length === 0, 'the round closes by itself at its closing time');

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
r = await adm('deleteRoundAnswers', ['end']);
const endRound = r.data && r.data.state.rounds.find(x => x.id === 'end');
ok(r.ok && !r.data.responses.some(x => x.round === 'end') && r.data.responses.length === 1 && !endRound.openedAt && !endRound.closedAt, 'all answers to the closed end survey deleted; it is not opened again');

// export and log
r = await adm('export');
ok(r.ok && r.data.state.title === 'Survey test 2' && r.data.responses.length === 1 && r.data.log.length > 5, 'export holds the state, responses, and log');
ok(!JSON.stringify(r.data).includes(secret), 'export leaves out the secret');
const lg = (await adm('log', ['', 'all', 5000])).data.rows;
const acts = lg.map(x => x.action);
['create class', 'import roster', 'open', 'close', 'set closing time', 'save settings', 'delete answers', 'remove student', 'add student', 'start', 'submit', 'submit changes', 'refused: save', 'refused: submit', 'refused: unlock', 'refused: closeRound', 'delete all answers', 'refused: deleteRoundAnswers']
  .forEach(a => ok(acts.indexOf(a) !== -1, 'logged: ' + a));
ok(acts.indexOf('export') === -1 && acts.indexOf('get') === -1 && acts.indexOf('state') === -1, 'reads are not logged');
ok(lg.filter(x => x.action === 'start').length === 3, 'a draft start is logged once per student and round');
ok((await adm('log', ['', 'instructor', 5000])).data.rows.every(x => /\(instructor\)$/.test(x.actor)) && (await adm('log', ['', 'students', 5000])).data.rows.every(x => !/\(instructor\)/.test(x.actor)), 'log filtered by who');

// delete
ok(/Type the class key/.test((await adm('deleteClass', ['wrong'])).error), 'delete needs the key typed');
r = await adm('deleteClass', [K]);
ok(r.ok && !r.data.classes.some(c => c.key === K) && /does not match/.test((await adm('get')).error), 'class deleted');
ok((await adm('log', ['', 'all', 10])).data.rows.length === 0, 'its log is deleted with it');

server.close();
console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
