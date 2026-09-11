import { test, expect, type Page } from '@playwright/test';
const backend = 'http://127.0.0.1:4100/__state';
const workspaceId = '11111111-1111-4111-8111-111111111111';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/pipeline`);
}
/** The browser leaves for the registered client; the test observes that outgoing request. */
const leavesFor = (page: Page) => page.waitForRequest(request => request.url().startsWith('https://client.example.com/'));

test.beforeEach(async ({request}) => {await request.post(backend,{data:{}});});

test('consent shows the verified application, its scopes and the eligible workspace, then allows', async ({page}) => {
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  // The opaque request is captured server-side and removed from the address bar.
  await expect(page).toHaveURL('/oauth/authorize');
  await expect(page.getByRole('heading',{name:'Allow Notes Assistant to use Caffriend?'})).toBeVisible();
  await expect(page.getByText('client-abc')).toBeVisible();
  await expect(page.getByText('Studio')).toBeVisible();
  await expect(page.getByText('Add notes to your workspace. Applied immediately.')).toBeVisible();
  await expect(page.getByText('Nothing is applied until you approve it.')).toBeVisible();
  await expect(page.getByText('This application can add notes to your workspace without further approval.')).toBeVisible();

  const [submitted, departure] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/consent') && response.request().method() === 'POST'),
    leavesFor(page),
    page.getByRole('button',{name:'Allow access'}).click(),
  ]);
  // The code is delivered only by the Location header of a bodiless redirect, never rendered.
  expect(submitted.status()).toBe(303);
  await expect(submitted.text()).rejects.toThrow(/unavailable for redirect/);
  expect(departure.url()).toContain('code=authcode-secret');
});

test('offline access requires explicit consent before Allow proceeds', async ({page,request}) => {
  await request.post(backend,{data:{consent:{client:{id:'client-abc',name:'Notes Assistant'},scopes:['notes:write','offline_access'],workspaces:[{id:workspaceId,name:'Studio'}],offlineRequested:true}}});
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  const consent = page.getByRole('checkbox');
  await expect(consent).toBeVisible();
  await page.getByRole('button',{name:'Allow access'}).click();
  await expect(page).toHaveURL('/oauth/authorize');
  await consent.check();
  const [departure] = await Promise.all([leavesFor(page), page.getByRole('button',{name:'Allow access'}).click()]);
  expect(departure.url()).toContain('code=authcode-secret');
});

test('cancel returns the denial through the backend redirect', async ({page}) => {
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  const [departure] = await Promise.all([leavesFor(page), page.getByRole('button',{name:'Cancel'}).click()]);
  expect(departure.url()).toContain('error=access_denied');
  expect(departure.url()).not.toContain('code=');
});

test('missing verified client identity fails closed', async ({page,request}) => {
  await request.post(backend,{data:{consent:{scopes:['notes:write'],workspaces:[{id:workspaceId,name:'Studio'}]}}});
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  await expect(page.getByRole('heading',{name:'Requesting application unavailable'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Allow access'})).toHaveCount(0);
});

test('no eligible workspace shows unavailable access and a local exit', async ({page,request}) => {
  await request.post(backend,{data:{consent:{client:{id:'c',name:'Notes Assistant'},scopes:['notes:write'],workspaces:[]}}});
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();
  await page.getByRole('link',{name:'Go to your workspace'}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/pipeline`);
});

test('an expired request must restart at the requesting application', async ({page}) => {
  await login(page);
  await page.goto('/oauth/authorize?request=stale-request');
  await expect(page.getByText(/expired/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Allow access'})).toHaveCount(0);
});

test('consent submission from another origin is refused', async ({page,request}) => {
  await login(page);
  await page.goto('/oauth/authorize?request=opaque-request');
  const response = await page.request.post('/api/consent',{
    headers:{origin:'https://evil.example.com','content-type':'application/x-www-form-urlencoded'},
    data:`decision=allow&workspaceId=${workspaceId}`, maxRedirects:0,
  });
  expect(response.headers().location).toContain('problem=blocked');
  const state = await (await request.get(backend)).json();
  expect((state.calls ?? []).some((call:{path:string;method:string})=>call.path==='/oauth/consent'&&call.method==='POST')).toBe(false);
});
