import { test, expect, type Page } from '@playwright/test';
import {chooseOption} from './controls';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const personId = '55555555-5555-4555-8555-555555555555';

async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in', exact:true}).click();
}
async function enter(page: Page, path: string) {
  await page.goto(path);
  if (page.url().includes('/login')) await login(page);
  await expect(page).toHaveURL(path);
}
test.beforeEach(async ({request}) => { await request.post('http://127.0.0.1:4100/__state', {data:{}}); });

test('an engagement can be created from the pipeline board', async ({page}) => {
  await enter(page, `/app/${workspaceId}/pipeline`);
  await page.getByRole('button', {name:'Add an engagement'}).click();
  await page.getByLabel('What are you trying to achieve?').fill('Get an introduction to the platform team');
  await chooseOption(page.getByLabel('Starting stage'), {label:'Prospect'});
  await page.getByLabel('Next action').fill('Send a short intro message');
  await page.getByRole('button', {name:'Create engagement'}).click();
  await expect(page.getByRole('status').filter({hasText:'Engagement created'})).toBeVisible();
  await expect(page.getByText('Get an introduction to the platform team')).toBeVisible();
});

test('an engagement can be started from a person, with that person fixed', async ({page}) => {
  await enter(page, `/app/${workspaceId}/people/${personId}`);
  await page.getByRole('button', {name:'Start an engagement'}).click();
  // The person is already decided here, so it is not asked again.
  await expect(page.getByLabel('Person')).toHaveCount(0);
  await page.getByLabel('What are you trying to achieve?').fill('Referral into the design team');
  await page.getByRole('button', {name:'Create engagement'}).click();
  await expect(page.getByRole('status').filter({hasText:'Engagement started'})).toBeVisible();
});

test('a refused creation is reported and nothing is added', async ({page, request}) => {
  await request.post('http://127.0.0.1:4100/__state', {data:{writeFails:true}});
  await enter(page, `/app/${workspaceId}/pipeline`);
  await page.getByRole('button', {name:'Add an engagement'}).click();
  await page.getByLabel('What are you trying to achieve?').fill('Should not be saved');
  await page.getByRole('button', {name:'Create engagement'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'Engagement created'})).toHaveCount(0);
});
