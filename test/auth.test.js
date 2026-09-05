const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');

process.env.USE_ARANGO='false';
process.env.JWT_SECRET='test-secret-that-is-not-used-in-production';
const{start}=require('../server');

let server,baseUrl;
test.before(async()=>{
  server=await start(0);
  baseUrl=`http://127.0.0.1:${server.address().port}`;
});
test.after(()=>new Promise(resolve=>server.close(resolve)));

async function request(path,options={}){
  const response=await fetch(`${baseUrl}${path}`,options);
  const body=response.status===204?null:await response.json();
  return{response,body};
}

async function login(username,password){
  const result=await request('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
  return{...result,cookie:result.response.headers.get('set-cookie')?.split(';')[0]};
}

function withPolicy(data,overrides={}){
  const saleDate=data.saleDate,validUntil=`${Number(saleDate.slice(0,4))+1}${saleDate.slice(4)}`;
  return{...data,validFrom:saleDate,validUntil,premium:12000,currency:'RSD',policyStatus:'Aktivna',paymentMethod:'Kartica',paymentStatus:'Plaćeno',insuredSubject:`${data.name} ${data.surname}`,...overrides};
}

test('health endpoint remains public',async()=>{
  const{response,body}=await request('/api/health');
  assert.equal(response.status,200);assert.equal(body.status,'ok');
});

test('protected endpoints reject anonymous requests',async()=>{
  const{response}=await request('/api/clients');assert.equal(response.status,401);
});

test('invalid credentials are rejected and recorded',async()=>{
  const{response}=await login('admin','wrong-password');assert.equal(response.status,401);
  const admin=await login('admin','Admin123!');
  const audit=await request('/api/auth/login-attempts',{headers:{cookie:admin.cookie}});
  assert.equal(audit.response.status,200);
  assert.ok(audit.body.some(item=>item.username==='admin'&&item.successful===false));
});

test('analyst has read-only access',async()=>{
  const analyst=await login('analyst','Analyst123!');assert.equal(analyst.response.status,200);
  assert.equal((await request('/api/analytics',{headers:{cookie:analyst.cookie}})).response.status,200);
  assert.equal((await request('/api/clients',{method:'POST',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:'{}'})).response.status,403);
});

test('agent can create clients but cannot create insurers',async()=>{
  const agent=await login('agent','Agent123!');assert.equal(agent.response.status,200);
  const client=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Test',surname:'Agent',age:30,insuranceType:'Auto',insurer:'Uniqa',saleDate:'2026-09-01',vehicleMake:'Toyota',engineCapacity:1598,vehicleType:'Putničko',bodyType:'SUV'}))});
  assert.equal(client.response.status,201);
  const insurer=await request('/api/insurers',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Agent Test Insurer'})});
  assert.equal(insurer.response.status,403);
});

test('administrator has full access and logout clears the session',async()=>{
  const admin=await login('admin','Admin123!');assert.equal(admin.response.status,200);assert.equal(admin.body.user.role,'admin');
  const created=await request('/api/insurers',{method:'POST',headers:{cookie:admin.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Admin Test Insurer'})});
  assert.equal(created.response.status,201);
  const logout=await request('/api/auth/logout',{method:'POST',headers:{cookie:admin.cookie}});assert.equal(logout.response.status,204);
  assert.match(logout.response.headers.get('set-cookie'),/kotva_session=;/);
});

test('travel insurance requires and stores JMBG, passport, and destination',async()=>{
  const agent=await login('agent','Agent123!');
  const base=withPolicy({name:'Travel',surname:'Customer',age:28,insuranceType:'Putno',insurer:'Uniqa',saleDate:'2026-09-03'});
  const missing=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(base)});
  assert.equal(missing.response.status,400);assert.match(missing.body.message,/JMBG/);

  const travelDetails={...base,jmbg:'0303990712345',passportNumber:'PA-123456',destination:'Greece'};
  const created=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(travelDetails)});
  assert.equal(created.response.status,201);
  assert.equal(created.body.jmbg,travelDetails.jmbg);
  assert.equal(created.body.passportNumber,travelDetails.passportNumber);
  assert.equal(created.body.destination,travelDetails.destination);

  const duplicate=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({...travelDetails,name:'Duplicate'})});
  assert.equal(duplicate.response.status,409);
});

test('auto insurance requires vehicle details and supports broker approval',async()=>{
  const agent=await login('agent','Agent123!');
  const base=withPolicy({name:'Auto',surname:'Customer',age:39,insuranceType:'Auto',insurer:'Generali',saleDate:'2026-09-04'});
  const missing=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(base)});
  assert.equal(missing.response.status,400);assert.match(missing.body.message,/Marka vozila/);
  const noBodyType=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({...base,vehicleMake:'Škoda',engineCapacity:1968,vehicleType:'Putničko'})});
  assert.equal(noBodyType.response.status,400);assert.match(noBodyType.body.message,/limuzinu, SUV ili karavan/);

  const created=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({...base,vehicleMake:'Škoda',engineCapacity:1968,vehicleType:'Putničko',bodyType:'Karavan'})});
  assert.equal(created.response.status,201);assert.equal(created.body.brokerApproval.status,'pending');assert.equal(created.body.bodyType,'Karavan');

  const analyst=await login('analyst','Analyst123!');
  const denied=await request(`/api/clients/${created.body.id}/broker-approval`,{method:'POST',headers:{cookie:analyst.cookie}});
  assert.equal(denied.response.status,403);
  const approved=await request(`/api/clients/${created.body.id}/broker-approval`,{method:'POST',headers:{cookie:agent.cookie}});
  assert.equal(approved.response.status,200);assert.equal(approved.body.brokerApproval.status,'confirmed');assert.equal(approved.body.brokerApproval.confirmedBy.username,'agent');
  assert.equal(approved.body.policyHistory.at(-1).action,'broker_confirmed');

  const adria=await login('adria-admin','Adria123!');
  const crossTenant=await request(`/api/clients/${created.body.id}/broker-approval`,{method:'POST',headers:{cookie:adria.cookie}});
  assert.equal(crossTenant.response.status,404);
});

test('Excel export contains tenant market-share percentages and DZO',async()=>{
  const agent=await login('agent','Agent123!');
  const dzo=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'DZO',surname:'Customer',age:34,insuranceType:'DZO',insurer:'Uniqa',saleDate:'2026-09-04'}))});
  assert.equal(dzo.response.status,201);
  const response=await fetch(`${baseUrl}/api/exports/insurance-market-share.xlsx`,{headers:{cookie:agent.cookie}});
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml/);assert.match(response.headers.get('content-disposition'),/\.xlsx/);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await response.arrayBuffer());
  const report=workbook.getWorksheet('Market Share'),source=workbook.getWorksheet('Source Counts');
  assert.ok(report);assert.ok(source);assert.equal(report.getCell('A1').value,'INSURANCE MARKET SHARE');
  assert.deepEqual(report.getRow(5).values.slice(1,6),['Insurance Company','Putno','Auto','Privatna svojina','DZO']);
  const totalRow=report.lastRow;
  for(const column of[2,3,4,5,6])assert.equal(totalRow.getCell(column).value.result,1);
  const insurerNames=source.getColumn(1).values.slice(2,-1);assert.equal(new Set(insurerNames).size,insurerNames.length);assert.ok(insurerNames.includes('Uniqa'));
});

test('tenant data and analytics are isolated between companies',async()=>{
  const kotva=await login('admin','Admin123!');
  const adria=await login('adria-admin','Adria123!');
  assert.equal(adria.response.status,200);assert.equal(adria.body.user.tenantName,'Adria Brokers');

  const kotvaClients=await request('/api/clients',{headers:{cookie:kotva.cookie}});
  const adriaClients=await request('/api/clients',{headers:{cookie:adria.cookie}});
  assert.ok(kotvaClients.body.length>adriaClients.body.length);
  assert.ok(kotvaClients.body.every(client=>client.tenantId==='tenant-kotva'));
  assert.ok(adriaClients.body.every(client=>client.tenantId==='tenant-adria'));

  const kotvaBefore=await request('/api/analytics',{headers:{cookie:kotva.cookie}});
  const adriaBefore=await request('/api/analytics',{headers:{cookie:adria.cookie}});
  const newInsurer=await request('/api/insurers',{method:'POST',headers:{cookie:adria.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Adria Exclusive'})});
  assert.equal(newInsurer.response.status,201);assert.equal(newInsurer.body.tenantId,'tenant-adria');
  const newClient=await request('/api/clients',{method:'POST',headers:{cookie:adria.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Tenant',surname:'Isolation',age:37,insuranceType:'Auto',insurer:'Adria Exclusive',saleDate:'2026-09-02',vehicleMake:'MAN',engineCapacity:6871,vehicleType:'Teretno'}))});
  assert.equal(newClient.response.status,201);assert.equal(newClient.body.tenantId,'tenant-adria');

  const kotvaAfter=await request('/api/analytics',{headers:{cookie:kotva.cookie}});
  const adriaAfter=await request('/api/analytics',{headers:{cookie:adria.cookie}});
  assert.equal(kotvaAfter.body.totalClients,kotvaBefore.body.totalClients);
  assert.equal(adriaAfter.body.totalClients,adriaBefore.body.totalClients+1);

  const kotvaAudit=await request('/api/auth/login-attempts',{headers:{cookie:kotva.cookie}});
  const adriaAudit=await request('/api/auth/login-attempts',{headers:{cookie:adria.cookie}});
  assert.ok(kotvaAudit.body.every(item=>item.tenantId==='tenant-kotva'));
  assert.ok(adriaAudit.body.every(item=>item.tenantId==='tenant-adria'));
});

test('advanced policy data is validated and status changes are audited',async()=>{
  const agent=await login('agent','Agent123!');
  const invalid=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Invalid',surname:'Policy',age:31,insuranceType:'Privatna svojina',insurer:'Sava',saleDate:'2026-09-05'})});
  assert.equal(invalid.response.status,400);assert.match(invalid.body.message,/Datumi/);
  const payload=withPolicy({name:'Advanced',surname:'Policy',age:31,insuranceType:'Privatna svojina',insurer:'Sava',saleDate:'2026-09-05'},{premium:275.5,currency:'EUR',policyStatus:'Nacrt',paymentMethod:'Bankovni transfer',paymentStatus:'Neplaćeno',insuredSubject:'Stan u Beogradu',documentReference:'ugovor-2026-09.pdf'});
  const created=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(created.response.status,201);assert.match(created.body.policyNumber,/^POL-\d{8}-KOTVA-[A-Z0-9]{6}$/);assert.equal(created.body.soldBy.username,'agent');assert.equal(created.body.documents.length,1);assert.equal(created.body.policyHistory[0].action,'created');
  const changed=await request(`/api/clients/${created.body.id}/policy`,{method:'PATCH',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({policyStatus:'Aktivna',paymentStatus:'Plaćeno'})});
  assert.equal(changed.response.status,200);assert.equal(changed.body.policyStatus,'Aktivna');assert.equal(changed.body.paymentStatus,'Plaćeno');assert.equal(changed.body.policyHistory.at(-1).action,'policy_updated');assert.equal(changed.body.policyHistory.at(-1).performedBy.username,'agent');
  const adria=await login('adria-admin','Adria123!'),crossTenant=await request(`/api/clients/${created.body.id}/policy`,{method:'PATCH',headers:{cookie:adria.cookie,'content-type':'application/json'},body:JSON.stringify({policyStatus:'Otkazana'})});
  assert.equal(crossTenant.response.status,404);
});
