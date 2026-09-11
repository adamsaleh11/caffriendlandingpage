import { test, expect } from '@playwright/test';

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

  await microphone.selectOption({ label: 'Headset Microphone' });
  await camera.selectOption({ label: 'External Webcam' });
  const used = await page.evaluate(() => (window as unknown as {__constraints: MediaStreamConstraints[]}).__constraints.at(-1));
  expect(JSON.stringify(used)).toContain('mic-2');
  expect(JSON.stringify(used)).toContain('cam-2');
});
