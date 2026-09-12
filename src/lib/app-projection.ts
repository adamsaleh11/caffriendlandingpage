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
import { normalizeWeeklyAvailability, type WeeklyAvailabilitySlot } from './weekly-availability';

type Row = Record<string, unknown>;
const list = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
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
    image: image(other.image_url) ?? image(Array.isArray(other.media) ? (other.media[0] as Row | undefined)?.url : null),
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
  source: 'CAFFRIEND' | 'CRM' | null;
  venue: 'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null;
  physicalLocation: string | null; joinUrl: string | null; meetingType: string | null;
  status: string | null; timezone: string | null; purpose: string | null;
  meetingId: string | null; workspaceId: string | null; engagementId: string | null;
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
    image: image(other.image_url) ?? image(Array.isArray(other.media) ? (other.media[0] as Row | undefined)?.url : null),
    format: text(row.format),
    notes: text(row.notes),
    // Matches the native rule: the target owes payment when the booking is unpaid and priced.
    needsPayment: String(target.id ?? '') === currentUserId && row.isPaid !== true && Number(row.amount ?? 0) > 0,
    threadId: text(row.messageThreadId),
    source: row.source === 'CAFFRIEND' || row.source === 'CRM' ? row.source : null,
    venue: ['CAFFRIEND_LIVEKIT','PROVIDER_CONFERENCE','IN_PERSON'].includes(String(row.venue)) ? row.venue as AppCall['venue'] : null,
    physicalLocation: text(row.physicalLocation),
    joinUrl: safeUrl(row.joinUrl),
    meetingType: text(row.meetingType),
    status: text(row.status),
    timezone: text(row.timezone),
    purpose: text(row.purpose),
    meetingId: text(row.meetingId),
    workspaceId: text(row.workspaceId),
    engagementId: text(row.engagementId),
  };
}

function safeUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; }
  catch { return null; }
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

/**
 * The signed-in person's own profile, as the Profile screen both renders and edits it.
 *
 * This is wider than the other projections on purpose: unlike a connection row,
 * this record is the subject of an edit form, so every field the native edit
 * screen (`app/profile/edit.tsx`) writes has to survive the round trip. Rate,
 * prompts, projects, work experience and coffee-chat tags stay native-only —
 * they are separate editors backed by their own endpoints.
 */
export type AppProfile = {
  id: string; name: string; email: string | null; image: string | null; bio: string | null;
  firstName: string; lastName: string;
  pronouns: string | null; jobTitle: string | null; company: string | null; industry: string | null;
  university: string | null; location: string | null; role: string | null;
  linkedInUrl: string | null; websiteUrl: string | null;
  accountRole: 'MENTEE' | 'MENTOR' | null;
  media: {id: string; url: string}[];
  /** In UTC, exactly as stored. The browser converts to the viewer's zone. */
  weeklyAvailability: WeeklyAvailabilitySlot[];
};
export function projectProfile(input: unknown): AppProfile {
  const row = (input ?? {}) as Row;
  const user = (row.user ?? row) as Row;
  const link = (value: unknown) => {
    const raw = text(value);
    if (!raw) return null;
    try { const url = new URL(raw); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
  };
  // The native app accepts any of these three spellings from the backend.
  const weekly = user.weeklyAvailability ?? user.weekly_availability ?? user.weekly_availabilty;
  const accountRole = String(user.role ?? '').toUpperCase();
  return {
    id: String(user.id ?? ''),
    name: fullName(user),
    firstName: text(user.firstName) ?? '',
    lastName: text(user.lastName) ?? '',
    email: text(user.email),
    role: text(user.role),
    image: image(user.image_url),
    bio: text(user.bio),
    pronouns: text(user.pronouns),
    // The backend sends job title as snake_case; `userType` is its older name.
    jobTitle: text(user.job_title) ?? text(user.userType),
    company: text(user.company),
    industry: text(user.industry),
    university: text(user.university),
    location: text(user.location),
    linkedInUrl: link(user.linkedInUrl),
    websiteUrl: link(user.websiteUrl),
    accountRole: accountRole === 'MENTOR' || accountRole === 'MENTEE' ? accountRole : null,
    media: list(user.media).map(item => ({id: String(item.id ?? ''), url: image(item.url) ?? image(item.media_url) ?? ''}))
      .filter(item => item.id && item.url),
    weeklyAvailability: normalizeWeeklyAvailability(weekly),
  };
}

/**
 * The fields a profile edit may set, and nothing else.
 *
 * The browser is not trusted to name the field: anything outside this map is
 * dropped rather than forwarded, so a crafted request cannot reach parts of
 * `PUT /user/profile` this screen does not edit (rate, pricing, subscription).
 * Each value is validated the same way the native modals validate it.
 */
const EDITABLE = ['firstName','lastName','pronouns','job_title','company','industry','university','location','linkedInUrl','websiteUrl'] as const;
const URL_FIELDS = new Set(['linkedInUrl','websiteUrl']);

export function profileEdit(input: unknown): Record<string, unknown> | null {
  const row = (input ?? {}) as Row;
  const payload: Record<string, unknown> = {};

  for (const field of EDITABLE) {
    if (!(field in row)) continue;
    const raw = row[field];
    // An empty string clears the field; the native modals send it the same way.
    if (raw === null || raw === '') { payload[field] = ''; continue; }
    if (typeof raw !== 'string' || raw.length > 300) return null;
    const value = raw.trim();
    if (URL_FIELDS.has(field)) {
      let url: URL;
      try { url = new URL(value); } catch { return null; }
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (field === 'linkedInUrl' && !/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
      payload[field] = url.toString();
      continue;
    }
    payload[field] = value;
  }

  if ('weeklyAvailability' in row) {
    if (!Array.isArray(row.weeklyAvailability)) return null;
    // Rejecting rather than silently dropping malformed slots: a half-saved
    // schedule is worse than a refused save the person can correct.
    const slots = normalizeWeeklyAvailability(row.weeklyAvailability);
    if (slots.length !== row.weeklyAvailability.length) return null;
    payload.weeklyAvailability = slots;
  }

  // `firstName` is the one field the native screen refuses to blank.
  if (payload.firstName === '') return null;
  return Object.keys(payload).length ? payload : null;
}

/**
 * Someone else's public profile, as the native public profile screen shows it
 * (`components/Profile/PublicProfileContent.tsx`).
 *
 * Wider than `AppProfileDetail`, which only fills in a connections table row.
 * This is what the profile modal renders, so it carries the photos, prompts,
 * projects, work history and counts that screen puts on the page — and, as
 * there too, none of the contact or billing fields the underlying record holds.
 */
export type AppPerson = AppProfileDetail & {
  id: string; name: string; image: string | null;
  media: {id: string; url: string}[];
  coffeeChatTags: string[];
  prompts: {question: string; answer: string}[];
  projects: {id: string | null; imageUrl: string | null; projectLink: string | null; description: string | null}[];
  workExperiences: {position: string | null; company: string | null; startDate: string | null; endDate: string | null; isCurrentlyWorking: boolean}[];
  coffeeChats: number | null;
  /** In UTC, as stored; the browser converts to the viewer's zone. */
  weeklyAvailability: WeeklyAvailabilitySlot[];
};

/** The answer text out of one `/basic-details/answers/:id` row, native's `extractAnswerText`. */
const answerText = (item: Row): string | null =>
  text(item.answer) ?? text((item.basicDetailAnswer as Row | undefined)?.answer)
  ?? text(item.text) ?? text(item.value) ?? text(item.title);

/** A coffee-chat tag row, identified the way native's `buildProfileAnswerGroups` identifies it. */
const isCoffeeChatTag = (item: Row): boolean => {
  const question = (item.basicDetailAnswer as Row | undefined)?.basicDetailQuestion
    ?? item.basicDetailQuestion ?? item.question ?? {};
  const key = String((question as Row).type ?? item.questionType ?? '').toLowerCase().replace(/[^a-z]+/g, '_');
  return key.includes('coffee_chat');
};

export function projectPerson(profileInput: unknown, detailsInput: unknown, mediaInput: unknown): AppPerson {
  const row = (profileInput ?? {}) as Row;
  const user = (row.user ?? row) as Row;
  const details = (detailsInput ?? {}) as Row;

  // Native merges the profile record's own media with `/media/user/:id`, first match wins.
  const photos = [...list(user.media), ...list(mediaInput)]
    .map(item => ({id: String(item.id ?? item.url ?? ''), url: image(item.url) ?? image(item.media_url) ?? ''}))
    .filter(item => item.id && item.url);
  const seen = new Set<string>();
  const media = photos.filter(item => !seen.has(item.url) && seen.add(item.url));

  const promptRows = list(details.promptsBlocks).length ? list(details.promptsBlocks) : list(user.promptsBlocks);
  const projectRows = list(details.projects).length ? list(details.projects)
    : list(details.projects_data).length ? list(details.projects_data)
    : list(user.projects).length ? list(user.projects) : list(user.projects_data);
  const experienceRows = list(details.workExperiences).length ? list(details.workExperiences)
    : list(details.work_experiences).length ? list(details.work_experiences)
    : list(user.workExperiences).length ? list(user.workExperiences) : list(user.work_experiences);

  return {
    ...projectProfileDetail(profileInput),
    id: String(user.id ?? ''),
    name: fullName(user),
    image: image(user.image_url) ?? media[0]?.url ?? null,
    media,
    coffeeChatTags: list(details.basicDetails).filter(isCoffeeChatTag).map(answerText).filter((v): v is string => !!v),
    prompts: promptRows.map(item => ({
      question: text((item.question as Row | undefined)?.question) ?? text(item.question) ?? text(item.prompt) ?? '',
      answer: text(item.answer) ?? text(item.response) ?? '',
    })).filter(item => item.question && item.answer),
    projects: projectRows.map(item => ({
      id: text(item.id),
      imageUrl: image(item.imageUrl) ?? image(item.image_url),
      projectLink: image(item.projectLink) ?? image(item.project_link) ?? image(item.link),
      description: text(item.description) ?? text(item.projectDescription) ?? text(item.project_description),
    })).filter(item => item.description || item.imageUrl || item.projectLink),
    workExperiences: experienceRows.map(item => ({
      position: text(item.position),
      company: text(item.company),
      startDate: text(item.startDate) ?? text(item.start_date),
      endDate: text(item.endDate) ?? text(item.end_date),
      isCurrentlyWorking: item.isCurrentlyWorking === true || item.is_currently_working === true,
    })).filter(item => item.position || item.company),
    avgRating: num(details.avgRating) ?? num(user.avgRating) ?? num(user.rating),
    matches: num(details.matches) ?? num(user.matches),
    coffeeChats: num(details.coffeeChat) ?? num(user.num_coffee_chats) ?? num(user.numCoffeeChats) ?? num(user.coffeeChats),
    weeklyAvailability: normalizeWeeklyAvailability(
      user.weeklyAvailability ?? user.weekly_availability ?? user.weekly_availabilty),
  };
}
