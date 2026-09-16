const{test,expect}=require('@playwright/test');

const today=new Date().toISOString().slice(0,10);
const nextYear=`${Number(today.slice(0,4))+1}${today.slice(4)}`;

async function openApp(page){
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:'window.Chart=class{destroy(){}}'}));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.goto('/app.html');
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

  test('13. administrator creates a user who must replace the temporary password',async({page})=>{
    await login(page,'admin','Admin123!');await expect(page.locator('#user-management')).toBeVisible();const form=page.locator('#user-form');await form.locator('[name="accountUsername"]').fill('playwright.agent');await form.locator('[name="displayName"]').fill('Playwright Agent');await form.locator('[name="role"]').selectOption('agent');await form.locator('[name="temporaryPassword"]').fill('Temporary123!');page.once('dialog',dialog=>dialog.accept());await form.locator('button').click();await expect(page.locator('#user-accounts-body')).toContainText('Playwright Agent');await page.locator('#logout-button').click();await page.locator('#login-form [name="username"]').fill('playwright.agent');await page.locator('#login-form [name="password"]').fill('Temporary123!');await page.locator('#login-form button').click();await expect(page.locator('#password-screen')).toBeVisible();await page.locator('#password-form [name="currentPassword"]').fill('Temporary123!');await page.locator('#password-form [name="newPassword"]').fill('Permanent123!');await page.locator('#password-form [name="confirmPassword"]').fill('Permanent123!');await page.locator('#password-form button').click();await expect(page.locator('#app-shell')).toBeVisible();await expect(page.locator('#user-name')).toContainText('Playwright Agent');
  });

  test('14. agent opens the policy 360-degree detail page and updates its status',async({page})=>{
    await login(page);const form=await createPolicy(page,{name:'DetailPageE2E',premium:'2400'});await form.locator('button').click();const row=page.locator('#clients-body tr').filter({hasText:'DetailPageE2E Playwright'});await expect(row.locator('.policy-detail-link')).toBeVisible();await row.locator('.policy-detail-link').click();await expect(page).toHaveURL(/policy-detail\.html\?id=/);await expect(page.locator('#policy-owner')).toContainText('DetailPageE2E Playwright');await expect(page.locator('#policy-summary')).toContainText('2.400 RSD');await expect(page.locator('#policy-fields')).toContainText('DZO');await expect(page.locator('#policy-actions')).toBeVisible();await page.locator('#detail-policy-status').selectOption('Otkazana');await page.locator('#save-policy-status').click();await expect(page.locator('#policy-status')).toHaveText('Otkazana');await expect(page.locator('#policy-timeline')).toContainText('Status polise promenjen');
  });

  test('15. agent renews a policy while preserving the previous version',async({page})=>{
    await login(page);const form=await createPolicy(page,{name:'RenewalE2E',premium:'3200'});await form.locator('button').click();const row=page.locator('#clients-body tr').filter({hasText:'RenewalE2E Playwright'}),oldNumber=await row.locator('td').nth(4).locator('strong').textContent();await row.locator('.policy-detail-link').click();await expect(page.locator('#renewal-panel')).toBeVisible();await expect(page.locator('#current-version')).toHaveText('v1');await page.locator('#renewal-form [name="premium"]').fill('3600');await page.locator('#renewal-form button').click();await expect(page.locator('#renewal-message')).toContainText('Polisa je obnovljena');await expect(page.locator('#policy-number')).not.toHaveText(oldNumber);await expect(page.locator('#current-version')).toHaveText('v2');await expect(page.locator('.version-card')).toHaveCount(2);await expect(page.locator('#policy-versions')).toContainText(oldNumber);await expect(page.locator('#policy-timeline')).toContainText('Polisa obnovljena');await expect(page.locator('#policy-summary')).toContainText('3.600 RSD');
  });

  test('16. analyst filters, sorts and pages the policy directory',async({page})=>{
    await login(page,'analyst','Analyst123!');await page.locator('#client-type-filter').selectOption('Putno');await expect(page.locator('#clients-body tr')).toHaveCount(10);await expect(page.locator('#clients-body tr .tag')).toHaveText(Array(10).fill('Putno'));await expect(page.locator('#client-page-info')).toContainText('1 /');await expect(page.locator('#client-next')).toBeEnabled();await page.locator('#client-next').click();await expect(page.locator('#client-page-info')).toContainText('Stranica 2 /');await page.locator('#client-filters-reset').click();await page.locator('#client-search').fill('LEGACY-AUTO-DODATNI-8');await expect(page.locator('#clients-body tr')).toHaveCount(1);await expect(page.locator('#clients-body')).toContainText('LEGACY-AUTO-DODATNI-8');
  });

  test('17. agent moves a quote from draft to a converted policy',async({page})=>{
    await login(page);const form=page.locator('#quote-form');await expect(form).toBeVisible();await form.locator('[name="name"]').fill('QuoteE2E');await form.locator('[name="surname"]').fill('Playwright');await form.locator('[name="age"]').fill('36');await form.locator('[name="insuranceType"]').selectOption('DZO');await form.locator('[name="insurer"]').selectOption('Uniqa');await form.locator('[name="validFrom"]').fill('2026-10-01');await form.locator('[name="validUntil"]').fill('2027-10-01');await form.locator('[name="premium"]').fill('15000');await form.locator('[name="currency"]').selectOption('RSD');await form.locator('[name="insuredSubject"]').fill('QuoteE2E Playwright');await form.getByRole('button',{name:'Sačuvaj ponudu'}).click();let row=page.locator('#quotes-body tr').filter({hasText:'QuoteE2E Playwright'});await expect(row).toContainText('Nacrt');await row.getByRole('button',{name:'Pošalji'}).click();row=page.locator('#quotes-body tr').filter({hasText:'QuoteE2E Playwright'});await expect(row).toContainText('Poslata');await row.getByRole('button',{name:'Prihvati'}).click();await expect(row).toContainText('Prihvaćena');await row.getByRole('button',{name:'Kreiraj polisu'}).click();await expect(row).toContainText('Konvertovana');await expect(row).toContainText('POL-');await page.locator('#client-search').fill('QuoteE2E');await expect(page.locator('#clients-body')).toContainText('QuoteE2E Playwright');
  });

  test('18. agent calculates an explainable vehicle premium',async({page})=>{
    await login(page);const form=page.locator('#quote-form');await form.locator('[name="age"]').fill('22');await form.locator('[name="insuranceType"]').selectOption('Auto');await form.locator('[name="validFrom"]').fill('2026-10-01');await form.locator('[name="validUntil"]').fill('2027-10-01');await form.locator('[name="vehicleMake"]').fill('Volvo');await form.locator('[name="engineCapacity"]').fill('2200');await form.locator('[name="vehicleType"]').selectOption('Putničko');await form.locator('[name="bodyType"]').selectOption('SUV');await page.locator('#calculate-premium').click();await expect(form.locator('[name="premium"]')).not.toHaveValue('');await expect(page.locator('#pricing-breakdown')).toContainText('RSD');await expect(page.locator('#pricing-breakdown')).toContainText('Koeficijent');await expect(page.locator('#rating-rules')).toBeHidden();
  });

  test('19. agent previews and commits a validated CSV policy import',async({page})=>{
    await login(page);const headers=['externalId','name','surname','age','insuranceType','insurer','saleDate','validFrom','validUntil','premium','currency','policyStatus','paymentMethod','paymentStatus','insuredSubject','jmbg','passportNumber','destination','vehicleMake','engineCapacity','vehicleType','bodyType'],values=['E2E-IMPORT-001','CsvE2E','Playwright','40','DZO','Uniqa','2026-09-16','2026-09-16','2027-09-16','12500','RSD','Aktivna','Kartica','Neplaćeno','CsvE2E Playwright'],line=row=>row.map(value=>`"${value||''}"`).join(','),csv=`${line(headers)}\n${line(values)}`;await page.locator('#import-file').setInputFiles({name:'e2e-import.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.locator('#import-preview').click();await expect(page.locator('#import-summary')).toContainText('1 ispravnih');await expect(page.locator('#import-preview-body')).toContainText('Ispravno');await expect(page.locator('#import-commit')).toBeEnabled();await page.locator('#import-commit').click();await expect(page.locator('#import-summary')).toContainText('1 polisa je uvezeno');await expect(page.locator('#import-runs-body')).toContainText('e2e-import.csv');await page.locator('#client-search').fill('CsvE2E');await expect(page.locator('#clients-body')).toContainText('CsvE2E Playwright');
  });
});
