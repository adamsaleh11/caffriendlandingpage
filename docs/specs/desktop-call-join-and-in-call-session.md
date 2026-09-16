# Desktop call join and in-call session

Status: ready-for-agent (not published — no issue tracker configured; see Further Notes)
Source: `Caffriend-backend/docs/contracts/desktop-in-call-session-contract.md` (2026-09-15)
Area: the shared call surface used by coffee-chat bookings and events.

## Problem Statement

A member with a booked coffee chat cannot get into it from Caffriend on the desktop.

Pressing **Join** on the Meetings page or on Upcoming Calls dead-ends on "This call could
not be loaded right now." The only desktop way in is the Join link in the invitation email,
and once through that door the call is visibly wrong: the in-call dock — microphone, camera,
share, raise hand, leave — never appears, so there is no way to mute, turn the camera off or
leave except by closing the tab. Every shared note the author writes appears twice in their
own notes list, though the other person sees it once.

The native consumer app is unaffected throughout. Two people on a call see two different
products, and the desktop one looks broken.

## Solution

The Join button opens the call and the call works.

Pressing Join on a Caffriend call takes the member straight into the room, host and invitee
alike, with the same reliability the phone already has. The dock is present from the moment
they arrive, so their microphone, camera and exit are under their control. A note appears
once, when they write it, in every list that should show it — and a private note shows its
author their own words rather than a blank.

Where a booking has no Caffriend room to join, the button is simply not offered, instead of
being offered and failing.

## User Stories

1. As a member with a booked coffee chat, I want the Join button on Upcoming Calls to take me into the call, so that I can attend from the desktop without hunting for the invitation email.
2. As a member, I want the Join button on the Meetings page to behave identically to the one on Upcoming Calls, so that where I happen to be in the product does not change whether I can attend.
3. As the invitee of a coffee chat, I want Join to work for me exactly as it does for the host, so that I am not the only one locked out of a call I accepted.
4. As the host of a coffee chat, I want my join to follow the same path as everyone else's, so that a bug affecting invitees is visible to me before a guest hits it.
5. As a member, I want a booking with no Caffriend room to show no Join button, so that I am not invited to press something that cannot work.
6. As a member joining a meeting that is held on Google Meet or Microsoft Teams, I want Join to open the provider link, so that the unified flow does not regress the meetings that already worked.
7. As a member with an in-person meeting, I want no Join button at all, so that the row reads as a place to be rather than a call to open.
8. As a member arriving via the invitation email link, I want the same in-call surface as a member arriving via the Join button, so that the two doors lead to one room.
9. As a member in a call, I want the dock present as soon as I arrive, so that I can mute before I have said anything I did not mean to broadcast.
10. As a member in a call, I want a working Leave button, so that I can exit without closing the browser tab.
11. As a member in a call, I want my microphone and camera toggles to reflect my own state, so that the controls tell me the truth about what the room can hear and see.
12. As a member who refreshes the page mid-call, I want to return to the same seat rather than appear as a second participant, so that the roster does not fill with ghosts of me.
13. As a member writing a shared note, I want it to appear once in my notes list, so that I do not have to work out which copy is real before continuing.
14. As the other person on the call, I want a note the author wrote to appear once for me too, so that our two views of the call agree.
15. As a member writing a private note, I want to see my own words in my list, so that the note is worth having written.
16. As the other person on the call, I want a private note's body withheld from me, so that private means private.
17. As a member with the call open in a second tab, I want my own private note to show its body there as well, so that the privacy rule does not blank my own writing.
18. As a member adding a commitment or sending a chat message, I want each to appear once, so that the fix to notes does not leave the neighbouring lists inconsistent.
19. As a member whose join fails for a real reason, I want a message that distinguishes "this call is unavailable" from "you are not in this call", so that I know whether to wait, sign in, or contact the organizer.
20. As a member, I want the call to load without polling, so that the room does not churn while I am in it.
21. As a member who closes the tab mid-call, I want my seat released, so that the other person is not left talking to a row that has gone.
22. As a member of an event using the shared call surface, I want these changes not to disturb the event call, so that fixing coffee chats does not break DESK-2.
23. As a developer, I want the "which participant is me" rule expressed in one place, so that the next join path added does not reintroduce a missing dock.
24. As a developer, I want the join-envelope fields the backend now returns to be projected with the same defaulting discipline as the rest of the call contract, so that an older or partial response degrades predictably.

## Implementation Decisions

**Call order on the call page.** `join` becomes the first backend call made when a call page
opens. `call-state` is membership-gated and a seat only exists after `join`, so reading it
first returns a correct 403 for an invitee; the host slipped through on a host short-circuit,
which is why the failure looked intermittent. `resolve` is unauthenticated and may still run
before `join` to drive the pre-join card, but nothing else may: not `call-state`, not the
roster, not the websocket subscription. The websocket subscribes only once a `participantId`
is in hand.

**Join envelope.** `POST /group-calls/:id/join` now answers with `participantId` and `userId`
alongside `token` and `url`. `participantId` is always present for guest and signed-in joins
alike; `userId` is the account behind the seat or `null` for a guest — null, never absent.
Re-joining after a refresh or reconnect returns the same `participantId` and does not create a
second seat, so the tab's in-call session keys off it. This envelope gains a projection in the
call-contract module beside the existing ones, so a missing or malformed field degrades the
way the rest of the contract does rather than reaching components as `undefined`.

**Roster identity.** `call-state` names each row `participants[].participantId`. The frontend
projects `id`, which matches `undefined` — this is the dock's root cause, not a display bug.
The projection reads `participantId`, and the existing fallbacks for rows that arrive without
one (email-invited and externally-imported people) are preserved, because those rows are still
real people who must key distinctly in a list.

**Finding yourself.** The pair of guesses — `userId === me` or `id === participantId` — is
replaced by one rule: the viewer's row is the one whose `participantId` equals the
`participantId` returned by `join`. This is expressed as a single named selector in the
call-contract module and is the only way any component answers "which of these is me". It works
for every join path, including a guest who has no account and therefore nothing else to match
on. `participantId` is also the identifier `heartbeat` and `leave` already take.

**Note echo.** The POST response is the bare resource; the socket broadcast wraps it
(`{ note }`, `{ actionItem }`, `{ message }`) and the ids inside are byte-identical. The
duplicate came from appending the bare POST response locally while de-duplicating against the
wrapped broadcast. Notes go socket-only, matching what chat and commitments already do, and the
local append is removed.

**Private notes are the exception to socket-only.** A private note's body is redacted in the
broadcast so the room cannot read it, which would blank the author's own copy. The payload
carries a second field alongside the redacted one:

```json
{ "note":       { "id": "n1", "scope": "private", "body": null,            "authorUserId": "u_123" },
  "authorNote": { "id": "n1", "scope": "private", "body": "the real text", "authorUserId": "u_123" } }
```

`authorNote` appears only on private notes. The rule: if `authorNote` is present and its
`authorUserId` is the viewer, render `authorNote`; otherwise render `note`. A shared note has
no `authorNote` and an intact body for everyone. The existing rule that drops another person's
private note entirely is kept.

**Join button href.** Driven by `venue`, from the shared accepted-events row source that
already backs Upcoming Calls, the Meetings page and the phone:

| `venue` | field read | button |
|---|---|---|
| `CAFFRIEND_LIVEKIT` | `groupCallId` | opens the Caffriend call page; hidden when null |
| `PROVIDER_CONFERENCE` | the provider link on the row | opens externally |
| `IN_PERSON` | — | no button |

The sequence does not branch on host versus invitee. A null `groupCallId` currently produces a
URL with `undefined` in it and a 404 that is indistinguishable from the membership 403; the
button is hidden instead. The existing five-minute join window is unchanged and still governs
when the button is live.

**Client obligations, unchanged and still required.** `x-caffriend-platform: desktop` on every
group-call request; `participantId` held for the tab's lifetime and dropped on leave;
heartbeat every 20 seconds; leave on both the Leave button and `beforeunload`; `call-state` as
the single initial load with the websocket as the only source of subsequent change; the LiveKit
token never logged.

**Modules touched.** The call-contract module (projections, the self selector, the join
envelope, the note-broadcast rule); the upcoming-meetings projection (Join button href and the
null-`groupCallId` gate); the call screen, which becomes a caller of the above rather than the
place the rules live; the meetings detail page, for the same href rule.

## Testing Decisions

A good test here asserts what a member experiences, stated as the sentence a reader would
recognise from the bug report — "a note the author wrote appears once", "the viewer's own row
is found" — and never asserts how the module reached that answer. The existing call tests set
the register: each is named as a claim about people, carries a short comment explaining the
real-world failure it guards, and builds its input from a small row factory.

**Seam: the call-contract module, via `node:test`.** This is the existing seam — the one
`tests/call-participants.test.mjs` and the other `*.test.mjs` unit tests already use — and no
new seam is introduced. The three fixes are moved behind it so they are testable as pure
functions: the participant projection, the self selector, the join-envelope projection, and the
note-broadcast rule. The call screen keeps no decision of its own worth testing.

**Seam: the upcoming-meetings projection, via `node:test`.** Already covered by
`tests/join-window.test.mjs`; the Join button href and the null-`groupCallId` gate are assertions
against the same exported projection.

**What gets tested.** That a roster row is identified by `participantId`; that a row without
one still keys distinctly, preserving the existing guarantee; that the self selector finds the
viewer for a signed-in join, a guest join with a null `userId`, and a roster containing a
same-named ghost; that it finds nobody rather than the wrong person when the viewer is absent;
that the join envelope projects `participantId` and a null `userId` without inventing values;
that a shared note applied from a broadcast lands once and is idempotent on redelivery; that a
private note renders the author's body for its author and is withheld from everyone else; that
the Join href is the call page for a Caffriend venue, the provider link for a provider
conference, absent for in person, and absent when `groupCallId` is null.

**Call ordering is covered end to end.** That `join` precedes `call-state` is a sequencing
property of the page, not of a pure function, and is asserted in the existing Playwright call
spec against the real backend. Only that spec is run — the full Playwright suite is not a gate
here.

**Prior art.** `tests/call-participants.test.mjs` for roster identity, `tests/join-window.test.mjs`
for the upcoming projection, `tests/call.spec.ts` for the in-call end-to-end path.

## Out of Scope

- **Guest collaboration.** The contract settles that guests are media-only: a guest joins, connects to LiveKit, and is then sent to login, and every collaboration surface plus the call websocket requires a signed-in session. Our API route still carries a guest call-session credential and routes guests into the full in-call surface. Removing that is a separate change with its own blast radius — route auth, the email-link flow, the login redirect — and is not part of these three fixes. See contract §5.
- Any backend change. The backend work is complete and additive; both existing clients ignore unknown fields.
- The native consumer app, which is unaffected.
- The event call surface, beyond not regressing it.
- Changing the five-minute join window, the pre-join card, or device selection.
- The duplicate-row and ghost-participant handling already in the projection, which is preserved as-is rather than revisited.

## Further Notes

This spec was not published to an issue tracker: none is configured for this repo, and no
triage-label vocabulary exists, so the `ready-for-agent` label could not be applied. Run
`/setup-matt-pocock-skills` if it should live in a tracker.

`docs/contracts/desktop-call-join-contract.md` in this repo is the list of questions that
produced the backend contract. It is now answered and superseded — in particular its §4 sketches
the guest call-session credential the contract says not to build. Delete it with the change, so
two contracts do not disagree.

The backend's own record of its side, including a deliberately reversed decision about the join
envelope, is `Caffriend-backend/docs/specs/join-envelope-participant-identity.md`.
