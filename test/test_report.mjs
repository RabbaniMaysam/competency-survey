// Checks the report statistics (worker/src/report.js).  node test/test_report.mjs
import * as sv from '../worker/src/survey.js';
import { answerStat, paired, betai, tTwoSided, report } from '../worker/src/report.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('FAIL:', label)); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);
const T0 = Date.parse('2026-09-01T12:00:00Z');

// answer statistic
let a = answerStat([1, 2, 3, 4, 'na', 4]);
ok(a.n === 5 && a.na === 1 && a.dist.join() === '1,1,1,2,1' && near(a.mean, 2.8) && near(a.sd, Math.sqrt(1.7)) && near(a.applying, 0.6), 'answer statistic: counts, mean, sd, share at 3 or 4');
a = answerStat(['na']);
ok(a.n === 0 && a.na === 1 && a.mean === null && a.sd === null && a.applying === null, 'only N/A: no mean');
ok(answerStat([3]).sd === null && answerStat([]).n === 0, 'one answer has no sd; empty is empty');

// the t distribution (values from statistical tables)
ok(near(tTwoSided(2, 10), 0.07339, 2e-5) && near(tTwoSided(1, 1), 0.5, 1e-6) && near(tTwoSided(2.228, 10), 0.05, 2e-4)
  && near(tTwoSided(1.96, 100000), 0.05, 2e-4) && near(tTwoSided(0, 5), 1) && tTwoSided(50, 5) < 1e-6, 'two-sided p-values of t');
ok(near(betai(1, 1, 0.3), 0.3) && near(betai(2, 3, 0.5), 0.6875, 1e-9) && betai(2, 3, 0) === 0 && betai(2, 3, 1) === 1, 'regularized incomplete beta');

// paired change
let p = paired([[1, 2], [2, 2], [3, 2], [1, 3], [2, 4]]);
ok(p.n === 5 && near(p.before, 1.8) && near(p.after, 2.6) && near(p.mean, 0.8) && p.up === 3 && p.same === 1 && p.down === 1, 'paired: means and the counts of rose, same, fell');
ok(near(p.sd, Math.sqrt(((0.2 * 0.2) + (0.8 * 0.8) + (1.8 * 1.8) + (1.2 * 1.2) + (1.2 * 1.2)) / 4)) && near(p.t, 0.8 / (p.sd / Math.sqrt(5))) && near(p.p, tTwoSided(p.t, 4)), 'paired: sd, t, p');
p = paired([[1, 2]]);
ok(p.n === 1 && p.sd === null && p.t === null && p.p === null && p.up === 1, 'one pair: no test');
p = paired([[1, 1], [2, 2]]);
ok(p.n === 2 && p.mean === 0 && p.t === null && p.same === 2, 'no variation: no test');
ok(paired([]).n === 0 && paired([]).before === null, 'no pairs');

// a class: 5 on the roster, equity off (22 items), start submitted by 4, end by 3 (2 of them in both), one dropped from the roster
const s = sv.newClass('BUS 101', T0);
sv.ADMIN.importRoster(s, 'first,last,email\nAmy,Zed,az@x.edu\nBo,Abe,bo@x.edu\nCy,Moe,cy@x.edu\nDi,Oak,di@x.edu\nEd,Pim,ed@x.edu');
const items = sv.activeItems(s).map(i => i.id);
const fill = (level, except) => { const o = {}; items.forEach(id => { o[id] = level; }); Object.assign(o, except || {}); return o; };
const rows = [
  { round: 'start', email: 'az@x.edu', answers: fill(1, { 'career.strengths': 'na' }), submitted: '2026-09-02T00:00:00Z' },
  { round: 'start', email: 'bo@x.edu', answers: fill(2), submitted: '2026-09-02T00:00:00Z' },
  { round: 'start', email: 'cy@x.edu', answers: fill(3, { 'career.strengths': 2 }), submitted: '2026-09-02T00:00:00Z' },
  { round: 'start', email: 'di@x.edu', answers: fill(1), submitted: '' },                        // started, not submitted
  { round: 'start', email: 'gone@x.edu', answers: fill(4), submitted: '2026-09-02T00:00:00Z' },  // not on the roster
  { round: 'start', email: 'ed@x.edu', answers: fill(2, { 'equity.advocate': 4 }), submitted: '2026-09-02T00:00:00Z' },
  { round: 'end', email: 'az@x.edu', answers: fill(3, { 'career.strengths': 'na', 'career.networking': 'na' }), submitted: '2026-12-02T00:00:00Z' },
  { round: 'end', email: 'bo@x.edu', answers: fill(2, { 'career.strengths': 4, 'teamwork.respect': 1 }), submitted: '2026-12-02T00:00:00Z' },
  { round: 'end', email: 'di@x.edu', answers: fill(4), submitted: '2026-12-02T00:00:00Z' }
];
const R = report(s, rows);
ok(R.rounds.length === 2 && R.rounds[0].submitted === 4 && R.rounds[0].started === 1 && R.rounds[0].outside === 1 && R.rounds[0].roster === 5
  && R.rounds[1].submitted === 3 && R.rounds[1].started === 0, 'rounds: submitted on the roster, started, outside the roster');
ok(R.pairs.both === 2 && R.pairs.startOnly === 2 && R.pairs.endOnly === 1, 'pairs: 2 students in both, 2 start only, 1 end only');
ok(R.competencies.length === 7 && R.items.length === 22 && !R.items.some(i => i.comp === 'equity') && R.levels.length === 4, 'equity left out');

// start: career.strengths answered by az (na), bo 2, cy 2, ed 2 -> n 3, mean 2, na 1
const cs = R.items.find(i => i.id === 'career.strengths');
ok(cs.start.n === 3 && cs.start.na === 1 && near(cs.start.mean, 2) && cs.start.dist.join() === '0,3,0,0,1' && near(cs.start.applying, 0), 'item statistic of the start round');
// end: az na, bo 4, di 4 -> n 2, mean 4
ok(cs.end.n === 2 && cs.end.na === 1 && near(cs.end.mean, 4) && near(cs.end.applying, 1), 'item statistic of the end round');
// change: az has na in both rounds, bo 2 -> 4: one pair
ok(cs.change.n === 1 && near(cs.change.before, 2) && near(cs.change.after, 4) && near(cs.change.mean, 2) && cs.change.up === 1 && cs.change.p === null, 'item change pairs the students answering at a level in both rounds');
const net = R.items.find(i => i.id === 'career.networking');
ok(net.change.n === 1 && near(net.change.mean, 0) && net.change.same === 1, 'an N/A in one round drops the pair for that item');

// competency Career: start scores az (1, 1) -> 1, bo 2, cy (2, 3, 3) -> 8/3, ed 2 ; end az (3) -> 3, bo (4, 2, 2) -> 8/3, di 4
const car = R.competencies.find(c => c.code === 'career');
ok(car.start.n === 4 && near(car.start.mean, (1 + 2 + 8 / 3 + 2) / 4) && car.start.na === 1 && car.start.dist.join() === '2,7,2,0,1' && car.itemIds.length === 3, 'competency score: mean of each student\'s non-N/A answers; answers pooled');
ok(car.end.n === 3 && near(car.end.mean, (3 + 8 / 3 + 4) / 3) && car.end.na === 2, 'competency statistic of the end round');
ok(car.change.n === 2 && near(car.change.before, 1.5) && near(car.change.after, (3 + 8 / 3) / 2) && car.change.up === 2, 'competency change pairs az and bo');
// teamwork: bo 2 -> (2, 1, 2) fell; az 1 -> 3 rose
const tw = R.competencies.find(c => c.code === 'teamwork');
ok(tw.change.n === 2 && tw.change.up === 1 && tw.change.down === 1 && near(tw.change.mean, (2 + (5 / 3 - 2)) / 2) && near(tw.change.p, tTwoSided(tw.change.t, 1)), 'competency change: rose and fell counted; paired t');

// overall: start az 1 (21 answers), bo 2, cy (2 + 21 * 3) / 22, ed 2 (the equity answer is ignored)
const o = R.overall;
ok(o.start.n === 4 && near(o.start.mean, (1 + 2 + (2 + 63) / 22 + 2) / 4) && o.start.dist.reduce((x, y) => x + y, 0) === 4 * 22, 'overall: mean of the students\' means; every answer pooled');
ok(o.change.n === 2 && near(o.change.before, 1.5) && o.change.up === 2 && o.change.down === 0, 'overall change');

// students: on the roster with a submitted survey (gone@x.edu left out, di has the end round only)
ok(R.students.length === 5 && R.students.map(x => x.email).join() === 'bo@x.edu,cy@x.edu,di@x.edu,ed@x.edu,az@x.edu', 'students on the roster with a survey, in roster order');
const az = R.students.find(x => x.email === 'az@x.edu'), di = R.students.find(x => x.email === 'di@x.edu');
ok(near(az.start.overall, 1) && az.start.na === 1 && near(az.end.overall, 3) && az.end.na === 2 && near(az.change, 2) && az.start.submitted && near(az.start.comps.career, 1), 'a student\'s scores in both rounds');
ok(di.start === null && near(di.end.overall, 4) && di.change === null, 'a student with one round has no change');

// no answers at all
const empty = report(s, []);
ok(empty.rounds[0].submitted === 0 && empty.overall.start.n === 0 && empty.overall.start.mean === null && empty.overall.change.n === 0 && empty.students.length === 0 && empty.items.length === 22, 'empty class: zeros and nulls');

console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
