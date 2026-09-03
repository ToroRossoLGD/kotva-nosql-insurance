const test=require('node:test');
const assert=require('node:assert/strict');

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
  const client=await request('/api/clients',{method:'POST',headers:{cookie:agent.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Test',surname:'Agent',age:30,insuranceType:'Auto',insurer:'Uniqa',saleDate:'2026-09-01'})});
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
  const newClient=await request('/api/clients',{method:'POST',headers:{cookie:adria.cookie,'content-type':'application/json'},body:JSON.stringify({name:'Tenant',surname:'Isolation',age:37,insuranceType:'Auto',insurer:'Adria Exclusive',saleDate:'2026-09-02'})});
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
