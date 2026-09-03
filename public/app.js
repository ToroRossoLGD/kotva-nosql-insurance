const $=s=>document.querySelector(s),charts={},colors=['#ff6b35','#112f4a','#39a88e','#f2b84b','#7b6ee6','#e85d75'];
const chartColor=index=>colors[index]||`hsl(${(index*57)%360} 62% 53%)`;
const doughnutPercentLabels={id:'doughnutPercentLabels',afterDatasetsDraw(chart){
  const values=chart.data.datasets[0].data,total=values.reduce((sum,value)=>sum+value,0);
  if(!total)return;
  const{ctx}=chart;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.font='700 11px DM Sans';
  chart.getDatasetMeta(0).data.forEach((arc,index)=>{if(!values[index])return;const point=arc.tooltipPosition();ctx.fillText(`${(values[index]*100/total).toFixed(1)}%`,point.x,point.y)});ctx.restore();
}};
async function api(url,options){const r=await fetch(url,options),d=r.status===204?null:await r.json();if(r.status===401)showLogin();if(!r.ok)throw Error(d?.message||'Zahtev nije uspeo.');return d}
function message(s,text,error=false){const e=$(s);e.textContent=text;e.classList.toggle('error',error);setTimeout(()=>{if(e.textContent===text)e.textContent=''},3500)}
function stats(d){const a=[['Korisnici',d.totalClients,'Ukupno aktivnih polisa','↗'],['Prosečna starost',d.averageAge,'godina','◎'],['Vodeća kuća',d.topInsurer.name,`${d.topInsurer.count} osiguranika`,'◆'],['Najjači mesec',d.busiestMonth.month,`${d.busiestMonth.count} putnih polisa`,'▦'],['Putno osiguranje',`${d.travelShare}%`,'ukupnog portfolija','✦']];$('#stats-grid').innerHTML=a.map(x=>`<article class="stat"><i>${x[3]}</i><div><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div></article>`).join('')}
function make(id,type,data,options,plugins=[]){charts[id]?.destroy();charts[id]=new Chart(document.getElementById(id),{type,data,options:{responsive:true,maintainAspectRatio:false,...options},plugins})}
function draw(d){
  make('travel-chart','line',{labels:d.monthlyTravelSales.map(x=>x.month),datasets:[{data:d.monthlyTravelSales.map(x=>x.count),borderColor:colors[0],backgroundColor:'#ff6b3518',fill:true,tension:.38}]},{scales:{y:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{display:false}}});
  const insurerTotal=d.insurerDistribution.reduce((sum,item)=>sum+item.count,0);
  make('insurer-chart','doughnut',{labels:d.insurerDistribution.map(x=>x.name),datasets:[{data:d.insurerDistribution.map(x=>x.count),backgroundColor:d.insurerDistribution.map((x,index)=>chartColor(index)),borderWidth:4}]},{cutout:'60%',plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:context=>{const value=context.raw,percent=insurerTotal?value*100/insurerTotal:0;return`${context.label}: ${value} osiguranika (${percent.toFixed(1)}%)`}}}}},[doughnutPercentLabels]);
  make('avg-age-chart','bar',{labels:d.avgAgeByInsurance.map(x=>x.type),datasets:[{data:d.avgAgeByInsurance.map(x=>x.avgAge),backgroundColor:colors,borderRadius:7}]},{scales:{y:{beginAtZero:true}},plugins:{legend:{display:false}}});
  make('july-travel-chart','bar',{labels:d.julyTravelSales.map(x=>`${x.day}. jul`),datasets:[{label:'Putne polise',data:d.julyTravelSales.map(x=>x.count),backgroundColor:d.julyTravelSales.map(x=>x.count?'#ff6b35':'#e9edef'),borderRadius:5,maxBarThickness:24}]},{scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:16}}},plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items[0].label,label:context=>`${context.raw} ${context.raw===1?'polisa':'polise'}`}}}});
  make('age-policy-chart','scatter',{datasets:[{label:'Broj polisa po starosti',data:d.ageDistribution,backgroundColor:'#39a88e',borderColor:'#177f6b',pointRadius:6,pointHoverRadius:9}]},{scales:{x:{type:'linear',title:{display:true,text:'Starost korisnika (godine)'},ticks:{precision:0}},y:{beginAtZero:true,title:{display:true,text:'Broj zaključenih polisa'},ticks:{precision:0}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:context=>`${context.raw.x} godina: ${context.raw.y} polisa`}}}});
  make('type-chart','bar',{labels:d.insuranceTypes.map(x=>x.type),datasets:[{data:d.insuranceTypes.map(x=>x.count),backgroundColor:colors,borderRadius:7}]},{indexAxis:'y',scales:{x:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{display:false}}})
}
function clients(a){$('#client-count').textContent=`${a.length} korisnika`;$('#clients-body').innerHTML=[...a].reverse().slice(0,10).map(x=>`<tr><td><i class="avatar">${x.name[0]}${x.surname[0]}</i><strong>${x.name} ${x.surname}</strong></td><td>${x.age}</td><td><span class="tag">${x.insuranceType}</span></td><td>${x.insurer}</td><td>${new Date(x.saleDate+'T00:00:00').toLocaleDateString('sr-RS')}</td></tr>`).join('')}
async function refresh(){const[d,c,h]=await Promise.all([api('/api/analytics'),api('/api/clients'),api('/api/health')]);stats(d);draw(d);clients(c);$('#db-status').textContent=h.database==='arango'?'ArangoDB aktivan':'Demo režim';$('#db-name').textContent=h.database==='arango'?`Baza: ${h.databaseName}`:'Podaci u memoriji'}
async function options(){const[i,c]=await Promise.all([api('/api/insurers'),api('/api/config')]);$('#insurer-select').innerHTML=i.map(x=>`<option>${x.name}</option>`).join('');$('#type-select').innerHTML=c.insuranceTypes.map(x=>`<option>${x}</option>`).join('')}
let searchTimer;
$('#client-search').addEventListener('input',event=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(async()=>{
    try{clients(await api(`/api/search?q=${encodeURIComponent(event.target.value)}`))}
    catch(error){console.error(error)}
  },250)
});
$('#client-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();$('#sale-date').valueAsDate=new Date();message('#client-message','Korisnik je uspešno sačuvan.');await refresh()}catch(x){message('#client-message',x.message,true)}finally{b.disabled=false}});$('#insurer-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await api('/api/insurers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});e.target.reset();message('#insurer-message','Kuća je dodata.');await options();await refresh()}catch(x){message('#insurer-message',x.message,true)}finally{b.disabled=false}});document.querySelectorAll('[data-scroll]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.scroll).scrollIntoView({behavior:'smooth'}));
let currentUser=null;
function showLogin(){currentUser=null;$('#app-shell').hidden=true;$('#login-screen').hidden=false}
function applyPermissions(user){
  currentUser=user;const canWrite=['admin','agent'].includes(user.role),isAdmin=user.role==='admin';
  document.querySelectorAll('[data-write]').forEach(element=>element.hidden=!canWrite);
  document.querySelectorAll('[data-admin]').forEach(element=>element.hidden=!isAdmin);
  $('.forms').classList.toggle('single',!isAdmin);
  $('#user-name').textContent=user.displayName;$('#user-role').textContent=`${user.tenantName} · ${user.role}`;
  $('#login-screen').hidden=true;$('#app-shell').hidden=false;
}
async function loadLoginAttempts(){
  if(currentUser?.role!=='admin')return;
  const attempts=await api('/api/auth/login-attempts');
  $('#login-attempts-body').innerHTML=attempts.map(item=>`<tr><td>${new Date(item.timestamp).toLocaleString('sr-RS')}</td><td>${item.username||'—'}</td><td><span class="${item.successful?'status-success':'status-failed'}">${item.successful?'Uspešno':'Neuspešno'}</span></td><td>${item.ip||'—'}</td></tr>`).join('')||'<tr><td colspan="4">Nema evidentiranih pokušaja.</td></tr>';
}
async function enterApplication(user){applyPermissions(user);$('#sale-date').valueAsDate=new Date();await Promise.all([options(),refresh(),loadLoginAttempts()])}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;$('#login-message').textContent='';
  try{const result=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});event.target.reset();await enterApplication(result.user)}
  catch(error){$('#login-message').textContent=error.message}
  finally{button.disabled=false}
});
$('#logout-button').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'})}finally{showLogin()}});
async function bootstrap(){
  try{const response=await fetch('/api/auth/me');if(!response.ok)return showLogin();const result=await response.json();await enterApplication(result.user)}catch(error){showLogin()}
}
bootstrap();
