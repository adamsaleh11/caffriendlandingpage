import { test, expect, type Page } from '@playwright/test';
const w = '11111111-1111-4111-8111-111111111111';
const state = 'http://127.0.0.1:4100/__state';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
async function enter(page: Page) {
  await page.goto(`/app/${w}/pipeline`);
  if (page.url().includes('/login')) await login(page);
  await expect(page).toHaveURL(`/app/${w}/pipeline`);
}
test.beforeEach(async ({request}) => { await request.post(state, {data:{}}); });

test('a new workspace is offered ready-made pipelines, not a blank page', async ({page, request}) => {
  await request.post(state, {data:{pipelines:[], stages:[]}});
  await enter(page);
  await expect(page.getByRole('heading', {name:'Coffee chats', exact:true})).toBeVisible();
  // Scoped to the template card: the same lifecycle appears in the explanation above it.
  const template = page.locator('.templates li').filter({hasText:'Coffee chats'});
  await expect(template.getByText(/Prospect → Contacted → Meeting booked → Follow-up → Closed/)).toBeVisible();
  await expect(page.getByRole('heading', {name:'Start from scratch'})).toHaveCount(0);
});

test('cards lead with the person and move a step at a time', async ({page}) => {
  await enter(page);
  const card = page.locator('.engagement').first();
  await expect(card.locator('.who')).toContainText('Alex Rivera');
  // The step number is decorative (aria-hidden); the count is labelled for screen readers.
  await expect(page.getByRole('heading', {name:/Prospect 1 in this step/})).toBeVisible();

  await card.getByRole('button', {name:/Move Alex Rivera forward to Contacted/}).click();
  await expect(page.getByRole('status').filter({hasText:'Moved to Contacted'})).toBeVisible();
});

test('clicking a pipeline icon empties every step but the chosen one', async ({page}) => {
  await enter(page);
  const board = page.getByRole('list', {name:'Active pipeline'});
  await expect(board.locator(':scope > li')).toHaveCount(4);

  await page.getByRole('button', {name:/Contacted .* Show only this step/}).click();
  await expect(page.getByRole('status').filter({hasText:'Showing 0 people in Contacted'})).toBeVisible();
  // The run of steps stays whole — only the people inside the other steps go away.
  await expect(board.locator(':scope > li')).toHaveCount(4);
  await expect(page.getByRole('heading', {name:/^Contacted/})).toBeVisible();
  await expect(page.locator('.engagement')).toHaveCount(0);

  await page.getByRole('button', {name:'Show everyone'}).click();
  await expect(board.locator(':scope > li')).toHaveCount(4);
  await expect(page.locator('.engagement')).toHaveCount(1);
});

test('pipeline exposes five stable booking-aware steps without customization',async({page})=>{
 await enter(page);
 const board=page.getByRole('list',{name:'Active pipeline'});
 await expect(board.locator(':scope > li')).toHaveCount(4);
 await expect(page.getByRole('heading',{name:/^Meeting booked/})).toBeVisible();
 await expect(page.getByRole('button',{name:/Edit steps|New pipeline/})).toHaveCount(0);
});

test('the first step cannot be moved backwards', async ({page}) => {
  await enter(page);
  const card = page.locator('.engagement').first();
  await expect(card.getByRole('button', {name:/Move Alex Rivera back/})).toBeDisabled();
});

test('a failed move rolls back and says so', async ({page, request}) => {
  await request.post(state, {data:{moveFails:true}});
  await enter(page);
  const card = page.locator('.engagement').first();
  await card.getByRole('button', {name:/forward to Contacted/}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Someone else changed this first');
  await expect(page.locator('.stage').first().locator('.engagement')).toHaveCount(1);
});

test('a stage with many people shows a page of cards and a way to see the rest', async ({page, request}) => {
  const many = Array.from({length: 36}, (_, index) => ({
    id: `12312312-1231-4231-8231-${(index+1).toString(16).padStart(12,'0')}`,
    workspaceId: w, personId: null, organizationId: null,
    pipelineId: '66666666-6666-4666-8666-666666666666', stageId: '77777777-7777-4777-8777-777777777777',
    ownerId: null, status: 'OPEN', objective: `Coffee chat ${index+1}`, nextAction: null, archivedAt: null,
    createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z',
  }));
  await request.post(state, {data:{crm:{engagements: many, people:[], organizations:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], approvals:[], agents:[], meetings:[]}}});
  await enter(page);
  await page.getByRole('button', {name:'Load more'}).click();

  const prospect = page.locator('.stage').filter({has: page.getByRole('heading', {name:/^Prospect/})});
  await expect(prospect.getByRole('heading', {name:/Prospect 36 in this step/})).toBeVisible();
  await expect(prospect.locator('.engagement')).toHaveCount(8);
  await expect(prospect.getByRole('button', {name:'Show 28 more'})).toBeVisible();

  await prospect.getByRole('button', {name:'Show 28 more'}).click();
  await expect(prospect.locator('.engagement')).toHaveCount(36);
  await expect(prospect.getByRole('button', {name:'Show fewer'})).toBeVisible();
});

test('an empty pipeline explains what an engagement is', async ({page, request}) => {
  await request.post(state, {data:{crm:{engagements:[], people:[], organizations:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], approvals:[], agents:[], meetings:[]}}});
  await enter(page);
  await expect(page.getByText(/one effort with one person/)).toBeVisible();
});
