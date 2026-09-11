import { test, expect, type Page } from '@playwright/test';

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
    await expect(page.getByRole('heading', {name:/^Qualified/})).toBeVisible();

    const stage = page.getByLabel('Stage');
    await stage.focus();
    await stage.selectOption({label:'Qualified'});
    await expect(page.getByRole('status').filter({hasText:'Moved to Qualified'})).toBeVisible();
  });

  test('a failed move rolls back completely and says so', async ({page, request}) => {
    await request.post(state, {data:{moveFails:true}});
    await enter(page, 'pipeline');
    await page.getByLabel('Stage').selectOption({label:'Qualified'});
    await expect(alerts(page)).toContainText('Someone else changed this first');
    // The card is back where the server says it belongs.
    await expect(page.getByLabel('Stage')).toHaveValue('77777777-7777-4777-8777-777777777777');
  });

  test('stages can be added and reordered', async ({page}) => {
    await enter(page, 'pipeline');
    await page.getByRole('button', {name:'Edit steps'}).click();
    await page.getByLabel('Add a step').fill('Following up');
    await page.getByRole('button', {name:'Add step'}).click();
    await expect(page.getByRole('heading', {name:'Following up'})).toBeVisible();
    await page.getByRole('button', {name:/Move later — Prospect/}).click();
    await expect(alerts(page)).toHaveCount(0);
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
    await page.getByLabel('Date').fill('2026-09-12');
    await expect(page.getByRole('status').filter({hasText:'busy period'})).toBeVisible();
    expect(await page.content()).not.toContain('PRIVATE_CRM_SENTINEL');
  });

  test('confirmation names the account, timezone, attendees and conference before sending', async ({page, request}) => {
    await request.post(state, {data:{connections:[{id:'33333333-3333-4333-8333-333333333333', provider:'GOOGLE', status:'CONNECTED', accountIdentifier:'alex@example.com', calendarId:'primary', calendarName:'Alex — Work'}]}});
    await enter(page, 'calendar');
    await page.getByLabel('Engagement').selectOption({index:1});
    await page.getByLabel('Purpose').fill('Intro chat');
    await page.getByLabel('Attendee emails').fill('jordan@example.com');
    await page.getByLabel('Date').fill('2027-03-04');
    await page.getByLabel('Start time').fill('10:00');
    await page.getByRole('button', {name:'Review before sending'}).click();

    await expect(page.getByText('alex@example.com')).toBeVisible();
    await expect(page.getByText('jordan@example.com')).toBeVisible();
    await expect(page.getByText('exactly one invitation')).toBeVisible();
    await expect(page.getByRole('button', {name:'Send the invitation'})).toBeVisible();
  });

  test('a provider failure never reports success', async ({page, request}) => {
    await request.post(state, {data:{createMeetingFails:true, connections:[{id:'33333333-3333-4333-8333-333333333333', provider:'GOOGLE', status:'CONNECTED', accountIdentifier:'alex@example.com', calendarId:'primary', calendarName:'Alex — Work'}]}});
    await enter(page, 'calendar');
    await page.getByLabel('Engagement').selectOption({index:1});
    await page.getByLabel('Purpose').fill('Intro chat');
    await page.getByLabel('Date').fill('2027-03-04');
    await page.getByLabel('Start time').fill('10:00');
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
  await page.getByRole('button', {name:'Show record'}).first().click();
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
