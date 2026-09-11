import { test, expect, type Page } from '@playwright/test';
const workspaceId = '11111111-1111-4111-8111-111111111111';
async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
test.beforeEach(async ({request}) => { await request.post('http://127.0.0.1:4100/__state', {data:{}}); });

test('the CRM sidebar is present on every app screen and never disappears', async ({page}) => {
  await page.goto('/home');
  await login(page);
  await expect(page).toHaveURL('/home');
  for (const screen of ['home','connections','calls','leaderboard','profile']) {
    await page.goto(`/${screen}`);
    const nav = page.getByRole('navigation', {name:'Workspace navigation'});
    await expect(nav.getByRole('link', {name:'People'})).toBeVisible();
    await expect(nav.getByRole('link', {name:'Pipeline'})).toBeVisible();
    await expect(page.getByRole('navigation', {name:'Caffriend app'})).toBeVisible();
  }
});

test('the sidebar reaches the CRM in one click from an app screen', async ({page}) => {
  await page.goto('/leaderboard');
  await login(page);
  await page.getByRole('navigation', {name:'Workspace navigation'}).getByRole('link', {name:'Pipeline'}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/pipeline`);
});

test('an unavailable workspace service still leaves the sidebar and the screen usable', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{workspacesFail:true}});
  await page.goto('/profile');
  await login(page);
  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('heading', {name:'Alex Rivera'})).toBeVisible();
  await expect(page.getByRole('navigation', {name:'Workspace navigation'}).getByRole('link', {name:'Your CRM'})).toBeVisible();
});
