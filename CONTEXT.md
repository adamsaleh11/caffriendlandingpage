# Caffriend

Caffriend includes a native consumer app and a desktop CRM for managing relationships and work.

## Language

**Native consumer app**:
The Caffriend mobile experience, distinct from the desktop CRM.

**Desktop CRM**:
The workspace-based Caffriend experience for People, Pipeline, Inbox, Agents, Calendar and Settings. Ordinary navigation does not require AI or a calendar connection.

**Person**:
An individual whose relationship is managed in a CRM workspace. The same person may be involved in multiple engagements.

**Organization**:
A company or other organization associated with people and the relationship efforts involving them.

**Engagement**:
A purpose-specific relationship effort involving a person, with its own pipeline position and outcome. One person may have simultaneous engagements, such as exploring a partnership and an advisory role; ending one does not end the others or remove the person.

**MCP consent**:
A user's decision to allow or decline a requesting application's requested access to a chosen Caffriend workspace.

**Calendar connection**:
An optional connection to a Google or Outlook calendar account, with granted access and a selected calendar.
_Avoid_: Caffriend login

**Mailbox connection**:
Permission for Caffriend to send explicitly confirmed invitation emails from the user's own email account. It is distinct from permission to access their calendar.

**Coffee-chat invitation**:
An invitation from a Caffriend account holder to arrange a coffee chat using the sender's availability or proposed times. Recipients may book and participate with an account or as a guest; sending the invitation does not itself create a booking.

**Meeting outreach**:
The sender-owned record of a coffee-chat invitation, including its delivery and recipient-decision state. It belongs to an engagement but is not itself a meeting.
_Avoid_: Meeting, booking

**Invitation batch**:
A desktop composing convenience that sends one independent meeting outreach and one private response link per recipient. It is not a group event or a shared booking.

**Relationship lifecycle**:
The five stable desktop pipeline steps: Prospect, Contacted, Meeting booked, Follow-up, and Closed. Invitation acceptance, not a manual pipeline action, advances a tracked engagement to Meeting booked.

**Invitation acceptance**:
A recipient's explicit confirmation of exactly one selected proposed time, resulting in a booked meeting. Opening an invitation, following an accept-intent link, or selecting a time is not acceptance.

**Account invitee**:
An invitee who accepted while signed into a Caffriend account. A connection follows from their acceptance. They are not a member of the sending workspace, and naming them is the sender's own record of the person, never a workspace member.

**Guest invitee**:
An invitee who accepted from the email link without signing in. The acceptance and its booking are as real as an account invitee's, but no connection follows, so the two are never presented as the same thing.

**Invitation decline**:
A recipient's explicit decision not to book any proposed time. Following a decline-intent link is not a decline.

**Coffee-chat booking**:
A confirmed agreement to a coffee chat at a selected date, time, and duration.

**Guest**:
An invited participant who books or joins a coffee chat without creating a Caffriend account.

**Connection**:
Two accounts that have a meeting between them, carrying a conversation so they can talk before they meet. It follows from the meeting alone and never from the surface that booked it. A guest cannot be connected to, having no account; converting to an account is what makes a connection possible. It is a relationship between people, unlike Calendar connection and Mailbox connection, which are a sender's own integrations.

**Call invitation**:
Permission to join an already scheduled call, distinct from an invitation to select a coffee-chat time.

**Event**:
A scheduled, host-led Caffriend gathering with attendee registration and a capacity of at most 50. It is distinct from a coffee-chat booking even though both use the shared call surface.

**Host**:
The authenticated Caffriend account that owns an event and may start its call and spotlight queue. DESK-2 has exactly one Host per event.
_Avoid_: Organizer, co-host

**Event registration**:
An authenticated attendee's reserved place at an event. A paid registration reserves capacity only after authoritative payment success.
_Avoid_: RSVP, ticket

**Listed event**:
An event that appears in public discovery and has a shareable detail page. An unlisted event has a shareable detail page but is omitted from discovery.
_Avoid_: Public event, private event

**Spotlight turn**:
A server-timed interval in which one event attendee occupies the spotlight stage. The server, rather than a participant's browser, is authoritative for its remaining duration.
