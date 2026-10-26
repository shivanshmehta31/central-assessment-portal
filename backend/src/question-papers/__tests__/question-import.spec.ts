import { hasQuestionColumn, normalizeHeader, rowsToDrafts, textToDrafts } from '../question-import';

const row = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [normalizeHeader(k), v]));

describe('rowsToDrafts (CSV / Excel)', () => {
  it('parses a single-answer MCQ with a letter answer', () => {
    const [d] = rowsToDrafts([
      row({ Question: 'Which is a DataFrame library?', 'Question type': 'MCQ', 'Option A': 'NumPy', 'Option B': 'Pandas', 'Option C': 'Flask', 'Correct answer': 'B', Marks: '2', 'Negative Marks': '0.5', Topic: 'Pandas', Difficulty: 'easy' }),
    ]);
    expect(d.type).toBe('MCQ');
    expect(d.options.map((o) => o.isCorrect)).toEqual([false, true, false]);
    expect(d.marks).toBe(2);
    expect(d.negativeMarks).toBe(0.5);
    expect(d.difficulty).toBe('EASY');
    expect(d.errors).toEqual([]);
    expect(d.rowNumber).toBe(2);
  });

  it('promotes multiple correct letters to MULTIPLE_SELECT', () => {
    const [d] = rowsToDrafts([row({ question: 'Pick libs', optionA: 'A1', optionB: 'B1', optionC: 'C1', correctAnswer: 'A, C' })]);
    expect(d.type).toBe('MULTIPLE_SELECT');
    expect(d.options.map((o) => o.isCorrect)).toEqual([true, false, true]);
  });

  it('generates True/False options from the answer cell', () => {
    const [d] = rowsToDrafts([row({ question: 'Seaborn wraps Matplotlib', type: 'true/false', correctAnswer: 'True' })]);
    expect(d.options).toEqual([{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }]);
    expect(d.errors).toEqual([]);
  });

  it('defaults to DESCRIPTIVE with no options, marks 1', () => {
    const [d] = rowsToDrafts([row({ question: 'Explain chart junk.' })]);
    expect(d.type).toBe('DESCRIPTIVE');
    expect(d.marks).toBe(1);
    expect(d.topic).toBe('General');
  });

  it('flags problems instead of dropping the row', () => {
    const drafts = rowsToDrafts([
      row({ question: 'No correct option', type: 'MCQ', optionA: 'x', optionB: 'y' }),
      row({ question: 'Bad type', type: 'riddle' }),
      row({ question: 'Bad marks', marks: 'abc' }),
      row({ question: '' , marks: '2'}),
    ]);
    expect(drafts[0].errors).toContain('Mark exactly one correct option');
    expect(drafts[1].errors.some((e) => e.includes('Unknown question type'))).toBe(true);
    expect(drafts[2].errors).toContain('Marks must be a positive number');
    expect(drafts[3].errors).toContain('Question text is missing');
  });

  it('skips fully empty rows', () => {
    expect(rowsToDrafts([row({ question: '', marks: '' })])).toHaveLength(0);
  });

  it('detects a question column regardless of header styling', () => {
    expect(hasQuestionColumn(['Question Text', 'Marks'])).toBe(true);
    expect(hasQuestionColumn(['Foo', 'Bar'])).toBe(false);
  });
});

describe('textToDrafts (PDF text)', () => {
  const sample = `
Data Visualization Using Python — Mid Term
Time: 2 hours

1. Which library is used for tabular data? [2 marks]
A. NumPy
B. Pandas
C. Flask
Answer: B

Q2) Explain the difference between a histogram and a bar chart
and when each is appropriate. (5 marks)

3. Select the visualization libraries
(a) Matplotlib
(b) Seaborn
(c) Pandas
Answer: A, B
`;

  it('splits numbered questions and detects options, answers, and marks', () => {
    const { drafts } = textToDrafts(sample);
    expect(drafts).toHaveLength(3);

    expect(drafts[0].type).toBe('MCQ');
    expect(drafts[0].marks).toBe(2);
    expect(drafts[0].description).toBe('Which library is used for tabular data?');
    expect(drafts[0].options.map((o) => o.isCorrect)).toEqual([false, true, false]);
    expect(drafts[0].errors).toEqual([]);

    expect(drafts[1].type).toBe('DESCRIPTIVE');
    expect(drafts[1].marks).toBe(5);
    expect(drafts[1].description).toContain('and when each is appropriate.');

    expect(drafts[2].type).toBe('MULTIPLE_SELECT');
    expect(drafts[2].options.map((o) => o.isCorrect)).toEqual([true, true, false]);
  });

  it('leaves MCQs without a detected answer flagged for review', () => {
    const { drafts } = textToDrafts('1. Pick one\nA. x\nB. y');
    expect(drafts[0].errors).toContain('Mark exactly one correct option');
  });

  it('warns for scanned / unreadable PDFs', () => {
    const { drafts, warnings } = textToDrafts('  ');
    expect(drafts).toHaveLength(0);
    expect(warnings[0]).toMatch(/scanned/i);
  });

  it('warns when no numbered questions are found', () => {
    const { drafts, warnings } = textToDrafts('This is a long paragraph of text without any numbering at all, sorry.');
    expect(drafts).toHaveLength(0);
    expect(warnings[0]).toMatch(/numbered questions/i);
  });
});
