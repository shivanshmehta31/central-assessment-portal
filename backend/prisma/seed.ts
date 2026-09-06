import { PrismaClient, Question, Student } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@institution.edu';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const FACULTY_EMAIL = process.env.SEED_FACULTY_EMAIL ?? 'faculty@institution.edu';
const FACULTY_PASSWORD = process.env.SEED_FACULTY_PASSWORD ?? 'Faculty@12345';
const STUDENT_PASSWORD = process.env.SEED_STUDENT_PASSWORD ?? 'Student@12345';

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

const SYLLABUS_UNITS = [
  {
    unit: 1,
    title: 'Introduction',
    topics: ['Python Basics', 'Data Visualization Introduction', 'Python for Visualization', 'Data Handling (Pandas/NumPy)'],
  },
  {
    unit: 2,
    title: 'Foundation for Visualization',
    topics: ['Plot Structure', 'Line & Bar Charts', 'Scatter Plots & Histograms', 'Subplots & Styling'],
  },
  {
    unit: 3,
    title: 'Statistical Visualization',
    topics: ['Seaborn', 'Central Tendency & Dispersion', 'Correlation & Covariance', 'Box Plots & Regression'],
  },
  {
    unit: 4,
    title: 'Interactive Visualization',
    topics: ['Plotly', 'Dash', 'Streamlit', 'Time-series & Real-time Dashboards'],
  },
  {
    unit: 5,
    title: 'Best Practices & Case Studies',
    topics: ['Visualization Ethics', 'Color Theory', 'Storytelling with Data', 'Business Intelligence & Power BI'],
  },
];

async function main() {
  console.log('Seeding Central Assessment & Examination Portal...');

  await prisma.systemSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      institutionName: 'Central Institute of Technology',
      academicYear: '2026-2027',
    },
  });

  const department = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: {},
    create: { name: 'Computer Science & Engineering', code: 'CSE' },
  });

  const course = await prisma.course.upsert({
    where: { code: 'BTECH-CSE' },
    update: {},
    create: { name: 'B.Tech — Computer Science & Engineering', code: 'BTECH-CSE', departmentId: department.id },
  });

  const subject = await prisma.subject.upsert({
    where: { code: 'DVP301' },
    update: { syllabusUnits: SYLLABUS_UNITS as any },
    create: {
      name: 'Data Visualization Using Python',
      code: 'DVP301',
      courseId: course.id,
      syllabusUnits: SYLLABUS_UNITS as any,
    },
  });

  // ── Admin ──────────────────────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash: await hash(ADMIN_PASSWORD),
      role: 'ADMIN',
      admin: { create: { name: 'Portal Administrator' } },
    },
  });

  // ── Faculty ────────────────────────────────────────────────────────────
  const facultyUser = await prisma.user.upsert({
    where: { email: FACULTY_EMAIL },
    update: {},
    create: {
      email: FACULTY_EMAIL,
      passwordHash: await hash(FACULTY_PASSWORD),
      role: 'FACULTY',
      faculty: {
        create: {
          name: 'Dr. Ananya Sharma',
          facultyCode: 'FAC-001',
          departmentId: department.id,
          designation: 'Associate Professor',
        },
      },
    },
    include: { faculty: true },
  });
  const faculty = await prisma.faculty.findUniqueOrThrow({ where: { userId: facultyUser.id } });
  await prisma.facultySubject.upsert({
    where: { facultyId_subjectId: { facultyId: faculty.id, subjectId: subject.id } },
    update: {},
    create: { facultyId: faculty.id, subjectId: subject.id },
  });

  // ── Students ───────────────────────────────────────────────────────────
  const studentNames = [
    'Aarav Mehta', 'Vivaan Iyer', 'Aditya Rao', 'Vihaan Nair', 'Arjun Pillai',
    'Sai Krishnan', 'Reyansh Gupta', 'Ayaan Khan', 'Krishna Reddy', 'Ishaan Verma',
    'Ananya Singh', 'Diya Patel', 'Saanvi Joshi', 'Aadhya Kulkarni', 'Myra Desai',
    'Anika Bose', 'Kiara Menon', 'Navya Chatterjee', 'Riya Kapoor', 'Ira Malhotra',
  ];

  const students: Student[] = [];
  for (let i = 0; i < studentNames.length; i++) {
    const rollSuffix = String(i + 1).padStart(3, '0');
    const email = `student${rollSuffix}@institution.edu`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await hash(STUDENT_PASSWORD),
        role: 'STUDENT',
        student: {
          create: {
            name: studentNames[i],
            studentCode: `CSE2026${rollSuffix}`,
            enrollmentNumber: `ENR2026${rollSuffix}`,
            departmentId: department.id,
            branch: 'Computer Science',
            semester: 5,
            section: 'A',
            batch: '2026',
            academicYear: '2026-2027',
          },
        },
      },
    });
    const student = await prisma.student.findUniqueOrThrow({ where: { userId: user.id } });
    students.push(student);
  }

  // ── Dataset for practical questions ───────────────────────────────────
  const dataset = await prisma.dataset.upsert({
    where: { id: 'seed-dataset-students' },
    update: {},
    create: {
      id: 'seed-dataset-students',
      name: 'students_scores.csv',
      fileUrl: '/uploads/datasets/students_scores.csv',
      format: 'csv',
      rowCount: 8,
      columnCount: 4,
      previewJson: [
        { name: 'Aarav', maths: 78, science: 85, english: null },
        { name: 'Diya', maths: 92, science: null, english: 88 },
        { name: 'Kabir', maths: null, science: 74, english: 69 },
        { name: 'Meera', maths: 65, science: 71, english: 80 },
      ],
    },
  });

  // ── Question Bank ──────────────────────────────────────────────────────
  type Q = Parameters<typeof prisma.question.create>[0]['data'];

  const questions: Q[] = [
    // ── 10 MCQs across units ──
    { title: 'Tabular data library', description: 'Which library is primarily used for tabular data manipulation in Python?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 1, negativeMarks: 0.25, explanation: 'Pandas provides DataFrame and Series structures for tabular data.', options: { create: [{ text: 'NumPy', isCorrect: false, order: 0 }, { text: 'Pandas', isCorrect: true, order: 1 }, { text: 'Matplotlib', isCorrect: false, order: 2 }, { text: 'Flask', isCorrect: false, order: 3 }] } },
    { title: 'Mutable sequence type', description: 'Which of the following Python data types is mutable?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Python Basics', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Tuple', isCorrect: false, order: 0 }, { text: 'String', isCorrect: false, order: 1 }, { text: 'List', isCorrect: true, order: 2 }, { text: 'Frozenset', isCorrect: false, order: 3 }] } },
    { title: 'DataFrame missing values', description: 'Which Pandas method returns the count of missing values in each column?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'df.dropna()', isCorrect: false, order: 0 }, { text: 'df.isnull().sum()', isCorrect: true, order: 1 }, { text: 'df.fillna()', isCorrect: false, order: 2 }, { text: 'df.count()', isCorrect: false, order: 3 }] } },
    { title: 'NumPy array creation', description: 'Which NumPy function creates an array of evenly spaced values within a given interval?', type: 'MCQ', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'np.zeros()', isCorrect: false, order: 0 }, { text: 'np.arange()', isCorrect: true, order: 1 }, { text: 'np.array()', isCorrect: false, order: 2 }, { text: 'np.eye()', isCorrect: false, order: 3 }] } },
    { title: 'Matplotlib figure vs axes', description: 'In Matplotlib, which object represents an individual plot within a figure?', type: 'MCQ', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Plot Structure', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Figure', isCorrect: false, order: 0 }, { text: 'Canvas', isCorrect: false, order: 1 }, { text: 'Axes', isCorrect: true, order: 2 }, { text: 'Layer', isCorrect: false, order: 3 }] } },
    { title: 'Chart for distribution', description: 'Which chart type is most appropriate for visualizing the distribution of a single continuous variable?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Scatter Plots & Histograms', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Pie chart', isCorrect: false, order: 0 }, { text: 'Histogram', isCorrect: true, order: 1 }, { text: 'Scatter plot', isCorrect: false, order: 2 }, { text: 'Line chart', isCorrect: false, order: 3 }] } },
    { title: 'Seaborn heatmap purpose', description: 'A Seaborn heatmap of df.corr() is most useful for visualizing:', type: 'MCQ', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Correlation & Covariance', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Missing values', isCorrect: false, order: 0 }, { text: 'Pairwise correlation between numeric columns', isCorrect: true, order: 1 }, { text: 'Data types of columns', isCorrect: false, order: 2 }, { text: 'Row counts', isCorrect: false, order: 3 }] } },
    { title: 'Central tendency measure', description: 'Which of the following is NOT a measure of central tendency?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Central Tendency & Dispersion', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Mean', isCorrect: false, order: 0 }, { text: 'Median', isCorrect: false, order: 1 }, { text: 'Mode', isCorrect: false, order: 2 }, { text: 'Standard Deviation', isCorrect: true, order: 3 }] } },
    { title: 'Plotly interactivity', description: 'Which feature is a core advantage of Plotly over static Matplotlib charts?', type: 'MCQ', difficulty: 'EASY', subjectId: subject.id, topic: 'Plotly', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Smaller file size', isCorrect: false, order: 0 }, { text: 'Built-in hover, zoom, and pan interactivity', isCorrect: true, order: 1 }, { text: 'Faster CPU rendering', isCorrect: false, order: 2 }, { text: 'No need for Python', isCorrect: false, order: 3 }] } },
    { title: 'Dash framework purpose', description: 'Dash is primarily used to:', type: 'MCQ', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Dash', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'Train machine learning models', isCorrect: false, order: 0 }, { text: 'Build interactive web-based analytical dashboards', isCorrect: true, order: 1 }, { text: 'Manage databases', isCorrect: false, order: 2 }, { text: 'Compile Python to C', isCorrect: false, order: 3 }] } },

    // ── 5 Multiple-select ──
    { title: 'Visualization libraries', description: 'Which of the following are Python libraries that can be used for data visualization? (Select all that apply)', type: 'MULTIPLE_SELECT', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Visualization Introduction', marks: 2, negativeMarks: 0.5, options: { create: [{ text: 'Matplotlib', isCorrect: true, order: 0 }, { text: 'Seaborn', isCorrect: true, order: 1 }, { text: 'Plotly', isCorrect: true, order: 2 }, { text: 'Pandas', isCorrect: false, order: 3 }] } },
    { title: 'Measures of dispersion', description: 'Which of the following are measures of dispersion? (Select all that apply)', type: 'MULTIPLE_SELECT', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Central Tendency & Dispersion', marks: 2, negativeMarks: 0.5, options: { create: [{ text: 'Range', isCorrect: true, order: 0 }, { text: 'Variance', isCorrect: true, order: 1 }, { text: 'Standard Deviation', isCorrect: true, order: 2 }, { text: 'Mode', isCorrect: false, order: 3 }] } },
    { title: 'Pandas data structures', description: 'Which of the following are core Pandas data structures? (Select all that apply)', type: 'MULTIPLE_SELECT', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 2, negativeMarks: 0.5, options: { create: [{ text: 'DataFrame', isCorrect: true, order: 0 }, { text: 'Series', isCorrect: true, order: 1 }, { text: 'Array', isCorrect: false, order: 2 }, { text: 'Panel', isCorrect: false, order: 3 }] } },
    { title: 'Interactive dashboard tools', description: 'Which of the following can be used to build interactive dashboards? (Select all that apply)', type: 'MULTIPLE_SELECT', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Streamlit', marks: 2, negativeMarks: 0.5, options: { create: [{ text: 'Streamlit', isCorrect: true, order: 0 }, { text: 'Dash', isCorrect: true, order: 1 }, { text: 'NumPy', isCorrect: false, order: 2 }, { text: 'Power BI', isCorrect: true, order: 3 }] } },
    { title: 'Good visualization practices', description: 'Which of the following are considered good data visualization practices? (Select all that apply)', type: 'MULTIPLE_SELECT', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Visualization Ethics', marks: 2, negativeMarks: 0.5, options: { create: [{ text: 'Using a truncated y-axis to exaggerate small differences', isCorrect: false, order: 0 }, { text: 'Choosing colorblind-accessible palettes', isCorrect: true, order: 1 }, { text: 'Labeling axes clearly', isCorrect: true, order: 2 }, { text: 'Avoiding unnecessary 3D effects', isCorrect: true, order: 3 }] } },

    // ── 3 Code output prediction ──
    { title: 'NumPy broadcasting output', description: 'Predict the output:\n\n```python\nimport numpy as np\na = np.array([1, 2, 3])\nprint(a + 5)\n```', type: 'CODE_OUTPUT_PREDICTION', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 2, negativeMarks: 0, expectedOutput: '[6 7 8]', explanation: 'NumPy broadcasts the scalar 5 across every element of the array.' },
    { title: 'List slicing output', description: 'Predict the output:\n\n```python\nnums = [10, 20, 30, 40, 50]\nprint(nums[1:4])\n```', type: 'CODE_OUTPUT_PREDICTION', difficulty: 'EASY', subjectId: subject.id, topic: 'Python Basics', marks: 1, negativeMarks: 0, expectedOutput: '[20, 30, 40]' },
    { title: 'Pandas Series arithmetic output', description: 'Predict the output:\n\n```python\nimport pandas as pd\ns = pd.Series([1, 2, 3])\nprint((s * 2).tolist())\n```', type: 'CODE_OUTPUT_PREDICTION', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 2, negativeMarks: 0, expectedOutput: '[2, 4, 6]' },

    // ── 3 Debugging ──
    { title: 'Fix the heatmap call', description: 'The following code raises an error. Identify and correct the bug, then submit the corrected code.', type: 'CODE_DEBUGGING', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Correlation & Covariance', marks: 3, negativeMarks: 0, incorrectCode: 'import seaborn as sns\nsns.heatmap(df.corr, annot=True)', explanation: 'df.corr is a method reference, not a call — it must be invoked as df.corr().' },
    { title: 'Fix the missing-values call', description: 'The following code raises an AttributeError. Identify and correct the bug.', type: 'CODE_DEBUGGING', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 2, negativeMarks: 0, incorrectCode: 'import pandas as pd\ndf = pd.read_csv("data.csv")\nprint(df.isnull.sum())', explanation: 'isnull is a method and must be called: df.isnull().sum().' },
    { title: 'Fix the Matplotlib import', description: 'The following code fails to run. Identify and correct the bug.', type: 'CODE_DEBUGGING', difficulty: 'EASY', subjectId: subject.id, topic: 'Plot Structure', marks: 2, negativeMarks: 0, incorrectCode: 'import matplotlib.pyplot as plt\nplt.plot([1,2,3],[4,5,6])\nplt.show', explanation: 'show is a method and must be called: plt.show().' },

    // ── 3 Coding ──
    { title: 'Count missing values per column', description: 'Using Pandas, load the given dataset and print the number of missing values in each column.', type: 'CODING', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 4, negativeMarks: 0, language: 'python', starterCode: 'import pandas as pd\n\ndf = pd.read_csv("students_scores.csv")\n# Your code here\n', sampleInput: 'students_scores.csv', sampleOutput: 'maths      1\nscience    1\nenglish    1\ndtype: int64', datasetId: dataset.id, allowedLibraries: ['pandas', 'numpy'], allowDatasetDownload: true },
    { title: 'Correlation heatmap', description: 'Write Python code using Seaborn to create a correlation heatmap of the numeric columns in the given dataset, with correlation values annotated.', type: 'CODING', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Correlation & Covariance', marks: 4, negativeMarks: 0, language: 'python', starterCode: 'import pandas as pd\nimport seaborn as sns\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv("students_scores.csv")\n# Your code here\n', datasetId: dataset.id, allowedLibraries: ['pandas', 'seaborn', 'matplotlib'], allowDatasetDownload: true },
    { title: 'Monthly sales line plot', description: 'Given a list of months and corresponding sales figures, write Python code using Matplotlib to create a line plot of sales over months with proper axis labels and a title.', type: 'CODING', difficulty: 'EASY', subjectId: subject.id, topic: 'Plot Structure', marks: 3, negativeMarks: 0, language: 'python', starterCode: 'import matplotlib.pyplot as plt\n\nmonths = ["Jan", "Feb", "Mar", "Apr"]\nsales = [120, 135, 160, 150]\n# Your code here\n', allowedLibraries: ['matplotlib'] },

    // ── 2 Descriptive ──
    { title: 'Ethics in data visualization', description: 'Explain, with an example, how a chart can be designed to mislead viewers even when the underlying data is accurate. Discuss at least two best practices to avoid this.', type: 'DESCRIPTIVE', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Visualization Ethics', marks: 5, negativeMarks: 0, wordLimit: 250 },
    { title: 'Choosing the right chart', description: 'A retail company wants to compare monthly revenue across five product categories over two years. Recommend a chart type for this scenario and justify your choice, mentioning any alternatives you considered.', type: 'DESCRIPTIVE', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Storytelling with Data', marks: 5, negativeMarks: 0, wordLimit: 250 },

    // ── Extra: True/False, Short answer, Dataset analysis, Visualization interpretation, Code completion ──
    { title: 'Seaborn built on Matplotlib', description: 'True or False: Seaborn is built on top of Matplotlib and extends it with statistical plotting functions.', type: 'TRUE_FALSE', difficulty: 'EASY', subjectId: subject.id, topic: 'Seaborn', marks: 1, negativeMarks: 0.25, options: { create: [{ text: 'True', isCorrect: true, order: 0 }, { text: 'False', isCorrect: false, order: 1 }] } },
    { title: 'Pandas creator', description: 'In one or two words, name the primary data structure in Pandas used to represent a single column of data.', type: 'SHORT_ANSWER', difficulty: 'EASY', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 1, negativeMarks: 0, shortAnswerKey: 'Series', characterLimit: 50 },
    { title: 'Identify duplicate records', description: 'Given the dataset, write the Pandas expression that would return the number of duplicate rows.', type: 'DATASET_ANALYSIS', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 3, negativeMarks: 0, datasetId: dataset.id, allowedLibraries: ['pandas'], allowDatasetDownload: true },
    { title: 'Interpreting a correlation heatmap', description: 'A correlation heatmap shows a value of -0.85 between "hours studied" and "hours on social media". What can you infer about the relationship between these two variables?', type: 'VISUALIZATION_INTERPRETATION', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Correlation & Covariance', marks: 3, negativeMarks: 0 },
    { title: 'Complete the groupby aggregation', description: 'Fill in the missing code to compute the average score per department.\n\n```python\nimport pandas as pd\ndf = pd.read_csv("data.csv")\nresult = df.________("department")["score"].mean()\n```', type: 'CODE_COMPLETION', difficulty: 'MEDIUM', subjectId: subject.id, topic: 'Data Handling (Pandas/NumPy)', marks: 2, negativeMarks: 0, language: 'python', explanation: 'groupby("department") groups rows before aggregating.' },
  ];

  const createdQuestions: Question[] = [];
  for (const q of questions) {
    const created = await prisma.question.create({ data: { ...q, createdById: faculty.id } as any });
    createdQuestions.push(created);
  }

  // ── Sample Assessment ────────────────────────────────────────────────
  const now = new Date();
  const assessment = await prisma.assessment.upsert({
    where: { id: 'seed-assessment-1' },
    update: {},
    create: {
      id: 'seed-assessment-1',
      title: 'Data Visualization Using Python – Assessment 1',
      description: 'Covers all five syllabus units: Python & Pandas foundations, static and statistical visualization, and interactive dashboards.',
      subjectId: subject.id,
      type: 'INTERNAL_ASSESSMENT',
      status: 'SCHEDULED',
      totalMarks: createdQuestions.reduce((sum, q) => sum + q.marks, 0),
      passingMarks: 30,
      durationMinutes: 60,
      startAt: new Date(now.getTime() - 5 * 60_000),
      endAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000),
      maxAttempts: 1,
      allowResume: true,
      randomizeQuestionOrder: true,
      randomizeOptionOrder: true,
      deviceRestriction: 'DESKTOP_AND_TABLET',
      requireFullscreen: true,
      violationLimit: 3,
      violationAction: 'AUTO_SUBMIT',
      showResultsImmediately: false,
      showCorrectAnswers: false,
      semester: '5',
      batch: '2026',
      createdById: adminUser.id,
    },
  });

  await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.assessmentQuestion.createMany({
    data: createdQuestions.map((q, order) => ({ assessmentId: assessment.id, questionId: q.id, order })),
  });

  await prisma.assessmentAssignment.createMany({
    data: students.map((s) => ({ assessmentId: assessment.id, studentId: s.id })),
    skipDuplicates: true,
  });

  await prisma.assessmentEvaluator.upsert({
    where: { assessmentId_facultyId: { assessmentId: assessment.id, facultyId: faculty.id } },
    update: {},
    create: { assessmentId: assessment.id, facultyId: faculty.id },
  });

  console.log('Seed complete.');
  console.log('──────────────────────────────────────────────');
  console.log(`Admin      → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`Faculty    → ${FACULTY_EMAIL} / ${FACULTY_PASSWORD}`);
  console.log(`Students   → student001@institution.edu ... student020@institution.edu / ${STUDENT_PASSWORD}`);
  console.log(`             (Student ID: CSE2026001 ... CSE2026020)`);
  console.log('──────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
