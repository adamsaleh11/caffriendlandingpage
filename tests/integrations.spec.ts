import { test, expect, type Page } from '@playwright/test';
import {openSelect} from './controls';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const backend = 'http://127.0.0.1:4100/__state';
const settings = `/app/${workspaceId}/settings`;

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
}
async function signedIn(page: Page, destination = settings) {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await login(page);
  await expect(page).toHaveURL(destination);
}
/** Stands in for the provider: it redirects straight back to the registered frontend callback. */
async function stubProvider(page: Page, result: string) {
  for (const host of ['https://accounts.google.com/**','https://login.microsoftonline.com/**']) {
    await page.route(host, route => {
      const state = new URL(route.request().url()).searchParams.get('state')!;
      const target = new URL(route.request().url()).searchParams.get('redirect_uri')!;
      route.fulfill({status:302, headers:{location:`${target}?state=${encodeURIComponent(state)}&${result}`}});
    });
  }
}

test.beforeEach(async ({request}) => {await request.post(backend,{data:{}});});

test('user signs out from the account menu and loses access to the workspace', async ({page}) => {
  await signedIn(page, `/app/${workspaceId}/people`);
  await page.getByRole('button',{name:'Alex'}).click();
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto(`/app/${workspaceId}/people`);
  await expect(page).toHaveURL(/\/login/);
});

test('google connect, callback, calendar selection and disconnect', async ({page,request}) => {
  await signedIn(page);
  await expect(page.getByRole('heading',{name:'Google Calendar'})).toBeVisible();
  await stubProvider(page,'code=provider-code');
  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  // The authorization code never reaches the web app's URL or its rendered page.
  expect(page.url()).not.toContain('provider-code');
  await expect(page.getByText('Connected. Choose the calendar Caffriend should use.')).toBeVisible();
  await expect(page.locator('dd').filter({hasText:'alex@example.com'})).toBeVisible();
  await expect(page.getByText('Granted access unavailable')).toBeVisible();

  await page.getByRole('button',{name:'Choose a calendar'}).click();
  const select = page.getByLabel('Calendar to use');
  const calendars = await openSelect(select);
  await expect(calendars.getByRole('option',{name:'Holidays'})).toHaveCount(0);
  await calendars.getByRole('option',{name:'Alex — Work',exact:true}).click();
  await page.getByRole('button',{name:'Save calendar'}).click();
  await expect(page.getByText('Alex — Work').first()).toBeVisible();
  const afterSelect = await (await request.get(backend)).json();
  expect(afterSelect.calls.find((call:{path:string})=>call.path.endsWith('/select')).key).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page.getByText(/Meetings already recorded stay in your workspace/)).toBeVisible();
  await page.getByRole('button',{name:'Yes, disconnect'}).click();
  await expect(page.getByRole('switch',{name:'Google Calendar calendar'})).toHaveAttribute('aria-checked','false');
});

test('the mailbox grant returns to settings, never to the API\'s raw response', async ({page,request}) => {
  // Start with the grant genuinely absent, or the switch is already on.
  await request.post(backend,{data:{mailConnected:false}});
  await signedIn(page);
  await stubProvider(page,'code=provider-code');
  // The mail grant is held on a calendar connection, so one has to exist first.
  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  const grant = page.getByRole('switch',{name:'Send mail from my Gmail address'});
  await expect(grant).toBeEnabled();
  await grant.click();
  // The person lands back in Settings, not on the backend's JSON body.
  await expect(page).toHaveURL(settings);
  expect(page.url()).not.toContain('provider-code');
  await expect(page.getByText(/Caffriend can now send invitations from your address/)).toBeVisible();
  await expect(page.getByText(/Sending as alex@example.com/)).toBeVisible();
  await expect(page.getByRole('switch',{name:/Send mail from my Gmail address/})).toHaveAttribute('aria-checked','true');
});

test('a cancelled mailbox grant says so in settings instead of failing silently', async ({page,request}) => {
  await request.post(backend,{data:{mailConnected:false}});
  await signedIn(page);
  await stubProvider(page,'code=provider-code');
  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  const grant = page.getByRole('switch',{name:'Send mail from my Gmail address'});
  await expect(grant).toBeEnabled();
  await stubProvider(page,'error=access_denied');
  await grant.click();
  await expect(page).toHaveURL(settings);
  await expect(page.getByText(/You cancelled the mailbox permission/)).toBeVisible();
});

test('provider cancellation reports honestly and performs no exchange', async ({page,request}) => {
  await signedIn(page);
  await stubProvider(page,'error=access_denied');
  await page.getByRole('switch',{name:'Outlook Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  await expect(page.getByText(/You cancelled the connection/)).toBeVisible();
  const state = await (await request.get(backend)).json();
  expect(state.calls.some((call:{path:string})=>call.path.startsWith('/crm-calendar/callback'))).toBe(false);
});

test('replayed callback state is rejected without an exchange', async ({page,request}) => {
  await signedIn(page);
  await stubProvider(page,'code=provider-code');
  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  await request.post(backend,{data:{}});
  const replay = await page.request.get('/crm-calendar/callback/GOOGLE?state=state-GOOGLE&code=provider-code',{maxRedirects:0});
  expect(replay.headers().location).toContain('/app');
  expect(replay.headers().location).not.toContain('settings');
  const state = await (await request.get(backend)).json();
  expect((state.calls ?? []).some((call:{path:string})=>call.path.startsWith('/crm-calendar/callback'))).toBe(false);
});

test('a callback for a different provider than the pending flow is refused', async ({page,request}) => {
  await signedIn(page);
  // Establish a real pending Google flow, then return through the Microsoft callback.
  const started = await page.request.post(`/api/crm/workspaces/${workspaceId}/calendar-connections/GOOGLE/connect`,
    {headers:{origin:'http://localhost:3100','x-caffriend-request':'1'}, data:{}});
  const state = new URL((await started.json()).redirect).searchParams.get('state')!;
  const mismatched = await page.request.get(`/crm-calendar/callback/MICROSOFT?state=${state}&code=provider-code`,{maxRedirects:0});
  expect(mismatched.headers().location).toContain('/app');
  expect(mismatched.headers().location).not.toContain('settings');
  const backendState = await (await request.get(backend)).json();
  expect((backendState.calls ?? []).some((call:{path:string})=>call.path.startsWith('/crm-calendar/callback/MICROSOFT'))).toBe(false);
});

test('a backend redirect using the wrong calendar callback is refused before Google', async ({page,request}) => {
  await request.post(backend,{data:{calendarRedirectUri:'http://localhost:4000/crm-calendar/callback/GOOGLE'}});
  await signedIn(page);
  await page.getByRole('switch',{name:'Google Calendar calendar'}).click();
  await expect(page).toHaveURL(settings);
  await expect(page.getByText('This provider is unavailable right now.')).toBeVisible();
  const backendState = await (await request.get(backend)).json();
  expect((backendState.calls ?? []).some((call:{path:string})=>call.path.startsWith('/crm-calendar/callback'))).toBe(false);
});

test('unconfigured provider is disabled with actionable feedback and the CRM stays usable', async ({page,request}) => {
  await request.post(backend,{data:{status:{GOOGLE:{configured:false},MICROSOFT:{configured:true}}}});
  await signedIn(page);
  await expect(page.getByRole('switch',{name:'Google Calendar calendar'})).toBeDisabled();
  await expect(page.getByText(/Google Calendar is not configured/)).toBeVisible();
  await expect(page.getByRole('switch',{name:'Outlook Calendar calendar'})).toBeEnabled();
  await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name:'People',exact:true}).click();
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
});

test('existing connections on later pages are not silently omitted', async ({page,request}) => {
  await request.post(backend,{data:{connections:[
    {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',provider:'GOOGLE',status:'CONNECTED',accountIdentifier:'alex@example.com',calendarId:'primary',calendarName:'Alex — Work'},
    {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',provider:'MICROSOFT',status:'ERROR',accountIdentifier:'opaque-account-id',errorCode:'TOKEN_EXPIRED'},
  ]}});
  await signedIn(page);
  await expect(page.getByText('Alex — Work')).toBeVisible();
  await expect(page.getByText('opaque-account-id')).toBeVisible();
  await expect(page.getByText(/TOKEN_EXPIRED/)).toBeVisible();
});
