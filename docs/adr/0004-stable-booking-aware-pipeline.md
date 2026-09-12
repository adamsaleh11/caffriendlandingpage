# ADR 0004: Keep the desktop pipeline booking-aware and stable

## Status

Accepted

## Context

Coffee-chat invitations can be sent to existing CRM people or arbitrary email addresses. When a recipient accepts, the backend must update an existing engagement deterministically. User-defined stage names make the booking destination ambiguous and prevent consistent reporting.

## Decision

Desktop exposes one five-step relationship lifecycle: Prospect, Contacted, Meeting booked, Follow-up, and Closed. Stage customization is not exposed. Sending to an untracked email creates a person and a Prospect engagement. A recipient acceptance advances the linked engagement to Meeting booked. A multi-recipient compose action fans out into independent outreach records; it does not create a group event.

## Consequences

Booking conversion can be measured consistently and iOS-created meetings share the same canonical meeting view. Existing legacy stages remain readable through a compatibility mapping, but new desktop workflows use only the five stable names. More configurable workflows can be reconsidered when booking automation has a durable stage identifier rather than a display-name dependency.
