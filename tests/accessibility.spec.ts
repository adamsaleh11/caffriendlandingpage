import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const backend = 'http://127.0.0.1:4100/__state';
const workspaceId = '11111111-1111-4111-8111-111111111111';

async function login(page: Page, destination = `/app/${workspaceId}/people`) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(destination);
}
const scan = (page: Page) => new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();

test.beforeEach(async ({request}) => {await request.post(backend,{data:{}});});

test('login, workspace and settings screens have no detectable accessibility violations', async ({page}) => {
  await page.goto('/login');
  expect((await scan(page)).violations).toEqual([]);
  await login(page);
  expect((await scan(page)).violations).toEqual([]);
  await page.goto(`/app/${workspaceId}/settings`);
  await expect(page.getByRole('heading',{name:'Calendar connections'})).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test('the consent screen has no detectable accessibility violations', async ({page}) => {
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  await expect(page.getByRole('button',{name:'Allow access'})).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test('a keyboard user reaches content through the skip link and operates the account menu', async ({page}) => {
  await login(page);
  await page.locator('#workspace-content').waitFor();
  await page.evaluate(()=>document.body.focus());
  // The Next.js dev overlay occupies a tab stop ahead of the document in development builds.
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(()=>document.activeElement?.tagName) !== 'NEXTJS-PORTAL') break;
  }
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace-content')).toBeFocused();

  const menu = page.getByRole('button',{name:'Alex'});
  await menu.click();
  await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
  // Escape closes the menu and returns focus to the control that opened it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Sign out'})).toBeHidden();
  await expect(menu).toBeFocused();
});

test('navigation and controls stay usable at tablet and phone widths without horizontal overflow', async ({page,request}) => {
  await request.post(backend,{data:{workspaces:[{id:workspaceId,name:'A workspace with a deliberately long name for layout checking'}]}});
  await login(page, `/app/${workspaceId}/settings`);
  const navigation = page.getByRole('navigation',{name:'Workspace navigation'});
  await expect(navigation).toBeVisible();
  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    if (width <= 800) {
      const toggle = page.getByRole('button',{name:'Menu'});
      await expect(toggle).toBeVisible();
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    await expect(navigation.getByRole('link',{name:'Settings',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

const invite = 'a'.repeat(43);

test('the public invitation page has no detectable accessibility violations in either state', async ({page,request}) => {
  await page.goto(`/meet/${invite}`);
  await expect(page.getByRole('heading',{name:'Coffee with Alex'})).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);

  await request.post(backend,{data:{invitationUnavailable:true}});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Invitation unavailable'})).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);
});

test('the invitation and call layouts stay usable from desktop to phone without horizontal overflow', async ({page,request}) => {
  await request.post(backend,{data:{allowJoin:true}});
  await page.route('https://livekit.test/**', route => route.abort());
  await page.routeWebSocket('wss://livekit.test/**', () => {});
  await page.goto(`/meet/${invite}`);
  const fits = () => page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.getByRole('button',{name:'Join on web',exact:true})).toBeVisible();
    expect(await fits()).toBe(true);
  }

  await page.setViewportSize({width: 1280, height: 900});
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await page.getByRole('button',{name:'Join on web',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Participants'})).toBeVisible();
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.getByRole('button',{name:'Leave',exact:true})).toBeVisible();
    expect(await fits()).toBe(true);
  }
});

const meetingId = '44444444-4444-4444-8444-444444444444';

test('the organizer meeting page and its dialogs have no detectable accessibility violations', async ({page}) => {
  await login(page, `/app/${workspaceId}/meetings/${meetingId}`);
  await expect(page.getByRole('heading',{name:'Coffee with Alex'})).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);

  await page.getByRole('button',{name:'Reschedule'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await scan(page)).violations).toEqual([]);

  // Escape closes the dialog and returns focus to the control that opened it.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Reschedule'})).toBeFocused();

  await page.getByRole('button',{name:'Cancel meeting'}).click();
  expect((await scan(page)).violations).toEqual([]);
});

test('the organizer meeting page stays usable from desktop to phone without horizontal overflow', async ({page}) => {
  await login(page, `/app/${workspaceId}/meetings/${meetingId}`);
  await page.getByRole('button',{name:'Reschedule'}).click();
  for (const width of [1280, 1024, 768, 390]) {
    await page.setViewportSize({width, height: 900});
    await expect(page.getByRole('button',{name:'Confirm reschedule'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});
