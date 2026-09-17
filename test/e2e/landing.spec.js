const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
});

test('public landing introduces the platform and opens the existing demo',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('Osiguranje');
  await expect(page.locator('.feature-card')).toHaveCount(3);
  await expect(page.locator('.platform-image img')).toBeVisible();
  await page.getByRole('link',{name:'Otvori demo uživo'}).first().click();
  await expect(page).toHaveURL(/\/app\.html$/);
  await expect(page.locator('#login-form')).toBeVisible();
  expect(errors).toEqual([]);
});

test('landing language selection is remembered by the sign-in page',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Insurance, from quote to insight');
  await expect(page.locator('#hero-heading em')).toHaveText('— all in one place.');
  await page.getByRole('link',{name:'Open live demo'}).first().click();
  await expect(page).toHaveURL(/\/app\.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('heading',{name:'Sign in to Kotva'})).toBeVisible();
});

test('landing is usable on a narrow mobile viewport',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByRole('link',{name:'Otvori demo uživo'}).first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
});

test('Kotva landing uses its own navy and coral visual system',async({page})=>{
  await page.goto('/');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#102b46');
  await expect(page.locator('.button-primary')).toHaveCSS('background-color','rgb(255, 118, 91)');
  await expect(page.locator('.feature-card').first()).toHaveCSS('background-color','rgb(16, 43, 70)');
  await expect(page.locator('.feature-card').nth(1)).toHaveCSS('background-color','rgb(225, 243, 246)');
});

test('customer-facing copy leads to the demo without portfolio or source-code messaging',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#za-timove')).toContainText('Polise, klijenti i podaci');
  await expect(page.locator('#za-timove a')).toHaveAttribute('href','/app.html');
  await expect(page.locator('body')).not.toContainText(/portfolio projekat|edukativni projekat|izvorni kod/i);
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.locator('#za-timove')).toContainText('Policies, clients and data');
  await expect(page.locator('body')).not.toContainText(/portfolio project|educational project|source code/i);
});

test('demo availability follows the real readiness endpoint and language',async({page})=>{
  await page.route('**/api/health/ready',route=>route.fulfill({status:200,contentType:'application/json',body:'{"status":"ready"}'}));
  await page.goto('/');
  await expect(page.locator('#demo-health')).toHaveAttribute('data-state','ready');
  await expect(page.getByRole('status')).toHaveText('Demo je dostupan');
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.getByRole('status')).toHaveText('Demo is available');
});

test('demo availability reports unavailable when readiness fails',async({page})=>{
  await page.route('**/api/health/ready',route=>route.fulfill({status:503,contentType:'application/json',body:'{"status":"not_ready"}'}));
  await page.goto('/');
  await expect(page.locator('#demo-health')).toHaveAttribute('data-state','unavailable');
  await expect(page.getByRole('status')).toHaveText('Demo trenutno nije dostupan');
  await page.unroute('**/api/health/ready');
  await page.route('**/api/health/ready',route=>route.abort());
  await page.reload();
  await expect(page.locator('#demo-health')).toHaveAttribute('data-state','unavailable');
});
