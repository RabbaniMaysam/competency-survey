/**
 * The survey's items, in two versions; a class uses one (its `version` setting, 1 by default, changed on the
 * instructor page's Settings tab). See VERSIONS at the end of this file.
 *
 * Version 1: the 8 competencies of the NACE Competency Assessment Tool (student version, 2024), with their
 * dimensions (25 in all: Communication has four, the others three). Each dimension is rated on the four
 * LEVELS, each with its own descriptor, or N/A. Text as in the PDF.
 * Version 2: 6 blocks of 3 one-sentence statements (18 in all), each rated for confidence on the five
 * LEVELS_V2, with no N/A.
 *
 * An item's id is competency code + '.' + dimension code (for example 'career.networking'); ids are stored
 * with the answers, so they must not change once a class has answers, and the two versions' codes differ.
 * offByDefault: the competency starts turned off in a new class (the instructor turns it on in Settings).
 */

export const LEVELS = ['Emerging Knowledge', 'Understanding', 'Early Application', 'Advanced Application'];

/** N/A, in the PDF's words ("Use the N/A column when you have not yet learned ..."). */
export const NA_TEXT = 'You have not yet learned or applied this dimension and/or you do not have enough information to self-assess.';

export const COMPETENCIES = [
  {
    code: 'career', name: 'Career & Self-development',
    definition: 'Proactively develop oneself and one’s career through continual personal and professional learning, awareness of one’s strengths and weaknesses, navigation of career opportunities, and networking to build relationships within and outside of one’s organization.',
    dims: [
      { code: 'strengths', name: 'Awareness of Strengths and Challenges', levels: [
        'I can identify strengths and challenges related to career goals.',
        'I understand how strengths and challenges can shape career paths and goals.',
        'I sometimes examine strengths and challenges to find learning experiences needed to move toward career goals.',
        'I consistently examine strengths and challenges to design a plan to find learning experiences needed to move toward career goals.'] },
      { code: 'development', name: 'Professional Development', levels: [
        'I am aware of the need for professional development for achieving career goals.',
        'I understand the importance of professional development for achieving career goals.',
        'I sometimes seek out professional development opportunities for achieving career goals.',
        'I consistently seek out professional development opportunities for achieving career goals.'] },
      { code: 'networking', name: 'Networking', levels: [
        'I can identify elements of effective networking, such as connecting with individuals and expecting reasonable outcomes.',
        'I understand how to use networks to create new career pathways.',
        'I sometimes use networks to build new relationships and pathways that align with career goals.',
        'I consistently use networks to build new relationships and pathways that align with career goals.'] }
    ]
  },
  {
    code: 'communication', name: 'Communication',
    definition: 'Clearly and effectively exchange information, ideas, facts, and perspectives with persons inside and outside of an organization.',
    dims: [
      { code: 'oral', name: 'Oral Communication', levels: [
        'I recognize the elements of effective oral communication skills, such as asking appropriate questions.',
        'I understand how to use oral communication skills to convey meaning.',
        'I sometimes use effective oral communication skills to convey meaning.',
        'I consistently use effective oral communication skills to convey meaning.'] },
      { code: 'written', name: 'Written Communication', levels: [
        'I recognize the elements of effective written communication skills, such as using clear topic sentences and providing evidence to support claims.',
        'I understand how to use written communication skills to convey meaning.',
        'I sometimes use effective written communication skills to convey meaning.',
        'I consistently use effective written communication skills to convey meaning.'] },
      { code: 'nonverbal', name: 'Non-verbal Communication', levels: [
        'I recognize the elements of effective non-verbal communication skills, such as monitoring body language and posture, proximity, gestures, and eye contact.',
        'I understand how to use non-verbal communication skills to convey meaning.',
        'I sometimes use effective non-verbal communication skills to convey meaning.',
        'I consistently use effective non-verbal communication skills to convey meaning.'] },
      { code: 'listening', name: 'Active Listening', levels: [
        'I recognize the elements of effective active listening, such as asking clarifying questions and summarizing what was heard.',
        'I understand how to use active listening skills when communicating with others.',
        'I sometimes use active listening skills when communicating with others.',
        'I consistently use active listening skills when communicating with others.'] }
    ]
  },
  {
    code: 'critical', name: 'Critical Thinking',
    definition: 'Identify and respond to needs based upon an understanding of situational context and logical analysis of relevant information.',
    dims: [
      { code: 'awareness', name: 'Display Situational Awareness', levels: [
        'I recognize the need for situational awareness, such as gathering information, anticipating needs, prioritizing issues, and setting achievable goals.',
        'I understand how to use situational awareness in the workplace.',
        'I sometimes use situational awareness in the workplace.',
        'I consistently use situational awareness in the workplace.'] },
      { code: 'data', name: 'Gather & Analyze Data', levels: [
        'I recognize the role of data gathering and analysis in fully understanding a problem.',
        'I understand how to gather and analyze data to solve a problem.',
        'I sometimes gather and analyze data to solve a problem.',
        'I consistently gather and analyze data to solve a problem after considering the quality of the data.'] },
      { code: 'decisions', name: 'Make Effective & Fair Decisions', levels: [
        'I recognize the need to objectively assess situations using relevant information from a variety of perspectives to make effective and fair decisions.',
        'I understand the elements of effective decision-making and problem-solving, such as problem identification, identifying values, and determining solutions and logistics.',
        'I sometimes demonstrate effective decision-making and problem-solving.',
        'I consistently demonstrate effective decision-making and problem-solving.'] }
    ]
  },
  {
    code: 'equity', name: 'Equity & Inclusion', offByDefault: true,
    definition: 'Demonstrate the awareness, attitude, knowledge, and skills required to equitably engage and include people from different cultures and backgrounds. Engage in anti-oppressive practices that actively challenge the systems, structures, and policies of racism and inequity.',
    dims: [
      { code: 'perspectives', name: 'Engage Multiple Perspectives', levels: [
        'I am aware that different cultures may have different experiences and viewpoints.',
        'I understand the need for getting input from multiple cultures.',
        'I sometimes seek input from multiple cultures.',
        'I consistently seek input from multiple cultures and then integrate the input into future decisions and actions.'] },
      { code: 'practices', name: 'Use Inclusive & Equitable Practices', levels: [
        'I am aware that inclusive and equitable practices are used in the workplace.',
        'I understand the importance of inclusive and equitable workplace practices.',
        'I sometimes use inclusive and equitable practices and occasionally work to bring them to the workplace.',
        'I consistently use inclusive and equitable workplace practices and work to bring them to the workplace.'] },
      { code: 'advocate', name: 'Advocate', levels: [
        'I recognize the need for inclusion, equity, justice, and empowerment for underrepresented groups.',
        'I understand the link between supporting underrepresented groups and achieving inclusion, equity, justice, and empowerment.',
        'I sometimes advocate for underrepresented groups in the workplace.',
        'I consistently advocate for underrepresented groups in the workplace.'] }
    ]
  },
  {
    code: 'leadership', name: 'Leadership',
    definition: 'Recognize and capitalize on personal and team strengths to achieve organizational goals.',
    dims: [
      { code: 'inspire', name: 'Inspire, Persuade, & Motivate', levels: [
        'I recognize some of the skills and knowledge leaders use in the workplace, such as being a role model, building trust, and tapping into what drives people.',
        'I understand some of the skills and knowledge leaders use in the workplace.',
        'I sometimes practice the skills and knowledge leaders use in the workplace.',
        'I consistently practice the skills and knowledge leaders use in the workplace.'] },
      { code: 'resources', name: 'Engage Various Resources & Seek Feedback', levels: [
        'I recognize the value of using a variety of resources (including people) and feedback from others to inform direction.',
        'I understand the importance of using a variety of resources and feedback from others to inform direction.',
        'I sometimes use a variety of resources and feedback from others to inform direction.',
        'I consistently use a variety of resources and feedback from others to inform direction.'] },
      { code: 'dynamics', name: 'Facilitate Group Dynamics', levels: [
        'I recognize the importance of group dynamics in achieving organizational goals by leveraging team member strengths, establishing group norms, and addressing conflicts effectively.',
        'I understand the importance of group dynamics in achieving organizational goals.',
        'I sometimes facilitate group dynamics to achieve organizational goals.',
        'I consistently facilitate group dynamics by putting team members in position to succeed, collectively setting group norms, and resolving conflicts effectively.'] }
    ]
  },
  {
    code: 'professionalism', name: 'Professionalism',
    definition: 'Knowing work environments differ greatly, understand and demonstrate effective work habits, and act in the interest of the larger community and workplace.',
    dims: [
      { code: 'integrity', name: 'Act With Integrity', levels: [
        'I recognize the need to act with integrity in the workplace by being trustworthy, accountable, and respectful of colleagues and stakeholders.',
        'I understand how to act with integrity in the workplace.',
        'I sometimes act with integrity in the workplace.',
        'I consistently act with integrity in the workplace.'] },
      { code: 'dependability', name: 'Demonstrate Dependability', levels: [
        'I recognize the need to be a dependable, diligent member of a work environment, including being present, prepared, and showing attention to detail.',
        'I understand how to be a dependable, diligent member of a work environment.',
        'I sometimes act as a dependable, diligent member of a work environment.',
        'I consistently act as a dependable, diligent member of a work environment.'] },
      { code: 'goals', name: 'Achieve Goals', levels: [
        'I recognize the need to focus on achieving goals in the workplace.',
        'I understand how to focus on achieving goals in the workplace by prioritizing tasks.',
        'I sometimes achieve goals in the workplace by prioritizing and completing tasks.',
        'I consistently achieve goals in the workplace by prioritizing and completing tasks.'] }
    ]
  },
  {
    code: 'teamwork', name: 'Teamwork',
    definition: 'Build and maintain collaborative relationships to work effectively toward common goals, while appreciating diverse viewpoints and shared responsibilities.',
    dims: [
      { code: 'relationships', name: 'Build Relationships for Collaboration', levels: [
        'I recognize that collaboration and relationship-building are important parts of team-building.',
        'I understand how to build strong, positive work relationships for successful collaboration.',
        'I sometimes build strong, positive work relationships with colleagues for collaboration.',
        'I consistently build strong, positive work relationships with colleagues and supervisors for collaboration.'] },
      { code: 'respect', name: 'Respect Diverse Perspectives', levels: [
        'I recognize the need to respect all people in the workplace, including those from diverse backgrounds.',
        'I understand how to respect all people in the workplace, including those from diverse backgrounds.',
        'I sometimes show respect for and include all people in the workplace, including those from diverse backgrounds.',
        'I consistently show respect for and include all people in the workplace, including those from diverse backgrounds.'] },
      { code: 'strengths', name: 'Integrate Strengths', levels: [
        'I recognize my own and my colleagues’ strengths, knowledge, and talents.',
        'I understand how my own and my colleagues’ strengths, knowledge, and talents can be integrated into the team to improve team performance.',
        'I sometimes integrate my own and my colleagues’ strengths, knowledge, and talents into the team’s performance.',
        'I consistently integrate my own and my colleagues’ strengths, knowledge, and talents into the team’s performance.'] }
    ]
  },
  {
    code: 'technology', name: 'Technology',
    definition: 'Understand and leverage technologies ethically to enhance efficiencies, complete tasks, and accomplish goals.',
    dims: [
      { code: 'leverage', name: 'Leverage Technology', levels: [
        'I recognize the role of technology in improving efficiency and productivity.',
        'I understand how to identify and select the appropriate technology for improving efficiency and productivity.',
        'I sometimes use the appropriate technology to improve efficiency and productivity.',
        'I consistently use the appropriate technology to improve efficiency and productivity.'] },
      { code: 'adapt', name: 'Adapt to New Technologies', levels: [
        'I recognize the importance of adapting to new workplace technologies by exploring, learning, and integrating new technologies into my work.',
        'I understand the knowledge and skills that are needed to adapt to new workplace technologies.',
        'I sometimes develop and use the knowledge and skills that are needed to adapt to new workplace technologies.',
        'I consistently develop and use the knowledge and skills that are needed to adapt to new workplace technologies.'] },
      { code: 'ethics', name: 'Use Technology Ethically', levels: [
        'I recognize there are ethical issues and questions surrounding the use of technology, such as responsible use of emerging technologies (e.g., AI) and the importance of protecting data and privacy.',
        'I understand how to ensure the ethical use of technology in the workplace.',
        'I sometimes ensure the ethical use of technology in the workplace.',
        'I consistently ensure the ethical use of technology in the workplace, including establishing and following processes for using emerging technologies responsibly and for protecting information.'] }
    ]
  }
];

/** Every item of version 1 in survey order: {id, comp, compName, dim, dimName, version}. */
export const ITEMS = COMPETENCIES.flatMap(c => c.dims.map(d => ({ id: c.code + '.' + d.code, comp: c.code, compName: c.name, dim: d.code, dimName: d.name, version: 1 })));

// ---------------------------------------------------------------- version 2

/** The five-point confidence scale of version 2 (1 to 5). */
export const LEVELS_V2 = ['Not at all', 'A little', 'Somewhat', 'Mostly', 'Fully'];

/**
 * Version 2: six blocks of three statements. A dimension's `name` is the short label used in the report and
 * the responses tables; `text` is the statement the student rates.
 */
export const COMPETENCIES_V2 = [
  { code: 'communication2', name: 'Communication', dims: [
    { code: 'present', name: 'Present without notes', text: 'Presenting to a class or a group clearly, without reading from your notes.' },
    { code: 'memo', name: 'Write a clear memo', text: 'Writing a clear one-page memo or report that someone else can act on.' },
    { code: 'summarize', name: 'Summarize before responding', text: 'Summarizing what someone else said in a discussion before you respond.' }] },
  { code: 'teamwork2', name: 'Teamwork and leadership', dims: [
    { code: 'share', name: 'Do own share on time', text: 'Doing your share of group work on time, without being reminded.' },
    { code: 'disagree', name: 'Settle disagreements', text: 'Helping your group settle a disagreement without anyone checking out.' },
    { code: 'plan', name: 'Set up a plan', text: 'Setting up a plan for a group that has none: tasks, owners, and deadlines.' }] },
  { code: 'thinking2', name: 'Critical thinking and data', dims: [
    { code: 'parts', name: 'Break a question into parts', text: 'Breaking a messy question into smaller parts you can answer.' },
    { code: 'numbers', name: 'Use data to test a claim', text: 'Using numbers or data to support or reject a claim.' },
    { code: 'sources', name: 'Judge a source', text: 'Judging whether a source, a statistic, or an AI answer is trustworthy.' }] },
  { code: 'technology2', name: 'Technology', dims: [
    { code: 'software', name: 'Analyze data in software', text: 'Using spreadsheet or statistical software (Excel, R, Stata) to analyze data.' },
    { code: 'selfteach', name: 'Teach oneself a tool', text: 'Teaching yourself a new software tool from its documentation or videos.' },
    { code: 'ai', name: 'Use AI openly', text: 'Using AI tools for schoolwork in a way you could openly explain to a professor or employer.' }] },
  { code: 'professionalism2', name: 'Professionalism', dims: [
    { code: 'deadlines', name: 'Meet deadlines', text: 'Meeting deadlines and commitments without last-minute excuses.' },
    { code: 'check', name: 'Check own work', text: 'Checking your work for errors before you submit it.' },
    { code: 'email', name: 'Communicate professionally', text: 'Communicating with professors and employers professionally (email, meetings, follow-up).' }] },
  { code: 'career2', name: 'Career and self-development', dims: [
    { code: 'strengths', name: 'Name own strengths and weaknesses', text: 'Naming your two strongest and two weakest skills for the job you want.' },
    { code: 'requirements', name: 'Know what the job requires', text: 'Knowing what the job you want requires and what you still lack.' },
    { code: 'outreach', name: 'Reach out to strangers', text: 'Reaching out to people you do not know (alumni, professors, professionals) to learn about careers.' }] }
];

/** Every item of version 2 in survey order: {id, comp, compName, dim, dimName, text, version}. */
export const ITEMS_V2 = COMPETENCIES_V2.flatMap(c => c.dims.map(d => ({ id: c.code + '.' + d.code, comp: c.code, compName: c.name, dim: d.code, dimName: d.name, text: d.text, version: 2 })));

// ---------------------------------------------------------------- the versions

/**
 * The two versions of the survey. n: the version number (the class setting); title: the student page's
 * heading; levels: the scale (1 to levels.length); na: whether N/A is an answer; intro: the student page's
 * opening text per round, instruction: the sentence after it, prompt: the instruction in each block's heading,
 * after the block's name (version 2 only); summary: one line for the Settings tab.
 */
export const VERSIONS = [
  { n: 1, name: 'Version 1', title: 'Competency self-assessment', competencies: COMPETENCIES, items: ITEMS, levels: LEVELS, na: true, naText: NA_TEXT,
    summary: 'NACE Career Competency Assessment Tool: 25 items in 8 competencies, each answered with one of four level descriptions or N/A.' },
  { n: 2, name: 'Version 2', title: 'Career skills self-assessment', competencies: COMPETENCIES_V2, items: ITEMS_V2, levels: LEVELS_V2, na: false, naText: '',
    intro: {
      start: 'Employers say the skills below matter as much as your major. This takes about 4 minutes. There are no right answers: it is for you, to notice where you stand now. Later in the semester you will answer the same questions again.',
      end: 'A few months ago you rated how confident you were in these skills. Rate them again, as you are today.'
    },
    instruction: 'For each statement below, think about class, group projects, a job or internship, a club, or anything else you have done.',
    prompt: 'Rate your confidence in doing the following',
    summary: '18 one-sentence statements in 6 blocks, each rated on a five-point confidence scale (Not at all to Fully), no N/A.' }
];
COMPETENCIES.forEach(c => { c.version = 1; });
COMPETENCIES_V2.forEach(c => { c.version = 2; });

/** The version with number n, or version 1. */
export const versionOf = n => VERSIONS.find(v => v.n === Number(n)) || VERSIONS[0];
/** The competencies and items of both versions (each marked with its version), for the instructor page. */
export const ALL_COMPETENCIES = VERSIONS.flatMap(v => v.competencies);
export const ALL_ITEMS = VERSIONS.flatMap(v => v.items);
