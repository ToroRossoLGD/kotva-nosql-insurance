const{chromium}=require('@playwright/test');
const{spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..'),port=3210,baseUrl=`http://127.0.0.1:${port}`,output=path.join(root,'docs','assets');
const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),USE_ARANGO:'false',JWT_SECRET:'readme-screenshot-secret'},stdio:'inherit'});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForServer(){for(let attempt=0;attempt<150;attempt++){try{if((await fetch(`${baseUrl}/api/health`)).ok)return}catch{}await wait(100)}throw Error('Screenshot server did not start')}
async function main(){
  await waitForServer();fs.mkdirSync(output,{recursive:true});const localChrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',browser=await chromium.launch(fs.existsSync(localChrome)?{executablePath:localChrome}:{}),page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:'window.Chart=class{constructor(canvas,options){this.canvas=canvas;const context=canvas.getContext("2d"),values=options.data.datasets.flatMap(dataset=>dataset.data).map(value=>typeof value==="number"?value:value?.y||0),maximum=Math.max(...values,1);canvas.width=canvas.clientWidth*2;canvas.height=canvas.clientHeight*2;context.scale(2,2);context.fillStyle="#f8fafb";context.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);values.slice(0,18).forEach((value,index)=>{const width=Math.max(8,(canvas.clientWidth-40)/Math.min(values.length,18)-8),height=(canvas.clientHeight-50)*value/maximum;context.fillStyle=["#ff6b35","#39a88e","#112f4a","#f2b84b"][index%4];context.fillRect(25+index*(width+8),canvas.clientHeight-25-height,width,height)});}destroy(){}}'}));
  await page.goto(`${baseUrl}/app.html`);await page.locator('#login-form [name="username"]').fill('analyst');await page.locator('#login-form [name="password"]').fill('Analyst123!');await page.locator('#login-form button').click();await page.locator('#app-shell').waitFor({state:'visible'});await page.locator('#clients-body .policy-detail-link').first().waitFor();
  const detailLink=page.locator('#clients-body tr').filter({hasText:'Putno'}).first().locator('.policy-detail-link');await detailLink.waitFor();await detailLink.click();await page.locator('#policy-content').waitFor({state:'visible'});await wait(400);await page.screenshot({path:path.join(output,'policy-360.png')});
  await browser.close();
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{if(server.exitCode===null)server.kill('SIGTERM')});
