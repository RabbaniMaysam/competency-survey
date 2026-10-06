/**
 * The survey's items: the 8 competencies of the NACE Competency Assessment Tool (student version, 2024),
 * with their dimensions (25 in all: Communication has four, the others three). Each dimension is rated on
 * the four LEVELS, each with its own descriptor, or N/A. Text as in the PDF.
 * An item's id is competency code + '.' + dimension code (for example 'career.networking'); ids are stored
 * with the answers, so they must not change once a class has answers.
 * offByDefault: the competency starts turned off in a new class (the instructor turns it on in Settings).
 */

export const LEVELS = ['Emerging Knowledge', 'Understanding', 'Early Application', 'Advanced Application'];

/** N/A, as the PDF explains it. */
export const NA_TEXT = 'You have not yet learned or applied this dimension, or you do not have enough information to self-assess.';

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

/** Every item in survey order: {id, comp, compName, dim, dimName}. */
export const ITEMS = COMPETENCIES.flatMap(c => c.dims.map(d => ({ id: c.code + '.' + d.code, comp: c.code, compName: c.name, dim: d.code, dimName: d.name })));
