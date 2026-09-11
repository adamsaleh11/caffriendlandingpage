import { test, expect, type Page } from '@playwright/test';

const backend = 'http://127.0.0.1:4100/__state';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const other = {id:'22222222-2222-4222-8222-222222222222', name:'Community'};

async function login(page: Page, destination = '/app') {
  await page.goto(`/login?returnTo=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email or phone number').fill('alex@example.com');
  await page.getByLabel('Password', {exact:true}).fill('correct');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
}

test.beforeEach(async ({request}) => {await request.post(backend,{data:{}});});

test('a failing workspace service offers a retry that recovers', async ({page,request}) => {
  await request.post(backend,{data:{workspacesFail:true}});
  await login(page);
  await expect(page.getByRole('heading',{name:'Unable to load workspaces'})).toBeVisible();
  await request.post(backend,{data:{}});
  await page.getByRole('button',{name:'Try again'}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/people`);
});

test('revoked membership is explained without disclosing another workspace', async ({page,request}) => {
  await request.post(backend,{data:{forbidden:true}});
  await login(page);
  await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();
  await expect(page.locator('p[role=alert]')).toContainText('no longer have access');
  await expect(page.getByText('Studio')).toHaveCount(0);
});

test('a deep link to a workspace the user cannot reach is not found, and the session survives', async ({page}) => {
  await login(page, `/app/${other.id}/people`);
  await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
  await page.getByRole('link',{name:'Back to workspaces'}).click();
  await expect(page).toHaveURL(`/app/${workspaceId}/people`);
});

test('a stale remembered selection is revalidated instead of trusted', async ({page,request}) => {
  await request.post(backend,{data:{workspaces:[{id:workspaceId,name:'Studio'},other]}});
  await login(page, `/app/${other.id}/people`);
  await expect(page).toHaveURL(`/app/${other.id}/people`);
  // Membership of the remembered workspace is withdrawn.
  await request.post(backend,{data:{workspaces:[{id:workspaceId,name:'Studio'}]}});
  await page.goto('/app');
  await expect(page).toHaveURL(`/app/${workspaceId}/people`);
});

test('workspace creation validates the name and reports a failure honestly', async ({page,request}) => {
  await request.post(backend,{data:{workspaces:[]}});
  await login(page);
  await expect(page).toHaveURL('/app/workspaces/new');
  const name = page.getByLabel('Workspace name');
  await expect(name).toHaveAttribute('maxlength','200');
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();
  await expect(page).toHaveURL('/app/workspaces/new');

  await request.post(backend,{data:{workspaces:[],workspacesFail:true}});
  await name.fill('Studio');
  await page.getByRole('button',{name:'Create workspace',exact:true}).click();
  await expect(page.locator('p[role=alert]')).toContainText('Refresh the workspace list');
  await expect(page).toHaveURL('/app/workspaces/new');
});

test('switching workspaces keeps the current section and drops the previous workspace view', async ({page,request}) => {
  await request.post(backend,{data:{workspaces:[{id:workspaceId,name:'Studio'},other]}});
  await login(page, `/app/${workspaceId}/pipeline`);
  await expect(page.getByRole('heading',{name:'Pipeline',exact:true})).toBeVisible();
  await page.getByLabel('Switch workspace').selectOption(other.id);
  await expect(page).toHaveURL(`/app/${other.id}/pipeline`);
  await expect(page.locator('#workspace-content').getByText('Community')).toBeVisible();
  await expect(page.locator('#workspace-content').getByText('Studio')).toHaveCount(0);
});
