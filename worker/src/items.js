/**
 * The default survey of a new class: 6 sections (competencies) of 3 one-sentence statements (18 in all), each
 * rated for confidence on the five LEVELS. Each class keeps its own copy (defaultSurvey), which the instructor
 * edits on the Questions tab (see survey.js). A dimension's `name` is the short label used in the report and the
 * responses tables; `text` is the statement the student rates.
 *
 * A default item's id is competency code + '.' + dimension code (for example 'career2.outreach'); ids are stored
 * with the answers, so an item keeps its id when edited. (The codes end in 2 because an earlier, longer survey
 * used the plain codes; that survey was removed on 2026-10-07.)
 */

/** The five-point confidence scale (1 to 5). */
export const LEVELS = ['Not at all', 'A little', 'Somewhat', 'Mostly', 'Fully'];

/** The optional sixth option of a question (stored as 'na'): the student had no occasion to try the skill. */
export const NA_LABEL = 'Didn\'t have a chance to try';
/** The label it replaced on 2026-10-09 (a class still storing it is renamed when read; survey.js upgrade). */
export const NA_LABEL_OLD = 'No chance to try';

/** What a section is called on the instructor page and in the report. */
export const UNIT = { one: 'Competency', many: 'Competencies' };

export const COMPETENCIES = [
  { code: 'communication2', name: 'Communication', dims: [
    { code: 'present', name: 'Present without notes', text: 'Presenting clearly to a class or group without reading from your notes.' },
    { code: 'memo', name: 'Write a clear memo', text: 'Writing a one-page memo or report that someone else can act on.' },
    { code: 'summarize', name: 'Summarize before responding', text: 'Summarizing what someone said before you respond.' }] },
  { code: 'teamwork2', name: 'Teamwork and leadership', dims: [
    { code: 'share', name: 'Do own share on time', text: 'Doing your share of group work on time without being reminded.' },
    { code: 'disagree', name: 'Settle disagreements', text: 'Helping your group settle a disagreement and keep everyone on board.' },
    { code: 'plan', name: 'Set up a plan', text: 'Setting up a plan for a group that has none: who does what, and by when.' }] },
  { code: 'thinking2', name: 'Critical thinking and data', dims: [
    { code: 'parts', name: 'Break a question into parts', text: 'Breaking a messy question into smaller ones you can answer.' },
    { code: 'numbers', name: 'Use data to test a claim', text: 'Using data to support or reject a claim.' },
    { code: 'sources', name: 'Judge a source', text: 'Judging whether a source, a statistic, or an AI answer can be trusted.' }] },
  { code: 'technology2', name: 'Technology', dims: [
    { code: 'software', name: 'Analyze data in software', text: 'Analyzing data in software such as Excel, R, or Stata.' },
    { code: 'selfteach', name: 'Teach oneself a tool', text: 'Teaching yourself a new software tool from documentation or videos.' },
    { code: 'ai', name: 'Use AI openly', text: 'Using AI for schoolwork in a way you could explain openly to a professor or employer.' }] },
  { code: 'professionalism2', name: 'Professionalism', dims: [
    { code: 'deadlines', name: 'Meet deadlines', text: 'Meeting deadlines without last-minute excuses.' },
    { code: 'check', name: 'Check own work', text: 'Checking your work for errors before you submit it.' },
    { code: 'email', name: 'Communicate professionally', text: 'Communicating professionally with professors and employers, by email and in person.' }] },
  { code: 'career2', name: 'Career and self-development', dims: [
    { code: 'strengths', name: 'Name own strengths and weaknesses', text: 'Naming your two strongest and two weakest skills for the job you want.' },
    { code: 'requirements', name: 'Know what the job requires', text: 'Knowing what the job you want requires and what you still lack.' },
    { code: 'outreach', name: 'Reach out to strangers', text: 'Contacting people you do not know, such as alumni or professionals, to learn about careers.' }] }
];


/**
 * The student page's texts: title: the heading; intro: the opening text per round; instruction: the sentence
 * after it; prompt: the instruction in each block's heading, after the block's name.
 */
export const TEXTS = {
  title: 'Career skills self-assessment',
  intro: {
    start: 'Employers say the skills below matter as much as your major. This takes about 4 minutes. There are no right answers: it is for you to see where you stand now. Later in the semester you will answer the same questions again.',
    end: 'A few months ago you rated how confident you were in these skills. Rate them again, as you are today.'
  },
  instruction: 'For each statement below, think about class, group projects, a job or internship, a club, or anything else you have done.',
  prompt: 'Rate your confidence in doing the following'
};

/**
 * The default survey in the form a class stores it (state.survey; see survey.js): the texts, the five levels, the
 * sixth option's label, the word for a section, and the sections with their questions (no question has the sixth option).
 */
export function defaultSurvey() {
  return { heading: TEXTS.title, intro: { start: TEXTS.intro.start, end: TEXTS.intro.end }, instruction: TEXTS.instruction, prompt: TEXTS.prompt,
           levels: LEVELS.slice(), naLabel: NA_LABEL, unit: { one: UNIT.one, many: UNIT.many },
           blocks: COMPETENCIES.map(c => ({ id: c.code, name: c.name,
             items: c.dims.map(d => ({ id: c.code + '.' + d.code, name: d.name, text: d.text, na: false })) })) };
}
