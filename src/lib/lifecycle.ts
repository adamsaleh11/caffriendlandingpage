/**
 * The Caffriend relationship lifecycle.
 *
 * The backend has no lifecycle enum. `PipelineStage` is an ordinary per-workspace
 * row with a free-text `name`, a `position` and an optional `terminalOutcome`
 * (`crm.records.ts` → `stages`, `prisma/schema.prisma` → `model PipelineStage`).
 * A stage is therefore whatever a workspace actually created.
 *
 * So this file is deliberately NOT a status enum the UI matches records against.
 * It is two separate things, and keeping them separate is the whole point:
 *
 *   1. `canonical` — the stage rows a new workspace is offered. Choosing it writes
 *      real `PipelineStage` records through `POST /workspaces/:id/pipelines/:id/stages`.
 *      After that the workspace owns them and may rename, reorder or retire any of
 *      them, exactly as before.
 *   2. `guidanceFor` — reading help, looked up by the stage's *own* name. When a
 *      workspace uses the canonical vocabulary the board can explain what each
 *      step means and what to do next. When it does not, the stage still renders
 *      under its real name with no guidance. Nothing is ever inferred, relabelled
 *      or reordered on the strength of this table.
 *
 * An engagement's position is always `engagement.stageId`, never a guess made here.
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
 * The lifecycle a relationship runs through, from a name an agent or a person
 * found to a relationship that outlives the immediate goal.
 *
 * Purpose-neutral on purpose: the same spine carries a coffee chat that becomes a
 * job interview and an agency conversation that becomes client work. Nothing here
 * is worded for sales.
 */
export const canonical: LifecycleStep[] = [
  { name: 'Prospect', meaning: 'Someone worth considering. Nothing has been decided yet.', prompt: 'Is this person worth pursuing?' },
  { name: 'Qualified', meaning: 'Worth pursuing, and you have recorded why.', prompt: 'What makes them a fit, and what will you say?' },
  { name: 'Contacted', meaning: 'You have reached out. No answer yet.', prompt: 'When did you reach out, and when will you follow up?' },
  { name: 'Engaged', meaning: 'They replied. A conversation is live.', prompt: 'What did they say, and what happens next?' },
  { name: 'Scheduling', meaning: 'You are agreeing a time to talk.', prompt: 'What times work for both of you?' },
  { name: 'Meeting booked', meaning: 'A time is agreed and on the calendar.', prompt: 'When is it, and what do you want out of it?' },
  { name: 'Completed', meaning: 'The conversation happened.', prompt: 'What came of it, and what did you commit to?' },
  { name: 'Follow-up', meaning: 'Something is owed before this can move on.', prompt: 'What must happen, by when, and who owns it?' },
  { name: 'Relationship', meaning: 'An ongoing relationship you want to keep.', prompt: 'When will you next be in touch?' },
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
