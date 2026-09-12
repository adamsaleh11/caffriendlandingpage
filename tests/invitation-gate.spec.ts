import { test, expect, type Page } from '@playwright/test';

const TOKEN = 'a'.repeat(43);
const backend = 'http://127.0.0.1:4100/__state';

test.beforeEach(async ({request}) => { await request.post(backend, {data:{}}); });

/**
 * The email link asks who is booking before it books anything: bring an account
 * and the chat becomes a connection, stay a guest and it is only a booking.
 */
async function openInvitation(page: Page) {
  await page.goto(`/invitation/${TOKEN}`);
  await expect(page.getByRole('heading', {name:'Book with Alex Rivera'})).toBeVisible();
}

/** Stands in for Google Identity Services, which will not load in a test. */
async function stubGoogle(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as {google: unknown}).google = {accounts:{id:{
      initialize: (options: {callback: (response: {credential: string}) => void}) => {
        (window as unknown as {__google: unknown}).__google = options.callback;
      },
      renderButton: (parent: HTMLElement) => {
        const button = document.createElement('button');
        button.textContent = 'Continue with Google';
        button.onclick = () => (window as unknown as {__google: (r: {credential: string}) => void})
          .__google({credential: 'google-id-token'});
        parent.appendChild(button);
      },
    }}};
  });
}

test('a guest books the chat and is told plainly that nothing else happens', async ({page}) => {
  await openInvitation(page);
  await page.getByRole('button', {name:'Continue as a guest'}).click();

  await page.getByRole('button', {name:'Accept'}).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', {name:'Confirm time'}).click();

  await expect(page.getByRole('heading', {name:'Your coffee chat is booked'})).toBeVisible();
  // No account, so no connection — and the page never claims one.
  await expect(page.getByText('now connected on Caffriend')).toHaveCount(0);
});

test('creating an account with Google books the chat and connects the two people', async ({page}) => {
  await stubGoogle(page);
  await openInvitation(page);
  await page.getByRole('button', {name:'Continue with Google'}).click();

  // Signing in replaces the choice with the ordinary booking flow.
  await expect(page.getByRole('button', {name:'Accept'})).toBeVisible();
  await page.getByRole('button', {name:'Accept'}).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', {name:'Confirm time'}).click();

  await expect(page.getByRole('heading', {name:'Your coffee chat is booked'})).toBeVisible();
  await expect(page.getByText('Your account is ready, and you and Alex Rivera are now connected')).toBeVisible();
});

test('signing in to an existing account says connected, not created', async ({page, request}) => {
  await request.post(backend, {data:{googleExisting:true}});
  await stubGoogle(page);
  await openInvitation(page);
  await page.getByRole('button', {name:'Continue with Google'}).click();
  await page.getByRole('button', {name:'Accept'}).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', {name:'Confirm time'}).click();
  await expect(page.getByText('You and Alex Rivera are now connected on Caffriend.')).toBeVisible();
});

test('an email and password sign-in is offered, prefilled with the invited address', async ({page}) => {
  await openInvitation(page);
  await page.getByRole('button', {name:'Sign in with an email and password'}).click();
  await expect(page.getByLabel('Email or phone number')).toHaveValue('guest@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in and continue'}).click();
  await expect(page.getByRole('button', {name:'Accept'})).toBeVisible();
});

test('a failed Google sign-in leaves the choice open rather than booking', async ({page, request}) => {
  await request.post(backend, {data:{googleFails:true}});
  await stubGoogle(page);
  await openInvitation(page);
  await page.getByRole('button', {name:'Continue with Google'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', {name:'Continue as a guest'})).toBeVisible();
});

test('someone already signed in is not asked to choose', async ({page}) => {
  await page.goto('/login');
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
  await expect(page).toHaveURL(/\/app/);

  await page.goto(`/invitation/${TOKEN}`);
  await expect(page.getByRole('button', {name:'Accept'})).toBeVisible();
  await expect(page.getByRole('heading', {name:'Book with Alex Rivera'})).toHaveCount(0);
});
