const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const ExcelJS=require('exceljs');

process.env.USE_ARANGO='false';
process.env.JWT_SECRET='test-secret-that-is-not-used-in-production';
const uploadDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'kotva-documents-'));process.env.UPLOAD_DIR=uploadDirectory;
const{start}=require('../server');

let server,baseUrl;
test.before(async()=>{
  server=await start(0);
  baseUrl=`http://127.0.0.1:${server.address().port}`;
});
test.after(()=>new Promise(resolve=>server.close(()=>{fs.rmSync(uploadDirectory,{recursive:true,force:true});resolve()})));

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
  assert.equal(response.status,200);assert.equal(body.status,'ok');assert.match(response.headers.get('x-request-id'),/^[0-9a-f-]{36}$/);
});

test('liveness, readiness, and runtime metrics support production monitoring',async()=>{
  const live=await request('/api/health/live'),ready=await request('/api/health/ready');assert.equal(live.response.status,200);assert.equal(live.body.status,'alive');assert.ok(Number.isInteger(live.body.uptimeSeconds));assert.equal(ready.response.status,200);assert.equal(ready.body.status,'ready');assert.equal(ready.body.databaseReady,true);
  const anonymous=await request('/api/metrics');assert.equal(anonymous.response.status,401);
  const agent=await login('agent','Agent123!'),denied=await request('/api/metrics',{headers:{cookie:agent.cookie}});assert.equal(denied.response.status,403);
  const admin=await login('admin','Admin123!'),metrics=await request('/api/metrics',{headers:{cookie:admin.cookie}});assert.equal(metrics.response.status,200);assert.ok(metrics.body.requests>=5);assert.ok(metrics.body.averageDurationMs>=0);assert.ok(metrics.body.maxDurationMs>=metrics.body.averageDurationMs);assert.ok(metrics.body.memory.rssMb>0);assert.equal(metrics.body.database,'memory');assert.ok(metrics.body.statusCodes['200']>=2);
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

test('analytics warehouse endpoints are role protected and report disabled state',async()=>{
  const anonymous=await request('/api/warehouse/status');assert.equal(anonymous.response.status,401);
  const agent=await login('agent','Agent123!');assert.equal((await request('/api/warehouse/status',{headers:{cookie:agent.cookie}})).response.status,403);
  const analyst=await login('analyst','Analyst123!'),status=await request('/api/warehouse/status',{headers:{cookie:analyst.cookie}});assert.equal(status.response.status,200);assert.deepEqual(status.body,{configured:false,connected:false});
  const load=await request('/api/warehouse/load',{method:'POST',headers:{cookie:analyst.cookie}});assert.equal(load.response.status,503);assert.match(load.body.message,/warehouse nije konfigurisan/i);
  const report=await request('/api/warehouse/reports/monthly',{headers:{cookie:analyst.cookie}});assert.equal(report.response.status,503);
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

test('policy PDF is generated dynamically and remains tenant protected',async()=>{
  const agent=await login('agent','Agent123!');
  const created=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'PDF',surname:'Customer',age:36,insuranceType:'Putno',insurer:'Uniqa',saleDate:'2026-09-04'},{jmbg:'0404990712346',passportNumber:'PDF123456',destination:'Spain'}))});
  assert.equal(created.response.status,201);
  const response=await fetch(`${baseUrl}/api/clients/${created.body.id}/policy.pdf`,{headers:{cookie:agent.cookie}}),bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/pdf/);assert.match(response.headers.get('content-disposition'),new RegExp(`kotva-policy-${created.body.policyNumber}\\.pdf`));assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1500);assert.ok(bytes.subarray(-20).toString().includes('%%EOF'));
  const analyst=await login('analyst','Analyst123!'),analystResponse=await fetch(`${baseUrl}/api/clients/${created.body.id}/policy.pdf`,{headers:{cookie:analyst.cookie}});assert.equal(analystResponse.status,200);
  const adria=await login('adria-admin','Adria123!'),crossTenant=await request(`/api/clients/${created.body.id}/policy.pdf`,{headers:{cookie:adria.cookie}});assert.equal(crossTenant.response.status,404);
  const anonymous=await request(`/api/clients/${created.body.id}/policy.pdf`);assert.equal(anonymous.response.status,401);
});

test('ETL creates an auditable run and exports anonymous analysis-ready CSV datasets',async()=>{
  const agent=await login('agent','Agent123!'),policy=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Sensitive',surname:'AnalystSource',age:34,insuranceType:'DZO',insurer:'Uniqa',saleDate:'2026-09-06'},{premium:24000,paymentStatus:'Neplaćeno'}))});assert.equal(policy.response.status,201);
  const agentDenied=await request('/api/etl/runs',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:'{}'});assert.equal(agentDenied.response.status,403);
  const analyst=await login('analyst','Analyst123!'),filters={dateFrom:'2026-09-01',dateTo:'2026-09-30',insuranceType:'DZO',insurer:'Uniqa'},run=await request('/api/etl/runs',{method:'POST',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:JSON.stringify(filters)});assert.equal(run.response.status,201);assert.equal(run.body.status,'completed');assert.ok(run.body.extractedRecords>=1);assert.ok(run.body.transformedRows>=1);assert.equal(run.body.initiatedBy.role,'analyst');
  const query=new URLSearchParams(filters),response=await fetch(`${baseUrl}/api/etl/exports/analytics-dataset.csv?${query}`,{headers:{cookie:analyst.cookie}}),bytes=Buffer.from(await response.arrayBuffer()),csv=bytes.toString('utf8');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/csv/);assert.match(response.headers.get('content-disposition'),/analytics-dataset/);assert.deepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);assert.match(csv,/customer_id/);assert.match(csv,/CUST-[A-F0-9]{16}/);assert.match(csv,/DZO,Uniqa,2026-09-06,2026,9,Q3/);assert.doesNotMatch(csv,/Sensitive|AnalystSource|jmbg|passport/i);
  for(const dataset of['policies.csv','payments.csv','claims.csv','etl-quality-report.csv']){const exportResponse=await fetch(`${baseUrl}/api/etl/exports/${dataset}`,{headers:{cookie:analyst.cookie}});assert.equal(exportResponse.status,200);assert.match(exportResponse.headers.get('content-type'),/text\/csv/)}
  const runs=await request('/api/etl/runs',{headers:{cookie:analyst.cookie}});assert.equal(runs.response.status,200);assert.equal(runs.body[0].id,run.body.id);assert.equal(runs.body[0].tenantId,'tenant-kotva');
  const invalid=await request('/api/etl/runs',{method:'POST',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:JSON.stringify({dateFrom:'2026-10-01',dateTo:'2026-09-01'})});assert.equal(invalid.response.status,400);
  const adria=await login('adria-admin','Adria123!'),adriaRuns=await request('/api/etl/runs',{headers:{cookie:adria.cookie}});assert.ok(adriaRuns.body.every(item=>item.tenantId==='tenant-adria'));
});

test('data quality dashboard scores dimensions and tracks ETL quality snapshots',async()=>{
  const agent=await login('agent','Agent123!'),denied=await request('/api/analytics/data-quality',{headers:{cookie:agent.cookie}});assert.equal(denied.response.status,403);
  const analyst=await login('analyst','Analyst123!'),before=await request('/api/analytics/data-quality',{headers:{cookie:analyst.cookie}});assert.equal(before.response.status,200);assert.ok(before.body.overallScore>=0&&before.body.overallScore<=100);assert.deepEqual(before.body.dimensions.map(item=>item.key),['completeness','validity','uniqueness','referentialIntegrity','freshness']);assert.equal(before.body.dimensions.find(item=>item.key==='completeness').target,98);assert.equal(before.body.dimensions.find(item=>item.key==='uniqueness').target,100);assert.equal(before.body.issueDistribution.reduce((sum,item)=>sum+item.count,0),before.body.issueCount);assert.equal(before.body.orphanCount,0);
  const run=await request('/api/etl/runs',{method:'POST',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:'{}'});assert.equal(run.response.status,201);assert.ok(run.body.qualitySnapshot);assert.equal(run.body.qualitySnapshot.overallScore,before.body.overallScore);
  const after=await request('/api/analytics/data-quality',{headers:{cookie:analyst.cookie}});assert.equal(after.body.lastSuccessfulEtl,run.body.completedAt);assert.equal(after.body.trend.at(-1).runId,run.body.id);assert.equal(after.body.trend.at(-1).overallScore,run.body.qualitySnapshot.overallScore);
  const adria=await login('adria-admin','Adria123!'),adriaQuality=await request('/api/analytics/data-quality',{headers:{cookie:adria.cookie}});assert.equal(adriaQuality.response.status,200);assert.ok(adriaQuality.body.recordCounts.policies<after.body.recordCounts.policies);assert.ok(adriaQuality.body.trend.every(item=>item.runId!==run.body.id));
});

test('insurance KPI dashboard calculates currency-safe premium and claim metrics',async()=>{
  const agent=await login('agent','Agent123!'),created=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'KPI',surname:'Metric',age:38,insuranceType:'DZO',insurer:'Uniqa',saleDate:'2026-09-05'},{premium:1000,currency:'EUR',paymentStatus:'Neplaćeno'}))});assert.equal(created.response.status,201);
  const payment=await request('/api/payments',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({clientId:created.body.id,paymentDate:'2026-09-06',amount:400,method:'Kartica',reference:'KPI-EUR-400'})});assert.equal(payment.response.status,201);
  const claim=await request('/api/claims',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({clientId:created.body.id,incidentDate:'2026-09-06',estimatedAmount:250,currency:'EUR',description:'KPI test claim with a valid description.'})});assert.equal(claim.response.status,201);
  const result=await request('/api/analytics/kpis',{headers:{cookie:agent.cookie}});assert.equal(result.response.status,200);const eur=result.body.byCurrency.find(item=>item.currency==='EUR');assert.deepEqual(eur,{currency:'EUR',policyCount:1,writtenPremium:1000,collectedPremium:400,outstandingPremium:600,collectionRate:40,claimCount:1,claimFrequency:100,claimSeverity:250,claimExposure:250,estimatedLossRatio:25,averagePremium:1000,cancellationRate:0});const trend=result.body.monthlyTrend.find(item=>item.currency==='EUR').points.find(item=>item.month==='2026-09');assert.deepEqual(trend,{month:'2026-09',policyCount:1,writtenPremium:1000,collectedPremium:400});const insurer=result.body.insurerPerformance.find(item=>item.currency==='EUR'&&item.insurer==='Uniqa');assert.equal(insurer.collectionRate,40);assert.equal(insurer.estimatedLossRatio,25);assert.match(result.body.definitions.estimatedLossRatio,/not an incurred-loss accounting ratio/);
  const adria=await login('adria-admin','Adria123!'),adriaKpis=await request('/api/analytics/kpis',{headers:{cookie:adria.cookie}});assert.ok(!adriaKpis.body.byCurrency.some(item=>item.currency==='EUR'));
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

test('claims are policy-linked, tenant-isolated, and keep status history',async()=>{
  const agent=await login('agent','Agent123!');
  const policy=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Claim',surname:'Owner',age:40,insuranceType:'Privatna svojina',insurer:'Sava',saleDate:'2026-09-01'},{insuredSubject:'Porodična kuća'}))});
  assert.equal(policy.response.status,201);
  const outsidePeriod=await request('/api/claims',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({clientId:policy.body.id,incidentDate:'2026-08-31',estimatedAmount:50000,currency:'RSD',description:'Oštećenje nastalo pre početka polise.'})});
  assert.equal(outsidePeriod.response.status,400);assert.match(outsidePeriod.body.message,/perioda važenja/);
  const created=await request('/api/claims',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({clientId:policy.body.id,incidentDate:'2026-09-05',estimatedAmount:185000,currency:'RSD',description:'Oštećenje krova usled jakog nevremena.'})});
  assert.equal(created.response.status,201);assert.match(created.body.claimNumber,/^CLM-\d{8}-KOTVA-[A-Z0-9]{6}$/);assert.equal(created.body.policyNumber,policy.body.policyNumber);assert.equal(created.body.status,'Prijavljena');assert.equal(created.body.history[0].action,'created');
  const analyst=await login('analyst','Analyst123!'),denied=await request(`/api/claims/${created.body.id}/status`,{method:'PATCH',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:JSON.stringify({status:'U obradi'})});
  assert.equal(denied.response.status,403);
  const updated=await request(`/api/claims/${created.body.id}/status`,{method:'PATCH',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({status:'Odobrena'})});
  assert.equal(updated.response.status,200);assert.equal(updated.body.status,'Odobrena');assert.equal(updated.body.history.at(-1).previousStatus,'Prijavljena');assert.equal(updated.body.history.at(-1).performedBy.username,'agent');
  const adria=await login('adria-admin','Adria123!'),crossTenant=await request(`/api/claims/${created.body.id}/status`,{method:'PATCH',headers:{cookie:adria.cookie,'content-type':'application/json'},body:JSON.stringify({status:'Odbijena'})});
  assert.equal(crossTenant.response.status,404);
  const listed=await request('/api/claims',{headers:{cookie:agent.cookie}});assert.ok(listed.body.some(claim=>claim.id===created.body.id));
});

test('premium payments prevent duplicates and overpayment while updating policy status',async()=>{
  const agent=await login('agent','Agent123!'),policy=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Payment',surname:'Owner',age:36,insuranceType:'DZO',insurer:'Uniqa',saleDate:'2026-09-01'},{premium:1000,paymentStatus:'Neplaćeno',insuredSubject:'Dodatno zdravstveno osiguranje'}))});
  assert.equal(policy.response.status,201);
  const firstPayload={clientId:policy.body.id,paymentDate:'2026-09-06',amount:400,method:'Kartica',reference:'PAYMENT-TEST-001'},first=await request('/api/payments',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(firstPayload)});
  assert.equal(first.response.status,201);assert.match(first.body.receiptNumber,/^PAY-\d{8}-KOTVA-[A-Z0-9]{6}$/);assert.equal(first.body.totalPaid,400);assert.equal(first.body.remaining,600);assert.equal(first.body.paymentStatus,'Delimično plaćeno');assert.equal(first.body.recordedBy.username,'agent');
  const duplicate=await request('/api/payments',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(firstPayload)});assert.equal(duplicate.response.status,409);
  const overpayment=await request('/api/payments',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({...firstPayload,amount:601,reference:'PAYMENT-TEST-002'})});assert.equal(overpayment.response.status,400);assert.match(overpayment.body.message,/preostali dug/);
  const finalPayment=await request('/api/payments',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({...firstPayload,amount:600,method:'Bankovni transfer',reference:'PAYMENT-TEST-003'})});assert.equal(finalPayment.response.status,201);assert.equal(finalPayment.body.remaining,0);assert.equal(finalPayment.body.paymentStatus,'Plaćeno');
  const clients=await request('/api/clients',{headers:{cookie:agent.cookie}}),updatedPolicy=clients.body.find(client=>client.id===policy.body.id);assert.equal(updatedPolicy.paymentStatus,'Plaćeno');assert.equal(updatedPolicy.policyHistory.at(-1).action,'payment_recorded');
  const analyst=await login('analyst','Analyst123!'),denied=await request('/api/payments',{method:'POST',headers:{cookie:analyst.cookie,'content-type':'application/json'},body:JSON.stringify(firstPayload)});assert.equal(denied.response.status,403);
  const adria=await login('adria-admin','Adria123!'),adriaPayments=await request('/api/payments',{headers:{cookie:adria.cookie}});assert.ok(adriaPayments.body.every(payment=>payment.tenantId==='tenant-adria'));
});

test('notification center creates tenant-safe user-dismissible operational alerts',async()=>{
  const today=new Date().toISOString().slice(0,10),expiryDate=new Date(`${today}T00:00:00Z`);expiryDate.setUTCDate(expiryDate.getUTCDate()+7);const validUntil=expiryDate.toISOString().slice(0,10),agent=await login('agent','Agent123!');
  const policy=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Reminder',surname:'Customer',age:43,insuranceType:'DZO',insurer:'Uniqa',saleDate:today},{validUntil,premium:2500,paymentStatus:'Neplaćeno',insuredSubject:'Polisa za test podsetnika'}))});assert.equal(policy.response.status,201);
  const result=await request('/api/notifications',{headers:{cookie:agent.cookie}});assert.equal(result.response.status,200);const expiry=result.body.find(item=>item.key===`policy-expiring:${policy.body.id}`),payment=result.body.find(item=>item.key===`payment-due:${policy.body.id}`);assert.ok(expiry);assert.equal(expiry.severity,'high');assert.ok(payment);
  const dismissed=await request(`/api/notifications/${encodeURIComponent(expiry.key)}/dismiss`,{method:'POST',headers:{cookie:agent.cookie}});assert.equal(dismissed.response.status,204);
  const afterDismiss=await request('/api/notifications',{headers:{cookie:agent.cookie}});assert.ok(!afterDismiss.body.some(item=>item.key===expiry.key));assert.ok(afterDismiss.body.some(item=>item.key===payment.key));
  const analyst=await login('analyst','Analyst123!'),analystNotifications=await request('/api/notifications',{headers:{cookie:analyst.cookie}});assert.ok(analystNotifications.body.some(item=>item.key===expiry.key));
  const adria=await login('adria-admin','Adria123!'),crossTenant=await request(`/api/notifications/${encodeURIComponent(payment.key)}/dismiss`,{method:'POST',headers:{cookie:adria.cookie}});assert.equal(crossTenant.response.status,404);
});

test('policy documents enforce file rules and tenant-protected downloads',async()=>{
  const agent=await login('agent','Agent123!'),policy=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify(withPolicy({name:'Document',surname:'Owner',age:38,insuranceType:'DZO',insurer:'Uniqa',saleDate:'2026-09-01'},{insuredSubject:'Polisa sa dokumentacijom'}))});assert.equal(policy.response.status,201);
  const form=new FormData();form.append('document',new Blob(['%PDF-1.4\nKotva test document'],{type:'application/pdf'}),'ugovor-polise.pdf');const uploaded=await request(`/api/clients/${policy.body.id}/documents`,{method:'POST',headers:{cookie:agent.cookie},body:form});assert.equal(uploaded.response.status,201);assert.equal(uploaded.body.originalName,'ugovor-polise.pdf');assert.equal(uploaded.body.mimeType,'application/pdf');assert.equal(uploaded.body.policyNumber,policy.body.policyNumber);assert.equal(uploaded.body.uploadedBy.username,'agent');assert.equal(uploaded.body.storageName,undefined);
  const listed=await request('/api/documents',{headers:{cookie:agent.cookie}}),document=listed.body.find(item=>item.id===uploaded.body.id);assert.ok(document);assert.equal(document.storageName,undefined);
  const download=await fetch(`${baseUrl}/api/documents/${uploaded.body.id}/download`,{headers:{cookie:agent.cookie}});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.match(await download.text(),/^%PDF-1.4/);
  const invalidForm=new FormData();invalidForm.append('document',new Blob(['not allowed'],{type:'text/plain'}),'notes.txt');const invalid=await request(`/api/clients/${policy.body.id}/documents`,{method:'POST',headers:{cookie:agent.cookie},body:invalidForm});assert.equal(invalid.response.status,400);assert.match(invalid.body.message,/PDF, JPG i PNG/);
  const analyst=await login('analyst','Analyst123!'),deniedForm=new FormData();deniedForm.append('document',new Blob(['%PDF'],{type:'application/pdf'}),'denied.pdf');const denied=await request(`/api/clients/${policy.body.id}/documents`,{method:'POST',headers:{cookie:analyst.cookie},body:deniedForm});assert.equal(denied.response.status,403);
  const adria=await login('adria-admin','Adria123!'),crossTenant=await fetch(`${baseUrl}/api/documents/${uploaded.body.id}/download`,{headers:{cookie:adria.cookie}});assert.equal(crossTenant.status,404);
});

test('business audit is append-only, filterable, admin-only, and tenant-isolated',async()=>{
  const admin=await login('admin','Admin123!'),audit=await request('/api/audit?limit=200',{headers:{cookie:admin.cookie}});assert.equal(audit.response.status,200);assert.ok(audit.body.length>0);for(const action of['policy.created','claim.created','claim.status_updated','payment.recorded','document.uploaded'])assert.ok(audit.body.some(event=>event.action===action),`Missing audit action ${action}`);assert.ok(audit.body.every(event=>event.tenantId==='tenant-kotva'&&event.actor?.username));
  const paymentAudit=await request('/api/audit?entityType=payment&limit=10',{headers:{cookie:admin.cookie}});assert.equal(paymentAudit.response.status,200);assert.ok(paymentAudit.body.length>0);assert.ok(paymentAudit.body.every(event=>event.entityType==='payment'));
  const serialized=JSON.stringify(audit.body);assert.ok(!serialized.includes('0303990712345'));assert.ok(!serialized.includes('PA-123456'));
  const agent=await login('agent','Agent123!'),denied=await request('/api/audit',{headers:{cookie:agent.cookie}});assert.equal(denied.response.status,403);
  const adria=await login('adria-admin','Adria123!'),adriaAudit=await request('/api/audit',{headers:{cookie:adria.cookie}});assert.equal(adriaAudit.response.status,200);assert.ok(adriaAudit.body.every(event=>event.tenantId==='tenant-adria'));assert.ok(!adriaAudit.body.some(event=>audit.body.some(kotvaEvent=>kotvaEvent.id===event.id)));
});
