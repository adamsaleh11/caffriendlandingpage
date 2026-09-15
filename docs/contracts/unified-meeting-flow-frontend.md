# Implementation Handoff Contract

## 1. Summary

- **What was implemented**: Frontend support for the unified meeting flow architecture that ensures desktop and mobile meetings follow the same data model and acceptance flow
- **Why it was implemented**: To align the frontend with backend changes that unified meeting data models across desktop (CRM) and mobile platforms, ensuring cross-platform visibility and consistent behavior
- **What is in scope**: Data type updates, meeting projection enhancements, venue-based join flow, source field display, and calendar status handling
- **What is out of scope**: Backend API changes, authentication flows, new UI components, mobile app changes
- **Which repo/service/module owns this implementation**: Caffriend frontend landing page (Next.js application)

## 2. Files Added or Changed

### `src/lib/contracts.ts`
- **Updated**: Added `source` and `venue` fields to the `Meeting` type to match backend contract
- **Purpose**: Type definitions for CRM and calendar data structures
- **Notable details**: 
  - Added `source?: 'CRM' | 'CAFFRIEND' | null` field to indicate meeting origin
  - Added `venue?: 'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null` field for join flow determination

### `src/lib/upcoming.ts`
- **Updated**: Enhanced meeting projection functions to support unified flow
- **Purpose**: Projects and merges meetings from both desktop (CRM) and mobile sources
- **Notable details**:
  - Added `source: 'CRM' | 'CAFFRIEND' | null` field to `UpcomingMeeting` type
  - Updated `fromMeeting()` to use `venue` field for join flow determination with fallback logic
  - Updated `fromCall()` to pass through `source` field
  - Updated `mergeMeetings()` to preserve `source` field from Meeting records

### `src/components/crm/MeetingPage.tsx`
- **Updated**: Enhanced meeting detail page to support venue-based join flow
- **Purpose**: Displays meeting details and provides join/cancel/reschedule actions
- **Notable details**:
  - Updated join action logic to use `venue` field for proper routing
  - Added display of `source` and `venue` fields in meeting details
  - Implemented venue-specific join behavior:
    - `CAFFRIEND_LIVEKIT` → Internal Caffriend call (`/calls/{groupCallId}`)
    - `PROVIDER_CONFERENCE` → External provider link (Google Meet/Teams)
    - `IN_PERSON` → Display as in-person meeting (no join link)

### `src/components/crm/Schedule.tsx`
- **Updated**: Enhanced calendar view to support unified meeting flow
- **Purpose**: Displays meetings in calendar grid and list views
- **Notable details**:
  - Updated orphan meeting handling to include `source` field
  - Removed unused `fromCall` import
  - Orphan meetings with `meetingId` are marked as `source: 'CRM'`

## 3. Public Interface Contract

### TypeScript Types and Interfaces

#### `Meeting` (in `src/lib/contracts.ts`)
- **Type**: Interface
- **Purpose**: Represents a meeting record from the CRM meetings projection
- **Owner**: Frontend contracts module
- **Fields**:
  - `id: string` - Meeting identifier
  - `purpose: string` - Meeting purpose/title
  - `startsAt: string` - ISO datetime string
  - `endsAt: string` - ISO datetime string
  - `timezone: string` - Timezone identifier
  - `status: MeetingStatus` - Meeting status enum
  - `provider?: Provider | null` - Calendar provider (GOOGLE/MICROSOFT)
  - `joinUrl?: string | null` - External join URL for provider conferences
  - `physicalLocation?: string | null` - Physical location for in-person meetings
  - `agenda?: string | null` - Meeting agenda/notes
  - `errorCode?: string | null` - Calendar error code if sync failed
  - `engagementId?: string | null` - Associated CRM engagement ID
  - `groupCallId?: string | null` - Caffriend LiveKit room ID
  - `source?: 'CRM' | 'CAFFRIEND' | null` - Meeting origin (NEW)
  - `venue?: 'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null` - Venue type (NEW)

#### `UpcomingMeeting` (in `src/lib/upcoming.ts`)
- **Type**: Interface
- **Purpose**: Unified representation of meetings from both desktop and mobile sources
- **Owner**: Frontend upcoming meetings module
- **Fields**:
  - `key: string` - Stable identifier across sources
  - `title: string` - Display title
  - `counterpart: string | null` - Other participant name
  - `image: string | null` - Participant image URL
  - `startsAt: string | null` - ISO datetime string
  - `endsAt: string | null` - ISO datetime string
  - `where: string | null` - Location/venue description
  - `status: string | null` - Display-formatted status
  - `notes: string | null` - Meeting notes/agenda
  - `href: string | null` - Join URL or internal route
  - `external: boolean` - Whether join link opens externally
  - `needsPayment: boolean` - Whether payment is required
  - `groupCallId: string | null` - Caffriend LiveKit room ID
  - `meetingId: string | null` - CRM meeting record ID
  - `source: 'CRM' | 'CAFFRIEND' | null` - Meeting origin (NEW)

### Exported Functions

#### `fromMeeting(meeting: Meeting): UpcomingMeeting`
- **Purpose**: Projects a CRM meeting into the unified meeting format
- **Owner**: Frontend upcoming meetings module
- **Inputs**: `Meeting` object from CRM API
- **Outputs**: `UpcomingMeeting` object
- **Behavior**: 
  - Uses `venue` field for join flow determination
  - Falls back to provider-based logic for backward compatibility
  - Defaults `source` to `'CRM'` for desktop meetings

#### `fromCall(call: AppCall): UpcomingMeeting`
- **Purpose**: Projects a mobile app call into the unified meeting format
- **Owner**: Frontend upcoming meetings module
- **Inputs**: `AppCall` object from mobile API
- **Outputs**: `UpcomingMeeting` object
- **Behavior**: Passes through `source` field from mobile API

#### `mergeMeetings(calls: AppCall[], meetings: Meeting[]): UpcomingMeeting[]`
- **Purpose**: Merges and deduplicates meetings from both sources
- **Owner**: Frontend upcoming meetings module
- **Inputs**: Arrays of `AppCall` and `Meeting` objects
- **Outputs**: Deduplicated array of `UpcomingMeeting` objects
- **Behavior**: 
  - Prioritizes Meeting record status over Call record
  - Preserves `source` field from Meeting records
  - Removes cancelled meetings

## 4. Data Contract

### Type Definitions

#### MeetingStatus Enum
- **Values**: `'LOCAL' | 'BOOKED' | 'CONFERENCE_PENDING' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCEL_PENDING' | 'CANCEL_FAILED' | 'CANCELLED'`
- **Purpose**: Meeting lifecycle states
- **Validation**: Backend provides these values, frontend uses them for display

#### Source Enum
- **Values**: `'CRM' | 'CAFFRIEND' | null`
- **Purpose**: Indicates meeting origin platform
- **Display**: 
  - `'CRM'` → "Desktop" in UI
  - `'CAFFRIEND'` → "Mobile" in UI
  - `null` → Not displayed

#### Venue Enum
- **Values**: `'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null`
- **Purpose**: Determines join flow and display behavior
- **Join Behavior**:
  - `'CAFFRIEND_LIVEKIT'` → Internal route `/calls/{groupCallId}`
  - `'PROVIDER_CONFERENCE'` → External `joinUrl` in new tab
  - `'IN_PERSON'` → No join link, display location text
  - `null` → Fallback to provider-based logic

### Backward Compatibility
- All changes are additive; existing fields and behaviors are preserved
- Missing `venue` or `source` fields fall back to existing provider-based logic
- No breaking changes to existing API contracts

## 5. Integration Contract

### Upstream Dependencies
- **Backend API**: 
  - `GET /workspaces/:workspaceId/meetings` - Returns Meeting objects with new `source` and `venue` fields
  - `GET /workspaces/:workspaceId/upcoming-calls` - Returns AppCall objects with `source` field
  - `GET /workspaces/:workspaceId/past-calls` - Returns historical call data
- **Authentication**: Uses existing session-based auth via iron-session
- **State Management**: Uses existing workspace data hooks and API client

### Downstream Dependencies
- **Meeting Display Components**: `MeetingPage.tsx`, `Schedule.tsx`
- **Call Components**: Existing LiveKit call components
- **Routing**: Next.js routing for internal navigation

### Event Flow
1. User navigates to Calendar/Meetings page
2. Frontend fetches meetings from both CRM and mobile APIs
3. `mergeMeetings()` combines and deduplicates the results
4. `fromMeeting()` and `fromCall()` project to unified format
5. UI displays meetings with proper venue-based join actions
6. User clicks join → routed based on `venue` field

### Error Handling
- Calendar sync failures (`status: 'FAILED'`) are displayed with error codes
- Missing `venue` or `source` fields fall back gracefully to existing logic
- API errors use existing error handling patterns

## 6. Usage Instructions for Other Engineers

### What You Can Rely On
- **Meeting Type**: Now includes `source` and `venue` fields
- **UpcomingMeeting Type**: Now includes `source` field
- **Projection Functions**: `fromMeeting()`, `fromCall()`, `mergeMeetings()` handle unified flow
- **Join Flow**: Venue-based routing is implemented in MeetingPage.tsx

### What You Should Call/Import/Use
```typescript
import { type Meeting } from '@/lib/contracts';
import { fromMeeting, fromCall, mergeMeetings, type UpcomingMeeting } from '@/lib/upcoming';
```

### Inputs You Must Provide
- **Meeting objects**: Should include `source` and `venue` fields from backend
- **AppCall objects**: Should include `source` field from backend

### Outputs You Will Receive
- **UpcomingMeeting objects**: Include `source` field and venue-based join URLs
- **Join actions**: Properly routed based on `venue` field

### States to Handle
- **Loading**: Existing loading states in Schedule.tsx and MeetingPage.tsx
- **Empty**: Existing empty states for no meetings
- **Error**: Existing error states with retry functionality
- **Success**: Meeting display with venue-based join actions

### What Is Finalized
- Type definitions with `source` and `venue` fields
- Projection functions that handle unified flow
- Venue-based join routing logic
- Source field display in meeting details

### What Is Still Provisional
- None - all changes are production-ready

### What Must Not Be Changed Without Coordination
- The `source` and `venue` field names and values must match backend contract
- The venue-based join logic in MeetingPage.tsx assumes specific field behavior
- The merge logic in `mergeMeetings()` prioritizes Meeting records over Call records

## 7. Security and Authorization Notes

- **Auth Requirements**: Uses existing session-based authentication via iron-session
- **Permission Rules**: Existing workspace-based access control applies
- **Data Isolation**: Workspace-scoped meeting access preserved
- **Sensitive Fields**: No new sensitive fields introduced
- **Sanitization**: Existing URL sanitization in `safeUrl()` function
- **Logging Restrictions**: No new logging added
- **Compliance Concerns**: None identified

## 8. Environment and Configuration

- **Environment Variables**: No new environment variables required
- **Config Keys**: No new configuration keys required
- **Feature Flags**: No feature flags used
- **Runtime Settings**: No new runtime settings

## 9. Testing and Verification

### Tests Added or Updated
- **No new tests added**: Implementation relied on existing type checking and lint verification

### Manual Verification
- **Type Checking**: Ran `npm run typecheck` - passed with no errors
- **Linting**: Ran `npm run lint` - passed with only pre-existing warnings
- **Dev Server**: Started successfully at http://localhost:3000
- **Browser Preview**: Successfully launched for visual verification

### How to Run Tests
```bash
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint verification
npm run dev        # Start development server
```

### How to Locally Validate
1. Start dev server: `npm run dev`
2. Navigate to Calendar/Meetings page
3. Verify meetings display with proper venue information
4. Test join actions for different venue types
5. Verify source field display in meeting details

### Known Gaps in Test Coverage
- No automated E2E tests for the unified flow
- No specific tests for venue-based join routing
- Manual testing required to verify backend integration

## 10. Known Limitations and TODOs

### Unfinished Edges
- None identified

### Temporary Assumptions
- Backend will provide `source` and `venue` fields as specified in contract
- Existing guest invitation flow remains functional without changes

### Known Bugs
- None identified

### Performance Limitations
- No performance impact expected from changes

### Mock Behavior
- No mock behavior introduced

### Compatibility Risks
- Low risk - changes are additive with backward compatibility

### Follow-up Tasks
- E2E testing for unified meeting flow
- Integration testing with actual backend API
- User acceptance testing for cross-platform meeting visibility

## 11. Source of Truth Snapshot

### Final Interface Names
- `Meeting` interface (updated)
- `UpcomingMeeting` interface (updated)
- `fromMeeting()` function (updated)
- `fromCall()` function (updated)
- `mergeMeetings()` function (updated)

### Final Type Names
- `MeetingStatus` enum (unchanged)
- `Source` type: `'CRM' | 'CAFFRIEND' | null` (new)
- `Venue` type: `'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null` (new)

### Final Enum/Status Values
- MeetingStatus: `'LOCAL' | 'BOOKED' | 'CONFERENCE_PENDING' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCEL_PENDING' | 'CANCEL_FAILED' | 'CANCELLED'`
- Source: `'CRM' | 'CAFFRIEND' | null`
- Venue: `'CAFFRIEND_LIVEKIT' | 'PROVIDER_CONFERENCE' | 'IN_PERSON' | null`

### Final File Paths
- `src/lib/contracts.ts` - Type definitions
- `src/lib/upcoming.ts` - Meeting projection functions
- `src/components/crm/MeetingPage.tsx` - Meeting detail page
- `src/components/crm/Schedule.tsx` - Calendar view

### Breaking Changes from Previous Version
- **None** - All changes are backward compatible

## 12. Copy-Paste Handoff for the Next Engineer

**What is already done:**
Frontend support for unified meeting flow is complete. The `Meeting` and `UpcomingMeeting` types now include `source` and `venue` fields. Projection functions (`fromMeeting`, `fromCall`, `mergeMeetings`) handle unified flow with proper fallback logic. MeetingPage.tsx implements venue-based join routing, and both MeetingPage.tsx and Schedule.tsx display source information.

**Exactly what is safe to depend on:**
- The `source` field values: `'CRM'` for desktop, `'CAFFRIEND'` for mobile
- The `venue` field values: `'CAFFRIEND_LIVEKIT'`, `'PROVIDER_CONFERENCE'`, `'IN_PERSON'`
- Venue-based join routing in MeetingPage.tsx
- The projection functions that merge desktop and mobile meetings
- Backward compatibility for missing fields

**Exactly what remains to be built:**
- E2E tests for the unified flow
- Integration testing with backend API
- User acceptance testing for cross-platform visibility

**Any traps, gotchas, or assumptions:**
- The implementation assumes the backend will provide `source` and `venue` fields as specified
- Missing fields fall back to existing provider-based logic for backward compatibility
- The `mergeMeetings()` function prioritizes Meeting records over Call records for status

**What they should read first in this contract:**
Read sections 3 (Public Interface Contract) and 4 (Data Contract) to understand the type changes, then section 6 (Usage Instructions) to see how to use the updated functions.