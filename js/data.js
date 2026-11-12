/* FacultyConnect — seed data: faculty profiles, courses, assignments, uploads */
/* ============================ DATA ============================ */
const KOMAL_PHOTO = "assets/images/komal-bharti.jpg";

const FACULTY = [
{
  id:'komal-bharti', featured:true, dept:'Computer Science & Engineering', deptColor:'#8172FF', photo: KOMAL_PHOTO,
  name:'Komal Bharti', role:'Assistant Professor, Software Engineering',
  tagline:'Studying how software teams build reliable systems, and how tools can make that easier.',
  office:'Block C, Room 214', officeHours:'Tue & Thu, 2:00–4:00 PM', email:'komal.bharti@thapar.edu',
  joined:'2021', phd:'Software Engineering, 2019',
  stats:{publications:24, years:7, students:4},
  about:[
    "I work on software testing, empirical software engineering, and the application of machine learning to developer workflows. My group builds tools and runs studies with practitioners to close the gap between what research recommends and what engineering teams actually do.",
    "I am an Assistant Professor in the Department of Computer Science & Engineering, where I lead a small research group working on software testing, program analysis, and empirical methods for studying how developers work. Before joining the department, I completed my Ph.D. in Software Engineering, where my dissertation examined how test suites decay as codebases evolve. I later spent time as a postdoctoral researcher working on tool support for continuous integration pipelines in industry settings.",
    "My group's work sits at the intersection of empirical research and tool building — we run studies with real development teams, and turn what we learn into open-source tools that other researchers and practitioners can use."
  ],
  research:[
    {name:'software-testing/', desc:'Test suite maintenance, flaky tests, regression test selection, and mutation testing at scale.'},
    {name:'empirical-se/', desc:'Mining software repositories and running developer studies to understand real engineering practice.'},
    {name:'ai-for-se/', desc:'Applying language models to code review, bug triage, and automated program repair.'},
    {name:'maintenance/', desc:'Refactoring practices, technical debt, and long-term code health in evolving systems.'},
    {name:'requirements-eng/', desc:'Traceability between requirements, tests, and code in agile development settings.'},
    {name:'devops-ci/', desc:'Build failure prediction and pipeline optimization in continuous integration systems.'}
  ],
  publications:[
    {year:'2026', title:'Predicting Flaky Tests from Commit History: A Large-Scale Study', venue:'ICSE', authors:'Bharti, K., Rao, A., Sen, P. — Proceedings of the International Conference on Software Engineering'},
    {year:'2025', title:'Do Code Review Comments Change What Developers Test? An Empirical Study', venue:'TOSEM', authors:'Bharti, K., Iyer, N. — ACM Transactions on Software Engineering and Methodology'},
    {year:'2025', title:'LLM-Assisted Triage: Reducing Time-to-Resolution for Production Incidents', venue:'ASE', authors:'Malhotra, S., Bharti, K. — IEEE/ACM International Conference on Automated Software Engineering'},
    {year:'2024', title:'Refactoring in the Wild: What 500 Open-Source Pull Requests Tell Us', venue:'EMSE', authors:'Bharti, K., Thomas, L., Verma, R. — Empirical Software Engineering Journal'},
    {year:'2023', title:'Test Suite Decay: A Longitudinal Study of Six Industrial Codebases', venue:'ISSTA', authors:'Bharti, K. — International Symposium on Software Testing and Analysis'},
    {year:'2022', title:'Traceability Recovery Between Agile User Stories and Test Cases', venue:'REJ', authors:'Bharti, K., Kapoor, D. — Requirements Engineering Journal'}
  ],
  teaching:[
    {code:'UCS503', name:'Software Engineering Principles', level:'undergraduate'},
    {code:'CSE452', name:'Software Testing & Quality Assurance', level:'undergraduate'},
    {code:'CSE221', name:'Object-Oriented Design', level:'undergraduate'},
    {code:'CSE601', name:'Advanced Topics in Empirical Software Engineering', level:'graduate'}
  ],
  assignments:[
    {course:'CSE452', title:'Assignment 2 — Design Test Cases for a Login Module', due:'20 Sep 2026', posted:'2026-09-04', status:'open', desc:'Apply boundary value analysis and equivalence partitioning to design a full test suite.'},
    {course:'UCS503', title:'Assignment 1 — Software Requirements Specification', due:'12 Sep 2026', posted:'2026-08-22', status:'closed', desc:'A formal SRS document for a chosen mini-project, following IEEE 830 structure.'},
    {course:'CSE221', title:'Assignment 3 — UML Class & Sequence Diagrams', due:'28 Sep 2026', posted:'2026-09-12', status:'open', desc:'Model a library management system with class and sequence diagrams.'}
  ],
  questionBank:{
    topics:[
      {name:'Boundary Value Analysis', tag:'high-yield'},
      {name:'Test Case Design Techniques', tag:'high-yield'},
      {name:'COCOMO Estimation', tag:'frequently asked'},
      {name:'Requirements Elicitation', tag:'core'},
      {name:'Coupling & Cohesion', tag:'core'}
    ],
    items:[
      {type:'mcq', topic:'Software Testing', difficulty:'medium', q:'Which technique divides input data into valid and invalid partitions for test design?', options:['Boundary value analysis','Equivalence partitioning','Mutation testing','Regression testing'], answer:1},
      {type:'mcq', topic:'Software Testing', difficulty:'easy', q:'White-box testing is also known as:', options:['Closed-box testing','Structural testing','Black-box testing','Acceptance testing'], answer:1},
      {type:'numerical', topic:'Project Management', difficulty:'hard', q:'Using the basic COCOMO model for an organic project of 25 KLOC (a=2.4, b=1.05), estimate the effort in person-months.', answer:'Effort = 2.4 × 25^1.05 ≈ 68 person-months.'},
      {type:'theory', topic:'Software Testing', difficulty:'medium', q:'Explain the difference between verification and validation with an example.', answer:'Verification checks "are we building the product right?" (reviews, inspections, static analysis); validation checks "are we building the right product?" (testing against user requirements). Example: reviewing an SRS is verification; user acceptance testing is validation.'},
      {type:'theory', topic:'Software Design', difficulty:'medium', q:'What is coupling and cohesion, and why is low coupling with high cohesion desirable?', answer:'Coupling measures interdependence between modules; cohesion measures how closely related the responsibilities within a single module are. Low coupling with high cohesion makes systems easier to test, maintain, and reuse.'}
    ]
  },
  customQB:[],
  students:{
    current:[
      {name:'Ritika Sood', role:'Ph.D.', topic:'automated program repair'},
      {name:'Aman Chauhan', role:'Ph.D.', topic:'flaky test detection'},
      {name:'Preet Kaur', role:'M.Tech', topic:'CI pipeline analysis'},
      {name:'Yuvraj Singh', role:'M.Tech', topic:'LLMs for code review'}
    ],
    alumni:[
      {name:'Dr. Naina Verma', role:'Ph.D. 2025', topic:'now at IIIT Delhi'},
      {name:'Rohan Mehta', role:'M.Tech 2024', topic:'now at a testing infrastructure startup'},
      {name:'Simran Gill', role:'M.Tech 2023', topic:'now a software engineer'}
    ]
  },
  announcements:[
    {date:'open now', tag:'opening', text:'Live project position — AI-assisted code review (RA / intern).'},
    {date:'Aug 2026', tag:'paper', text:'A paper from the group on flaky test detection was accepted at ICSE 2027.'},
    {date:'Jul 2026', tag:'course', text:'Lecture notes and assignment 2 for CSE452 — Software Testing & QA are now posted.'},
    {date:'May 2026', tag:'note', text:'Gave an invited talk on AI-assisted code review at the SE Colloquium, IIT Ropar.'},
    {date:'Feb 2026', tag:'note', text:'Awarded a seed grant to study refactoring practices in open-source projects.'}
  ],
  lectures:[
    {num:'01', title:'Introduction to Software Testing', desc:'Why testing matters, fault vs. failure, levels of testing.', posted:'2026-07-21'},
    {num:'02', title:'Black-Box Test Design', desc:'Equivalence partitioning, boundary value analysis, decision tables.', posted:'2026-08-04'},
    {num:'03', title:'White-Box Testing & Coverage', desc:'Statement, branch and path coverage; cyclomatic complexity.', posted:'2026-08-18'}
  ],
  uploads:[
    {id:'seed-k1', title:'MST solutions — Software Engineering Principles', type:'solutions', course:'UCS503', date:'2026-06-18', note:'Worked solutions for all five MST questions.'},
    {id:'seed-k2', title:'CSE452 — Unit 2 slides: Test Design Techniques', type:'lecture', course:'CSE452', date:'2026-07-28'},
    {id:'seed-k3', title:'Recorded lecture — Mutation Testing in Practice', type:'video', course:'CSE452', date:'2026-08-27', note:'48-minute recording from the Thursday class.'},
    {id:'seed-k4', title:'Paper — Predicting Flaky Tests from Commit History (preprint)', type:'paper', date:'2026-09-09'},
    {id:'seed-k5', title:'Mini-project brief — Library Management System', type:'project', course:'CSE221', date:'2026-09-30', note:'Team formation, milestones and evaluation rubric.'},
    {id:'seed-k6', title:'EST sample paper with solutions — Software Testing & QA', type:'solutions', course:'CSE452', date:'2026-10-19'}
  ],
  messages:[]
},
{
  id:'arjun-mehta', dept:'Mechanical Engineering', deptColor:'#3FE0A8', demo:true,
  name:'Arjun Mehta', role:'Associate Professor, Thermal & Fluid Systems',
  tagline:'Making campus energy systems and internal-combustion research a little more efficient.',
  office:'Block E, Room 118', officeHours:'Mon & Wed, 11:00–1:00 PM', email:'arjun.mehta@thapar.edu',
  joined:'2016', phd:'Mechanical Engineering, 2014',
  stats:{publications:31, years:10, students:3},
  about:["Demo profile — this is placeholder content so you can see how a second department looks inside FacultyConnect. Dr. Mehta's group works on heat transfer in compact engine geometries and low-emission combustion, and runs the campus's thermal-systems lab."],
  research:[
    {name:'combustion-lab/', desc:'Low-emission combustion strategies for small engines.'},
    {name:'heat-transfer/', desc:'Compact heat exchanger design and simulation.'}
  ],
  publications:[
    {year:'2025', title:'Heat Rejection in Compact Radial Engine Geometries', venue:'IJHT', authors:'Mehta, A., Sethi, R.'},
    {year:'2023', title:'Low-NOx Combustion Strategies for Small Diesel Engines', venue:'SAE', authors:'Mehta, A.'}
  ],
  teaching:[
    {code:'MEC301', name:'Thermodynamics II', level:'undergraduate'},
    {code:'MEC512', name:'Advanced Heat Transfer', level:'graduate'}
  ],
  assignments:[{course:'MEC301', title:'Assignment 1 — Entropy Balance Problems', due:'22 Sep 2026', posted:'2026-09-08', status:'open', desc:'Solve five entropy-generation problems from the problem set.'}],
  questionBank:{topics:[{name:'Second Law of Thermodynamics', tag:'core'}], items:[{type:'mcq', topic:'Thermodynamics', difficulty:'easy', q:'Entropy of an isolated system during a spontaneous process:', options:['Decreases','Stays constant','Increases','Becomes zero'], answer:2}]},
  customQB:[],
  lectures:[
    {num:'01', title:'Second Law Revisited', desc:'Entropy, exergy, and available work.', posted:'2026-07-24'},
    {num:'02', title:'Combustion Fundamentals', desc:'Stoichiometry, flame types, emissions.', posted:'2026-08-07'}
  ],
  students:{current:[{name:'Karan Bedi', role:'M.Tech', topic:'engine cooling design'}], alumni:[{name:'Ishaan Roy', role:'M.Tech 2022', topic:'now at an auto OEM'}]},
  announcements:[{date:'Aug 2026', tag:'note', text:'Thermal-systems lab open house on the 20th.'}],
  uploads:[{id:'seed-a1', title:'MEC301 — Unit 3 notes', type:'lecture', course:'MEC301', date:'2026-08-21'}],
  messages:[]
},
{
  id:'neha-kapoor', dept:'Electronics & Communication', deptColor:'#FF6E58', demo:true,
  name:'Neha Kapoor', role:'Assistant Professor, VLSI & Embedded Systems',
  tagline:'Squeezing more out of silicon — low-power chip design for student and industry projects.',
  office:'Block D, Room 302', officeHours:'Wed & Fri, 3:00–5:00 PM', email:'neha.kapoor@thapar.edu',
  joined:'2019', phd:'Electronics Engineering, 2018',
  stats:{publications:18, years:7, students:5},
  about:["Demo profile. Dr. Kapoor's group designs low-power VLSI circuits and runs a student embedded-systems collective that ships a working prototype every semester."],
  research:[
    {name:'low-power-vlsi/', desc:'Power-aware digital circuit design and layout.'},
    {name:'embedded-iot/', desc:'Sensor-driven embedded systems for campus and industry pilots.'}
  ],
  publications:[
    {year:'2026', title:'Sub-Threshold Logic for Battery-Free IoT Nodes', venue:'VLSID', authors:'Kapoor, N., Arora, V.'},
    {year:'2024', title:'A Low-Power Sensor Fusion ASIC for Wearables', venue:'ISCAS', authors:'Kapoor, N.'}
  ],
  teaching:[
    {code:'ECE304', name:'Digital VLSI Design', level:'undergraduate'},
    {code:'ECE470', name:'Embedded Systems Lab', level:'undergraduate'}
  ],
  assignments:[{course:'ECE304', title:'Assignment 2 — CMOS Inverter Sizing', due:'25 Sep 2026', posted:'2026-09-10', status:'open', desc:'Size a CMOS inverter for a target rise/fall time.'}],
  questionBank:{topics:[{name:'CMOS Fundamentals', tag:'high-yield'}], items:[{type:'theory', topic:'VLSI', difficulty:'medium', q:'Why does reducing supply voltage reduce dynamic power more than static power?', answer:'Dynamic power scales with V² (P = CV²f), so lowering voltage has a quadratic effect, while static (leakage) power scales roughly linearly with voltage.'}]},
  customQB:[],
  lectures:[
    {num:'01', title:'CMOS Fundamentals', desc:'Switching characteristics and power dissipation.', posted:'2026-07-29'},
    {num:'02', title:'Low-Power Design Styles', desc:'Clock gating, power gating, voltage scaling.', posted:'2026-08-12'}
  ],
  students:{current:[{name:'Divya Nair', role:'Ph.D.', topic:'sub-threshold logic'}], alumni:[]},
  announcements:[{date:'Jul 2026', tag:'opening', text:'Two embedded-systems project slots open for this semester.'}],
  uploads:[],
  messages:[]
},
{
  id:'rajiv-anand', dept:'Chemical Engineering', deptColor:'#FFC24E', demo:true,
  name:'Rajiv Anand', role:'Professor, Process Safety & Design',
  tagline:'Keeping industrial processes — and the people who run them — safe by design.',
  office:'Block F, Room 210', officeHours:'Tue & Thu, 10:00 AM–12:00 PM', email:'rajiv.anand@thapar.edu',
  joined:'2009', phd:'Chemical Engineering, 2006',
  stats:{publications:42, years:17, students:2},
  about:["Demo profile. Prof. Anand consults on process-safety audits for regional plants and teaches the department's core design sequence."],
  research:[{name:'process-safety/', desc:'Hazard analysis and inherently safer process design.'}],
  publications:[{year:'2024', title:'Inherently Safer Design in Batch Reactor Retrofits', venue:'JLPP', authors:'Anand, R., Suri, M.'}],
  teaching:[{code:'CHE440', name:'Plant Design & Economics', level:'undergraduate'}],
  assignments:[],
  questionBank:{topics:[], items:[]},
  customQB:[],
  lectures:[{num:'01', title:'Process Hazard Analysis', desc:'HAZOP methodology and case studies.', posted:'2026-08-03'}],
  students:{current:[], alumni:[{name:'Farhan Sheikh', role:'M.Tech 2021', topic:'now a process safety engineer'}]},
  announcements:[{date:'Jun 2026', tag:'note', text:'Guest lecture on refinery safety audits, Sept 30.'}],
  uploads:[],
  messages:[]
}
];
const CAMPUS_NOTICES = [
  {tag:'note', text:'Mid-semester break: October 12–16.'},
  {tag:'note', text:'Placement drive pre-registration opens this Friday.'},
  {tag:'note', text:'Library extended hours begin during exam week.'}
];
