'use client';

/**
 * The connected run of steps a relationship travels.
 *
 * A pipeline is a sequence, and a row of separate boxes does not say so. This
 * draws the steps as bubbles joined by a line: what has happened carries a tick,
 * where you are now is filled, what is ahead is quiet. The optional last step of
 * a single engagement hangs off the end of that line on its own, because it is
 * not part of the shared pipeline — it belongs to one engagement only.
 */

export type StepIcon = 'prospect' | 'message' | 'calendar' | 'followup' | 'closed' | 'flag' | 'plus';

export type FlowStep = {
  key: string;
  /** Shown under the bubble in the full variant, and as the accessible name always. */
  label: string;
  /** The quiet second line — a count, a date, a status. */
  sub?: string;
  icon: StepIcon;
  state: 'done' | 'current' | 'todo';
  /** When given, the bubble becomes a button. */
  onSelect?: () => void;
  /** Spoken to a screen reader in place of a bare label, when the label alone is not a sentence. */
  hint?: string;
};

const paths: Record<StepIcon, React.ReactNode> = {
  prospect: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 17c.7-2.8 2.8-4.3 5.5-4.3s4.8 1.5 5.5 4.3" /><path d="M15.5 5.5h5M18 3v5" /></>,
  message: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 5.5L20 7" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  followup: <><path d="M9 7 4 12l5 5" /><path d="M4 12h9a6 6 0 0 1 6 6v1" /></>,
  closed: <><circle cx="12" cy="12" r="8.5" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  flag: <><path d="M6 21V4" /><path d="M6 4.5h11l-2.2 4 2.2 4H6" /></>,
  plus: <><path d="M12 6v12M6 12h12" /></>,
};

const Glyph = ({icon}: {icon: StepIcon}) => <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[icon]}</svg>;

/** The tick that says a step is behind you, drawn over the bubble's edge. */
const Tick = () => <span className="step-tick" aria-hidden="true">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.8 4.8L19 7" />
  </svg>
</span>;

function Bubble({step, dashed}: {step: FlowStep; dashed?: boolean}) {
  const className = `step-bubble ${step.state}${dashed ? ' dashed' : ''}`;
  const inner = <>
    <Glyph icon={step.icon} />
    {step.state === 'done' && <Tick />}
  </>;
  return step.onSelect
    ? <button type="button" className={className} onClick={step.onSelect} aria-label={step.hint ?? step.label}>{inner}</button>
    : <span className={className} role="img" aria-label={step.hint ?? step.label}>{inner}</span>;
}

function Node({step, dashed}: {step: FlowStep; dashed?: boolean}) {
  return <div className="step-node">
    <Bubble step={step} dashed={dashed} />
    <span className="step-label">{step.label}</span>
    {step.sub && <span className="step-sub">{step.sub}</span>}
  </div>;
}

export default function StepFlow({
  steps, extra, label, compact = false,
}:{
  steps: FlowStep[];
  /**
   * The optional last step of one engagement. It sits past the end of the run,
   * reached by its own line, so nobody reads it as a pipeline step everyone shares.
   */
  extra?: FlowStep;
  label: string;
  /** Bubbles only, for the width of an engagement card. */
  compact?: boolean;
}) {
  return <div className={`step-flow${compact ? ' compact' : ''}`} role="group" aria-label={label}>
    {steps.map((step, index) => <div className="step-cell" key={step.key}>
      {index > 0 && <span className={`step-line${steps[index - 1].state === 'done' ? ' travelled' : ''}`} aria-hidden="true" />}
      <Node step={step} />
    </div>)}
    {extra && <div className="step-cell extra">
      <span className="step-line optional" aria-hidden="true" />
      <Node step={extra} dashed={extra.state === 'todo'} />
    </div>}
  </div>;
}
