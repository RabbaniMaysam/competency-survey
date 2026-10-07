/**
 * Competency survey: the report statistics, as pure functions on a class's state and its response rows.
 * The instructor page's Report tab shows the result (tables, figures, and the PDF, Word, and Excel downloads).
 *
 * Only submitted surveys of students on the roster count. Levels are 1 to L, the class's survey version's scale
 * (version 1: 1 Emerging Knowledge to 4 Advanced Application, or N/A; version 2: 1 Not at all to 5 Fully, no N/A);
 * N/A answers are counted but left out of every mean.
 *   item statistic:       n = answers at a level, mean and sd of those levels, dist = counts at levels 1 to L and N/A
 *                         (the last entry, always 0 in version 2), na = N/A answers, applying = share of the levels
 *                         at the top two (3 or 4 in version 1, 4 or 5 in version 2).
 *   competency statistic: a student's competency score is the mean of the student's non-N/A answers to its items;
 *                         n = students with a score, mean and sd of the scores; dist, na, applying pool the answers.
 *   overall:              the same with every item.
 *   change:               for students who submitted both rounds (an item: answered at a level in both),
 *                         before and after = the two means, mean and sd of the differences, a paired t-test
 *                         (t, two-sided p), and the counts of students who rose, stayed, and fell.
 */

import { versionOf } from './items.js';

const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((t, x) => t + (x - m) * (x - m), 0) / (a.length - 1)); };

/** Statistic of a list of answers (1 to L or 'na'); L = number of levels, 4 by default. */
export function answerStat(values, L = 4) {
  const dist = new Array(L + 1).fill(0), nums = [];
  values.forEach(v => { if (v === 'na') dist[L]++; else { dist[v - 1]++; nums.push(v); } });
  return { n: nums.length, mean: mean(nums), sd: sd(nums), dist, na: dist[L], applying: nums.length ? (dist[L - 2] + dist[L - 1]) / nums.length : null };
}

/** Statistic of student scores, with the answers they pool. */
function scoreStat(scores, answers, L) {
  const a = answerStat(answers, L);
  return { n: scores.length, mean: mean(scores), sd: sd(scores), dist: a.dist, na: a.na, applying: a.applying };
}

/** The change between two rounds from pairs [before, after]. */
export function paired(pairs) {
  const d = pairs.map(p => p[1] - p[0]);
  const n = d.length, m = mean(d), s = sd(d);
  const t = n > 1 && s > 0 ? m / (s / Math.sqrt(n)) : null;
  return { n, before: mean(pairs.map(p => p[0])), after: mean(pairs.map(p => p[1])), mean: m, sd: s, t, p: t === null ? null : tTwoSided(t, n - 1),
           up: d.filter(x => x > 1e-9).length, same: d.filter(x => Math.abs(x) <= 1e-9).length, down: d.filter(x => x < -1e-9).length };
}

// Student's t distribution: the two-sided p-value of t with df degrees of freedom, through the regularized
// incomplete beta function I_x(a, b) (continued fraction, as in Numerical Recipes).
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5, ser = 1.000000000190015;
  tmp -= (x + 0.5) * Math.log(tmp);
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
function betacf(a, b, x) {
  const FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-14) break;
  }
  return h;
}
export function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export const tTwoSided = (t, df) => betai(df / 2, 0.5, df / (df + t * t));

/**
 * The report of a class. rows: every response row [{round, email, answers (object), submitted}].
 * Returns {version, levels, na, rounds, competencies, items, overall, pairs, students}; see the file comment for the
 * statistics. Only the items of the class's survey version count; answers to the other version's items are ignored.
 */
export function report(s, rows) {
  const onRoster = {};
  s.roster.forEach(r => { onRoster[r.email] = true; });
  const V = versionOf(s.version), L = V.levels.length;
  const comps = V.competencies.filter(c => s.off.indexOf(c.code) === -1)
    .map(c => ({ code: c.code, name: c.name, items: c.dims.map(d => ({ id: c.code + '.' + d.code, name: d.name })) }));
  const items = comps.flatMap(c => c.items.map(i => ({ id: i.id, comp: c.code, compName: c.name, name: i.name })));
  const ids = s.rounds.map(r => r.id);
  const sub = {}, byMail = {}, scores = {};
  const rounds = s.rounds.map(r => {
    const mine = rows.filter(x => x.round === r.id);
    sub[r.id] = mine.filter(x => x.submitted && onRoster[x.email]);
    byMail[r.id] = {}; scores[r.id] = {};
    sub[r.id].forEach(x => { byMail[r.id][x.email] = x; scores[r.id][x.email] = scoresOf(x); });
    return { id: r.id, name: r.name, roster: s.roster.length, submitted: sub[r.id].length,
             started: mine.filter(x => !x.submitted && onRoster[x.email]).length, outside: mine.filter(x => x.submitted && !onRoster[x.email]).length,
             openedAt: r.openedAt || '', closedAt: r.open ? '' : (r.closedAt || r.closes || '') };
  });
  // a submitted response's scores: per competency and overall the mean of the non-N/A answers, and the N/A count
  function scoresOf(x) {
    const num = id => (x.answers[id] === undefined || x.answers[id] === 'na' ? null : Number(x.answers[id]));
    const byComp = {}, all = [];
    comps.forEach(c => { const v = c.items.map(i => num(i.id)).filter(k => k !== null); byComp[c.code] = mean(v); all.push(...v); });
    return { comps: byComp, overall: mean(all), na: items.filter(i => x.answers[i.id] === 'na').length };
  }
  const [A, B] = ids;
  const both = sub[A].map(x => x.email).filter(e => byMail[B][e]);
  const answersTo = (id, list) => list.map(x => x.answers[id]).filter(v => v !== undefined);
  const perRound = f => Object.fromEntries(ids.map(r => [r, f(r)]));  // {start: statistic, end: statistic}
  return {
    title: s.title, version: V.n, levels: V.levels, na: V.na, rounds,
    pairs: { both: both.length, startOnly: sub[A].length - both.length, endOnly: sub[B].length - both.length },
    items: items.map(i => Object.assign({ id: i.id, comp: i.comp, compName: i.compName, name: i.name },
      perRound(r => answerStat(answersTo(i.id, sub[r]), L)),
      { change: paired(both.map(e => [byMail[A][e].answers[i.id], byMail[B][e].answers[i.id]]).filter(p => p.every(v => v !== undefined && v !== 'na'))) })),
    competencies: comps.map(c => Object.assign({ code: c.code, name: c.name, itemIds: c.items.map(i => i.id) },
      perRound(r => scoreStat(sub[r].map(x => scores[r][x.email].comps[c.code]).filter(v => v !== null), c.items.flatMap(i => answersTo(i.id, sub[r])), L)),
      { change: paired(both.map(e => [scores[A][e].comps[c.code], scores[B][e].comps[c.code]]).filter(p => p.every(v => v !== null))) })),
    overall: Object.assign(
      perRound(r => scoreStat(sub[r].map(x => scores[r][x.email].overall).filter(v => v !== null), items.flatMap(i => answersTo(i.id, sub[r])), L)),
      { change: paired(both.map(e => [scores[A][e].overall, scores[B][e].overall]).filter(p => p.every(v => v !== null))) }),
    // one row per student on the roster with a submitted survey: the scores of each round and the overall change
    students: s.roster.filter(r => ids.some(id => byMail[id][r.email])).map(r => {
      const o = { first: r.first, last: r.last, email: r.email };
      ids.forEach(id => { const x = byMail[id][r.email]; o[id] = x ? Object.assign({ submitted: x.submitted }, scores[id][r.email]) : null; });
      o.change = o[A] && o[B] && o[A].overall !== null && o[B].overall !== null ? o[B].overall - o[A].overall : null;
      return o;
    })
  };
}
