const test=require('node:test');
const assert=require('node:assert/strict');
const{spawn}=require('node:child_process');
const path=require('node:path');

const port=3199,baseUrl=`http://127.0.0.1:${port}`;let child;
async function waitForServer(){for(let attempt=0;attempt<50;attempt++){try{if((await fetch(`${baseUrl}/api/health`)).ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw new Error('Public demo test server did not start')}
async function json(pathname,options={}){const response=await fetch(`${baseUrl}${pathname}`,options);return{response,body:await response.json()}}

test.before(async()=>{
  child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),USE_ARANGO:'false',PUBLIC_DEMO:'true',JWT_SECRET:'demo-mode-test-secret',ANALYST_PASSWORD:'PublicDemo123!',LOGIN_RATE_LIMIT:'50'},stdio:'ignore'});
  await waitForServer();
});
test.after(()=>new Promise(resolve=>{if(!child||child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill('SIGTERM');setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL')},3000).unref()}));

test('public demo exposes only analyst credentials and blocks analytical mutations',async()=>{
  const config=await json('/api/public-config');assert.deepEqual(config.body,{publicDemo:true,credentials:{username:'analyst',password:'PublicDemo123!'}});
  const login=await json('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'analyst',password:'PublicDemo123!'})});assert.equal(login.response.status,200);assert.equal(login.body.user.demoReadOnly,true);
  const cookie=login.response.headers.get('set-cookie').split(';')[0],headers={cookie};
  assert.equal((await json('/api/analytics',{headers})).response.status,200);
  const etl=await json('/api/etl/runs',{method:'POST',headers});assert.equal(etl.response.status,403);assert.match(etl.body.message,/read-only/i);
  const warehouse=await json('/api/warehouse/load',{method:'POST',headers});assert.equal(warehouse.response.status,403);assert.match(warehouse.body.message,/read-only/i);
});
