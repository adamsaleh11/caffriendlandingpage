import { test, expect, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
async function enter(page: Page, screen: string) {
  await page.goto(`/${screen}`);
  if (page.url().includes('/login')) await login(page);
  await expect(page).toHaveURL(`/${screen}`);
}

test.beforeEach(async ({request}) => { await request.post('http://127.0.0.1:4100/__state', {data:{}}); });

test('Home lists suggestions, hides the signed-in user, and accepts one', async ({page}) => {
  await enter(page, 'home');
  await expect(page.getByRole('heading', {name:'Home', exact:true})).toBeVisible();
  await expect(page.getByRole('rowheader', {name:/Jordan Patel/})).toBeVisible();
  // The viewer must never be offered to themselves.
  await expect(page.getByRole('rowheader', {name:/Alex Rivera/})).toHaveCount(0);
  await page.getByRole('row', {name:/Jordan Patel/}).getByRole('button', {name:'Accept'}).click();
  await expect(page.getByRole('status').filter({hasText:'You matched with Jordan Patel'})).toBeVisible();
  await expect(page.getByRole('rowheader', {name:/Jordan Patel/})).toHaveCount(0);
});

test('a refused accept is reported, not swallowed', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{createMatchFails:true}});
  await enter(page, 'home');
  await page.getByRole('row', {name:/Jordan Patel/}).getByRole('button', {name:'Accept'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('no longer available');
  await expect(page.getByRole('rowheader', {name:/Jordan Patel/})).toBeVisible();
});

test('opening a row shows the profile card and returns focus on close', async ({page}) => {
  await enter(page, 'home');
  const row = page.getByRole('row', {name:/Jordan Patel/});
  await row.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test('Connections resolves the other person from each bucket', async ({page}) => {
  await enter(page, 'connections');
  await expect(page.getByRole('rowheader', {name:/Jordan Patel/})).toBeVisible();
  await expect(page.getByRole('rowheader', {name:/Sam Okonkwo/})).toBeVisible();
  // Never the viewer, whichever side of the match they are on.
  await expect(page.getByRole('rowheader', {name:/Alex Rivera/})).toHaveCount(0);
});

test('Connections shows each person\'s profile data, not just a name', async ({page}) => {
  await enter(page, 'connections');
  await expect(page.getByRole('cell', {name:'Staff Engineer'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Fintech'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Acme'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Toronto'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Product Designer'})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Healthcare'})).toBeVisible();
  // Contact and billing fields are on that record but must never be rendered.
  expect(await page.content()).not.toContain('PRIVATE_CONTACT_SENTINEL');
});

test('a connection whose profile fails to load still lists', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{profileFails:true}});
  await enter(page, 'connections');
  await expect(page.getByRole('rowheader', {name:/Jordan Patel/})).toBeVisible();
  await expect(page.getByRole('row', {name:/Jordan Patel/}).getByText('—').first()).toBeVisible();
});

test('Upcoming calls shows the counterpart, not the viewer', async ({page}) => {
  await enter(page, 'calls');
  await expect(page.getByRole('heading', {name:'Upcoming calls'})).toBeVisible();
  // 'When' is the row header here, so the person is a plain cell.
  await expect(page.getByRole('cell', {name:/Jordan Patel/})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Video call'})).toBeVisible();
});

test('Leaderboard marks the signed-in person and sorts', async ({page}) => {
  await enter(page, 'leaderboard');
  await expect(page.getByRole('cell', {name:/Alex Rivera \(you\)/})).toBeVisible();
  await page.getByRole('button', {name:/Score/}).click();
  await expect(page.getByRole('columnheader', {name:/Score/})).toHaveAttribute('aria-sort', 'ascending');
});

test('Profile shows the signed-in person', async ({page}) => {
  await enter(page, 'profile');
  await expect(page.getByRole('heading', {name:'Alex Rivera'})).toBeVisible();
  await expect(page.getByText('alex@example.com')).toBeVisible();
});

test('the top-right navbar moves between the app screens', async ({page}) => {
  await enter(page, 'home');
  const nav = page.getByRole('navigation', {name:'Caffriend app'});
  await expect(nav.getByRole('link', {name:'Home'})).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', {name:'Leaderboard'}).click();
  await expect(page).toHaveURL('/leaderboard');
  await expect(nav.getByRole('link', {name:'Leaderboard'})).toHaveAttribute('aria-current', 'page');
  // The CRM is a separate product and must not appear in this navbar.
  await expect(nav.getByRole('link', {name:/pipeline|workspace|CRM/i})).toHaveCount(0);
});

test('signed-out visitors are sent to sign in', async ({page, context}) => {
  await context.clearCookies();
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login/);
});
