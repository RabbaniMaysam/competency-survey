/**
 * Competency survey: the rules, as pure functions on a class's state (one JSON row per class).
 *
 * State of a class:
 *   { title, created, roster: [{first, last, email}],
 *     survey: the class's own questions and texts (below), retired: [{id, blockName, name, text}] questions removed
 *       from the survey (kept so that answers given to them stay labeled on the Responses tab and in the CSV),
 *     code: whether a student types the session code to start a round, codeSec: seconds between session codes,
 *     secret: random string the codes derive from,
 *     rounds: [{id: 'start' | 'end', name, open: bool, closes: ISO time or '', openedAt, closedAt}] }
 *   survey = { heading, intro: {start, end}, instruction, prompt, levels: [five labels, 1 to 5], naLabel: the sixth
 *              option's label, unit: {one, many} (what a section is called), blocks: [{id, name, items: [{id, name, text, na}]}] }
 *   An item's name is its short label for the report (empty: the text is used); na: the item offers the sixth option.
 * A new class starts with the default survey (items.js) or a copy of another class's survey and settings.
 * A round is open while open is true and its closing time (if any) has not passed.
 * A student's answers to a round are one row of the responses table: answers = {itemId: a level, 1 to 5, or 'na'},
 * saved = time of the last change, submitted = time of the first complete submission ('' before it).
 * Answers to questions removed from the survey are kept.
 */

import { canonEmail, parseRoster } from './roster.js';
import { defaultSurvey } from './items.js';

export const ROUNDS = [{ id: 'start', name: 'Start of semester' }, { id: 'end', name: 'End of semester' }];

const iso = ms => new Date(ms).toISOString();
const text = s => String(s ?? '').trim();
export const fullName = r => (r.first + ' ' + r.last).trim();
const copy = o => JSON.parse(JSON.stringify(o));

/** A new class: the default survey, or the survey and the session-code settings of `from` (another class's state). */
export function newClass(title, now, from) {
  return { title: text(title), created: iso(now), roster: [], survey: from ? copy(from.survey) : defaultSurvey(), retired: [],
           code: from ? !!from.code : true, codeSec: from && from.codeSec > 0 ? from.codeSec : CODE_SEC_DEFAULT, secret: randomSecret(),
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

/**
 * Fills fields a class saved by an earlier version lacks (a missing secret is created by the Worker, which writes it back).
 * A class saved before the Questions tab (2026-10-09) receives the default survey; the competencies it had turned
 * off (the list `off`) are left out of it and their questions listed as retired, so the answers given to them stay labeled.
 */
export function upgrade(s) {
  if (!Array.isArray(s.roster)) s.roster = [];
  if (!Array.isArray(s.retired)) s.retired = [];
  if (!s.survey || !Array.isArray(s.survey.blocks)) {
    const off = Array.isArray(s.off) ? s.off : [], def = defaultSurvey();
    s.survey = Object.assign(def, { blocks: def.blocks.filter(b => off.indexOf(b.id) === -1) });
    if (!s.survey.blocks.length) s.survey.blocks = defaultSurvey().blocks;
    defaultSurvey().blocks.filter(b => !s.survey.blocks.some(x => x.id === b.id))
      .forEach(b => b.items.forEach(i => s.retired.push({ id: i.id, blockName: b.name, name: i.name, text: i.text })));
  }
  delete s.off;
  delete s.version;
  if (typeof s.code !== 'boolean') s.code = true;
  if (!(s.codeSec > 0)) s.codeSec = CODE_SEC_DEFAULT;
  if (!Array.isArray(s.rounds)) s.rounds = [];
  ROUNDS.forEach(r => { if (!s.rounds.some(x => x.id === r.id)) s.rounds.push({ id: r.id, name: r.name, open: false, closes: '', openedAt: '', closedAt: '' }); });
  return s;
}

export const student = (s, email) => s.roster.find(r => r.email === canonEmail(email)) || null;

/** The questions of a survey in order: {id, block, blockName, name (the short label, or the text), text, na}. */
export const surveyItems = sv => sv.blocks.flatMap(b => b.items.map(i => ({ id: i.id, block: b.id, blockName: b.name, name: i.name || i.text, text: i.text, na: !!i.na })));
export const activeItems = s => surveyItems(s.survey);
/** The survey's questions, then the retired ones (retired: true; na: false), for labeling every stored answer. */
export const allItems = s => activeItems(s).concat(s.retired.map(r => ({ id: r.id, block: '', blockName: r.blockName, name: r.name || r.text, text: r.text, na: false, retired: true })));

/** Whether v is a valid answer to the item: a level 1 to 5, or 'na' when the item offers the sixth option. */
export const validAnswer = (s, item, v) => (v === 'na' ? !!item.na : Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= s.survey.levels.length && String(v).trim() !== '');

export function round(s, id) {
  const r = s.rounds.find(x => x.id === String(id));
  if (!r) throw new Error('There is no survey round "' + id + '".');
  return r;
}

export const isOpen = (r, ms) => !!r.open && (!r.closes || ms < Date.parse(r.closes));

/**
 * The answers a student sends, reduced to the survey's questions, each a level (1 to 5) or 'na'. An 'na' to a question
 * that no longer offers the sixth option (the instructor removed it while the student's page was open) is dropped.
 */
export function cleanAnswers(s, raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  activeItems(s).forEach(i => {
    if (!(i.id in src) || src[i.id] === null || src[i.id] === '') return;
    const v = String(src[i.id]).trim();
    if (v === 'na' && !i.na) return;
    if (!validAnswer(s, i, v)) throw new Error('An answer is not valid: ' + i.name + '.');
    out[i.id] = v === 'na' ? 'na' : Number(v);
  });
  return out;
}

/** The survey's questions without a valid answer. */
export const missing = (s, answers) => activeItems(s).filter(i => !answers || !(i.id in answers) || !validAnswer(s, i, answers[i.id]));

/**
 * What the student page shows. rows: this student's responses [{round, answers (object), saved, submitted}].
 * Each round's answers are those valid for the survey as it is now.
 */
export function studentView(s, email, rows, ms) {
  const me = student(s, email);
  if (!me) return { authorized: false, email: email, title: s.title };
  const mine = id => (rows || []).find(r => r.round === id) || null;
  const items = activeItems(s), sv = s.survey;
  const valid = a => { const o = {}; items.forEach(i => { if (a && i.id in a && validAnswer(s, i, a[i.id])) o[i.id] = a[i.id]; }); return o; };
  return {
    authorized: true, email: me.email, name: fullName(me), title: s.title,
    // the survey's heading, scale, and texts
    heading: sv.heading, levels: sv.levels, naLabel: sv.naLabel, instruction: sv.instruction, prompt: sv.prompt,
    needCode: !!s.code,  // a round is started by typing the session code; a round with a stored row is started
    codeSec: codeSec(s), // seconds between codes (shown in the code field's label)
    // blocks: [{id, name, items: [{id, name, text, na}]}]
    blocks: sv.blocks.map(b => ({ id: b.id, name: b.name, items: b.items.map(i => ({ id: i.id, name: i.name || i.text, text: i.text, na: !!i.na })) })),
    rounds: s.rounds.map(r => {
      const row = mine(r.id);
      return { id: r.id, name: r.name, open: isOpen(r, ms), closes: r.closes, started: !!row, intro: (sv.intro && sv.intro[r.id]) || '',
               answers: row ? valid(row.answers) : {}, saved: row ? row.saved : '', submitted: row ? row.submitted : '' };
    })
  };
}

// ---------------------------------------------------------------- the survey's questions

/** Limits of a survey: characters of each text, and counts. */
export const LIMITS = { heading: 150, intro: 1500, instruction: 1500, prompt: 200, level: 40, unit: 40, block: 120, item: 400, name: 80,
                        blocks: 40, itemsPerBlock: 40, items: 200 };
const ID_RE = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * A survey sent by the instructor page, checked and normalized. A section or question without a valid id (a new one)
 * receives a new id, unused in the class (`s`: its survey and retired questions); a question keeps the id it was sent with,
 * so its stored answers stay attached to it. Throws with a message naming the first problem.
 */
export function cleanSurvey(raw, s) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const field = (v, max, what, required) => {
    const t = text(v);
    if (required && !t) throw new Error(what + ' is empty.');
    if (t.length > max) throw new Error(what + ' has ' + t.length + ' characters; the limit is ' + max + '.');
    return t;
  };
  const levels = Array.isArray(o.levels) ? o.levels : [];
  if (levels.length !== 5) throw new Error('The scale needs exactly five options.');
  const out = {
    heading: field(o.heading, LIMITS.heading, 'The survey\'s heading', true),
    intro: { start: field(o.intro && o.intro.start, LIMITS.intro, 'The start-of-semester introduction'),
             end: field(o.intro && o.intro.end, LIMITS.intro, 'The end-of-semester introduction') },
    instruction: field(o.instruction, LIMITS.instruction, 'The instruction'),
    prompt: field(o.prompt, LIMITS.prompt, 'The text after each section\'s name'),
    levels: levels.map((l, k) => field(l, LIMITS.level, 'Option ' + (k + 1) + ' of the scale', true)),
    naLabel: field(o.naLabel, LIMITS.level, 'The sixth option', true),
    unit: { one: field(o.unit && o.unit.one, LIMITS.unit, 'The word for one section', true),
            many: field(o.unit && o.unit.many, LIMITS.unit, 'The word for several sections', true) },
    blocks: []
  };
  const labels = out.levels.concat(out.naLabel).map(l => l.toLowerCase());
  if (new Set(labels).size !== labels.length) throw new Error('The six options of the scale must differ from each other.');
  const blocks = Array.isArray(o.blocks) ? o.blocks : [];
  if (!blocks.length) throw new Error('The survey needs at least one section.');
  if (blocks.length > LIMITS.blocks) throw new Error('The survey has ' + blocks.length + ' sections; the limit is ' + LIMITS.blocks + '.');
  // ids in use: the class's questions now and the retired ones (a new question must not take over their answers)
  const taken = new Set((s ? surveyItems(s.survey).map(i => i.id).concat(s.retired.map(r => r.id)) : []).concat(s ? s.survey.blocks.map(b => b.id) : []));
  const used = new Set();
  const fresh = prefix => { let id; do { id = prefix + Math.random().toString(36).slice(2, 8); } while (taken.has(id) || used.has(id)); return id; };
  const idOf = (v, prefix) => { const id = text(v); const ok = ID_RE.test(id) && !used.has(id) ? id : fresh(prefix); used.add(ok); return ok; };
  let total = 0;
  blocks.forEach((b, bk) => {
    const name = field(b && b.name, LIMITS.block, 'The name of section ' + (bk + 1), true);
    const items = Array.isArray(b && b.items) ? b.items : [];
    if (!items.length) throw new Error('Section "' + name + '" has no questions.');
    if (items.length > LIMITS.itemsPerBlock) throw new Error('Section "' + name + '" has ' + items.length + ' questions; the limit is ' + LIMITS.itemsPerBlock + '.');
    total += items.length;
    out.blocks.push({ id: idOf(b.id, 's'), name: name, items: items.map((i, ik) => {
      const where = 'Question ' + (ik + 1) + ' of "' + name + '"';
      return { id: idOf(i && i.id, 'q'), name: field(i && i.name, LIMITS.name, where + ' (short label)'), text: field(i && i.text, LIMITS.item, where, true), na: !!(i && i.na) };
    }) });
  });
  if (total > LIMITS.items) throw new Error('The survey has ' + total + ' questions; the limit is ' + LIMITS.items + '.');
  return out;
}

/**
 * What changes from survey a to survey b: questions added, removed, reworded (text changed), and given or deprived of
 * the sixth option (lists of items, as surveyItems), and whether the sections' order or names, the texts, or the scale changed.
 */
export function surveyDiff(a, b) {
  const A = surveyItems(a), B = surveyItems(b);
  const inA = id => A.find(i => i.id === id), inB = id => B.find(i => i.id === id);
  const both = B.filter(i => inA(i.id));
  return {
    added: B.filter(i => !inA(i.id)), removed: A.filter(i => !inB(i.id)),
    reworded: both.filter(i => inA(i.id).text !== i.text),
    relabeled: both.filter(i => inA(i.id).text === i.text && inA(i.id).name !== i.name),
    naOn: B.filter(i => i.na && !(inA(i.id) && inA(i.id).na)), naOff: both.filter(i => !i.na && inA(i.id).na),
    order: JSON.stringify(A.map(i => i.id)) !== JSON.stringify(B.map(i => i.id)) || JSON.stringify(a.blocks.map(x => x.name)) !== JSON.stringify(b.blocks.map(x => x.name)),
    texts: ['heading', 'instruction', 'prompt'].some(k => a[k] !== b[k]) || JSON.stringify(a.intro) !== JSON.stringify(b.intro) || JSON.stringify(a.unit) !== JSON.stringify(b.unit),
    scale: JSON.stringify(a.levels) !== JSON.stringify(b.levels) || a.naLabel !== b.naLabel
  };
}

// ---------------------------------------------------------------- instructor actions

/**
 * What importing the CSV would change, without changing anything: the file's student count, how many of them are on
 * the roster, the new students, and the students on the roster but not in the file (whom the instructor keeps or drops).
 */
export function previewRoster(roster, csv) {
  const file = parseRoster(csv), seen = {}, on = {};
  file.forEach(st => { seen[st.email] = true; });
  roster.forEach(r => { on[r.email] = true; });
  const pick = r => ({ first: r.first, last: r.last, email: r.email });
  return { file: file.length, matched: file.filter(st => on[st.email]).length,
           added: file.filter(st => !on[st.email]).map(pick), missing: roster.filter(r => !seen[r.email]).map(pick) };
}

/** Instructor actions on the state (in place). Each throws with a message when refused. */
export const ADMIN = {
  /**
   * Imports the CSV: the file's students make up the roster. keep: emails of students on the roster but not in the
   * file who stay (unchanged); the others are dropped. Without keep (an older page), every student not in the file is dropped.
   */
  importRoster(s, csv, keep) {
    const file = parseRoster(csv), inFile = {}, stay = {};
    file.forEach(r => { inFile[r.email] = true; });
    (Array.isArray(keep) ? keep : []).forEach(e => { stay[canonEmail(e)] = true; });
    s.roster = file.concat(s.roster.filter(r => !inFile[r.email] && stay[r.email]))
      .sort((a, b) => (a.last + ' ' + a.first).localeCompare(b.last + ' ' + b.first));
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

  /** Removes several students at once. Every email must be on the roster (duplicates count once). Returns the removed rows. */
  removeStudents(s, emails) {
    const seen = {};
    const list = (Array.isArray(emails) ? emails : []).map(e => canonEmail(e)).filter(e => !seen[e] && (seen[e] = true));
    if (!list.length) throw new Error('No student is selected.');
    const rows = list.map(e => { const st = student(s, e); if (!st) throw new Error(e + ' is not on the roster.'); return st; });
    s.roster = s.roster.filter(r => rows.indexOf(r) === -1);
    return rows;
  },

  /** settings: {title, code: whether students type the session code to start, codeSec: seconds between session codes}. */
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
  },

  /**
   * Replaces the class's survey (cleanSurvey). Questions left out are added to the retired list (their answers stay
   * stored and labeled); a retired question sent again leaves the list. Returns the change (surveyDiff).
   */
  saveSurvey(s, raw) {
    const next = cleanSurvey(raw, s), diff = surveyDiff(s.survey, next);
    const now = new Set(surveyItems(next).map(i => i.id)), gone = diff.removed.map(i => ({ id: i.id, blockName: i.blockName, name: i.name, text: i.text }));
    s.retired = s.retired.filter(r => !now.has(r.id) && !gone.some(g => g.id === r.id)).concat(gone);
    s.survey = next;
    return diff;
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
