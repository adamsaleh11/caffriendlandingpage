import { test, expect } from '@playwright/test';

test('the public landing page keeps its metadata, content, links and video', async ({page}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Caffriend');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', 'Swipe right for your next coffee chat!');
  await expect(page.locator('iframe[title="How It Works"]')).toHaveAttribute('src', /youtube\.com\/embed\/MltlpUeMtRc/);
  for (const href of [
    'mailto:caffriendapp@gmail.com',
    'https://www.linkedin.com/company/caffriend/?viewAsMember=true',
    'https://www.youtube.com/@caffriendapp',
  ]) await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  // The CRM must not reach the landing page.
  await expect(page.locator('.crm')).toHaveCount(0);
});

test('early access accepts a signup and reports a transport failure honestly', async ({page}) => {
  await page.goto('/');
  const messages: string[] = [];
  page.on('dialog', dialog => {messages.push(dialog.message()); dialog.dismiss();});

  const email = page.getByPlaceholder('Enter your email address').locator('visible=true').first();
  await email.fill('friend@example.com');
  await email.press('Enter');
  await expect.poll(()=>messages).toContain("Thanks! You're on the list.");

  await email.fill('undeliverable@example.com');
  await email.press('Enter');
  await expect.poll(()=>messages.length).toBeGreaterThan(1);
  expect(messages[1]).not.toContain("You're on the list");
});
