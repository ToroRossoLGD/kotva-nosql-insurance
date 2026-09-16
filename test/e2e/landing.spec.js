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
