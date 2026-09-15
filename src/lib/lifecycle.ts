/**
 * The Caffriend relationship lifecycle.
 *
 * PipelineStage remains a backend row, but desktop intentionally exposes one
 * five-step vocabulary. The stable `Meeting booked` name is the integration point
 * used by invitation acceptance. Legacy rows are read compatibly by the board;
 * users cannot create or rename stages in this phase.
 */

export type LifecycleStep = {
  name: string;
  /** What the stage means, in one line, for the column header. */
  meaning: string;
  /** The question this stage answers for the person reading the board. */
  prompt: string;
  /** Written to `terminalOutcome` when this stage is created from the template. */
  terminalOutcome?: string;
};

/**
 * The five stable steps used by both the desktop CRM and booking automation.
 * Names are intentionally fixed: the backend moves an accepted invitation to
 * `Meeting booked`, so allowing local renames would make that transition ambiguous.
 */
export const canonical: LifecycleStep[] = [
  { name: 'Prospect', meaning: 'Someone worth considering. Nothing has been decided yet.', prompt: 'Is this person worth pursuing?' },
  { name: 'Contacted', meaning: 'You have reached out. No answer yet.', prompt: 'When did you reach out, and when will you follow up?' },
  { name: 'Meeting booked', meaning: 'A time is agreed and on the calendar.', prompt: 'When is it, and what do you want out of it?' },
  { name: 'Follow-up', meaning: 'Something is owed before this can move on.', prompt: 'What must happen, by when, and who owns it?' },
  { name: 'Closed', meaning: 'Not going further. The person and their history stay.', prompt: 'Why did it end?', terminalOutcome: 'CLOSED' },
];

export const canonicalPipeline = {
  name: 'Relationships',
  purpose: 'Take people found by me or by my agents, turn them into real conversations, and keep the relationships that come out of them.',
  stages: canonical,
};

const guidance = new Map(canonical.map(step => [step.name.toLowerCase(), step]));

/**
 * Reading help for a stage the workspace actually has, or `undefined` when the
 * workspace named its steps something else. The caller always renders
 * `stage.name`; this only decides whether an explanation sits beside it.
 */
export const guidanceFor = (stageName: string): LifecycleStep | undefined =>
  guidance.get(stageName.trim().toLowerCase());

/**
 * Whether a pipeline's live stages are the canonical lifecycle, in order. Used
 * only to decide whether the board may show the lifecycle as a legend — never to
 * change where an engagement sits.
 */
export const isCanonical = (stageNames: string[]): boolean => {
  const expected = canonical.map(step => step.name.toLowerCase());
  const actual = stageNames.map(name => name.trim().toLowerCase());
  return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
};
