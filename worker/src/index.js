/**
 * Competency survey: backend (Cloudflare Worker + D1).
 * The pages in docs/ (GitHub Pages) call it. See README.md.
 *
 *   GET  /config  -> {clientId, classes, sessions}      public, needed before sign-in
 *   POST /survey  -> student page: {token, class, action: 'state' | 'unlock' | 'save' | 'submit', args: [round, answers or code]} -> {ok, state}
 *   POST /admin   -> instructor page: {token, class, action, args}                                           -> {ok, data}
 *
 * Settings and roster are one JSON row per class (classes); each student's answers to a round are one
 * row of responses; every sign-in action of note is a row of log.
 * The sign-in code is a copy of the attendance tool's (RabbaniMaysam/attendance).
 */

import { canonEmail } from './roster.js';
import * as sv from './survey.js';
import { report } from './report.js';
import { ALL_COMPETENCIES, ALL_ITEMS, VERSIONS } from './items.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = o => new Response(JSON.stringify(o), {
  headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, CORS)
});

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (request.method === 'GET' && path === '/config') {
        // "sessions" says whether the SESSION_SECRET secret is set (without it every sign-in lasts one hour).
        return json({ clientId: env.GOOGLE_CLIENT_ID || '', classes: await classList(env), sessions: !!env.SESSION_SECRET });
      }
      if (request.method === 'POST' && (path === '/survey' || path === '/admin')) {
        const body = await request.text();
        if (body.length > 1000000) throw new Error('The request is too large.');
        const req = JSON.parse(body);
        const who = await verify(req.token, env);
        const real = who.email;
        const args = Array.isArray(req.args) ? req.args.slice(0, 8) : [];
        const key = String(req.class || '');
        const action = String(req.action);
        // After a Google sign-in the answer carries a session token of this tool, which the page keeps
        // for the following visits (Google's own token lasts an hour and the page cannot renew it silently).
        const session = who.google ? await sessionToken(real, env) : '';
        let out;
        if (path === '/admin') {
          if (!isAdmin(real, env)) throw new Error('The account ' + real + ' is not an instructor account.');
          out = { ok: true, data: await adminCall(env, real, action, key, args) };
        } else out = { ok: true, state: await studentCall(env, real, action, key, args) };
        if (session) out.session = session;
        return json(out);
      }
      return json({ ok: false, error: 'Not found.' });
    } catch (err) {
      return json({ ok: false, error: String((err && err.message) || err) });
    }
  }
};

// ---------------------------------------------------------------- sign-in

let certs = null, certsAt = 0;

async function googleKeys(env, refresh) {
  const age = Date.now() - certsAt;
  if (!certs || age > 3600000 || (refresh && age > 60000)) {
    const r = await fetch(env.GOOGLE_CERTS_URL || 'https://www.googleapis.com/oauth2/v3/certs');
    if (!r.ok) throw new Error('SIGNIN');
    certs = (await r.json()).keys;
    certsAt = Date.now();
  }
  return certs;
}

const bytes = b64url => Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
const parse = b64url => JSON.parse(new TextDecoder().decode(bytes(b64url)));

/**
 * Returns {email, google} for a sign-in token: either a session token of this tool (see
 * sessionToken) or a Google sign-in token, whose Google signature, client ID (this tool's),
 * and expiry are checked. The error text SIGNIN instructs the page to show the sign-in button again.
 */
async function verify(token, env) {
  try {
    const parts = String(token || '').split('.');
    if (parts[0] === 's1') return { email: await verifySession(parts, env), google: false };
    if (parts.length !== 3 || !env.GOOGLE_CLIENT_ID) throw 0;
    const head = parse(parts[0]), p = parse(parts[1]);
    if (head.alg !== 'RS256') throw 0;
    let jwk = (await googleKeys(env, false)).find(k => k.kid === head.kid);
    if (!jwk) jwk = (await googleKeys(env, true)).find(k => k.kid === head.kid);
    if (!jwk) throw 0;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]),
      new TextEncoder().encode(parts[0] + '.' + parts[1]));
    const issuer = p.iss === 'accounts.google.com' || p.iss === 'https://accounts.google.com';
    const verified = p.email_verified === true || p.email_verified === 'true';
    if (!signed || !issuer || p.aud !== env.GOOGLE_CLIENT_ID || !verified || !(Number(p.exp) * 1000 > Date.now())) throw 0;
    const email = canonEmail(p.email);
    if (!email) throw 0;
    return { email: email, google: true };
  } catch (e) {
    throw new Error('SIGNIN');
  }
}

/**
 * Session tokens: 's1.' + base64url({e: email, x: expiry ms}) + '.' + base64url(HMAC-SHA256 of that
 * payload with the SESSION_SECRET secret). Issued after a Google sign-in, valid SESSION_DAYS days,
 * kept by the page in the browser's storage. Signing out deletes the token from the browser; changing
 * the secret invalidates every session.
 */
const SESSION_DAYS = 180;
const toB64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sessionKey(env) {
  if (!env.SESSION_SECRET) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sessionToken(email, env) {
  const key = await sessionKey(env);
  if (!key) return '';
  const payload = toB64url(new TextEncoder().encode(JSON.stringify({ e: email, x: Date.now() + SESSION_DAYS * 86400000 })));
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return 's1.' + payload + '.' + toB64url(sig);
}

async function verifySession(parts, env) {
  const key = await sessionKey(env);
  if (!key || parts.length !== 3) throw 0;
  const good = await crypto.subtle.verify('HMAC', key, bytes(parts[2]), new TextEncoder().encode(parts[1]));
  const p = parse(parts[1]);
  const email = canonEmail(p.e);
  if (!good || !email || !(Number(p.x) > Date.now())) throw 0;
  return email;
}

/** Instructors are the emails in the ADMIN_EMAILS secret. */
function isAdmin(email, env) {
  return !!email && String(env.ADMIN_EMAILS || '').toLowerCase().split(/[,;\s]+/).indexOf(email) !== -1;
}

// ---------------------------------------------------------------- storage

const LOG_SQL = 'INSERT INTO log (time, class, actor, action, detail) VALUES (?, ?, ?, ?, ?)';

async function classList(env) {
  return (await env.DB.prepare("SELECT key, json_extract(state, '$.title') AS title FROM classes ORDER BY key").all()).results;
}

async function readClass(env, key) {
  const row = await env.DB.prepare('SELECT state FROM classes WHERE key = ?').bind(key).first();
  if (!row) throw new Error('This link does not match any class.');
  const s = sv.upgrade(JSON.parse(row.state));
  // A class saved before session codes existed receives its secret on first use.
  if (!s.secret) {
    s.secret = sv.randomSecret();
    await writeClass(env, key, s);
  }
  return s;
}

/** The state without the secret the session codes derive from (the instructor page receives it separately). */
const shownState = s => { const o = Object.assign({}, s); delete o.secret; return o; };

const writeClass = (env, key, s) => env.DB.prepare('UPDATE classes SET state = ? WHERE key = ?').bind(JSON.stringify(s), key).run();
const logRow = (env, key, actor, action, detail) => env.DB.prepare(LOG_SQL)
  .bind(new Date().toISOString(), key, actor, action, String(detail || '').slice(0, 2000)).run();
const parseRow = r => Object.assign({}, r, { answers: JSON.parse(r.answers || '{}') });

// ---------------------------------------------------------------- student page

async function studentCall(env, real, action, key, args) {
  const s = await readClass(env, key);
  const now = Date.now();
  const mineSql = 'SELECT round, answers, saved, submitted FROM responses WHERE class = ? AND email = ?';
  try {
    if (action === 'unlock') {
      // The student types the session code shown on the instructor's screen; a row with no answers starts the round.
      if (!sv.student(s, real)) throw new Error('This account is not on the class roster.');
      const r = sv.round(s, args[0]);
      if (!sv.isOpen(r, now)) throw new Error('The ' + r.name.toLowerCase() + ' survey is closed.');
      sv.checkCode(s, args[1], now);
      const res = await env.DB.prepare("INSERT OR IGNORE INTO responses (class, round, email, answers, saved, submitted) VALUES (?, ?, ?, '{}', ?, '')")
        .bind(key, r.id, real, new Date(now).toISOString()).run();
      if (res.meta.changes) await logRow(env, key, real, 'start', r.name);
    } else if (action === 'save' || action === 'submit') {
      if (!sv.student(s, real)) throw new Error('This account is not on the class roster.');
      const r = sv.round(s, args[0]);
      if (!sv.isOpen(r, now)) throw new Error('The ' + r.name.toLowerCase() + ' survey is closed.');
      const answers = sv.cleanAnswers(s, args[1]);
      const prev = await env.DB.prepare('SELECT answers, submitted FROM responses WHERE class = ? AND round = ? AND email = ?').bind(key, r.id, real).first();
      if (s.code && !prev) throw new Error('Type the session code first.');
      if (action === 'save' && prev && prev.submitted) throw new Error('Your answers are submitted. Change them with "Submit changes".');
      if (action === 'submit') {
        const left = sv.missing(s, answers), naNote = sv.version(s).na ? ' N/A counts as an answer.' : '';
        if (left.length) throw new Error(left.length === 1 ? 'One item has no answer: ' + left[0].dimName + '.' + naNote
          : left.length + ' items have no answer.' + naNote);
      }
      // Answers to competencies turned off since they were given are kept.
      const old = prev ? JSON.parse(prev.answers || '{}') : {};
      const keep = {};
      Object.keys(old).forEach(id => { if (!sv.activeItems(s).some(i => i.id === id)) keep[id] = old[id]; });
      const stamp = new Date(now).toISOString();
      const submitted = action === 'submit' ? (prev && prev.submitted ? prev.submitted : stamp) : '';
      await env.DB.prepare('INSERT INTO responses (class, round, email, answers, saved, submitted) VALUES (?, ?, ?, ?, ?, ?) '
        + 'ON CONFLICT (class, round, email) DO UPDATE SET answers = excluded.answers, saved = excluded.saved, submitted = excluded.submitted')
        .bind(key, r.id, real, JSON.stringify(Object.assign(keep, answers)), stamp, submitted).run();
      // Saves of a draft are not logged one by one: the first one ("start") and every submission are.
      if (!prev) await logRow(env, key, real, 'start', r.name);
      if (action === 'submit') await logRow(env, key, real, prev && prev.submitted ? 'submit changes' : 'submit', r.name);
    } else if (action !== 'state') throw new Error('Unknown action.');
  } catch (err) {
    await logRow(env, key, real, 'refused: ' + action, err.message);
    throw err;
  }
  const rows = (await env.DB.prepare(mineSql).bind(key, real).all()).results.map(parseRow);
  const view = sv.studentView(s, real, rows, now);
  // An instructor account that is not on the roster is sent to the instructor page instead of the roster error.
  if (!view.authorized && isAdmin(real, env)) view.instructor = true;
  return view;
}

// ---------------------------------------------------------------- instructor page

const READS = { whoami: 1, get: 1, log: 1, export: 1, report: 1 };

/** Every instructor action except reads is logged (actor "email (instructor)"); a refused one is logged with its reason. */
async function adminCall(env, real, action, key, args) {
  const who = real + ' (instructor)';
  try {
    return await adminDo(env, real, who, action, key, args);
  } catch (err) {
    if (!READS[action]) {
      const shown = args.map(a => (typeof a === 'string' ? a.slice(0, 200) : JSON.stringify(a).slice(0, 200)));
      await logRow(env, key, who, 'refused: ' + action, shown.join(', ') + (shown.length ? ' | ' : '') + err.message);
    }
    throw err;
  }
}

async function adminDo(env, real, who, action, key, args) {
  const now = Date.now();
  if (action === 'whoami') return { email: real, classes: await classList(env) };

  if (action === 'createClass') {
    const newKey = String(args[0] || '').trim().toLowerCase();
    const title = String(args[1] || '').trim();
    if (!/^[a-z0-9-]{2,30}$/.test(newKey)) throw new Error('The class key must be 2 to 30 lowercase letters, digits, or hyphens.');
    if (!title) throw new Error('The class needs a title.');
    const res = await env.DB.prepare('INSERT OR IGNORE INTO classes (key, state) VALUES (?, ?)')
      .bind(newKey, JSON.stringify(sv.newClass(title, now))).run();
    if (res.meta.changes !== 1) throw new Error('A class with the key "' + newKey + '" exists.');
    await logRow(env, newKey, who, 'create class', title);
    return { key: newKey, classes: await classList(env) };
  }

  if (action === 'deleteClass') {
    if (String(args[0]) !== key) throw new Error('Type the class key exactly to delete the class.');
    await readClass(env, key);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM classes WHERE key = ?').bind(key),
      env.DB.prepare('DELETE FROM responses WHERE class = ?').bind(key),
      env.DB.prepare('DELETE FROM log WHERE class = ?').bind(key)
    ]);
    return { classes: await classList(env) };
  }

  // The activity log: args = [search text, who: 'all' | 'instructor' | 'students', limit]. Newest first.
  if (action === 'log') {
    const like = '%' + String(args[0] || '').replace(/[%_]/g, '') + '%';
    const whoFilter = args[1] === 'instructor' ? " AND actor LIKE '%(instructor)'" : args[1] === 'students' ? " AND actor NOT LIKE '%(instructor)'" : '';
    const limit = Math.min(Math.max(Number(args[2]) || 500, 1), 20000);
    const out = await env.DB.prepare('SELECT id, time, actor, action, detail FROM log WHERE class = ? AND (actor LIKE ? OR action LIKE ? OR detail LIKE ?)'
      + whoFilter + ' ORDER BY id DESC LIMIT ?').bind(key, like, like, like, limit).all();
    return { rows: out.results };
  }

  const s = await readClass(env, key);
  const name = e => { const r = sv.student(s, e); return r ? sv.fullName(r) + ' (' + e + ')' : e; };
  const allRows = async () => (await env.DB.prepare('SELECT round, email, answers, saved, submitted FROM responses WHERE class = ? ORDER BY round, email').bind(key).all()).results.map(parseRow);

  // Everything stored about the class, for a full download.
  if (action === 'export') {
    return { exportedAt: new Date(now).toISOString(), key: key, state: shownState(s), responses: await allRows(),
             log: (await env.DB.prepare('SELECT id, time, actor, action, detail FROM log WHERE class = ? ORDER BY id').bind(key).all()).results };
  }

  // The statistics of the Report tab (worker/src/report.js).
  if (action === 'report') return Object.assign(report(s, await allRows()), { generated: new Date(now).toISOString() });

  // What importing a roster file would change; nothing is saved (the page then sends importRoster with the students to keep).
  if (action === 'previewRoster') return sv.previewRoster(s.roster, args[0]);

  const logs = [];  // [action, detail] lines written after the change succeeds
  if (action === 'importRoster') {
    const before = s.roster.map(r => r.email);
    sv.ADMIN.importRoster(s, args[0], args[1]);
    await writeClass(env, key, s);
    const after = s.roster.map(r => r.email);
    logs.push(['import roster', after.length + ' students; added: ' + (after.filter(e => before.indexOf(e) === -1).join(', ') || 'none')
      + '; dropped: ' + (before.filter(e => after.indexOf(e) === -1).join(', ') || 'none')]);
  } else if (action === 'addStudent') {
    sv.ADMIN.addStudent(s, args[0], args[1], args[2]);
    await writeClass(env, key, s);
    logs.push(['add student', name(canonEmail(args[2]))]);
  } else if (action === 'removeStudent') {
    const shown = name(canonEmail(args[0]));
    sv.ADMIN.removeStudent(s, args[0]);
    await writeClass(env, key, s);
    logs.push(['remove student', shown]);
  } else if (action === 'saveSettings') {
    const before = JSON.stringify({ title: s.title, version: s.version, off: s.off, code: s.code, codeSec: s.codeSec });
    sv.ADMIN.saveSettings(s, args[0], now);
    await writeClass(env, key, s);
    const after = JSON.stringify({ title: s.title, version: s.version, off: s.off, code: s.code, codeSec: s.codeSec });
    const offNames = sv.version(s).competencies.filter(c => s.off.indexOf(c.code) !== -1).map(c => c.name).join(', ') || 'none';
    if (after !== before) logs.push(['save settings', 'title: ' + s.title + '; survey version ' + s.version + '; turned off: ' + offNames
      + '; session code: ' + (s.code ? 'required' : 'not required') + ', changes every ' + sv.codeSec(s) + ' seconds']);
  } else if (action === 'openRound') {
    sv.ADMIN.openRound(s, args[0], args[1], now);
    await writeClass(env, key, s);
    const r = sv.round(s, args[0]);
    logs.push(['open', r.name + (r.closes ? ', closes ' + r.closes : ', until closed by hand')]);
  } else if (action === 'closeRound') {
    sv.ADMIN.closeRound(s, args[0], now);
    await writeClass(env, key, s);
    logs.push(['close', sv.round(s, args[0]).name]);
  } else if (action === 'setCloses') {
    sv.ADMIN.setCloses(s, args[0], args[1], now);
    await writeClass(env, key, s);
    const r = sv.round(s, args[0]);
    logs.push(['set closing time', r.name + ': ' + (r.closes || 'none (until closed by hand)')]);
  } else if (action === 'deleteResponse') {
    // A student's answers to one round are deleted, so the student starts that round again.
    const r = sv.round(s, args[0]), email = canonEmail(args[1]);
    const res = await env.DB.prepare('DELETE FROM responses WHERE class = ? AND round = ? AND email = ?').bind(key, r.id, email).run();
    if (!res.meta.changes) throw new Error('That student has no answers to ' + r.name.toLowerCase() + '.');
    logs.push(['delete answers', name(email) + ', ' + r.name]);
  } else if (action === 'deleteRoundAnswers') {
    // Every student's answers to one closed round are deleted and the round returns to "not opened yet".
    sv.ADMIN.resetRound(s, args[0], now);
    const r = sv.round(s, args[0]);
    const res = await env.DB.prepare('DELETE FROM responses WHERE class = ? AND round = ?').bind(key, r.id).run();
    await writeClass(env, key, s);
    logs.push(['delete all answers', r.name + ': ' + res.meta.changes + ' students\' answers deleted']);
  } else if (action !== 'get') throw new Error('Unknown action.');

  if (logs.length) {
    const time = new Date().toISOString();
    await env.DB.batch(logs.map(l => env.DB.prepare(LOG_SQL).bind(time, key, who, l[0], String(l[1]).slice(0, 2000))));
  }
  // secret and now let the page compute the session code shown with the QR code (sv.sessionCode). The competencies
  // and items of both survey versions are sent (each marked with its version); the page shows the class's version.
  return { state: shownState(s), secret: s.secret, responses: await allRows(), competencies: ALL_COMPETENCIES, items: ALL_ITEMS,
           versions: VERSIONS.map(v => ({ n: v.n, name: v.name, summary: v.summary, levels: v.levels, na: v.na })), defaultVersion: sv.DEFAULT_VERSION,
           open: s.rounds.filter(r => sv.isOpen(r, now)).map(r => r.id), now: new Date(now).toISOString() };
}
