import { test, expect, type Page } from '@playwright/test';

/**
 * The whole product, in one pass: an agent-discovered prospect is qualified,
 * contacted, replies, is scheduled, met, followed up, and ends as a relationship
 * whose full history is still readable.
 *
 * Every step here is a real write to the CRM contract — an engagement PATCH, a
 * note POST, a task POST — and the page is reloaded between stages so that only
 * state the server actually kept can carry the walkthrough forward.
 */
const w = '11111111-1111-4111-8111-111111111111';
const personId = '55555555-5555-4555-8555-555555555555';
const state = 'http://127.0.0.1:4100/__state';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
async function open(page: Page, path: string) {
  await page.goto(path);
  if (page.url().includes('/login')) { await login(page); }
  await expect(page).toHaveURL(path);
}

/** Runs one lifecycle step, then proves the server kept it across a reload. */
async function advance(page: Page, action: string, body: string, expected: string) {
  await page.getByRole('button', {name: action, exact: true}).click();
  await page.getByRole('textbox', {name: /What|Why/}).first().fill(body);
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.getByRole('status').filter({hasText: `moved to ${expected}`})).toBeVisible();
  await page.reload();
  // Only what the server kept can satisfy this: the page was rebuilt from scratch.
  await expect(page.locator('.engagement-detail header')).toContainText(expected);
}

test.beforeEach(async ({request}) => { await request.post(state, {data:{}}); });

test('a prospect an agent found becomes a relationship, and the history survives', async ({page}) => {
  // 1–3. The prospect is on the board, under Prospect, with its origin stated.
  await open(page, `/app/${w}/pipeline`);
  const card = page.locator('.engagement').first();
  await expect(card.locator('.who')).toContainText('Alex Rivera');
  await expect(page.getByRole('heading', {name:/Prospect 1 in this step/})).toBeVisible();
  // Caffriend did not find them: the agent that did is named on the card.
  await expect(card.locator('.source')).toContainText('Found by Notes Assistant');
  await expect(card.locator('.source')).toContainText('confidence 82%');

  // 4. Opening them explains who they are and why they are here.
  await card.getByRole('link', {name:'Alex Rivera'}).click();
  await expect(page.getByRole('heading', {name:'Alex Rivera'})).toBeVisible();
  const why = page.locator('.provenance');
  await expect(why).toContainText('Notes Assistant');
  await expect(why).toContainText('an agent connected to this workspace');
  await expect(why).toContainText('Caffriend did not find them itself');
  await expect(why).toContainText('prospect-brief.pdf');
  await expect(why).toContainText('page 4, paragraph 2');

  // 5–11. The lifecycle, one recorded step at a time.
  await advance(page, 'Qualify this person', 'Engineer on the platform team, hiring now.', 'Qualified');
  await advance(page, 'Record your outreach', 'Sent a short intro message on LinkedIn.', 'Contacted');
  await advance(page, 'Record their reply', 'Replied — happy to chat next week.', 'Engaged');
  await advance(page, 'Start scheduling', 'Looking for 30 minutes Tuesday or Wednesday.', 'Scheduling');

  // 12–13. Scheduling points at the one place meetings are actually made.
  await expect(page.getByRole('note')).toContainText('Meetings are created on the');
  await advance(page, 'Mark the meeting as booked', 'Agreed Tuesday at 2pm Toronto.', 'Meeting booked');

  // 14–16. The booked meeting is the workspace's real meeting, joinable from here.
  const meeting = page.locator('.meeting-row').first();
  await expect(meeting).toContainText('Coffee with Alex');
  await expect(meeting.getByRole('link', {name:'Join Coffee with Alex'})).toBeVisible();

  // 17–19. The outcome is recorded in the user's own words.
  await page.getByRole('button', {name:'Record how it went', exact:true}).click();
  await page.getByLabel('Outcome').selectOption('Introduction promised');
  await page.getByRole('textbox', {name:/What came of the conversation/}).fill('They will introduce me to the hiring manager.');
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'moved to Completed'})).toBeVisible();

  // 20–21. A follow-up is a real task with a date, not a dead column.
  await page.reload();
  await page.getByRole('button', {name:'Set up the follow-up', exact:true}).click();
  await page.getByRole('textbox', {name:/What did you commit to/}).fill('Sending my portfolio.');
  await page.getByLabel('What must happen next?').fill('Send portfolio to Alex');
  await page.getByLabel('Due', {exact:true}).fill('2026-09-18');
  await page.getByRole('button', {name:'Save', exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'moved to Follow-up'})).toBeVisible();

  await page.reload();
  await expect(page.locator('.engagement-detail .tasks')).toContainText('Send portfolio to Alex');

  // 22–23. Closing the follow-up leaves an ongoing relationship.
  await advance(page, 'Close the follow-up', 'Sent it; they made the introduction.', 'Relationship');

  // 24. The whole history is still there, and agent work still reads as agent work.
  const timeline = page.locator('.timeline');
  await expect(timeline).toContainText('Engineer on the platform team, hiring now.');
  await expect(timeline).toContainText('Introduction promised: They will introduce me to the hiring manager.');
  await expect(timeline).toContainText('Send portfolio to Alex');
  await expect(timeline).toContainText('Coffee with Alex');
  await expect(timeline.locator('.actor.agent').first()).toContainText('(agent)');
});

test('the pipeline reads as a table as well as a board', async ({page}) => {
  await open(page, `/app/${w}/pipeline`);
  await page.getByRole('button', {name:'Table', exact:true}).click();
  const row = page.locator('.pipeline-table tbody tr').first();
  await expect(row).toContainText('Alex Rivera');
  await expect(row).toContainText('Notes Assistant');
  // The stage is changed from the table too, against the same records.
  await row.getByLabel(/Stage for Alex Rivera/).selectOption({label:'Qualified'});
  await expect(page.getByRole('status').filter({hasText:'Moved to Qualified'})).toBeVisible();
});

test('an overdue follow-up reaches the Inbox, and a stuck meeting with it', async ({page, request}) => {
  await request.post(state, {data:{crm:{
    people:[{id:personId, workspaceId:w, displayName:'Alex Rivera', title:'Engineer', location:'Toronto', email:null, phone:null,
             sourceCategory:'MANUAL', organizationId:null, archivedAt:null,
             createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
    tasks:[{id:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', workspaceId:w, title:'Send portfolio to Alex', personId,
            engagementId:null, assigneeId:null, dueAt:'2026-09-01T10:00:00.000Z', status:'OPEN', archivedAt:null,
            createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
    organizations:[], engagements:[], notes:[], conversations:[],
    'source-artifacts':[], 'source-claims':[], approvals:[], 'audit-events':[], agents:[],
    meetings:[{id:'44444444-4444-4444-8444-444444444444', workspaceId:w, purpose:'Coffee with Alex',
               startsAt:'2026-09-12T19:00:00.000Z', endsAt:'2026-09-12T19:30:00.000Z', timezone:'America/Toronto',
               status:'FAILED', provider:'GOOGLE', joinUrl:null, physicalLocation:null, agenda:null,
               engagementId:null, organizerId:'member-1', connectionId:null, errorCode:'PROVIDER_REJECTED',
               createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
  }}});
  await open(page, `/app/${w}/inbox`);
  const overdue = page.locator('.attention').first();
  await expect(overdue).toContainText('Overdue follow-up');
  await expect(overdue).toContainText('Send portfolio to Alex');
  await expect(overdue.getByRole('link', {name:'Alex Rivera'})).toBeVisible();
  const stuck = page.locator('.attention').nth(1);
  await expect(stuck).toContainText('Meeting needs attention');
  await expect(stuck).toContainText('The calendar invitation failed');
});

test('a person with no engagements, sources or agent still opens cleanly', async ({page, request}) => {
  await request.post(state, {data:{crm:{
    people:[{id:personId, workspaceId:w, displayName:'Sam Okonkwo', title:null, location:null, email:null, phone:null,
             sourceCategory:'MANUAL', organizationId:null, archivedAt:null,
             createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
    organizations:[], engagements:[], notes:[], tasks:[], conversations:[],
    'source-artifacts':[], 'source-claims':[], approvals:[], 'audit-events':[], agents:[], meetings:[],
  }}});
  await open(page, `/app/${w}/people/${personId}`);
  await expect(page.getByRole('heading', {name:'Sam Okonkwo'})).toBeVisible();
  await expect(page.locator('.provenance')).toContainText('No creation event is held for this person');
  await expect(page.locator('.provenance')).toContainText('nothing about this person is cited to a source');
  await expect(page.getByText(/Nothing is in flight with this person yet/)).toBeVisible();
  await expect(page.getByText(/Nothing has happened with this person yet/)).toBeVisible();
});
