# iOS call surface — frontend contract

What the iPhone call screen needs from the backend: one read to hydrate, twelve writes, ten live
events. The desktop client (`src/components/call/`, pinned by `tests/call.spec.ts`) is built against
this exact contract. Where iOS should behave the same way, it says so.

- Backend: `GroupCallsModule`, `GroupCallsService`, `CallGateway`
- Design kit: `ui_kits/video-call-ios` (393×852)
- Reference client: `caffriendlandingpage`, `src/components/call/` and `src/lib/call.ts`

## 1. One room, both shapes

A 1:1 coffee chat and a five-person group call are the same object. Accepting a coffee seats both
attendees in a `COFFEE_CHAT` room, already admitted, so the waiting room is simply empty rather than
a different screen.

`groupCallId` comes from:

- `POST /calendar/accept-event` (response)
- `GET /calendar/accepted-events/:type` (rows, both `CAFFRIEND` and `CRM` sources)
- `GET /workspaces/:workspaceId/meetings` and its detail route

It is `null` for an in-person coffee, and `null` on any coffee accepted before this shipped —
nothing backfills those.

The room address is stable **before, during and after** the call. It is not a join link that
expires: it is where the chat, notes, commitments and agenda live once the call is over. The iOS
calls list should keep pointing at it rather than swapping in a different destination.

## 2. The one read

`GET /group-calls/:id/call-state` hydrates the whole screen.

```
{
  room: { id, title, kind, status, roomName, locked, muteOnEntry,
          hostId, aiNotesConsent, roomProvisionedAt },
  participants: [ { id, userId, displayName, role, micOn, cameraOn, handRaised,
                    screenShareOn, connectionQuality, activeSpeaker, pinned,
                    waitingStatus, leftAt } ],
  waitingRoom:  [ ...same shape, waitingStatus: "waiting" ],
  chat:  { threadId, messages: [ { id, senderId, message, createdAt,
                                   mentions, resourceCards, replyToMessageId } ] },
  notes:        [ { id, authorUserId, scope, body, createdAt } ],
  actionItems:  [ { id, ownerUserId, text, dueAt, done } ],
  agendaBlocks: [ { id, title, prompt, sortOrder, completed } ]
}
```

Every collection needs a loading, empty, loaded and failed state.

**Defaults.** Rows written before this feature carry no live state. Fall back to the contract's
defaults, not to `nil`: `micOn` and `cameraOn` are **true**; `handRaised`, `screenShareOn`,
`activeSpeaker`, `pinned` false; `connectionQuality` `"unknown"`; `waitingStatus` `"admitted"`;
`role` `"participant"`. An old row should read as someone present with their camera on.

**Filtering.** Show a participant only when `waitingStatus == "admitted"` and `leftAt` is null.
Someone who left is history, not someone in the room.

**Ordering.** Sort `agendaBlocks` by `sortOrder`. Array order is not guaranteed.

`chat.threadId: null` means "no messages yet" — the backend mints the thread on first send.

## 3. The writes

All authenticated, all under `/group-calls`. REST is authoritative; never broadcast state from the
client and assume it stuck.

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/:id/call-state` | Hydrate the screen. |
| POST | `/:id/join` | LiveKit token and URL. The **first** join provisions the room — call it before expecting anyone's media. |
| POST | `/:id/call-controls` | `locked`, `muteOnEntry`, `aiNotesConsent`. Host/co-host only. |
| POST | `/:id/participants/:pid/state` | Your own mic/camera/hand/share; anyone's if you moderate. `role` changes need host/co-host. |
| POST | `/:id/participants/:pid/remove` | Remove someone. Host/co-host only. |
| POST | `/:id/waiting-room/:pid/admit` | Seat someone waiting. Host/co-host only. |
| POST | `/:id/waiting-room/:pid/decline` | Turn someone away. Host/co-host only. |
| POST | `/:id/call-chat/messages` | `message`, `replyToMessageId`, `mentions`, `resourceCards`. Text is not required when sending attachments or cards. |
| POST | `/:id/notes` | `scope` is `private`, `shared` or `ai`. An `ai` note needs host/co-host. |
| POST | `/:id/action-items` | `text`, optional `ownerUserId`, `dueAt`. |
| POST | `/:id/action-items/:itemId` | `done`, `text`, `ownerUserId`, `dueAt`. |
| POST | `/:id/agenda-blocks` | `title`, optional `prompt`, `sortOrder`. |

`403` means you are not in this call, or not a moderator. `404` means the call does not exist.
Surface both — never swallow a refusal into a silently reverted control.

Clients must not set `senderId`, `authorUserId`, `createdByUserId` or `groupCallId`; the service
derives them from auth and the route.

## 4. Live events

Socket.IO on the `/calls` namespace. Authenticate the handshake with the same bearer token the REST
calls use, emit `subscribeCallRoom` with `{ groupCallId }`, and wait for `call.room.subscribed`.
A `roomError` means unauthenticated or not a member.

| Event | Apply |
| --- | --- |
| `call.room.updated` | Lock, mute-on-entry, consent |
| `call.participant.updated` | Mic, camera, hand, share, role |
| `call.waiting.admitted` | Move from queue to room |
| `call.waiting.declined` | Drop from queue |
| `call.participant.removed` | Drop from room |
| `call.chat.message.created` | Append to thread |
| `call.note.created` | Append note |
| `call.action_item.created` | Append commitment |
| `call.action_item.updated` | Replace commitment |
| `call.agenda.created` | Insert by `sortOrder` |

Every payload carries `groupCallId` and `timestamp`, plus the changed entity under `room`,
`participant`, `message`, `note`, `actionItem` or `agendaBlock`.

**Patch what the event carries and leave the rest alone.** Refetching `call-state` on every event
throws away everyone's live mic, camera and hand state because one person typed a message.

**Events are not deduplicated.** A mutation you made yourself comes back as an event too. Key
inserts by `id` and ignore one you already hold.

## 5. Rules to match

These are the behaviours the desktop client settled on. Diverging makes the two clients disagree in
front of the same people on the same call.

**Your own controls are optimistic; moderation is not.** Mic, camera, hand, share and ticking a
commitment apply immediately and roll back if the server refuses — a control that waits for a round
trip reads as dead under the thumb. Admit, decline and remove apply only from the confirmed row,
because being wrong about who is in the room is worse than a moment's delay.

**Private notes are already filtered.** `call-state` never contains another person's private note.
Don't build a client-side guard and assume it is what keeps them apart. `call.note.created`
broadcasts a private note with `body: null`, so ignore an event for a private note that isn't yours.

**Pinning is per-viewer — keep it local.** The contract stores `pinned` on the participant row,
which would pin the tile for *everyone*. Desktop keeps pin in local state and does not write it.
Do the same until there's a per-viewer preference to write to.

**Mentions are ids; the text is the readable copy.** Write `@Display Name` into the message body and
send the matching `userId` in `mentions`. Before sending, drop any mention whose name is no longer in
the text — picking someone then deleting their name shouldn't quietly notify them. On render,
highlight the longest matching name first so "Maya Okafor" wins over "Maya".

**The clock runs from `roomProvisionedAt`.** That's when the first person joined, so everyone sees
the same duration and a late arrival doesn't see it start at zero. Older rows carry only `createdAt`;
a room never joined has neither — then show no clock rather than `00:00`.

**An ended call keeps its panel.** When `room.status` is not `OPEN`, drop the stage, the controls and
every moderation affordance, and keep chat, notes, commitments and agenda readable. The notes are the
point of the call and they outlive it.

## 6. iOS specifics

Per the brief, the relationship layer on iPhone is a tab bar inside the call with one sheet per tab —
not the desktop's single stacked panel. People opens by default, Chat carries an unread dot, and
tapping the active tab again dismisses the sheet.

| Region | Measure | Notes |
| --- | --- | --- |
| Frame | 393 × 852 | iPhone kit size |
| Status bar | 62.738px | The Figma status-bar height |
| Stage card | radius 20, inset 16 | Cream page behind it, not a black room |
| Self view | 92 × 124, radius 14 | |
| Filmstrip | 76px, tiles 86px | Horizontal scroll; Invite tile in group calls only |
| Controls | 56.906px round | Mic, camera, raise hand, Leave in red |
| Tab bar | 81px | Espresso bar, active tab orange |
| Sheet | 556px, radius 30 top | Grabber, title, close |

**Two things the kit still shows that are gone.** The iOS control row includes **Save moment** in
orange, and the Notes sheet has a **Saved moments** section. Both were cut — no endpoint, and desktop
doesn't build them. Delete them during the port rather than wiring them to local state.

## 7. Not backed

Things the kit draws that no route supports. Build around them, not against them.

- **Saved moments** — cut from the product.
- **Reactions** — `Messages.reactions` is a column but nothing writes it. Desktop renders no
  reaction pills.
- **Agenda timings** — no per-block minutes, no done/now/next. Blocks carry `sortOrder` and
  `completed` only, so "21 minutes left" and "Wrap by 9:45" have nothing behind them.
- **AI-notes consent banner** — `aiNotesConsent` is a per-user map on the room, but there's no rollup
  to say "all 5 participants agreed". AI note *generation* is not implemented; only notes created
  through the endpoint exist.
- **Connection quality** — accepts any string, but the backend only ever writes `"unknown"`. Draw the
  dot from LiveKit's own quality signal, or not at all.
- **Note editing and deletion**, agenda editing, action-item deletion. Create-only, except action
  items which also update.
- **Profile peek data** — rating, school, pronouns, mutuals, relationship history come from the user
  and relationship APIs, not `call-state`. Desktop reuses the existing public-profile fetch.

## 8. Two gotchas

In-call chat uses a **call-scoped thread** keyed to the `GroupCall`, not the two people's existing
direct-message thread. They're deliberately separate — don't merge them into one conversation view.

Chat history in `call-state` is **not paginated**. A long-running room returns every message in the
initial load. Plan the sheet's scroll for that, and expect pagination to arrive later as a change.
