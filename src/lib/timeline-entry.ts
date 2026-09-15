/** One row of a person's timeline, as the page renders it. */
export type TimelineEntry = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  /** Who did it, when the record says. Agent work is never presented as the user's. */
  actor: string;
  byAgent: boolean;
  kind: 'change' | 'note' | 'task' | 'meeting';
};
