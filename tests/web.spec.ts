import { test, expect, type Page } from '@playwright/test';
const workspaceId = '11111111-1111-4111-8111-111111111111';
async function login(page: Page) {
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
}
test.beforeEach(async ({request}) => {await request.post('http://127.0.0.1:4100/__state',{data:{}});});
test('signed-out user logs in with existing identity and enters their workspace', async ({page}) => {
  await page.goto(`/app/${workspaceId}/people`);
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await expect(page).toHaveURL(`/app/${workspaceId}/people`);
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});
test('user with no workspaces creates one and enters People', async ({page,request}) => {
  await request.post('http://127.0.0.1:4100/__state',{data:{workspaces:[]}});
  await page.goto('/login'); await login(page);
  await expect(page).toHaveURL('/app/workspaces/new');
  await page.getByLabel('Workspace name').fill('Studio');
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/people`);
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
});
test('multiple-workspace user chooses a workspace and navigates every section without integrations', async ({page,request})=>{
  const other={id:'22222222-2222-4222-8222-222222222222',name:'Community'};
  await request.post('http://127.0.0.1:4100/__state',{data:{workspaces:[{id:workspaceId,name:'Studio'},other]}});
  await page.goto('/login');await login(page);
  await expect(page.getByRole('heading',{name:'Choose a workspace'})).toBeVisible();
  await page.getByRole('link',{name:'Studio',exact:true}).click();
  for(const name of ['Pipeline','Inbox','Agents','Calendar','Settings','People']){
    await page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link',{name,exact:true}).click();
    await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  }
  await page.getByLabel('Switch workspace').selectOption(other.id);
  await expect(page).toHaveURL(`/app/${other.id}/people`);
  await page.goto('/app');
  await expect(page).toHaveURL(`/app/${other.id}/people`);
});
