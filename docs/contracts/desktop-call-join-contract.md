# Contract request: desktop join + in-call session

**From:** web frontend (Next.js, caffriend.com)
**To:** backend
**Status:** questions open — we need the answers below before we change frontend wiring.

## 0. What we observed (2026-09-15, Adam + Shil, 1:1 coffee chat)

| Surface | Result |
|---|---|
| iOS app join | works fully |
| Desktop, **email "Join" link** (`/meet/<inviteToken>`) | call connects, video + roster correct, **but** (a) every shared note the author posts renders twice for the author, (b) the in-call dock (mic/camera/share/hand/leave) never renders |
| Desktop, **Join button** on Meetings page and Upcoming calls (`/calls/<groupCallId>`) | dead end: *"This call could not be loaded right now."* |

The third row is the blocking one: the same room the iOS app and the email link enter is unreachable from our own scheduling surfaces.

## 1. What the frontend calls today

All browser traffic goes through our own server routes (`/api/call/*` → backend), which add
`x-caffriend-platform: desktop` and either the signed-in bearer token **or**
`x-caffriend-call-session: <token>` for guests. Backend paths hit:

**Email-link path (works):**
1. `POST /meetings/join/resolve` `{token}` → `{purpose, startsAt, endsAt, timezone, groupCallId, requiresDisplayName, requiresTermsAcceptance, platformSupported}`
2. `GET  /group-calls/:groupCallId/resolve`
3. `POST /group-calls/:groupCallId/join` `{displayName, anonymousInstallId, invitationToken, acceptedTerms}` → `{token, url, participantId?, callSessionToken?}`
4. `GET  /group-calls/:groupCallId/call-state`
5. `ws  /calls` → `subscribeCallRoom {groupCallId, participantId}`

**Scheduling-surface path (fails):** identical, minus step 1, and with `POST /group-calls/:id/join` `{}` under the signed-in session. The id we pass is `meeting.groupCallId` as returned by `GET /calendar/accepted-events/:type` and the CRM meetings projection.

## 2. Q1 — Which id and which endpoint is the desktop join?

Our Join buttons link to `/calls/${meeting.groupCallId}` whenever `venue === 'CAFFRIEND_LIVEKIT'`
(`src/lib/upcoming.ts:159-170`, `src/components/crm/MeetingPage.tsx:162-170`). Please confirm, per field:

1. Is `groupCallId` on an accepted-event / meeting row **the same id** accepted by `GET /group-calls/:id/resolve`, `POST /group-calls/:id/join` and `GET /group-calls/:id/call-state`? If it is a Meeting id, GroupCall id, or a room id under another name, say which and name the field we should read instead.
2. Is the group call **provisioned at booking time** or lazily on first join? If lazily: what does `GET /group-calls/:id/*` return before provisioning, and what should the desktop call to provision it (the iOS app clearly does something that works — please give us the exact call sequence iOS makes, verbatim)?
3. Does `POST /group-calls/:id/join` with `{}` (bearer session, no invitation token) succeed for **both** the host and the invitee of a 1:1 coffee chat, or does an invitee always need an `invitationToken`? If a token is required, which endpoint mints one for an already-authenticated user?
4. Please give us the **actual status + body** the backend returns for our failing request. We surface any non-403/404 as the generic message, so we cannot tell a 500 from a 503 from a 422. A sample failing `groupCallId` and its response would settle this in one round.
5. If the correct desktop entry point is actually an invitation-token URL (`/meet/<token>`) rather than `/calls/<id>`, say so explicitly, and tell us which field on the meeting/accepted-event row carries that token so the Join button can link to it.

**Answer shape we need:** for each meeting row, the one field to read and the one URL to open, for each value of `venue` (`CAFFRIEND_LIVEKIT`, `PROVIDER_CONFERENCE`, `IN_PERSON`), for host and invitee, signed-in and guest.

## 3. Q2 — Identity of the joining participant (the missing dock)

The dock renders only when we can find the viewer's own row in the roster. We match on
`participant.userId === me` **or** `participant.id === access.participantId`
(`src/components/call/CallScreen.tsx:287-292`, `src/components/call/Dock.tsx:62`). When we
joined from the email link, neither matched — so the dock never rendered.

1. Does `POST /group-calls/:id/join` **always** return `participantId`, for guest and signed-in joins alike? It is optional in our type today because we have seen it absent. If it can be absent, under what conditions?
2. Does it also return the `userId` the backend assigned this session? For a guest join keyed by `anonymousInstallId`, the frontend has no way to know its own `userId`, so we cannot match the roster row at all without one of these two fields.
3. Are `participants[].id` in `call-state` and `participantId` from `join` the **same identifier space**? (We suspect they are not, which would explain the miss.)
4. When a signed-in member joins via an `invitationToken`, is their roster row keyed by their real `userId` or by a guest identity? If the latter, is there a documented moment where the row is reconciled to the real user, and is an event emitted for it?

**Answer shape we need:** a documented, always-present `{participantId, userId}` on the join response, plus a statement that `participantId === call-state.participants[].id`. That alone fixes the dock for every join path.

## 4. Q3 — Note echo (the duplicate notes)

`POST /group-calls/:id/notes` returns the created note and we append it locally; the socket
then delivers `call.note.created`, which we de-duplicate **by `id`**
(`src/lib/call.ts` `applyCallEvent`, `src/components/call/CallScreen.tsx:378-381`). We saw every
note twice, which means the id on the POST response and the id in the broadcast did not match.

1. What is the **exact** body of the 200 from `POST /group-calls/:id/notes`? Is it the bare note (`{id, authorUserId, scope, body, createdAt}`), or wrapped (`{data:{...}}`, `{note:{...}}`)? We unwrap `data` only.
2. Is the `id` in the response byte-identical to the `id` in the `call.note.created` payload for the same write? Same question for `call.chat.message.created` and `call.action_item.created`.
3. Is `call.note.created` broadcast **back to the author** as well as to the other participants? (We already rely on "yes" for chat and action items, where we deliberately do not append locally.) If yes for notes too, we will stop appending locally — confirm and we will make that change.
4. For `scope: 'private'`, is the body redacted for non-authors in the broadcast, and is the author's own copy sent with the body intact?

**Answer shape we need:** one sentence per resource — "the POST response and the broadcast carry the same `id`, and the author receives the broadcast" — or the opposite, stated plainly, so we can pick local-append vs socket-only per resource rather than guessing.

## 5. Q4 — Parity with iOS

iOS joins both rooms cleanly. Rather than reverse-engineer it, please paste the ordered list of
backend calls the iOS client makes from "tap Join on an upcoming meeting" to "in the room, controls
live", with request bodies and the fields it reads from each response. If iOS uses a different
endpoint family than `/group-calls/*`, that is the answer to §2 and we will move to it.

## 6. What we will do with the answers

- §2 → fix the `href` that the Meetings and Upcoming Calls Join buttons produce.
- §3 → match the viewer's roster row reliably, restoring the dock on every join path.
- §4 → remove the local append (or keep it) per resource, killing the duplicate notes.

No frontend change lands on guesses here; these three are all frontend-side wiring waiting on the
contract above.
