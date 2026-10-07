/**
 * Competency survey: the rules, as pure functions on a class's state (one JSON row per class).
 *
 * State of a class:
 *   { title, created, roster: [{first, last, email}], off: [competency codes turned off],
 *     code: whether a student types the session code to start a round, codeSec: seconds between session codes,
 *     secret: random string the codes derive from,
 *     rounds: [{id: 'start' | 'end', name, open: bool, closes: ISO time or '', openedAt, closedAt}] }
 * A round is open while open is true and its closing time (if any) has not passed.
 * A student's answers to a round are one row of the responses table: answers = {itemId: 1..4 or 'na'},
 * saved = time of the last change, submitted = time of the first complete submission ('' before it).
 */

import { canonEmail, parseRoster } from './roster.js';
import { COMPETENCIES, ITEMS, LEVELS, NA_TEXT } from './items.js';

export const ROUNDS = [{ id: 'start', name: 'Start of semester' }, { id: 'end', name: 'End of semester' }];
export const DEFAULT_OFF = COMPETENCIES.filter(c => c.offByDefault).map(c => c.code);
const VALUES = ['1', '2', '3', '4', 'na'];

const iso = ms => new Date(ms).toISOString();
const text = s => String(s ?? '').trim();
export const fullName = r => (r.first + ' ' + r.last).trim();

export function newClass(title, now) {
  return { title: text(title), created: iso(now), roster: [], off: DEFAULT_OFF.slice(), code: true, codeSec: CODE_SEC_DEFAULT, secret: randomSecret(),
           rounds: ROUNDS.map(r => ({ id: r.id, name: r.name, open: false, closes: '', openedAt: '', closedAt: '' })) };
}

export function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The 4-digit session code shown with the QR code. A student types it once to start a survey round
 * (when the class requires it, s.code), which shows the student was in the room when the survey began.
 * It changes every codeSec seconds (a class setting, CODE_SEC_DEFAULT when unset): a hash of the class's
 * secret and the slot number (the server clock divided by the interval), so it cannot be guessed from
 * earlier codes. The instructor page computes it with a copy of this function (it receives the secret,
 * the interval, and the server clock); the Worker accepts the current slot and the previous one, so a
 * code is valid for one to two intervals after it appears. (cyrb53 hash, as in the attendance tool.)
 */
export const CODE_SEC_DEFAULT = 30, CODE_SEC_MIN = 3, CODE_SEC_MAX = 300;
export const codeSec = s => (s && s.codeSec > 0 ? s.codeSec : CODE_SEC_DEFAULT);
export const codeMs = s => codeSec(s) * 1000;
export const codeSlot = (ms, s) => Math.floor(ms / codeMs(s));
export function sessionCode(s, slot) {
  const str = String(s.secret || '') + '|' + slot;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return String(n % 10000).padStart(4, '0');
}

/** Checks a typed session code: the current code or the previous one. */
export function checkCode(s, code, nowMs) {
  const typed = String(code ?? '').trim(), slot = codeSlot(nowMs, s);
  if (typed !== sessionCode(s, slot) && typed !== sessionCode(s, slot - 1)) {
    throw new Error('Wrong session code. The code changes every ' + codeSec(s) + ' seconds: type the one on the screen now.');
  }
}

/** Fills fields a class saved by an earlier version lacks (a missing secret is created by the Worker, which writes it back). */
export function upgrade(s) {
  if (!Array.isArray(s.roster)) s.roster = [];
  if (!Array.isArray(s.off)) s.off = DEFAULT_OFF.slice();
  if (typeof s.code !== 'boolean') s.code = true;
  if (!(s.codeSec > 0)) s.codeSec = CODE_SEC_DEFAULT;
  if (!Array.isArray(s.rounds)) s.rounds = [];
  ROUNDS.forEach(r => { if (!s.rounds.some(x => x.id === r.id)) s.rounds.push({ id: r.id, name: r.name, open: false, closes: '', openedAt: '', closedAt: '' }); });
  return s;
}

export const student = (s, email) => s.roster.find(r => r.email === canonEmail(email)) || null;

/** The competencies turned on in this class, in survey order, with their full text. */
export const activeCompetencies = s => COMPETENCIES.filter(c => s.off.indexOf(c.code) === -1);
export const activeItems = s => ITEMS.filter(i => s.off.indexOf(i.comp) === -1);

export function round(s, id) {
  const r = s.rounds.find(x => x.id === String(id));
  if (!r) throw new Error('There is no survey round "' + id + '".');
  return r;
}

export const isOpen = (r, ms) => !!r.open && (!r.closes || ms < Date.parse(r.closes));

/** The answers a student sends, reduced to the items turned on, each 1 to 4 or 'na'. */
export function cleanAnswers(s, raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  activeItems(s).forEach(i => {
    if (!(i.id in src) || src[i.id] === null || src[i.id] === '') return;
    const v = String(src[i.id]).toLowerCase();
    if (VALUES.indexOf(v) === -1) throw new Error('An answer is not valid: ' + i.dimName + '.');
    out[i.id] = v === 'na' ? 'na' : Number(v);
  });
  return out;
}

/** The items turned on that have no answer. */
export const missing = (s, answers) => activeItems(s).filter(i => !answers || !(i.id in answers));

/**
 * What the student page shows. rows: this student's responses [{round, answers (object), saved, submitted}].
 */
export function studentView(s, email, rows, ms) {
  const me = student(s, email);
  if (!me) return { authorized: false, email: email, title: s.title };
  const mine = id => (rows || []).find(r => r.round === id) || null;
  return {
    authorized: true, email: me.email, name: fullName(me), title: s.title,
    levels: LEVELS, naText: NA_TEXT,
    needCode: !!s.code,  // a round is started by typing the session code; a round with a stored row is started
    codeSec: codeSec(s), // seconds between codes (shown in the code field's label)
    competencies: activeCompetencies(s).map(c => ({ code: c.code, name: c.name, definition: c.definition, dims: c.dims })),
    rounds: s.rounds.map(r => {
      const row = mine(r.id);
      return { id: r.id, name: r.name, open: isOpen(r, ms), closes: r.closes, started: !!row,
               answers: row ? row.answers : {}, saved: row ? row.saved : '', submitted: row ? row.submitted : '' };
    })
  };
}

/** Instructor actions on the state (in place). Each throws with a message when refused. */
export const ADMIN = {
  importRoster(s, csv) {
    s.roster = parseRoster(csv).sort((a, b) => (a.last + ' ' + a.first).localeCompare(b.last + ' ' + b.first));
  },

  addStudent(s, first, last, email) {
    const mail = canonEmail(email);
    if (!/^\S+@\S+\.\S+$/.test(mail)) throw new Error('That email address is not valid.');
    if (student(s, mail)) throw new Error(mail + ' is on the roster.');
    s.roster.push({ first: text(first), last: text(last), email: mail });
    s.roster.sort((a, b) => (a.last + ' ' + a.first).localeCompare(b.last + ' ' + b.first));
  },

  /** The student's answers stay stored; the instructor page lists them as "not on the roster". */
  removeStudent(s, email) {
    const st = student(s, email);
    if (!st) throw new Error('That student is not on the roster.');
    s.roster.splice(s.roster.indexOf(st), 1);
  },

  /** settings: {title, off: [competency codes turned off], code: whether students type the session code to start,
   *  codeSec: seconds between session codes}. */
  saveSettings(s, settings) {
    const o = settings || {};
    if ('codeSec' in o && o.codeSec !== '') {
      const sec = Number(o.codeSec);
      if (!(Number.isInteger(sec) && sec >= CODE_SEC_MIN && sec <= CODE_SEC_MAX)) {
        throw new Error('The session code interval must be a whole number of seconds from ' + CODE_SEC_MIN + ' to ' + CODE_SEC_MAX + '.');
      }
      s.codeSec = sec;
    }
    if ('code' in o) s.code = !!o.code;
    if ('title' in o) {
      if (!text(o.title)) throw new Error('The class needs a title.');
      s.title = text(o.title);
    }
    if ('off' in o) {
      const off = Array.isArray(o.off) ? o.off.map(String) : [];
      off.forEach(code => { if (!COMPETENCIES.some(c => c.code === code)) throw new Error('Unknown competency: ' + code + '.'); });
      if (off.length >= COMPETENCIES.length) throw new Error('At least one competency must stay on.');
      s.off = COMPETENCIES.map(c => c.code).filter(code => off.indexOf(code) !== -1);
    }
  },

  /** Opens a round now; closes = ISO time when it closes by itself, or '' (open until closed by hand). */
  openRound(s, id, closes, now) {
    const r = round(s, id);
    const c = closes ? new Date(closes) : null;
    if (c && isNaN(c)) throw new Error('The closing time is not valid.');
    if (c && c.getTime() <= now) throw new Error('The closing time has passed.');
    r.open = true; r.closes = c ? c.toISOString() : ''; r.openedAt = iso(now); r.closedAt = '';
  },

  closeRound(s, id, now) {
    const r = round(s, id);
    if (!isOpen(r, now)) throw new Error(r.name + ' is not open.');
    r.open = false; r.closedAt = iso(now);
  },

  /** Returns a closed round to "not opened yet" (the Worker deletes its answers with it). */
  resetRound(s, id, now) {
    const r = round(s, id);
    if (isOpen(r, now)) throw new Error('Close the ' + r.name.toLowerCase() + ' survey first.');
    r.open = false; r.closes = ''; r.openedAt = ''; r.closedAt = '';
  },

  /** Changes or removes ('') the closing time of an open round. */
  setCloses(s, id, closes, now) {
    const r = round(s, id);
    if (!isOpen(r, now)) throw new Error(r.name + ' is not open.');
    const c = closes ? new Date(closes) : null;
    if (c && isNaN(c)) throw new Error('The closing time is not valid.');
    if (c && c.getTime() <= now) throw new Error('The closing time has passed.');
    r.closes = c ? c.toISOString() : '';
  }
};
