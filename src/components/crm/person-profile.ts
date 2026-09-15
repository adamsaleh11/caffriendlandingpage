import type { Person } from '@/lib/contracts';

/**
 * How a person entered the workspace. The backend stores this as free text, but
 * MANUAL carries a specific meaning in its rights model: a person a member typed
 * in themselves may be contacted without reviewed claims. So it is offered
 * explicitly rather than left to whatever a member happens to type.
 */
export const sourceCategories = [
  {value:'MANUAL', label:'I added them myself', hint:'Someone you met or found yourself. You may contact them.'},
  {value:'REFERRAL', label:'A referral', hint:'Introduced to you by someone else.'},
  {value:'EVENT', label:'An event', hint:'Met at a conference, meetup or similar.'},
  {value:'IMPORTED', label:'Imported from a document', hint:'From a file or dataset. Outreach stays blocked until its source rights are reviewed.'},
];

export const sourceLabel = (value: string) =>
  sourceCategories.find(row => row.value === value)?.label ?? value;

/** Every editable field on a person, in the order it is worth filling in. */
export type ProfileField = {
  name: 'displayName'|'title'|'organizationId'|'email'|'discoveryReason'|'location'|'sourceUrl'|'phone';
  label: string;
  /** Why this is worth having, shown once while filling it in — never as body text on the page. */
  hint?: string;
  placeholder?: string;
  kind: 'text'|'email'|'url'|'tel'|'organization'|'long';
  /** Counted towards the completeness bar. The name is not: it always exists. */
  scored: boolean;
  max: number;
};

/**
 * Ordered by what a chat actually needs: who they are and where they work, how to
 * reach them, what to talk about, then the rest.
 */
export const profileFields: ProfileField[] = [
  {name:'displayName', label:'Name', kind:'text', scored:false, max:200, placeholder:'Alex Rivera'},
  {name:'title', label:'Role', kind:'text', scored:true, max:200, placeholder:'Staff engineer', hint:'What they do — the first thing you will want in front of you.'},
  {name:'organizationId', label:'Organization', kind:'organization', scored:true, max:0, hint:'Links them to everyone else you know there.'},
  {name:'email', label:'Email', kind:'email', scored:true, max:320, placeholder:'alex@example.com', hint:'Needed before an invitation can go out.'},
  {name:'discoveryReason', label:'What to talk about', kind:'long', scored:true, max:2000,
    placeholder:'Building an agents platform. Wants Toronto hiring advice. Mentioned a launch in November.',
    hint:'The one thing you would want to reread in the five minutes before the call.'},
  {name:'location', label:'Location', kind:'text', scored:true, max:200, placeholder:'Toronto', hint:'Their timezone, in practice — it decides when you can meet.'},
  {name:'sourceUrl', label:'Profile link', kind:'url', scored:true, max:2048, placeholder:'https://www.linkedin.com/in/…', hint:'Where you read up on them. Must be an https link.'},
  {name:'phone', label:'Phone', kind:'tel', scored:true, max:50, placeholder:'+1 416 555 0134', hint:'For the day a call needs to move.'},
];

export const scoredFields = profileFields.filter(field => field.scored);

export const valueOf = (person: Person, field: ProfileField): string =>
  String((person as unknown as Record<string, unknown>)[field.name] ?? '');

/** Which fields are still empty, in the order they are worth filling in. */
export const missingFields = (person: Person) =>
  scoredFields.filter(field => !valueOf(person, field).trim());

export function completeness(person: Person) {
  const missing = missingFields(person);
  const filled = scoredFields.length - missing.length;
  return { filled, total: scoredFields.length, missing, ratio: filled / scoredFields.length };
}

/** Fields the backend only accepts once the CRM field registry update is deployed. */
export const extendedFields = ['sourceUrl', 'discoveryReason'] as const;

/**
 * "What to talk about" is one text field on the backend, but people write a list
 * into it. Splitting on line breaks and on the dashes and bullets they type by
 * hand lets the screen show each point on its own without a schema change.
 */
export const talkingPoints = (value: string | null | undefined): string[] =>
  String(value ?? '')
    .split(/\r?\n|(?:^|\s)[-•*]\s+/)
    .map(point => point.trim().replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

/** The same list written back the way it is read: one point per line. */
export const talkingPointsText = (points: string[]) => points.map(point => point.trim()).filter(Boolean).join('\n');
