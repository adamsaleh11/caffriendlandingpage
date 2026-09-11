import { test, expect, type Page } from '@playwright/test';

const backend = 'http://127.0.0.1:4100/__state';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const meetingId = '44444444-4444-4444-8444-444444444444';
const meetingPath = `/app/${workspaceId}/meetings/${meetingId}`;

async function login(page: Page, destination = meetingPath) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}

test.beforeEach(async ({request}) => {await request.post(backend,{data:{}});});

test('the organizer reviews the meeting and its audit history from server truth', async ({page}) => {
  await login(page);
  await expect(page).toHaveURL(meetingPath);
  await expect(page.getByRole('heading',{name:'Coffee with Alex'})).toBeVisible();
  await expect(page.locator('.meeting-detail strong')).toHaveText('Confirmed');
  await expect(page.getByText('America/Toronto', {exact:false})).toBeVisible();
  // Audit history is paged through and filtered to this meeting only.
  await expect(page.getByText('meeting.confirmed')).toBeVisible();
  await expect(page.getByText('meeting.join_link_issued')).toBeVisible();
  await expect(page.getByText('person.updated')).toHaveCount(0);
});

test('the organizer copies the invite link without it being guessed client-side', async ({page,context}) => {
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await login(page);
  await page.getByRole('button',{name:'Copy invite link'}).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Invite link copied');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(`https://caffriend.com/meet/${'a'.repeat(43)}`);
});

test('rescheduling requires confirmation and reflects the server result', async ({page}) => {
  await login(page);
  await page.getByRole('button',{name:'Reschedule'}).click();
  await page.getByLabel('New start').fill('2026-09-20T14:00');
  await page.getByLabel('New end').fill('2026-09-20T14:30');
  await page.getByRole('button',{name:'Confirm reschedule'}).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Meeting rescheduled');
  await expect(page.getByText('September 20, 2026', {exact:false}).first()).toBeVisible();
});

test('a failed reschedule rolls back to the server time and explains itself', async ({page,request}) => {
  await login(page);
  await request.post(backend,{data:{rescheduleConflict:true}});
  await page.getByRole('button',{name:'Reschedule'}).click();
  await page.getByLabel('New start').fill('2026-09-20T14:00');
  await page.getByLabel('New end').fill('2026-09-20T14:30');
  await page.getByRole('button',{name:'Confirm reschedule'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be rescheduled');
  // The original server time is restored, not the attempted one.
  await expect(page.getByText('September 12, 2026', {exact:false}).first()).toBeVisible();
  await expect(page.getByText('September 20, 2026', {exact:false})).toHaveCount(0);
});

test('cancelling requires confirmation, and a CANCEL_FAILED status is treated as failure', async ({page,request}) => {
  await request.post(backend,{data:{cancelFailedStatus:true}});
  await login(page);
  await page.getByRole('button',{name:'Cancel meeting'}).click();
  await expect(page.getByRole('dialog')).toContainText('cannot be undone');
  await page.getByRole('button',{name:'Confirm cancellation'}).click();
  // HTTP 200 carrying CANCEL_FAILED must never read as success.
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be cancelled');
  await expect(page.locator('.meeting-detail strong')).not.toHaveText('Cancelled');
});

test('a confirmed cancellation reaches the cancelled state and stops offering a join', async ({page}) => {
  await login(page);
  await page.getByRole('button',{name:'Cancel meeting'}).click();
  await page.getByRole('button',{name:'Confirm cancellation'}).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Meeting cancelled');
  await expect(page.locator('.meeting-detail strong')).toHaveText('Cancelled');
  await expect(page.getByRole('link',{name:'Join on web'})).toHaveCount(0);
});

test('dismissing a destructive dialog changes nothing on the server', async ({page,request}) => {
  await login(page);
  await page.getByRole('button',{name:'Cancel meeting'}).click();
  await page.getByRole('button',{name:'Keep meeting'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await (await request.post(backend,{data:{}})).json();
  expect(JSON.stringify(state)).not.toContain('cancel');
});

test('a meeting that is gone is reported without inventing one, and no token is stored', async ({page,request}) => {
  await request.post(backend,{data:{meetingMissing:true}});
  await login(page);
  await expect(page.getByRole('heading',{name:'Meeting unavailable'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify(localStorage)+JSON.stringify(sessionStorage))).not.toContain('eyJ');
});

test('the meeting page is private, and its invitation link is never assembled in the browser', async ({page}) => {
  await page.goto(meetingPath);
  await expect(page).toHaveURL(`/login?returnTo=${encodeURIComponent(meetingPath)}`);
  // A signed-out visitor learns nothing about the meeting.
  await expect(page.locator('body')).not.toContainText('Coffee with Alex');

  await login(page);
  await expect(page.getByRole('heading',{name:'Coffee with Alex'})).toBeVisible();
  // The token appears only in the server-issued joinUrl, never built from the meeting id.
  const scripts = await page.evaluate(()=>document.documentElement.innerHTML);
  expect(scripts).not.toContain('eyJ');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('a'.repeat(43));
});
