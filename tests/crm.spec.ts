import { test, expect, type Page } from '@playwright/test';
import {chooseDate, chooseOption, chooseTime} from './controls';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const personId = '55555555-5555-4555-8555-555555555555';
const state = 'http://127.0.0.1:4100/__state';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
/** Next mounts a permanent empty role="alert" announcer outside <main>; scope past it. */
const alerts = (page: Page) => page.getByRole('main').getByRole('alert');

async function enter(page: Page, section: string) {
  await page.goto(`/app/${workspaceId}/${section}`);
  if (page.url().includes('/login')) await login(page);
  await expect(page).toHaveURL(`/app/${workspaceId}/${section}`);
}

test.beforeEach(async ({request}) => { await request.post(state, {data:{}}); });

test.describe('people and organizations', () => {
  test('lists people, groups by organization and adds one by hand', async ({page}) => {
    await enter(page, 'people');
    await expect(page.getByRole('heading', {name:'People', exact:true})).toBeVisible();
    await expect(page.getByRole('link', {name:'Alex Rivera'})).toBeVisible();

    await page.getByRole('button', {name:'Add a person'}).click();
    await page.getByLabel('Name', {exact:true}).fill('Sam Okonkwo');
    await page.getByRole('button', {name:'Add person'}).click();
    await expect(page.getByRole('status').filter({hasText:'was added'})).toContainText('Sam Okonkwo was added');
  });

  test('adds a person with a new organization from the same form', async ({page, request}) => {
    await request.post(state, {data:{crm:{people:[], organizations:[], engagements:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], approvals:[], agents:[], meetings:[]}}});
    await enter(page, 'people');

    await page.getByRole('button', {name:'Add a person'}).click();
    await page.getByLabel('Name', {exact:true}).fill('Mina Lee');
    await page.getByLabel('Role', {exact:true}).fill('Design Lead');
    await page.getByLabel('New organization name').fill('Northwind Labs');
    await page.getByRole('button', {name:'Add person'}).click();

    await expect(page.getByRole('status').filter({hasText:'was added'})).toContainText('Mina Lee was added');
    await expect(page.getByRole('link', {name:'Mina Lee'})).toBeVisible();
    await expect(page.getByText('Design Lead · Northwind Labs')).toBeVisible();
  });

  test('imports contacts from a file through review and per-row results', async ({page, request}) => {
    await enter(page, 'people');

    await page.getByRole('button', {name:'Import contacts'}).click();
    await page.getByLabel('Contact file').setInputFiles({
      name: 'connections.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Full Name,Company\nPriya Shah,Northwind\nNo Name Co,\n'),
    });
    await page.getByRole('button', {name:'Review contacts'}).click();

    await expect(page.getByRole('heading', {name:'Review contacts'})).toBeVisible();
    await expect(page.locator('input[value="Priya Shah"]')).toBeVisible();
    await expect(page.locator('input[value="Northwind"]')).toBeVisible();
    await page.getByLabel('Name for row 1').fill('Priya Shah Edited');
    await page.getByLabel('Email for row 1').fill('priya@example.com');
    await page.getByRole('checkbox', {name:/Import Jordan Lee/}).uncheck();

    await page.getByRole('button', {name:/Skipped rows/}).click();
    await expect(page.getByText('Missing a name')).toBeVisible();

    await page.getByRole('button', {name:'Import selected'}).click();
    await expect(page.getByRole('heading', {name:'Import results'})).toBeVisible();
    await expect(page.getByText('Priya Shah Edited')).toBeVisible();
    await expect(page.getByText('Added')).toBeVisible();
    await expect(page.getByText('Jordan Lee')).toBeVisible();
    await expect(page.getByText('Not imported')).toBeVisible();

    const stateBody = await (await request.get(state)).json();
    const imports = stateBody.calls.filter((call: {path: string}) => call.path.endsWith('/crm/prospects/ingest'));
    expect(imports).toHaveLength(1);
    expect(imports[0].body).toMatchObject({displayName:'Priya Shah Edited', email:'priya@example.com', organizationName:'Northwind', sourceCategory:'IMPORTED'});
  });

  test('keeps import errors visible and lets the user continue', async ({page, request}) => {
    await request.post(state, {data:{parseFails:true}});
    await enter(page, 'people');

    await page.getByRole('button', {name:'Import contacts'}).click();
    await page.getByLabel('Contact file').setInputFiles({
      name: 'connections.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Full Name,Company\nPriya Shah,Northwind\n'),
    });
    await page.getByRole('button', {name:'Review contacts'}).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Could not read that file');

    await request.post(state, {data:{ingestFails:true, importParse:{
      people: [{displayName:'Priya Shah', title:'Investor', organizationName:'Northwind', email:null, phone:null, location:null, sourceUrl:null, discoveryReason:'Met through LinkedIn export', sourceCategory:'IMPORTED'}],
      skipped: [],
    }}});
    await page.getByRole('button', {name:'Review contacts'}).click();
    await page.getByRole('button', {name:'Import selected'}).click();

    await expect(page.getByRole('heading', {name:'Import results'})).toBeVisible();
    await expect(page.getByText('Priya Shah')).toBeVisible();
    await expect(page.getByText('That contact could not be imported')).toBeVisible();
  });

  test('never renders backend fields outside the CRM-safe projection', async ({page}) => {
    await enter(page, 'people');
    await expect(page.getByRole('link', {name:'Alex Rivera'})).toBeVisible();
    // linkedUserId marks an opt-in Caffriend network identity and must not cross the boundary.
    expect(await page.content()).not.toContain('PRIVATE_USER_SENTINEL');
  });

  test('search narrows the list and clears again', async ({page}) => {
    await enter(page, 'people');
    await page.getByLabel('Search by name').fill('Nobody');
    await page.getByRole('button', {name:'Search'}).click();
    await expect(page.getByText('Nobody matches these filters')).toBeVisible();
    await page.getByRole('button', {name:'Clear'}).click();
    await expect(page.getByRole('link', {name:'Alex Rivera'})).toBeVisible();
  });

  test('person detail shows citations, licensing and an unavailable source chat', async ({page}) => {
    await page.goto(`/app/${workspaceId}/people/${personId}`);
    await login(page);
    await expect(page.getByRole('heading', {name:'Alex Rivera'})).toBeVisible();
    await expect(page.getByText('Permitted: OUTREACH')).toBeVisible();
    await expect(page.getByText('page 4, paragraph 2')).toBeVisible();
    await expect(page.getByText('No republication')).toBeVisible();
    // No durable URL was supplied, so no link is invented.
    await expect(page.getByText('A durable link is unavailable.')).toBeVisible();
  });

  test('permanently deletes a person through the explicit delete path', async ({page}) => {
    await page.goto(`/app/${workspaceId}/people/${personId}`);
    await login(page);
    await page.getByRole('button', {name:/Delete person/}).click();
    await expect(page.getByRole('heading', {name:'Delete this person permanently?'})).toBeVisible();
    await page.getByRole('button', {name:'Yes, delete this person'}).click();
    await expect(page).toHaveURL(`/app/${workspaceId}/people`);
    await expect(page.getByRole('link', {name:'Alex Rivera'})).toHaveCount(0);
  });

  test('a missing person gets a not-found state, not a crash', async ({page}) => {
    await page.goto(`/app/${workspaceId}/people/00000000-0000-4000-8000-000000000000`);
    await login(page);
    await expect(page.getByRole('heading', {name:'Person not found'})).toBeVisible();
  });
});

test.describe('pipeline', () => {
  test('renders server-defined stages and moves an engagement without a pointer', async ({page}) => {
    await enter(page, 'pipeline');
    await expect(page.getByRole('heading', {name:/^Prospect/})).toBeVisible();
    await expect(page.getByRole('heading', {name:/^Contacted/})).toBeVisible();

    const stage = page.getByLabel('Stage');
    await chooseOption(stage, {label:'Contacted'});
    await expect(page.getByRole('status').filter({hasText:'Moved to Contacted'})).toBeVisible();
  });

  test('a failed move rolls back completely and says so', async ({page, request}) => {
    await request.post(state, {data:{moveFails:true}});
    await enter(page, 'pipeline');
    await chooseOption(page.getByLabel('Stage'), {label:'Contacted'});
    await expect(alerts(page)).toContainText('Someone else changed this first');
    // The card is back where the server says it belongs.
    await expect(page.getByLabel('Stage')).toContainText('Prospect');
  });

  test('deletes an engagement from the pipeline board icon', async ({page}) => {
    await enter(page, 'pipeline');
    const card = page.locator('li.engagement').filter({hasText:'Coffee chat about the platform team'});
    await expect(card).toBeVisible();
    await card.getByRole('button', {name:/Delete engagement Coffee chat about the platform team/}).click();
    await expect(page.getByRole('heading', {name:'Delete this engagement permanently?'})).toBeVisible();
    await page.getByRole('button', {name:'Yes, delete this engagement'}).click();
    await expect(page.getByRole('status').filter({hasText:'Engagement deleted.'})).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test('shows engagements that sit in a legacy completed stage', async ({page, request}) => {
    const completed = '77777777-7777-4777-8777-000000000111';
    await request.post(state, {data:{
      stages:[
        {id:completed, pipelineId:'66666666-6666-4666-8666-666666666666', name:'Completed', position:0, terminalOutcome:null, archived:false},
      ],
      crm:{
        people:[{id:personId, workspaceId, displayName:'Alex Rivera', title:'Engineer', location:'Toronto', email:'alex@example.com', phone:null, sourceCategory:'MANUAL', organizationId:null, archivedAt:null, createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
        organizations:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], approvals:[], agents:[], meetings:[],
        engagements:[{id:'99999999-9999-4999-8999-999999999999', workspaceId, personId, organizationId:null, pipelineId:'66666666-6666-4666-8666-666666666666', stageId:completed, ownerId:null, status:'OPEN', objective:'Completed-stage relationship', nextAction:null, archivedAt:null, createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
      },
    }});
    await enter(page, 'pipeline');
    await expect(page.getByRole('heading', {name:/^Completed/})).toBeVisible();
    await expect(page.locator('.objective', {hasText:'Completed-stage relationship'})).toBeVisible();
  });

  test('pipeline stages stay fixed for booking automation', async ({page}) => {
    await enter(page, 'pipeline');
    await expect(page.getByRole('button', {name:'Edit steps'})).toHaveCount(0);
    await expect(page.locator('.stage')).toHaveCount(5);
  });
});

test.describe('approval inbox', () => {
  test('shows evidence and licensing before any decision control', async ({page}) => {
    await enter(page, 'inbox');
    await expect(page.getByText('prospect-brief.pdf')).toBeVisible();
    await expect(page.getByText('page 4, paragraph 2')).toBeVisible();
    await expect(page.getByText('Licensed for internal research')).toBeVisible();
    await expect(page.getByText('confidence 82%')).toBeVisible();
    await expect(page.getByRole('button', {name:'Approve', exact:true})).toBeVisible();
  });

  test('approval needs confirmation and then creates a real record', async ({page}) => {
    await enter(page, 'inbox');
    await page.getByRole('button', {name:'Approve', exact:true}).click();
    await expect(page.getByText('It creates a real record')).toBeVisible();
    await page.getByRole('button', {name:'Yes, approve'}).click();
    await expect(page.getByRole('status').filter({hasText:'Approved. The record is now active'})).toBeVisible();
    await enter(page, 'people');
    await expect(page.getByRole('link', {name:'Jordan Patel'})).toBeVisible();
  });

  test('rejection requires a reason and creates nothing', async ({page}) => {
    await enter(page, 'inbox');
    await page.getByRole('button', {name:'Reject'}).click();
    await page.getByRole('button', {name:'Reject proposal'}).click();
    // The browser blocks submission on the required reason; nothing was decided.
    await expect(page.getByLabel(/Why are you rejecting this/)).toBeVisible();
    await page.getByLabel(/Why are you rejecting this/).fill('Not a fit for this pipeline.');
    await page.getByRole('button', {name:'Reject proposal'}).click();
    await expect(page.getByRole('status').filter({hasText:'Rejected. Nothing was created'})).toBeVisible();
    await enter(page, 'people');
    await expect(page.getByRole('link', {name:'Jordan Patel'})).toHaveCount(0);
  });

  test('a competing reviewer cannot produce a second decision', async ({page, request}) => {
    await request.post(state, {data:{reviewConflict:true}});
    await enter(page, 'inbox');
    await page.getByRole('button', {name:'Approve', exact:true}).click();
    await page.getByRole('button', {name:'Yes, approve'}).click();
    await expect(alerts(page)).toContainText('already reviewed');
  });

  test('a meeting proposal is not approvable here', async ({page, request}) => {
    await request.post(state, {data:{crm:{
      approvals:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workspaceId, action:'meetings', payload:{data:{purpose:'Intro call'}, claimIds:[]}, rightsState:'PERMITTED', status:'PENDING', reason:null, requesterAgentId:'agent-9', createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
      people:[], organizations:[], engagements:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], agents:[], meetings:[],
    }}});
    await enter(page, 'inbox');
    await expect(page.getByText('An agent can never create a calendar invitation directly')).toBeVisible();
    await expect(page.getByRole('button', {name:'Approve', exact:true})).toHaveCount(0);
  });

  test('prohibited rights block approval outright', async ({page, request}) => {
    await request.post(state, {data:{crm:{
      approvals:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workspaceId, action:'people', payload:{data:{displayName:'Jordan Patel'}, claimIds:[]}, rightsState:'PROHIBITED', status:'PENDING', reason:null, requesterAgentId:'agent-9', createdAt:'2026-09-01T10:00:00.000Z', updatedAt:'2026-09-01T10:00:00.000Z'}],
      people:[], organizations:[], engagements:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], agents:[], meetings:[],
    }}});
    await enter(page, 'inbox');
    await expect(alerts(page)).toContainText('cannot be approved for outreach, export or republication');
    await expect(page.getByRole('button', {name:'Approve', exact:true})).toHaveCount(0);
  });
});

test.describe('agents', () => {
  test('shows a credential once and keeps it out of browser storage and the URL', async ({page}) => {
    await enter(page, 'agents');
    await page.getByRole('button', {name:'Create an agent', exact:true}).first().click();
    await page.getByLabel('Name').fill('Research Assistant');
    await page.getByLabel('Redirect URI').fill('https://host.example.com/callback');
    await page.getByRole('checkbox', {name:/people:read/}).check();
    await page.getByRole('button', {name:'Create agent'}).click();

    await expect(page.getByText('client-new-id')).toBeVisible();
    expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].join('|'))).not.toContain('client-new-id');
    expect(page.url()).not.toContain('client-new-id');

    await page.getByRole('button', {name:'I have saved it'}).click();
    await expect(page.getByText('client-new-id')).toHaveCount(0);
  });

  test('a connection can be revoked after confirmation', async ({page}) => {
    await enter(page, 'agents');
    await page.getByRole('button', {name:'Revoke'}).click();
    await page.getByRole('button', {name:'Yes, revoke'}).click();
    await expect(page.getByRole('status').filter({hasText:'was revoked'})).toBeVisible();
  });

  test('role restrictions are surfaced rather than swallowed', async ({page, request}) => {
    await request.post(state, {data:{registerFails:true}});
    await enter(page, 'agents');
    await page.getByRole('button', {name:'Create an agent', exact:true}).first().click();
    await page.getByLabel('Name').fill('Research Assistant');
    await page.getByLabel('Redirect URI').fill('https://host.example.com/callback');
    await page.getByRole('checkbox', {name:/people:read/}).check();
    await page.getByRole('button', {name:'Create agent'}).click();
    await expect(alerts(page)).toContainText('You no longer have access here.');
  });
});

test.describe('calendar and meetings', () => {
  test('reads busy time only, never what the events are', async ({page, request}) => {
    await request.post(state, {data:{connections:[{id:'33333333-3333-4333-8333-333333333333', provider:'GOOGLE', status:'CONNECTED', accountIdentifier:'alex@example.com', calendarId:'primary', calendarName:'Alex — Work'}]}});
    await enter(page, 'calendar');
    await chooseDate(page.getByLabel('Date'), '2027-09-12');
    await expect(page.getByRole('status').filter({hasText:'busy period'})).toBeVisible();
    expect(await page.content()).not.toContain('PRIVATE_CRM_SENTINEL');
  });

  test('confirmation names the account, timezone, attendees and conference before sending', async ({page, request}) => {
    await request.post(state, {data:{connections:[{id:'33333333-3333-4333-8333-333333333333', provider:'GOOGLE', status:'CONNECTED', accountIdentifier:'alex@example.com', calendarId:'primary', calendarName:'Alex — Work'}]}});
    await enter(page, 'calendar');
    await chooseOption(page.getByLabel('Engagement'), {index:0});
    await page.getByLabel('Purpose').fill('Intro chat');
    await page.getByLabel('Attendee emails').fill('jordan@example.com');
    await chooseDate(page.getByLabel('Date'), '2027-03-04');
    await chooseTime(page.getByLabel('Start time'), '10:00');
    await page.getByRole('button', {name:'Review before sending'}).click();

    await expect(page.getByText('alex@example.com')).toBeVisible();
    await expect(page.getByText('jordan@example.com')).toBeVisible();
    await expect(page.getByText('exactly one invitation')).toBeVisible();
    await expect(page.getByRole('button', {name:'Send the invitation'})).toBeVisible();
  });

  test('a provider failure never reports success', async ({page, request}) => {
    await request.post(state, {data:{createMeetingFails:true, connections:[{id:'33333333-3333-4333-8333-333333333333', provider:'GOOGLE', status:'CONNECTED', accountIdentifier:'alex@example.com', calendarId:'primary', calendarName:'Alex — Work'}]}});
    await enter(page, 'calendar');
    await chooseOption(page.getByLabel('Engagement'), {index:0});
    await page.getByLabel('Purpose').fill('Intro chat');
    await chooseDate(page.getByLabel('Date'), '2027-03-04');
    await chooseTime(page.getByLabel('Start time'), '10:00');
    await page.getByRole('button', {name:'Review before sending'}).click();
    await page.getByRole('button', {name:'Send the invitation'}).click();
    await expect(alerts(page)).toContainText('That did not complete');
    await expect(page.getByRole('status').filter({hasText:'was sent to your calendar provider'})).toHaveCount(0);
  });

  test('cancelling a meeting requires explicit human confirmation', async ({page}) => {
    await enter(page, 'calendar');
    await page.getByRole('button', {name:'Cancel meeting'}).first().click();
    await expect(page.getByText('asks your provider to cancel')).toBeVisible();
    await page.getByRole('button', {name:'Yes, cancel the meeting'}).click();
    await expect(page.getByRole('status').filter({hasText:'Cancellation was sent'})).toBeVisible();
  });

  test('with no calendar connected every other CRM feature still works', async ({page}) => {
    await enter(page, 'calendar');
    await expect(page.getByText('No calendar is connected')).toBeVisible();
    await enter(page, 'people');
    await expect(page.getByRole('link', {name:'Alex Rivera'})).toBeVisible();
    await enter(page, 'pipeline');
    await expect(page.getByRole('heading', {name:/^Prospect/})).toBeVisible();
  });
});

test('history explains changes in words, with raw data secondary', async ({page}) => {
  await enter(page, 'history');
  await expect(page.getByRole('heading', {name:'History', exact:true})).toBeVisible();
  await expect(page.getByText('Edited a person')).toBeVisible();
  await expect(page.locator('pre')).toHaveCount(0);
  await page.getByRole('button', {name:'Details', exact:true}).first().click();
  await expect(page.locator('pre').first()).toBeVisible();
});

test('a workspace the user cannot reach shows a forbidden state', async ({page, request}) => {
  await request.post(state, {data:{forbidden:true}});
  await page.goto(`/app/${workspaceId}/people`);
  await login(page);
  await expect(page.getByText(/Access unavailable|do not have access/)).toBeVisible();
});

test('the CRM is usable at a phone width', async ({page}) => {
  await page.setViewportSize({width:390, height:844});
  await enter(page, 'people');
  await expect(page.getByRole('link', {name:'Alex Rivera'})).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

/**
 * A dialog must actually be over the page, not merely present in the DOM.
 *
 * The backdrop is portalled to <body> carrying `crm modal-root modal-backdrop`
 * on one element, so its rule has to be a compound selector — a descendant one
 * silently misses, leaving the panel as a static block at the foot of a document
 * whose scrolling the dialog has just locked. Playwright's toBeVisible() passes
 * on that (it still has a box), so this asserts the thing a person would notice:
 * the dialog sits inside the viewport, and the page behind it is inert.
 */
test('a dialog opens over the page, not below it', async ({page}) => {
  await page.setViewportSize({width:1280, height:900});
  await enter(page, 'people');
  await page.getByRole('button', {name:'Add a person'}).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  // The whole panel is within the viewport it is supposed to be centred in.
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  expect(await page.locator('.modal-backdrop').evaluate(el => getComputedStyle(el).position)).toBe('fixed');

  // While it is open, the shell behind it is neither reachable nor announced.
  await expect(page.locator('#workspace-content')).toHaveAttribute('aria-hidden', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('#workspace-content')).not.toHaveAttribute('aria-hidden', 'true');
});

/**
 * Notes and tasks are presented as a pair, so they have to read across as well
 * as down: the two "Add …" controls and their buttons sit on one line whatever
 * is above them. A two-line empty note on one side used to shunt its whole
 * column out of step with the other.
 */
test('the notes and tasks columns line up as a pair', async ({page}) => {
  await page.setViewportSize({width:1280, height:1000});
  await page.goto(`/app/${workspaceId}/people/${personId}`);
  if (page.url().includes('/login')) await login(page);
  await expect(page.getByRole('heading', {name:'Notes and tasks'})).toBeVisible();

  const note = (await page.getByRole('button', {name:'Add note'}).boundingBox())!;
  const task = (await page.getByRole('button', {name:'Add task'}).boundingBox())!;
  expect(Math.abs(note.y - task.y)).toBeLessThanOrEqual(1);

  // The controls they belong to end on the same line too.
  const textarea = (await page.getByPlaceholder('Something worth remembering').boundingBox())!;
  const input = (await page.getByPlaceholder('Send the portfolio').boundingBox())!;
  expect(Math.abs((textarea.y + textarea.height) - (input.y + input.height))).toBeLessThanOrEqual(1);
});

/**
 * The profile editor asks one question at a time, and must ask every one of them.
 *
 * Its queue has to be fixed when it opens: each save updates the person, so a
 * queue recomputed from that person drops the answered field at the same moment
 * the step advances past it — skipping a question per save and then reading past
 * the end of the list, which crashed the page.
 */
test('the profile editor walks every question without skipping or crashing', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`/app/${workspaceId}/people/${personId}`);
  if (page.url().includes('/login')) await login(page);
  await page.getByRole('button', {name:/Complete profile|Edit profile/}).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const total = Number((await dialog.getByText(/Question 1 of \d+/).innerText()).match(/of (\d+)/)![1]);
  expect(total).toBeGreaterThan(1);

  // Step through the whole queue. Every question is numbered, in order, and the
  // editor closes on the last one rather than running off the end.
  for (let index = 1; index <= total; index++) {
    await expect(dialog.getByText(`Question ${index} of ${total}`)).toBeVisible();
    await dialog.getByRole('button', {name:'Skip'}).click();
  }
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * A phone number on a profile is there to be read, not dialled.
 *
 * A `tel:` href hands the number to whatever the OS registered as its dialler —
 * FaceTime on a Mac — so simply looking someone up was one stray click away from
 * calling them. The number is plain text you can copy instead.
 *
 * The number is added through the editor rather than by posting fixture state,
 * so this exercises the real write path and leaves the shared backend untouched.
 */
test('a phone number is readable without offering to call anyone', async ({page}) => {
  await page.goto(`/app/${workspaceId}/people/${personId}`);
  if (page.url().includes('/login')) await login(page);
  await expect(page.getByRole('heading', {name:'Alex Rivera'})).toBeVisible();

  await page.getByRole('button', {name:'+ Phone'}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Phone').fill('+1 416 555 0134');
  await dialog.getByRole('button', {name:/Save and/}).click();
  await expect(dialog.getByRole('status')).toContainText('Phone saved');
  await page.keyboard.press('Escape');

  await expect(page.getByText('+1 416 555 0134')).toBeVisible();
  // Nothing on the page may hand a number to the system dialler.
  expect(await page.locator('a[href^="tel:"]').count()).toBe(0);
});

/**
 * The People toolbar reads as one row with one primary action.
 *
 * The filters carry a divider — padding and a bottom border — when they stand
 * alone, which hangs below their own button and pushed Search above the button
 * beside it. And two orange buttons side by side gave the page two things that
 * both looked like the main action.
 */
test('the people toolbar sits on one line with a single primary action', async ({page}) => {
  await page.setViewportSize({width:1280, height:900});
  await enter(page, 'people');

  const search = (await page.getByRole('button', {name:'Search'}).boundingBox())!;
  const add = (await page.getByRole('button', {name:'Add a person'}).boundingBox())!;
  expect(Math.abs((search.y + search.height) - (add.y + add.height))).toBeLessThanOrEqual(1);

  // Only "Add a person" carries the primary fill.
  const fill = (name: string) => page.getByRole('button', {name})
    .evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await fill('Search')).not.toBe(await fill('Add a person'));
});
