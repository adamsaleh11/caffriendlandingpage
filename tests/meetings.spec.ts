import { test, expect } from '@playwright/test';
import {chooseOption} from './controls';

const invite = 'a'.repeat(43);
test('a guest sees only safe meeting details without signing in', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.goto(`/meet/${invite}`);
  await expect(page.getByRole('heading', { name: 'Coffee with Alex' })).toBeVisible();
  await expect(page.getByText('America/Toronto', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Your display name')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Workspace navigation' })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('PRIVATE_CRM_SENTINEL');
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain(invite);
});

test('joining requires a name and terms, and a closed meeting cannot issue access', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { joinClosed: true } });
  await page.goto(`/meet/${invite}`);
  const join = page.getByRole('button', { name: 'Join on web', exact: true });
  await expect(join).toBeDisabled();
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await join.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('This meeting is not open for joining');
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain(invite);
});

test('a connection failure is honest and leaving returns to a safe completion screen', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { allowJoin: true } });
  await page.route('https://livekit.test/**', route => route.abort());
  await page.routeWebSocket('wss://livekit.test/**', socket => socket.close());
  await page.goto(`/meet/${invite}`);
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await page.getByRole('button', { name: 'Join on web', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Unable to connect', { timeout: 20000 });
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You left the call' })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('test-livekit-token');
});

test('permission denial explains recovery without preventing a camera-off join', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
  });
  await page.goto(`/meet/${invite}`);
  await page.getByRole('button', { name: 'Preview camera and microphone' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('browser site settings');
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await expect(page.getByRole('button', { name: 'Join on web', exact: true })).toBeEnabled();
});

test('the call has camera, microphone, device and participant controls while connecting', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { allowJoin: true } });
  await page.route('https://livekit.test/**', route => route.abort());
  await page.routeWebSocket('wss://livekit.test/**', () => {});
  await page.goto(`/meet/${invite}`);
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await page.getByRole('button', { name: 'Join on web', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Participants' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Microphone', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Camera', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Camera devices' })).toBeVisible();
  await expect(page.getByRole('button', { name: /screen share|chat/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You left the call' })).toBeVisible();
});

test('a booked meeting link backed by a group call opens the full call design', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { meetingGroupCall: true } });
  await page.route('https://livekit.test/**', route => route.abort());
  await page.routeWebSocket('wss://livekit.test/**', () => {});
  await page.goto(`/meet/${invite}`);
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await page.getByRole('button', { name: 'Join on web', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Breaking into product analytics' })).toBeVisible({timeout: 15000});
  await expect(page.getByRole('region', { name: 'Call stage' })).toBeVisible();
  for (const tab of ['People', 'Chat', 'Notes', 'Actions', 'Agenda']) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }
  // Joining from /meet used to leave the call inside the lobby card, which painted
  // every roster control orange. The call is its own surface, matching /calls/:id.
  const inviteLink = page.getByRole('button', { name: 'Copy invite link' });
  expect(await inviteLink.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  const lead = await page.getByRole('region', { name: 'Call stage' }).locator('.call-tile').first().boundingBox();
  expect(lead?.height ?? 0).toBeGreaterThan(280);
  // Every dock control does something: the mic, camera, share and hand go to the call,
  // and picture in picture goes to the browser. Nothing is shown that has nowhere to go.
  await expect(page.getByRole('button', { name: 'Reactions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Raise hand' })).toBeVisible();
});

test('the device preview uses the same cream page and orange join control as the rest of the product', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.goto(`/meet/${invite}`);
  const pageColor = await page.locator('.meeting-page').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(pageColor).toBe('rgb(255, 251, 249)');
  const join = page.getByRole('button', { name: 'Join on web', exact: true });
  expect(await join.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  expect(await join.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 100, 4)');
  await expect(page.getByRole('region', { name: 'Device preview' })).toBeVisible();
});

test('an unavailable invitation is safe, a failing resolve leaks nothing, and retry recovers', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { invitationUnavailable: true } });
  await page.goto(`/meet/${invite}`);
  await expect(page.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Invitation unavailable.');
  await expect(page.getByLabel('Your display name')).toHaveCount(0);

  // An upstream failure must not surface the backend's own message.
  await request.post('http://127.0.0.1:4100/__state', { data: { meetingFailure: true } });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Unable to load this invitation');
  await expect(page.locator('body')).not.toContainText('PRIVATE_CRM_SENTINEL');

  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee with Alex' })).toBeVisible();
});

test('an offline recipient is told so and recovers once the connection returns', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.route('**/api/meet/resolve', route => route.abort());
  await page.goto(`/meet/${invite}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('You may be offline');
  await page.unroute('**/api/meet/resolve');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Coffee with Alex' })).toBeVisible();
});

test('the invitation page never hands off to an app store and keeps credentials out of the URL', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { allowJoin: true } });
  await page.route('https://livekit.test/**', route => route.abort());
  await page.routeWebSocket('wss://livekit.test/**', () => {});
  await page.goto(`/meet/${invite}`);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  await expect(page.locator('a[href*="apps.apple.com"], a[href*="itunes.apple.com"], a[href*="play.google.com"], a[href^="caffriend:"]')).toHaveCount(0);

  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await page.getByRole('button', { name: 'Join on web', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Participants' })).toBeVisible();
  expect(page.url()).toBe(`http://localhost:3100/meet/${invite}`);
  expect(page.url()).not.toContain('test-livekit-token');
  expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('test-livekit-token');
});

test('a keyboard recipient reaches every join control in order with a visible focus ring', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.goto(`/meet/${invite}`);
  await page.getByRole('button', { name: 'Preview camera and microphone' }).focus();
  const focused = async () => page.evaluate(() => {
    const element = document.activeElement as HTMLInputElement | null;
    if (!element) return '';
    return element.getAttribute('aria-label') || element.labels?.[0]?.textContent || element.textContent || '';
  });
  await page.keyboard.press('Tab');
  expect(await focused()).toContain('Your display name');
  await page.keyboard.press('Tab');
  expect(await focused()).toContain('I accept the meeting and privacy terms');
  await page.keyboard.press('Space');
  await page.getByLabel('Your display name').fill('Jordan');
  await page.getByRole('button', { name: 'Join on web', exact: true }).focus();
  expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth)).toBe('3px');
});

const fakeDevices = () => {
  const devices = [
    {deviceId:'mic-1', kind:'audioinput', label:'Built-in Microphone', groupId:'g1'},
    {deviceId:'mic-2', kind:'audioinput', label:'Headset Microphone', groupId:'g2'},
    {deviceId:'cam-1', kind:'videoinput', label:'FaceTime Camera', groupId:'g3'},
    {deviceId:'cam-2', kind:'videoinput', label:'External Webcam', groupId:'g4'},
  ];
  const win = window as unknown as {__constraints: MediaStreamConstraints[]};
  win.__constraints = [];
  navigator.mediaDevices.enumerateDevices = async () => devices as unknown as MediaDeviceInfo[];
  navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    win.__constraints.push(constraints!);
    const canvas = document.createElement('canvas');
    const stream = (canvas as HTMLCanvasElement & {captureStream:(fps:number)=>MediaStream}).captureStream(5);
    return stream;
  };
};

test('the recipient chooses a microphone and camera before joining, and that choice is used', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: {} });
  await page.addInitScript(fakeDevices);
  await page.goto(`/meet/${invite}`);

  // Labels are only available after permission, so selectors follow the preview.
  await page.getByRole('button', { name: 'Preview camera and microphone' }).click();
  const microphone = page.getByRole('combobox', { name: 'Microphone', exact: true });
  const camera = page.getByRole('combobox', { name: 'Camera', exact: true });
  await expect(microphone).toBeVisible();
  await expect(camera).toBeVisible();

  await chooseOption(microphone, { label: 'Headset Microphone' });
  await chooseOption(camera, { label: 'External Webcam' });
  const used = await page.evaluate(() => (window as unknown as {__constraints: MediaStreamConstraints[]}).__constraints.at(-1));
  expect(JSON.stringify(used)).toContain('mic-2');
  expect(JSON.stringify(used)).toContain('cam-2');
});

test('a signed-in member is not asked for a name they already gave at sign up', async ({ page, request }) => {
  await request.post('http://127.0.0.1:4100/__state', { data: { allowJoin: true } });
  await page.goto('/login');
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto(`/meet/${invite}`);
  await expect(page.getByRole('heading', { name: 'Coffee with Alex' })).toBeVisible();
  // The name is stated, not asked for, and Join needs only the terms.
  await expect(page.getByLabel('Your display name')).toHaveCount(0);
  await expect(page.getByText(/Joining as/)).toBeVisible();
  const join = page.getByRole('button', { name: 'Join on web', exact: true });
  await expect(join).toBeDisabled();
  await page.getByLabel('I accept the meeting and privacy terms').check();
  await expect(join).toBeEnabled();
});
