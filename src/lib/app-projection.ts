/**
 * Consumer-surface projections.
 *
 * Every field below is taken from the types the native app already uses:
 * `MatchSuggestionItemDTO` and `getMatches` in `api/matchApi.tsx`,
 * `AcceptedEventResponseDto` in `app/api/calendarApi.tsx`, and
 * `LeaderBoardUser` in `types/leaderboard/leaderboard.types.ts`.
 *
 * The user records these endpoints return are far wider than these screens need,
 * so each projection names exactly what is rendered and drops the rest.
 */
type Row = Record<string, unknown>;
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const num = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Only an https image passes through; anything else renders as initials. */
const image = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; }
  catch { return null; }
};
const fullName = (row: Row) => [text(row.firstName), text(row.lastName)].filter(Boolean).join(' ') || 'Unnamed';

/**
 * The public profile behind `GET /user/profile/:id` (`UserProfileDTO`).
 *
 * Deliberately excludes the contact and billing fields that record carries —
 * email, phoneNumber, rate, pricing, subscription — none of which belong in a
 * connections table. Only what the native public profile puts on screen.
 */
export type AppProfileDetail = {
  jobTitle: string | null; industry: string | null; company: string | null;
  university: string | null; location: string | null; role: string | null;
  pronouns: string | null; linkedInUrl: string | null; websiteUrl: string | null;
  avgRating: number | null; matches: number | null;
};
export function projectProfileDetail(input: unknown): AppProfileDetail {
  const row = (input ?? {}) as Row;
  const user = (row.user ?? row) as Row;
  const link = (value: unknown) => {
    const raw = text(value);
    if (!raw) return null;
    try { const url = new URL(raw); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
  };
  return {
    // The backend sends job title as snake_case; `userType` is its older name.
    jobTitle: text(user.job_title) ?? text(user.userType),
    industry: text(user.industry),
    company: text(user.company),
    university: text(user.university),
    location: text(user.location),
    role: text(user.role) ?? text(user.roleText),
    pronouns: text(user.pronouns),
    linkedInUrl: link(user.linkedInUrl),
    websiteUrl: link(user.websiteUrl),
    avgRating: num(user.avgRating),
    matches: num(user.matches),
  };
}

/** A person as `/match/suggestions` returns them. */
export type AppSuggestion = {
  userId: string; name: string; role: string | null;
  score: number | null; avgRating: number | null; matches: number | null; image: string | null;
};
export function projectSuggestion(input: unknown): AppSuggestion {
  const row = (input ?? {}) as Row;
  return {
    userId: String(row.userId ?? ''),
    name: fullName(row),
    role: text(row.role),
    score: num(row.score),
    avgRating: num(row.avgRating),
    matches: num(row.matches),
    image: image(row.image_url),
  };
}

/** One row of `/match/matches`, resolved to the other person from the viewer's side. */
export type AppConnection = {
  id: string; userId: string; name: string; image: string | null;
  bucket: string; isNew: boolean; isMatched: boolean; threadId: string | null; updatedAt: string | null;
} & Partial<AppProfileDetail>;
export function projectConnection(input: unknown, bucket: string, currentUserId: string): AppConnection | null {
  const row = (input ?? {}) as Row;
  const decider = (row.deciderUser ?? {}) as Row;
  const target = (row.targetUser ?? {}) as Row;
  // Exactly the native resolution: whichever side is not the viewer is the other person.
  const other = String(decider.id ?? '') === currentUserId ? target
    : String(target.id ?? '') === currentUserId ? decider
    : null;
  if (!other || !other.id) return null;
  return {
    id: String(row.id ?? ''),
    userId: String(other.id),
    name: fullName(other),
    image: image(other.image_url),
    bucket,
    isNew: row.isNew === true || row.isViewed === false,
    isMatched: row.isMatched === true,
    threadId: text(row.chatId) ?? text(row.messageThreadId),
    updatedAt: text(row.updatedAt) ?? text(row.createdAt),
  };
}

/** One accepted event, as the native Upcoming Calls screen reads it. */
export type AppCall = {
  id: string; startDate: string | null; endDate: string | null;
  counterpartId: string | null; counterpart: string | null; image: string | null;
  format: string | null; notes: string | null; needsPayment: boolean; threadId: string | null;
};
export function projectCall(input: unknown, currentUserId: string): AppCall {
  const row = (input ?? {}) as Row;
  const booker = (row.booker ?? {}) as Row;
  const target = (row.targetUser ?? {}) as Row;
  const other = String(target.id ?? '') === currentUserId ? booker : target;
  const date = (value: unknown) => value instanceof Date ? value.toISOString() : text(value);
  return {
    id: String(row.id ?? ''),
    startDate: date(row.startDate),
    endDate: date(row.endDate),
    counterpartId: text(other.id),
    counterpart: Object.keys(other).length ? fullName(other) : null,
    image: image(other.image_url),
    format: text(row.format),
    notes: text(row.notes),
    // Matches the native rule: the target owes payment when the booking is unpaid and priced.
    needsPayment: String(target.id ?? '') === currentUserId && row.isPaid !== true && Number(row.amount ?? 0) > 0,
    threadId: text(row.messageThreadId),
  };
}

/** One leaderboard row. */
export type AppRank = {
  userId: string; name: string; rank: number | null; combinedScore: number | null;
  totalChats: number | null; totalMatches: number | null; totalMessages: number | null; image: string | null;
};
export function projectRank(input: unknown): AppRank {
  const row = (input ?? {}) as Row;
  return {
    userId: String(row.userId ?? ''),
    name: fullName(row),
    rank: num(row.rank),
    combinedScore: num(row.combinedScore),
    totalChats: num(row.totalChats),
    totalMatches: num(row.totalMatches),
    totalMessages: num(row.totalMessages),
    image: image(row.image_url),
  };
}

/** The signed-in person's own profile. */
export type AppProfile = { id: string; name: string; email: string | null; role: string | null; image: string | null; bio: string | null };
export function projectProfile(input: unknown): AppProfile {
  const row = (input ?? {}) as Row;
  const user = (row.user ?? row) as Row;
  return {
    id: String(user.id ?? ''),
    name: fullName(user),
    email: text(user.email),
    role: text(user.role),
    image: image(user.image_url),
    bio: text(user.bio),
  };
}
