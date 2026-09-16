/**
 * Resolving an outreach email to a person, on the client side of the boundary.
 *
 * The server answers each address with one of two statuses. `CONNECTION` means an
 * account the sender has already met, and carries that person's profile.
 * `NO_ACCOUNT` covers everything else — no account, an account never met, and a
 * malformed address alike. That is deliberate on the server's part: a third value
 * would answer, for any address a sender can type, whether it belongs to a
 * Caffriend account, which is an enumeration oracle reachable from the invite box.
 */

/** A resolved profile. Field names are the server's, which are already the Person's. */
export type ResolvedProfile = {
  displayName?: string | null;
  title?: string | null;
  company?: string | null;
  organizationId?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
  image?: string | null;
};

export type ResolvedEntry = {
  email: string;
  status: string;
  userId?: string | null;
  /** A person this workspace already has for this address, to reuse rather than duplicate. */
  existingPersonId?: string | null;
  profile?: ResolvedProfile | null;
};

const connection = 'CONNECTION';

export type Notice = { tone: 'connection' | 'guest'; message: string };

/**
 * What the composer tells the sender about one recipient.
 *
 * The guest wording claims only what is true of every `NO_ACCOUNT` answer. Saying
 * "no Caffriend account" would assert something false about a person who has one
 * the sender has simply never met, and the client cannot tell those apart.
 */
export function noticeFor(entry: ResolvedEntry): Notice {
  if (entry.status !== connection) {
    return {tone: 'guest', message: 'They will answer from the email link as a guest.'};
  }
  const name = entry.profile?.displayName?.trim() || entry.email;
  return {tone: 'connection', message: `${name} is one of your connections — their details are filled in below.`};
}

/**
 * A display name derived from the address, for a recipient nothing is known about.
 *
 * Today's behaviour, moved here from the composer so the unit runner can hold it:
 * `jordan.lee@example.com` reads as `Jordan Lee`.
 */
export const nameFromEmail = (email: string): string =>
  email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) || email;

/** Live account fields carry trailing spaces, so every one of them is trimmed. */
const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export type PersonDraft = {
  displayName: string;
  email: string;
  sourceCategory: string;
  title?: string;
  location?: string;
  sourceUrl?: string;
  organizationId?: string;
};

/**
 * The record to write for a recipient the workspace has no person for.
 *
 * A resolved Connection fills in what the account already knows; anything else
 * keeps the derived name and nothing more. A field the account does not carry is
 * left out rather than padded with a placeholder — absent means "not recorded",
 * which the person page already renders as such.
 *
 * `company` is deliberately not copied: a person holds an `organizationId`, and an
 * organization is never created as a side effect of sending an invitation.
 */
export function personDraftFrom(entry: ResolvedEntry): PersonDraft {
  const profile = entry.status === connection ? entry.profile ?? null : null;
  const draft: PersonDraft = {
    displayName: clean(profile?.displayName) ?? nameFromEmail(entry.email),
    email: entry.email,
    sourceCategory: profile ? connection : 'MANUAL',
  };
  const title = clean(profile?.title);
  if (title) draft.title = title;
  const location = clean(profile?.location);
  if (location) draft.location = location;
  const sourceUrl = clean(profile?.sourceUrl);
  if (sourceUrl) draft.sourceUrl = sourceUrl;
  const organizationId = clean(profile?.organizationId);
  if (organizationId) draft.organizationId = organizationId;
  return draft;
}

/**
 * Which person an invitation is tracked against.
 *
 * `personId` names one to reuse; `create` is the record to write when there is
 * none. Reuse is what actually fixes duplicate people: the server names the person
 * this workspace already holds for an address, whether or not that address belongs
 * to an account, and sending to it again tracks the same person rather than a
 * second one. There is no uniqueness constraint behind this — reuse is the fix.
 *
 * A missing entry is not a failure: resolution is best-effort, and an address that
 * was never resolved falls back to exactly today's record.
 */
export function personPlanFor(
  target: { email: string; person?: { id: string } | null },
  entry: ResolvedEntry | undefined,
): { personId: string; create?: undefined } | { personId?: undefined; create: PersonDraft } {
  if (target.person) return {personId: target.person.id};
  if (entry?.existingPersonId) return {personId: entry.existingPersonId};
  return {create: personDraftFrom(entry ?? {email: target.email, status: 'NO_ACCOUNT', profile: null})};
}
