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
  await expect(template.getByText(/Prospect → Qualified → Contacted → Engaged → Scheduling → Meeting booked → Completed → Follow-up → Relationship → Closed/)).toBeVisible();
  await expect(page.getByRole('heading', {name:'Start from scratch'})).toBeVisible();
});

test('cards lead with the person and move a step at a time', async ({page}) => {
  await enter(page);
  const card = page.locator('.engagement').first();
  await expect(card.locator('.who')).toContainText('Alex Rivera');
  // The step number is decorative (aria-hidden); the count is labelled for screen readers.
  await expect(page.getByRole('heading', {name:/Prospect 1 in this step/})).toBeVisible();

  await card.getByRole('button', {name:/Move Alex Rivera forward to Qualified/}).click();
  await expect(page.getByRole('status').filter({hasText:'Moved to Qualified'})).toBeVisible();
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
  await card.getByRole('button', {name:/forward to Qualified/}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Someone else changed this first');
  await expect(page.locator('.stage').first().locator('.engagement')).toHaveCount(1);
});

test('an empty pipeline explains what an engagement is', async ({page, request}) => {
  await request.post(state, {data:{crm:{engagements:[], people:[], organizations:[], notes:[], tasks:[], conversations:[], 'source-artifacts':[], 'source-claims':[], approvals:[], agents:[], meetings:[]}}});
  await enter(page);
  await expect(page.getByText(/one effort with one person/)).toBeVisible();
});

test('steps can be renamed and reordered behind Edit steps', async ({page}) => {
  await enter(page);
  await page.getByRole('button', {name:'Edit steps'}).click();
  await expect(page.getByRole('heading', {name:/Steps in Coffee chats/})).toBeVisible();
  await page.getByRole('button', {name:/Move later — Prospect/}).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
