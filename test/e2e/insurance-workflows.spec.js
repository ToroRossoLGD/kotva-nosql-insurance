const{test,expect}=require('@playwright/test');

const today=new Date().toISOString().slice(0,10);
const nextYear=`${Number(today.slice(0,4))+1}${today.slice(4)}`;

async function openApp(page){
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:'window.Chart=class{destroy(){}}'}));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.goto('/');
}

async function login(page,username='agent',password='Agent123!'){
  await openApp(page);
  await page.locator('#login-form input[name="username"]').fill(username);
  await page.locator('#login-form input[name="password"]').fill(password);
  await page.locator('#login-form button').click();
  await expect(page.locator('#app-shell')).toBeVisible();
  await expect(page.locator('#type-select option').first()).toBeAttached();
}

async function createPolicy(page,{name,type='DZO',premium='1000',paymentStatus='Neplaćeno'}){
  const form=page.locator('#client-form');
  await form.locator('[name="name"]').fill(name);
  await form.locator('[name="surname"]').fill('Playwright');
  await form.locator('[name="age"]').fill('35');
  await form.locator('[name="insuranceType"]').selectOption(type);
  await form.locator('[name="insurer"]').selectOption({label:'Uniqa'});
  await form.locator('[name="saleDate"]').fill(today);
  await form.locator('[name="validFrom"]').fill(today);
  await form.locator('[name="validUntil"]').fill(nextYear);
  await form.locator('[name="premium"]').fill(premium);
  await form.locator('[name="currency"]').selectOption('RSD');
  await form.locator('[name="policyStatus"]').selectOption('Aktivna');
  await form.locator('[name="paymentMethod"]').selectOption('Kartica');
  await form.locator('[name="paymentStatus"]').selectOption(paymentStatus);
  await form.locator('[name="insuredSubject"]').fill(`Predmet osiguranja za ${name}`);
  return form;
}

async function optionValueContaining(page,selector,text){
  const value=await page.locator(`${selector} option`).filter({hasText:text}).getAttribute('value');
  expect(value).toBeTruthy();
  return value;
}

test.describe.serial('Kotva browser workflows',()=>{
  test('1. agent can sign in and sign out',async({page})=>{
    await login(page);
    await expect(page.locator('#user-name')).toContainText('Insurance Agent');
    await page.locator('#logout-button').click();
    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#app-shell')).toBeHidden();
  });

  test('2. analyst has a read-only interface',async({page})=>{
    await login(page,'analyst','Analyst123!');
    await expect(page.locator('#analytics')).toBeVisible();
    await expect(page.locator('#new-client')).toBeHidden();
    await expect(page.locator('#claim-form')).toBeHidden();
    await expect(page.locator('#payment-form')).toBeHidden();
    await expect(page.locator('#document-form')).toBeHidden();
    await expect(page.locator('#security')).toBeHidden();
  });

  test('3. agent creates a standard policy',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'StandardE2E'});
    await form.locator('button').click();
    await expect(page.locator('#client-message')).toContainText('uspešno sačuvan');
    const row=page.locator('#clients-body tr').filter({hasText:'StandardE2E Playwright'});
    await expect(row).toContainText('DZO');
    await expect(row).toContainText('1.000 RSD');
  });

  test('4. travel policy reveals and stores required identity fields',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'TravelE2E',type:'Putno'});
    await expect(form.locator('[name="jmbg"]')).toBeVisible();
    await expect(form.locator('[name="passportNumber"]')).toBeVisible();
    await expect(form.locator('[name="destination"]')).toBeVisible();
    await form.locator('[name="jmbg"]').fill('0609990712345');
    await form.locator('[name="passportNumber"]').fill('E2E123456');
    await form.locator('[name="destination"]').fill('Grčka');
    await form.locator('button').click();
    await expect(page.locator('#clients-body tr').filter({hasText:'TravelE2E Playwright'})).toContainText('E2E123456');
  });

  test('5. auto policy captures vehicle data and broker confirmation',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'VehicleE2E',type:'Auto'});
    await form.locator('[name="vehicleMake"]').fill('Toyota');
    await form.locator('[name="engineCapacity"]').fill('1987');
    await form.locator('[name="vehicleType"]').selectOption('Putničko');
    await expect(form.locator('[name="bodyType"]')).toBeVisible();
    await form.locator('[name="bodyType"]').selectOption('SUV');
    await form.locator('button').click();
    let row=page.locator('#clients-body tr').filter({hasText:'VehicleE2E Playwright'});
    await expect(row).toContainText('Toyota');
    page.once('dialog',dialog=>dialog.accept());
    await row.locator('[data-broker-client]').click();
    row=page.locator('#clients-body tr').filter({hasText:'VehicleE2E Playwright'});
    await expect(row).toContainText('Potvrđeno');
  });

  test('6. agent reports a claim and updates its status',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'ClaimE2E'});await form.locator('button').click();
    const clientId=await optionValueContaining(page,'#claim-client-select','ClaimE2E Playwright');
    await page.locator('#claim-client-select').selectOption(clientId);
    await page.locator('#incident-date').fill(today);
    await page.locator('#claim-form [name="estimatedAmount"]').fill('75000');
    await page.locator('#claim-form [name="currency"]').selectOption('RSD');
    await page.locator('#claim-form [name="description"]').fill('Oštećenje pokrića prijavljeno kroz Playwright test.');
    await page.locator('#claim-form button').click();
    let row=page.locator('#claims-body tr').filter({hasText:'ClaimE2E Playwright'});await expect(row).toContainText('Prijavljena');
    await row.locator('[data-claim-status]').selectOption('U obradi');
    page.once('dialog',dialog=>dialog.accept());await row.locator('[data-save-claim]').click();
    row=page.locator('#claims-body tr').filter({hasText:'ClaimE2E Playwright'});await expect(row).toContainText('U obradi');
  });

  test('7. partial and final payments update the policy',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'PaymentE2E',premium:'1000'});await form.locator('button').click();
    const clientId=await optionValueContaining(page,'#payment-client-select','PaymentE2E Playwright');
    const paymentForm=page.locator('#payment-form');
    await paymentForm.locator('[name="clientId"]').selectOption(clientId);
    await paymentForm.locator('[name="paymentDate"]').fill(today);
    await paymentForm.locator('[name="amount"]').fill('400');
    await paymentForm.locator('[name="method"]').selectOption('Kartica');
    await paymentForm.locator('[name="reference"]').fill('E2E-PAYMENT-001');
    await paymentForm.locator('button').click();
    await expect(page.locator('#payment-message')).toContainText('Preostalo: 600 RSD');
    await paymentForm.locator('[name="clientId"]').selectOption(clientId);
    await paymentForm.locator('[name="paymentDate"]').fill(today);
    await paymentForm.locator('[name="amount"]').fill('600');
    await paymentForm.locator('[name="method"]').selectOption('Bankovni transfer');
    await paymentForm.locator('[name="reference"]').fill('E2E-PAYMENT-002');
    await paymentForm.locator('button').click();
    await expect(page.locator('#payment-message')).toContainText('Preostalo: 0 RSD');
    await expect(page.locator('#clients-body tr').filter({hasText:'PaymentE2E Playwright'})).toContainText('Plaćeno');
  });

  test('8. generated policy PDF downloads from the client table',async({page})=>{
    await login(page);
    const form=await createPolicy(page,{name:'PolicyPdfE2E'});await form.locator('button').click();
    const row=page.locator('#clients-body tr').filter({hasText:'PolicyPdfE2E Playwright'});await expect(row.locator('[data-policy-pdf]')).toBeVisible();
    const[download]=await Promise.all([page.waitForEvent('download'),row.locator('[data-policy-pdf]').click()]);
    expect(download.suggestedFilename()).toMatch(/^kotva-policy-POL-.*\.pdf$/);expect(await download.failure()).toBeNull();
    const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks);expect(bytes.subarray(0,5).toString()).toBe('%PDF-');expect(bytes.length).toBeGreaterThan(1500);
  });

  test('9. analyst runs ETL and downloads an anonymous CSV dataset',async({page})=>{
    await login(page,'analyst','Analyst123!');await expect(page.locator('#etl')).toBeVisible();await page.locator('#etl-type').selectOption('DZO');await page.locator('#etl-form button[type="submit"]').click();await expect(page.locator('#etl-message')).toContainText('uspešno završen');await expect(page.locator('#etl-summary')).toContainText('Transformisano');
    const[download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-csv="analytics-dataset.csv"]').click()]);expect(download.suggestedFilename()).toMatch(/^kotva-analytics-dataset-.*\.csv$/);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const csv=Buffer.concat(chunks).toString('utf8');expect(csv).toContain('customer_id');expect(csv).toContain('CUST-');expect(csv).not.toMatch(/jmbg|passport_number|client_name/i);
  });

  test('10. analyst reviews currency-safe insurance KPIs',async({page})=>{
    await login(page,'analyst','Analyst123!');await expect(page.locator('#kpi-currency')).toHaveValue('RSD');await expect(page.locator('#kpi-cards')).toContainText('Ugovorena premija');await expect(page.locator('#kpi-cards')).toContainText('Stopa naplate');await expect(page.locator('#kpi-cards')).toContainText('Procenjeni odnos šteta i premije');await expect(page.locator('#kpi-cards')).toContainText('Učestalost šteta');await expect(page.locator('.kpi-definition')).toContainText('nije računovodstveni incurred loss ratio');await expect(page.locator('#premium-trend-chart')).toBeVisible();await expect(page.locator('#insurer-kpi-chart')).toBeVisible();
  });

  test('11. analyst monitors data quality scores and ETL trend',async({page})=>{
    await login(page,'analyst','Analyst123!');await expect(page.locator('#quality-status')).toContainText('Overall');await expect(page.locator('#quality-dimensions .quality-dimension')).toHaveCount(5);await expect(page.locator('#quality-dimensions')).toContainText('Potpunost');await expect(page.locator('#quality-dimensions')).toContainText('Referencijalni integritet');await expect(page.locator('#quality-updated')).toContainText('Poslednji ETL');await expect(page.locator('#quality-issues-chart')).toBeVisible();await expect(page.locator('#quality-trend-chart')).toBeVisible();
  });

  test('12. analyst sees PostgreSQL warehouse controls and graceful disabled state',async({page})=>{
    await login(page,'analyst','Analyst123!');await expect(page.locator('#warehouse-panel')).toBeVisible();await expect(page.locator('#warehouse-panel')).toContainText('PostgreSQL star schema');await expect(page.locator('#warehouse-status')).toHaveText('NIJE KONFIGURISAN');await expect(page.locator('#warehouse-load')).toBeDisabled();await expect(page.locator('#warehouse-counts')).toContainText('Police');
  });
});
