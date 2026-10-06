/**
 * Competency survey: the rules, as pure functions on a class's state (one JSON row per class).
 *
 * State of a class:
 *   { title, created, roster: [{first, last, email}], off: [competency codes turned off],
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
  return { title: text(title), created: iso(now), roster: [], off: DEFAULT_OFF.slice(),
           rounds: ROUNDS.map(r => ({ id: r.id, name: r.name, open: false, closes: '', openedAt: '', closedAt: '' })) };
}

/** Fills fields a class saved by an earlier version lacks. */
export function upgrade(s) {
  if (!Array.isArray(s.roster)) s.roster = [];
  if (!Array.isArray(s.off)) s.off = DEFAULT_OFF.slice();
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
    competencies: activeCompetencies(s).map(c => ({ code: c.code, name: c.name, definition: c.definition, dims: c.dims })),
    rounds: s.rounds.map(r => {
      const row = mine(r.id);
      return { id: r.id, name: r.name, open: isOpen(r, ms), closes: r.closes,
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

  /** settings: {title, off: [competency codes turned off]}. */
  saveSettings(s, settings) {
    const o = settings || {};
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
