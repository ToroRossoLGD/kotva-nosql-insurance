const {test,expect}=require('@playwright/test');

async function open(page){
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:'window.Chart=class{constructor(element,config){this.data=config.data;this.options=config.options}destroy(){}}'}));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.goto('/');
}
const picker=page=>page.locator('[data-language-picker] select:visible');
async function login(page){
  await page.getByRole('textbox',{name:'Username',exact:true}).fill('agent');
  await page.getByLabel('Password',{exact:true}).fill('Agent123!');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#app-shell')).toBeVisible();
  await expect(page.locator('#type-select option')).toHaveCount(5);
  await expect(page.locator('#stats-grid .stat')).toHaveCount(5);
}

test('language selection persists through login, reload and logout; forms keep canonical values',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang','sr');
  await picker(page).selectOption('en');
  await expect(page.getByRole('heading',{name:'Sign in to Kotva'})).toBeVisible();
  await login(page);
  await expect(page.getByRole('heading',{name:'Welcome to Kotva.'})).toBeVisible();
  const form=page.locator('#client-form');
  await form.getByLabel('First name',{exact:true}).fill('Putno');
  await form.getByLabel('Last name',{exact:true}).fill('LanguageTest');
  await form.getByLabel('Age',{exact:true}).fill('35');
  await form.getByLabel('Insurance type',{exact:true}).selectOption({label:'Private health'});
  await form.getByLabel('Premium',{exact:true}).fill('1234.5');
  await form.getByLabel('Insured subject',{exact:true}).fill('Language test policy');
  await picker(page).selectOption('sr');
  await expect(form.locator('[name=name]')).toHaveValue('Putno');
  await expect(form.locator('[name=insuranceType]')).toHaveValue('DZO');
  await expect(form.locator('[name=premium]')).toHaveValue('1234.5');
  await picker(page).selectOption('en');
  await form.getByLabel('Policy status',{exact:true}).selectOption({label:'Active'});
  await form.getByLabel('Payment method',{exact:true}).selectOption({label:'Card'});
  await form.getByLabel('Payment status',{exact:true}).selectOption({label:'Unpaid'});
  const sent=page.waitForRequest(request=>request.url().endsWith('/api/clients')&&request.method()==='POST');
  await form.getByRole('button',{name:'Save client and policy'}).click();
  expect((await sent).postDataJSON()).toMatchObject({name:'Putno',insuranceType:'DZO',policyStatus:'Aktivna',paymentMethod:'Kartica',paymentStatus:'Neplaćeno'});
  await expect(page.locator('#client-message')).toHaveText('Client saved successfully.');
  await expect(page.locator('#clients-body')).toContainText('Putno LanguageTest');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByRole('heading',{name:'Welcome to Kotva.'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Sign in to Kotva'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('login errors translate in both directions and picker fits a mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await open(page);
  await picker(page).selectOption('en');
  await page.route('**/api/auth/login',route=>route.fulfill({status:401,json:{message:'Invalid username or password.'}}));
  await page.getByLabel('Username',{exact:true}).fill('invalid');
  await page.getByLabel('Password',{exact:true}).fill('invalid');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  await picker(page).selectOption('sr');
  await expect(page.locator('#login-message')).toHaveText('Korisničko ime ili lozinka nisu ispravni.');
  await picker(page).selectOption('en');
  await expect(page.locator('#login-message')).toHaveText('Invalid username or password.');
  const bounds=await picker(page).boundingBox();
  expect(bounds.x).toBeGreaterThan(195);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);expect(bounds.y).toBeLessThan(40);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'test-results/language-login-mobile-en.png'});
});

test('blocked storage falls back to Serbian and still permits switching',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value(){throw new Error('Storage blocked')}});Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('Storage blocked')}})});
  await open(page);
  await expect(page.getByRole('heading',{name:'Prijava u Kotvu'})).toBeVisible();
  await picker(page).selectOption('en');
  await expect(page.getByRole('heading',{name:'Sign in to Kotva'})).toBeVisible();
});

test('analyst charts, filters and permissions survive language changes',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kotva.language','unsupported'));
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang','sr');
  await page.locator('[name=username]').fill('analyst');
  await page.locator('[name=password]').fill('Analyst123!');
  await page.locator('#login-form button').click();
  await expect(page.locator('#warehouse-status')).toHaveText('NIJE KONFIGURISAN');
  await page.locator('#etl-type').selectOption('DZO');
  await picker(page).selectOption('en');
  await expect(page.locator('#kpi-cards')).toContainText('Written premium');
  await expect(page.locator('#quality-dimensions')).toContainText('Completeness');
  await expect(page.locator('#warehouse-status')).toHaveText('NOT CONFIGURED');
  await expect(page.locator('#etl-type')).toHaveValue('DZO');
  await expect(page.locator('#client-form')).toBeHidden();
  expect(await page.evaluate(()=>charts['avg-age-chart'].data.labels)).toContain('Travel');
  await page.screenshot({path:'test-results/language-dashboard-en.png'});
  await picker(page).selectOption('sr');
  await expect(page.locator('#kpi-cards')).toContainText('Ugovorena premija');
  await expect(page.locator('#db-status')).toHaveText('Demo režim');
  await expect(page.locator('#etl-type option[value=""]')).toHaveText('Svi tipovi');
  await expect(page.locator('#etl-type')).toHaveValue('DZO');
});
