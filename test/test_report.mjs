// Checks the report statistics (worker/src/report.js).  node test/test_report.mjs
import * as sv from '../worker/src/survey.js';
import { answerStat, paired, betai, tTwoSided, report } from '../worker/src/report.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { cond ? pass++ : (fail++, console.log('FAIL:', label)); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);
const T0 = Date.parse('2026-09-01T12:00:00Z');

// answer statistic
let a = answerStat([1, 2, 3, 4, 5, 5]);
ok(a.n === 6 && a.dist.join() === '1,1,1,1,2' && near(a.mean, 10 / 3) && near(a.sd, Math.sqrt(8 / 3)) && near(a.applying, 0.5) && !('na' in a), 'answer statistic: counts at the five levels, mean, sd, share at 4 or 5');
a = answerStat([]);
ok(a.n === 0 && a.mean === null && a.sd === null && a.applying === null && a.dist.join() === '0,0,0,0,0', 'no answers: no mean');
ok(answerStat([3]).sd === null, 'one answer has no sd');

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

// a class: 5 on the roster, Teamwork turned off (15 items in 5 blocks), start submitted by 4, end by 3 (2 of them in both),
// one dropped from the roster
const s = sv.newClass('BUS 101', T0);
sv.ADMIN.importRoster(s, 'first,last,email\nAmy,Zed,az@x.edu\nBo,Abe,bo@x.edu\nCy,Moe,cy@x.edu\nDi,Oak,di@x.edu\nEd,Pim,ed@x.edu');
{ const e = JSON.parse(JSON.stringify(s.survey)); e.blocks = e.blocks.filter(b => b.id !== 'teamwork2'); sv.ADMIN.saveSurvey(s, e); }
const items = sv.activeItems(s).map(i => i.id);
const fill = (level, except) => { const o = {}; items.forEach(id => { o[id] = level; }); Object.assign(o, except || {}); return o; };
const rows = [
  { round: 'start', email: 'az@x.edu', answers: fill(1, { 'career.strengths': 3 }), submitted: '2026-09-02T00:00:00Z' },  // an id of the removed survey
  { round: 'start', email: 'bo@x.edu', answers: fill(2), submitted: '2026-09-02T00:00:00Z' },
  { round: 'start', email: 'cy@x.edu', answers: fill(3, { 'career2.strengths': 2 }), submitted: '2026-09-02T00:00:00Z' },
  { round: 'start', email: 'di@x.edu', answers: fill(1), submitted: '' },                        // started, not submitted
  { round: 'start', email: 'gone@x.edu', answers: fill(4), submitted: '2026-09-02T00:00:00Z' },  // not on the roster
  { round: 'start', email: 'ed@x.edu', answers: fill(2, { 'teamwork2.share': 5 }), submitted: '2026-09-02T00:00:00Z' },  // a competency turned off
  { round: 'end', email: 'az@x.edu', answers: fill(3, { 'career2.strengths': 5 }), submitted: '2026-12-02T00:00:00Z' },
  { round: 'end', email: 'bo@x.edu', answers: fill(2, { 'career2.strengths': 4, 'thinking2.parts': 1 }), submitted: '2026-12-02T00:00:00Z' },
  { round: 'end', email: 'di@x.edu', answers: fill(4), submitted: '2026-12-02T00:00:00Z' }
];
const R = report(s, rows);
ok(R.rounds.length === 2 && R.rounds[0].submitted === 4 && R.rounds[0].started === 1 && R.rounds[0].outside === 1 && R.rounds[0].roster === 5
  && R.rounds[1].submitted === 3 && R.rounds[1].started === 0, 'rounds: submitted on the roster, started, outside the roster');
ok(R.pairs.both === 2 && R.pairs.startOnly === 2 && R.pairs.endOnly === 1, 'pairs: 2 students in both, 2 start only, 1 end only');
ok(R.competencies.length === 5 && R.items.length === 15 && !R.items.some(i => i.comp === 'teamwork2') && R.levels.length === 5 && !('version' in R) && R.hasNa === false && R.unit.many === 'Competencies' && R.naLabel === 'No chance to try', 'teamwork left out; five levels; no sixth option');

// career2.strengths: start az 1, bo 2, cy 2, ed 2 -> n 4, mean 7/4; end az 5, bo 4, di 4 -> n 3, mean 13/3
const cs = R.items.find(i => i.id === 'career2.strengths');
ok(cs.start.n === 4 && near(cs.start.mean, 7 / 4) && cs.start.dist.join() === '1,3,0,0,0' && near(cs.start.applying, 0), 'item statistic of the start round');
ok(cs.end.n === 3 && near(cs.end.mean, 13 / 3) && cs.end.dist.join() === '0,0,0,2,1' && near(cs.end.applying, 1), 'item statistic of the end round');
// change: az 1 -> 5, bo 2 -> 4
ok(cs.change.n === 2 && near(cs.change.before, 1.5) && near(cs.change.after, 4.5) && near(cs.change.mean, 3) && cs.change.up === 2 && near(cs.change.t, 3) && near(cs.change.p, tTwoSided(3, 1)), 'item change pairs the students who answered in both rounds');

// competency Career: start az 1, bo 2, cy (2, 3, 3) -> 8/3, ed 2; end az (5, 3, 3) -> 11/3, bo (4, 2, 2) -> 8/3, di 4
const car = R.competencies.find(c => c.code === 'career2');
ok(car.start.n === 4 && near(car.start.mean, (1 + 2 + 8 / 3 + 2) / 4) && car.start.dist.join() === '3,7,2,0,0' && car.itemIds.length === 3, 'competency score: mean of each student\'s answers; answers pooled');
ok(car.end.n === 3 && near(car.end.mean, (11 / 3 + 8 / 3 + 4) / 3), 'competency statistic of the end round');
ok(car.change.n === 2 && near(car.change.before, 1.5) && near(car.change.after, (11 / 3 + 8 / 3) / 2) && car.change.up === 2, 'competency change pairs az and bo');
// critical thinking: bo 2 -> (1, 2, 2) fell; az 1 -> 3 rose
const th = R.competencies.find(c => c.code === 'thinking2');
ok(th.change.n === 2 && th.change.up === 1 && th.change.down === 1 && near(th.change.mean, (2 + (5 / 3 - 2)) / 2) && near(th.change.p, tTwoSided(th.change.t, 1)), 'competency change: rose and fell counted; paired t');

// overall: start az 1 (the removed survey's answer is ignored), bo 2, cy (2 + 14 * 3) / 15, ed 2 (the teamwork answer is ignored)
const o = R.overall;
ok(o.start.n === 4 && near(o.start.mean, (1 + 2 + 44 / 15 + 2) / 4) && o.start.dist.reduce((x, y) => x + y, 0) === 4 * 15, 'overall: mean of the students\' means; every answer pooled');
ok(o.change.n === 2 && near(o.change.before, 1.5) && near(o.change.after, (47 / 15 + 31 / 15) / 2) && o.change.up === 2 && o.change.down === 0, 'overall change');
ok(near(o.end.applying, (1 + 1 + 15) / 45), 'overall applying: share of the answers at level 4 or 5');

// students: on the roster with a submitted survey (gone@x.edu left out, di has the end round only)
ok(R.students.length === 5 && R.students.map(x => x.email).join() === 'bo@x.edu,cy@x.edu,di@x.edu,ed@x.edu,az@x.edu', 'students on the roster with a survey, in roster order');
const az = R.students.find(x => x.email === 'az@x.edu'), di = R.students.find(x => x.email === 'di@x.edu');
ok(near(az.start.overall, 1) && near(az.end.overall, 47 / 15) && near(az.change, 32 / 15) && az.start.submitted && near(az.start.comps.career2, 1) && !('na' in az.start), 'a student\'s scores in both rounds');
ok(di.start === null && near(di.end.overall, 4) && di.change === null, 'a student with one round has no change');

// a stored value outside the scale is not counted
const odd = report(s, [{ round: 'start', email: 'az@x.edu', answers: fill(2, { 'career2.strengths': 7 }), submitted: '2026-09-02T00:00:00Z' }]);
ok(odd.items.find(i => i.id === 'career2.strengths').start.n === 0 && near(odd.overall.start.mean, 2) && odd.overall.start.dist.reduce((x, y) => x + y, 0) === 14, 'a value outside the scale is left out');

// the sixth option: counted as na, left out of every mean and of the change
{
  const e = JSON.parse(JSON.stringify(s.survey)); e.blocks.find(b => b.id === 'career2').items[0].na = true; sv.ADMIN.saveSurvey(s, e);
  const N = report(s, [
    { round: 'start', email: 'az@x.edu', answers: fill(2, { 'career2.strengths': 'na' }), submitted: '2026-09-02T00:00:00Z' },
    { round: 'start', email: 'bo@x.edu', answers: fill(4), submitted: '2026-09-02T00:00:00Z' },
    { round: 'end', email: 'az@x.edu', answers: fill(3), submitted: '2026-12-02T00:00:00Z' },
    { round: 'end', email: 'bo@x.edu', answers: fill(4, { 'career2.strengths': 'na' }), submitted: '2026-12-02T00:00:00Z' }]);
  const ci = N.items.find(i => i.id === 'career2.strengths'), cc = N.competencies.find(c => c.code === 'career2');
  ok(N.hasNa && ci.na === true && ci.start.na === 1 && ci.start.n === 1 && near(ci.start.mean, 4) && ci.end.na === 1 && ci.end.n === 1 && ci.change.n === 0, 'item: the sixth option counted apart; no pair without two levels');
  ok(cc.start.na === 1 && near(cc.start.mean, 3) && cc.start.dist.reduce((x, y) => x + y, 0) === 5 && N.overall.start.na === 1 && N.overall.end.na === 1, 'competency and overall: the sixth option counted, left out of the pooled answers');
  ok(near(N.students.find(x => x.email === 'az@x.edu').start.comps.career2, 2) && near(N.overall.start.mean, 3), 'a student\'s score is the mean of the levels answered');
  const off = JSON.parse(JSON.stringify(s.survey)); off.blocks.find(b => b.id === 'career2').items[0].na = false; sv.ADMIN.saveSurvey(s, off);
  ok(report(s, [{ round: 'start', email: 'az@x.edu', answers: fill(2, { 'career2.strengths': 'na' }), submitted: '2026-09-02T00:00:00Z' }]).hasNa, 'a stored sixth-option answer still shows the column after the option is turned off');
  ok(report(s, []).hasNa === false, 'no question with the option and no such answer: no column');
}

// no answers at all
const empty = report(s, []);
ok(empty.rounds[0].submitted === 0 && empty.overall.start.n === 0 && empty.overall.start.mean === null && empty.overall.change.n === 0 && empty.students.length === 0 && empty.items.length === 15, 'empty class: zeros and nulls');

console.log('passed', pass, 'failed', fail);
process.exit(fail ? 1 : 0);
