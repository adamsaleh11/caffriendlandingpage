import {test,expect,type Page} from '@playwright/test';
import {chooseDate, chooseTime} from './controls';

const workspaceId='11111111-1111-4111-8111-111111111111';
const personId='55555555-5555-4555-8555-555555555555';
const invite='a'.repeat(43);
const groupCall='cacacaca-caca-4aca-8aca-cacacacacaca';
const connection={id:'33333333-3333-4333-8333-333333333333',provider:'GOOGLE',status:'CONNECTED',accountIdentifier:'alex@example.com',calendarId:'primary',calendarName:'Alex — Work'};
async function login(page:Page){await page.getByLabel('Email or phone number').fill('alex@example.com');await page.getByLabel('Password',{exact:true}).fill('correct');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
async function enter(page:Page,path:string){await page.goto(path);if(page.url().includes('/login'))await login(page);await expect(page).toHaveURL(path);}
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:4100/__state',{data:{connections:[connection]}});});

test('coffee chat invites has its own workspace sidebar page',async({page})=>{
 await enter(page,`/app/${workspaceId}/pipeline`);
 await page.getByRole('link',{name:/Coffee chat invites/}).click();
 await expect(page).toHaveURL(`/app/${workspaceId}/invites`);
 await expect(page.getByRole('heading',{name:'Coffee chat invites'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Create invitation'})).toBeVisible();
});

test('one invitation flow accepts workspace people and multiple email addresses',async({page})=>{
 await enter(page,`/app/${workspaceId}/invites`);
 await page.getByLabel(/Alex Rivera/).check();
 await page.getByLabel('Email addresses').fill('sam@example.com\njordan@example.com');
 await expect(page.getByText('3 recipients selected')).toBeVisible();
 await page.getByRole('button',{name:'Create invitation'}).click();
 await page.getByLabel('Message').fill('Pick a time that works for you.');
 await chooseDate(page.getByLabel('Date',{exact:true}),'2026-09-20');
 await chooseTime(page.getByLabel('Time',{exact:true}),'11:00');
 await page.getByRole('button',{name:'Preview emails'}).click();
 await expect(page.getByRole('tab')).toHaveCount(3);
 await page.getByRole('button',{name:'Send 3 invitations'}).click();
 await expect(page.getByText('Invitation sent')).toHaveCount(3);
});

test('sender previews the actual email and sends from an engagement',async({page})=>{
 await enter(page,`/app/${workspaceId}/pipeline`);
 await page.getByRole('button',{name:'Send coffee chat invite'}).click();
 await expect(page.getByLabel('Recipient email')).toHaveValue('alex@example.com');
 await page.getByLabel('Message').fill('Would love to hear about your team.');
 await chooseDate(page.getByLabel('Date',{exact:true}),'2026-09-20');await chooseTime(page.getByLabel('Time',{exact:true}),'11:00');
 await page.getByRole('button',{name:'Preview email'}).click();
 await expect(page.getByRole('heading',{name:'Review the delivered email'})).toBeVisible();
 await expect(page.locator('iframe[title="Actual invitation email"]')).toBeVisible();
 await page.getByRole('button',{name:'Send invitation'}).click();
 await expect(page.getByRole('heading',{name:'Invitation sent'})).toBeVisible();
});

test('editing after preview requires a fresh backend preview',async({page})=>{
 await enter(page,`/app/${workspaceId}/people/${personId}`);await page.getByRole('button',{name:'Send coffee chat invite'}).click();
 await page.getByLabel('Message').fill('First message');await chooseDate(page.getByLabel('Date',{exact:true}),'2026-09-20');await chooseTime(page.getByLabel('Time',{exact:true}),'11:00');await page.getByRole('button',{name:'Preview email'}).click();
 await page.getByRole('button',{name:'Edit invitation'}).click();await page.getByLabel('Message').fill('Changed message');
 await expect(page.getByRole('button',{name:'Send invitation'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Preview email'})).toBeVisible();
});

test('logged-out recipient explicitly chooses a slot and accepts',async({page})=>{
 await page.goto(`/invitation/${invite}?intent=accept`);
 // A recipient with no session is asked first whether they are bringing an
 // account; booking as a guest is the path this test follows.
 await page.getByRole('button',{name:'Continue as a guest'}).click();
 await expect(page.getByRole('heading',{name:'Coffee chat about the platform team'})).toBeVisible();
 const confirm=page.getByRole('button',{name:'Confirm time'});await expect(confirm).toBeDisabled();
 await page.getByRole('radio').first().check();await confirm.click();
 await expect(page.getByRole('heading',{name:'Your coffee chat is booked'})).toBeVisible();
 await expect(page.getByText('confirmation email with your join button')).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Workspace navigation'})).toHaveCount(0);
});

// The booking appears twice on this page on purpose — once on the month grid, once in
// the list under it — so every assertion here is scoped to the list, which is the half
// that carries the detail and the Join button.
test('meetings renders canonical Upcoming Calls data and join route',async({page})=>{
 await enter(page,`/app/${workspaceId}/calendar`);
 const meeting=page.getByRole('list',{name:'Upcoming meetings'}).getByRole('listitem').filter({hasText:'Coffee with Jordan'});
 await expect(meeting.getByRole('heading',{name:'Coffee with Jordan'})).toBeVisible();
 await expect(meeting).toContainText('Jordan Patel');await expect(meeting).toContainText('Caffriend call');
 // A Caffriend call is joined in its own collaboration room, not through the invitation
 // URL: the room is the same address before, during and after the call.
 await expect(meeting.getByRole('link',{name:'Join',exact:true})).toHaveAttribute('href',`/calls/${groupCall}`);
});
