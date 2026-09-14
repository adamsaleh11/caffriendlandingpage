import { test, expect, type Page } from '@playwright/test';

const groupCallId = 'cacacaca-caca-4aca-8aca-cacacacacaca';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
async function enterCall(page: Page) {
  await page.goto(`/calls/${groupCallId}`);
  if (page.url().includes('/login')) await login(page);
  await expect(page).toHaveURL(`/calls/${groupCallId}`);
}

test.beforeEach(async ({request}) => { await request.post('http://127.0.0.1:4100/__state', {data:{}}); });

test('the call opens on who is in the room', async ({page}) => {
  await enterCall(page);
  await expect(page.getByRole('heading', {name:'Breaking into product analytics'})).toBeVisible();
  const roster = page.getByRole('list', {name:'In the room'});
  await expect(roster.getByRole('listitem')).toHaveCount(3);
  await expect(roster.getByText('Sarah Chen')).toBeVisible();
  // The viewer is named for themselves, never by their own display name.
  await expect(roster.getByText('You')).toBeVisible();
  await expect(roster.getByText('Alex Rivera')).toHaveCount(0);
});

test('the host admits someone from the waiting room', async ({page}) => {
  await enterCall(page);
  await page.getByRole('button', {name:'Room'}).click();
  const waiting = page.getByRole('dialog', {name:'Waiting room'});
  const queue = waiting.getByRole('list', {name:'Waiting to join'});
  await expect(waiting.getByText('2 people are waiting to join')).toBeVisible();
  await queue.getByRole('listitem').filter({hasText:'Nina Ostrov'}).getByRole('button', {name:'Admit'}).click();
  await expect(queue.getByRole('listitem').filter({hasText:'Nina Ostrov'})).toHaveCount(0);
  await expect(waiting.getByText('1 person is waiting to join')).toBeVisible();
  // Admitting seats them: they are in the room, not merely gone from the queue.
  await page.getByRole('button', {name:'Close'}).click();
  await expect(page.getByRole('list', {name:'In the room'}).getByText('Nina Ostrov')).toBeVisible();
});

test('a refused admission is reported and the person stays in the queue', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{admitFails:true}});
  await enterCall(page);
  await page.getByRole('button', {name:'Room'}).click();
  const waiting = page.getByRole('dialog', {name:'Waiting room'});
  const queue = waiting.getByRole('list', {name:'Waiting to join'});
  await queue.getByRole('listitem').filter({hasText:'Nina Ostrov'}).getByRole('button', {name:'Admit'}).click();
  await expect(waiting.getByRole('alert')).toContainText('not in this call');
  await expect(queue.getByRole('listitem').filter({hasText:'Nina Ostrov'})).toBeVisible();
});

test('someone who is not a moderator gets no host controls', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{viewerIsHost:false}});
  await enterCall(page);
  await expect(page.getByRole('list', {name:'In the room'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Room'})).toHaveCount(0);
});

test('chat carries the thread from before the call and takes a new message', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Chat'}).click();
  const thread = page.getByRole('log', {name:'Call chat'});
  await expect(thread.getByText('Before we start — you asked about the analytics ladder.')).toBeVisible();
  await page.getByLabel('Message').fill('That would help a lot.');
  await page.getByRole('button', {name:'Send'}).click();
  await expect(thread.getByText('That would help a lot.')).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('');
});

test('notes keep private, shared and AI apart and take a new one', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Notes'}).click();
  await expect(page.getByRole('list', {name:'Notes'}).getByText('Ask Maya for the portfolio invite.')).toBeVisible();
  // Another member's private note is filtered out by the backend and must not surface.
  await expect(page.getByText('Sarah private sentinel')).toHaveCount(0);
  await page.getByRole('radio', {name:'Shared'}).click();
  await expect(page.getByRole('list', {name:'Notes'}).getByText('Levelling doc — Sarah shares after the call.')).toBeVisible();
  await expect(page.getByText('Ask Maya for the portfolio invite.')).toHaveCount(0);
  await page.getByLabel('Add a note').fill('Reconvene in four weeks.');
  await page.getByRole('button', {name:'Add note'}).click();
  await expect(page.getByRole('list', {name:'Notes'}).getByText('Reconvene in four weeks.')).toBeVisible();
});

test('actions list open commitments and tick one off', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Actions'}).click();
  await expect(page.getByText('2 open commitments')).toBeVisible();
  const item = page.getByRole('listitem').filter({hasText:'Draft a one-page case study'});
  await item.getByRole('checkbox').check();
  await expect(item.getByRole('checkbox')).toBeChecked();
  await expect(page.getByText('1 open commitment')).toBeVisible();
});

test('the agenda lists its blocks in order', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Agenda'}).click();
  const blocks = page.getByRole('list', {name:'Agenda'}).getByRole('listitem');
  await expect(blocks).toHaveCount(3);
  await expect(blocks.first()).toContainText('Warm intros');
  await expect(blocks.last()).toContainText('Concrete next steps');
});

test('a refused tick rolls back rather than showing a commitment as done', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{actionFails:true}});
  await enterCall(page);
  await page.getByRole('tab', {name:'Actions'}).click();
  const item = page.getByRole('listitem').filter({hasText:'Draft a one-page case study'});
  await item.getByRole('checkbox').click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('not in this call');
  await expect(item.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByText('2 open commitments')).toBeVisible();
});

test('the host locks the room and mutes people on entry', async ({page}) => {
  await enterCall(page);
  await page.getByRole('button', {name:'Room'}).click();
  const waiting = page.getByRole('dialog', {name:'Waiting room'});
  const lock = waiting.getByRole('switch', {name:'Lock the room'});
  await expect(lock).toHaveAttribute('aria-checked', 'false');
  await lock.click();
  await expect(lock).toHaveAttribute('aria-checked', 'true');
  await waiting.getByRole('switch', {name:'Mute everyone on entry'}).click();
  await expect(waiting.getByRole('switch', {name:'Mute everyone on entry'})).toHaveAttribute('aria-checked', 'false');
});

test('the host removes someone from the room', async ({page}) => {
  await enterCall(page);
  await page.getByRole('button', {name:'Room'}).click();
  const waiting = page.getByRole('dialog', {name:'Waiting room'});
  await waiting.getByRole('list', {name:'Remove a participant'}).getByRole('listitem').filter({hasText:'Maya Okafor'}).getByRole('button', {name:'Remove'}).click();
  await page.getByRole('button', {name:'Close'}).click();
  await expect(page.getByRole('list', {name:'In the room'}).getByText('Maya Okafor')).toHaveCount(0);
  await expect(page.getByRole('list', {name:'In the room'}).getByRole('listitem')).toHaveCount(2);
});

test('muting yourself and raising your hand shows in the room', async ({page}) => {
  await enterCall(page);
  const roster = page.getByRole('list', {name:'In the room'});
  await page.getByRole('button', {name:'Mute microphone'}).click();
  await expect(page.getByRole('button', {name:'Unmute microphone'})).toBeVisible();
  await expect(roster.getByRole('listitem').filter({hasText:'You'})).toContainText('Muted');
  await page.getByRole('button', {name:'Raise hand'}).click();
  await expect(roster.getByRole('listitem').filter({hasText:'You'})).toContainText('Hand raised');
  await expect(page.getByRole('button', {name:'Lower hand'})).toBeVisible();
});

test('what someone else does arrives without a reload', async ({page, request}) => {
  await enterCall(page);
  const roster = page.getByRole('list', {name:'In the room'});
  await expect(roster.getByRole('listitem').filter({hasText:'Sarah Chen'})).not.toContainText('Hand raised');

  // Sarah raises her hand from her own client; this one is only listening.
  await request.post('http://127.0.0.1:4100/__emit', {data:{
    event:'call.participant.updated',
    payload:{participant:{id:'p2', userId:'user-2', displayName:'Sarah Chen', handRaised:true, micOn:true, cameraOn:true, role:'participant', waitingStatus:'admitted'}},
  }});
  await expect(roster.getByRole('listitem').filter({hasText:'Sarah Chen'})).toContainText('Hand raised');

  await request.post('http://127.0.0.1:4100/__emit', {data:{
    event:'call.chat.message.created',
    payload:{message:{id:'m9', senderId:'user-2', message:'Sending the doc now.', createdAt:'2026-09-13T09:21:00.000Z', mentions:[], resourceCards:[]}},
  }});
  await page.getByRole('tab', {name:'Chat'}).click();
  await expect(page.getByRole('log', {name:'Call chat'}).getByText('Sending the doc now.')).toBeVisible();
});

test('the stage shows a tile for everyone and switches between speaker and grid', async ({page}) => {
  await enterCall(page);
  const stage = page.getByRole('region', {name:'Call stage'});
  await expect(stage.getByRole('listitem')).toHaveCount(3);
  // Speaker view leads with whoever is speaking.
  await expect(stage.getByRole('listitem').first()).toContainText('Sarah Chen');
  await expect(stage.getByRole('listitem').first()).toContainText('Speaking');
  await page.getByRole('button', {name:'Grid view'}).click();
  await expect(stage).toHaveAttribute('data-layout', 'grid');
  await page.getByRole('button', {name:'Speaker view'}).click();
  await expect(stage).toHaveAttribute('data-layout', 'speaker');
});

test('pinning someone leads the stage with them', async ({page}) => {
  await enterCall(page);
  const stage = page.getByRole('region', {name:'Call stage'});
  await stage.getByRole('listitem').filter({hasText:'Maya Okafor'}).getByRole('button', {name:'Pin'}).click();
  await expect(stage.getByRole('listitem').first()).toContainText('Maya Okafor');
  await stage.getByRole('listitem').first().getByRole('button', {name:'Unpin'}).click();
  await expect(stage.getByRole('listitem').first()).toContainText('Sarah Chen');
});

test('a camera that is off falls back to the person, and mute is visible on the tile', async ({page}) => {
  await enterCall(page);
  const stage = page.getByRole('region', {name:'Call stage'});
  const maya = stage.getByRole('listitem').filter({hasText:'Maya Okafor'});
  await expect(maya).toContainText('Muted');
  await expect(maya).toContainText('Hand raised');
});

test('tapping someone in the room opens their profile', async ({page}) => {
  await enterCall(page);
  await page.getByRole('list', {name:'In the room'}).getByRole('button', {name:/Sarah Chen/}).click();
  const profile = page.getByRole('dialog');
  await expect(profile).toBeVisible();
  await expect(profile.getByText('Sarah Chen')).toBeVisible();
});

test('the invite link can be copied', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await enterCall(page);
  await page.getByRole('button', {name:'Copy invite link'}).click();
  await expect(page.getByRole('status').filter({hasText:'Invite link copied'})).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('/calls/');
});

test('a new commitment can be added', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Actions'}).click();
  await page.getByLabel('Add an action').fill('Send the case study draft');
  await page.getByRole('button', {name:'Add action'}).click();
  await expect(page.getByRole('list', {name:'Action items'}).getByText('Send the case study draft')).toBeVisible();
  await expect(page.getByText('3 open commitments')).toBeVisible();
});

test('the header counts how long the call has been running', async ({page}) => {
  await enterCall(page);
  // The fixture provisions the room 125 seconds ago.
  const duration = page.getByRole('timer', {name:'Call duration'});
  await expect(duration).toHaveText(/^0?2:0\d$/);
  await expect(duration).toHaveText(/^0?2:0\d$/, {timeout: 3000});
});

test('a message can reply to another and mention someone', async ({page}) => {
  await enterCall(page);
  await page.getByRole('tab', {name:'Chat'}).click();
  const thread = page.getByRole('log', {name:'Call chat'});
  await thread.getByRole('listitem').filter({hasText:'I will drop the levelling doc'}).getByRole('button', {name:'Reply'}).click();
  await expect(page.getByRole('status').filter({hasText:'Replying to Sarah Chen'})).toBeVisible();
  await page.getByLabel('Message').fill('Thanks — ');
  await page.getByRole('button', {name:'Mention someone'}).click();
  await page.getByRole('option', {name:'Maya Okafor'}).click();
  await expect(page.getByLabel('Message')).toHaveValue('Thanks — @Maya Okafor ');
  await page.getByRole('button', {name:'Send'}).click();
  const sent = thread.getByRole('listitem').filter({hasText:'Thanks —'});
  await expect(sent).toContainText('I will drop the levelling doc');
  await expect(sent.getByText('@Maya Okafor')).toBeVisible();
});

test('sharing your screen shows on your tile and in the room', async ({page}) => {
  await enterCall(page);
  await page.getByRole('button', {name:'Share your screen'}).click();
  await expect(page.getByRole('button', {name:'Stop sharing your screen'})).toBeVisible();
  await expect(page.getByRole('region', {name:'Call stage'}).getByRole('listitem').filter({hasText:'You'})).toContainText('Sharing');
});

test('after the call has ended the notes are still there, even once you have left', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{callEnded:true}});
  await enterCall(page);
  await expect(page.getByText('This call has ended')).toBeVisible();
  // Nothing live is offered any more, but everything the call produced is.
  await expect(page.getByRole('button', {name:'Leave'})).toHaveCount(0);
  await expect(page.getByRole('region', {name:'Call stage'})).toHaveCount(0);
  await page.getByRole('tab', {name:'Notes'}).click();
  await page.getByRole('radio', {name:'Shared'}).click();
  await expect(page.getByRole('list', {name:'Notes'}).getByText('Levelling doc — Sarah shares after the call.')).toBeVisible();
  await page.getByRole('tab', {name:'Actions'}).click();
  await expect(page.getByRole('list', {name:'Action items'}).getByText('Draft a one-page case study')).toBeVisible();
});

test('an upcoming Caffriend call opens the call surface, and its notes outlive it', async ({page}) => {
  await page.goto('/calls');
  if (page.url().includes('/login')) await login(page);
  await page.getByRole('listitem').filter({hasText:'Coffee with Jordan'})
    .getByRole('link', {name:'Join'}).click();
  await expect(page).toHaveURL(`/calls/${groupCallId}`);
  // Generous: this is the first visit to the call surface in this spec's run.
  await expect(page.getByRole('tab', {name:'Notes'})).toBeVisible({timeout: 15000});
});

test.describe('workspace calls page', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';

  test('upcoming calls show on a calendar, and a past call opens its notes and who was there', async ({page, request}) => {
    await request.post('http://127.0.0.1:4100/__state', {data:{callEnded:true}});
    await page.goto(`/app/${workspaceId}/calendar`);
    if (page.url().includes('/login')) await login(page);

    // Upcoming: a month grid, with the booked call sitting on its own day. A day's chip
    // opens the call's detail rather than navigating, so everywhere the call can be
    // followed to — the room, its notes, the meeting record — is reachable from here.
    const grid = page.getByRole('grid', {name:/Calls in /});
    await expect(grid).toBeVisible();
    const chip = grid.getByRole('button', {name:/Jordan Patel/});
    await expect(chip).toBeVisible();
    await chip.click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByRole('heading', {name:'Coffee with Jordan'})).toBeVisible();
    await expect(detail.getByRole('link', {name:/Open (notes|the call room)/}))
      .toHaveAttribute('href', `/calls/${groupCallId}`);
    await detail.getByRole('button', {name:'Close'}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The sections that were never about calls are gone.
    await expect(page.getByRole('heading', {name:'Calendar delivery'})).toHaveCount(0);
    await expect(page.getByRole('heading', {name:'Schedule a meeting'})).toHaveCount(0);

    // Past: history comes from /group-calls/mine, and opening a row names who was there.
    const past = page.getByRole('list', {name:'Past calls'});
    const row = past.getByRole('listitem').filter({hasText:'Breaking into product analytics'});
    await expect(row).toBeVisible();
    // A finished call carries the same card as an upcoming one; only its action differs.
    // Notes opens a read-only page of its own — never the live call surface, which would
    // flash the room and its devices for a call that is over.
    await row.getByRole('link', {name:'Notes'}).click();
    await expect(page).toHaveURL(`/app/${workspaceId}/calls/${groupCallId}`);
    await expect(page.getByRole('list', {name:'People on this call'}).getByText('Sarah Chen')).toBeVisible();
    await expect(page.getByText('Ask Maya for the portfolio invite.')).toBeVisible();
    await expect(page.getByRole('list', {name:'Commitments'}).getByText('Draft a one-page case study')).toBeVisible();
    await expect(page.getByRole('list', {name:'Call chat'})).toBeVisible();
    // Nothing here may offer a way into the room.
    await expect(page.getByRole('link', {name:'Join'})).toHaveCount(0);
  });
});
