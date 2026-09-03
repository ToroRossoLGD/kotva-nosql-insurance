const express=require('express');const path=require('path');const cors=require('cors');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const{Database,aql}=require('arangojs');require('dotenv').config();
const app=express(),PORT=+process.env.PORT||3000,DB_NAME=process.env.ARANGO_DB||'kotva';
const JWT_SECRET=process.env.JWT_SECRET||'kotva-local-demo-secret-change-before-production';
const TOKEN_TTL_SECONDS=8*60*60;
const DEMO_USERS=[
  {id:'user-admin',username:'admin',displayName:'Kotva Administrator',role:'admin',password:process.env.ADMIN_PASSWORD||'Admin123!'},
  {id:'user-agent',username:'agent',displayName:'Insurance Agent',role:'agent',password:process.env.AGENT_PASSWORD||'Agent123!'},
  {id:'user-analyst',username:'analyst',displayName:'Portfolio Analyst',role:'analyst',password:process.env.ANALYST_PASSWORD||'Analyst123!'}
];
const TYPES=['Putno','Životno','Auto','Privatna svojina'],MONTHS=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Avg','Sep','Okt','Nov','Dec'];
const INSURERS=['Uniqa','Generali','Milenijum','Sava'].map((name,i)=>({id:`kuca-${i+1}`,name}));
const CLIENTS=[['Ana','Marković',29,'Putno','Uniqa','2026-01-15'],['Nemanja','Petrović',41,'Životno','Generali','2026-01-18'],['Milica','Jovanović',34,'Auto','Milenijum','2026-02-09'],['Stefan','Đurić',52,'Privatna svojina','Sava','2026-02-12'],['Jovana','Nikolić',27,'Putno','Uniqa','2026-03-15'],['Viktor','Bojić',46,'Životno','Generali','2026-03-21'],['Sara','Pavlović',31,'Putno','Sava','2026-04-04'],['Luka','Mihajlović',39,'Auto','Milenijum','2026-04-20'],['Marija','Stojanović',48,'Privatna svojina','Sava','2026-05-09'],['Petar','Milošević',36,'Putno','Generali','2026-05-24'],['Ivana','Kostić',44,'Auto','Uniqa','2026-06-11'],['Marko','Lukić',51,'Životno','Sava','2026-06-19'],['Teodora','Ilić',28,'Putno','Milenijum','2026-07-13'],['Nikola','Perić',42,'Privatna svojina','Generali','2026-08-02'],['Katarina','Savić',33,'Auto','Uniqa','2026-09-17']].map(([name,surname,age,insuranceType,insurer,saleDate],i)=>({id:`korisnik-${i+1}`,name,surname,age,insuranceType,insurer,saleDate}));
const TRAVEL_TARGETS=[6,5,4,3,2,6,7,6,4,3,2,8];
const FIRST_NAMES=['Aleksa','Anđela','Bojan','Danica','Filip','Gorana','Igor','Jelena','Kristina','Milan','Nataša','Ognjen','Sofija','Uroš','Vanja'];
const LAST_NAMES=['Arsić','Babić','Cvetković','Dabić','Eraković','Gajić','Horvat','Isaković','Jakšić','Knežević','Lazić','Matić','Novaković','Obradović','Popović'];
TRAVEL_TARGETS.forEach((target,monthIndex)=>{
  const existing=CLIENTS.filter(client=>client.insuranceType==='Putno'&&Number(client.saleDate.slice(5,7))===monthIndex+1).length;
  for(let index=existing;index<target;index++){
    const sequence=monthIndex*8+index;
    CLIENTS.push({
      id:`putno-2026-${String(monthIndex+1).padStart(2,'0')}-${index+1}`,
      name:FIRST_NAMES[sequence%FIRST_NAMES.length],surname:LAST_NAMES[(sequence*3)%LAST_NAMES.length],
      age:22+(sequence*7)%39,insuranceType:'Putno',insurer:INSURERS[sequence%INSURERS.length].name,
      saleDate:`2026-${String(monthIndex+1).padStart(2,'0')}-${String(5+(index*3)%23).padStart(2,'0')}`
    });
  }
});
[
  ['Maja','Ristić',26,'Uniqa'],['Dušan','Vasić',38,'Generali'],
  ['Tamara','Živković',31,'Milenijum'],['Vuk','Radovanović',45,'Sava']
].forEach(([name,surname,age,insurer],index)=>CLIENTS.push({
  id:`putno-jul-17-dodatni-${index+1}`,name,surname,age,insuranceType:'Putno',insurer,saleDate:'2026-07-17'
}));
[
  ['Nevena','Todorović',29,'Uniqa','2026-02-14'],['Miloš','Stevanović',35,'Generali','2026-03-22'],
  ['Andrea','Radosavljević',42,'Milenijum','2026-04-18'],['Pavle','Simić',51,'Sava','2026-05-27'],
  ['Isidora','Mladenović',33,'Uniqa','2026-07-06'],['Veljko','Janković',47,'Generali','2026-08-19'],
  ['Lena','Grujić',24,'Milenijum','2026-10-11'],['Strahinja','Đorđević',39,'Sava','2026-12-03']
].forEach(([name,surname,age,insurer,saleDate],index)=>CLIENTS.push({
  id:`auto-dodatni-${index+1}`,name,surname,age,insuranceType:'Auto',insurer,saleDate
}));
let memoryInsurers=[...INSURERS],memoryClients=[...CLIENTS],memoryUsers=[],memoryLoginAttempts=[],db,mode='memory';const clean=({_key,_id,_rev,...x})=>x,id=p=>`${p}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
async function initializeAuthUsers(){
  memoryUsers=await Promise.all(DEMO_USERS.map(async({password,...user})=>({...user,passwordHash:await bcrypt.hash(password,12),active:true})));
}
async function init(){
  await initializeAuthUsers();
  if(process.env.USE_ARANGO!=='true')return;
  try{
    const connection={url:process.env.ARANGO_URL||'http://127.0.0.1:8529',auth:{username:process.env.ARANGO_USER||'root',password:process.env.ARANGO_PASSWORD||'kotva123'}};
    const system=new Database({...connection,databaseName:'_system'});
    if(!(await system.listDatabases()).includes(DB_NAME))await system.createDatabase(DB_NAME);
    db=new Database({...connection,databaseName:DB_NAME});
    for(const name of['clients','insurers','users','login_attempts']){const col=db.collection(name);if(!(await col.exists()))await col.create()}
    const insurerCollection=db.collection('insurers'),clientCollection=db.collection('clients');
    await clientCollection.ensureIndex({
      type:'persistent',name:'idx_insurance_type_sale_date',
      fields:['insuranceType','saleDate'],unique:false,sparse:false
    });
    const graph=db.graph('kotva_insurance_graph');
    if(!(await graph.exists()))await graph.create([
      {collection:'owns',from:['clients'],to:['policies']},
      {collection:'issued_by',from:['policies'],to:['insurers']}
    ]);
    const nameAnalyzer=db.analyzer('sr_name_search');
    if(!(await nameAnalyzer.exists()))await db.createAnalyzer('sr_name_search',{
      type:'norm',properties:{locale:'sr',case:'lower',accent:false},features:[]
    });
    await clientCollection.ensureIndex({
      type:'inverted',name:'idx_client_name_search',
      fields:[{name:'name',analyzer:'sr_name_search'},{name:'surname',analyzer:'sr_name_search'}]
    });
    const searchView=db.view('client_search');
    if(!(await searchView.exists()))await db.createView('client_search',{
      type:'search-alias',indexes:[{collection:'clients',index:'idx_client_name_search'}]
    });
    const insurerCursor=await db.query(aql`FOR doc IN ${insurerCollection} RETURN doc._key`);
    const clientCursor=await db.query(aql`FOR doc IN ${clientCollection} RETURN doc._key`);
    const insurerKeys=new Set(await insurerCursor.all());
    const clientKeys=new Set(await clientCursor.all());
    const missingInsurers=INSURERS.filter(item=>!insurerKeys.has(item.id)).map(item=>({...item,_key:item.id}));
    const missingClients=CLIENTS.filter(item=>!clientKeys.has(item.id)).map(item=>({...item,_key:item.id}));
    if(missingInsurers.length)await insurerCollection.saveAll(missingInsurers);
    if(missingClients.length)await clientCollection.saveAll(missingClients);
    for(const user of memoryUsers){
      const userDocument={...user,_key:user.id};
      await db.query(aql`UPSERT {_key:${user.id}} INSERT ${userDocument} UPDATE ${user} IN users`);
    }
    mode='arango';
    await syncInsuranceGraph();
    console.log(`ArangoDB baza "${DB_NAME}" je aktivna. Dodato demo korisnika: ${missingClients.length}.`)
  }catch(e){console.warn(`ArangoDB nije dostupan (${e.message}). Koristi se memorija.`)}
}
async function syncInsuranceGraph(){
  if(mode!=='arango'||!db)return;
  await db.query(aql`
    FOR client IN clients
      LET policyKey=CONCAT("polisa-",client.id)
      LET basePremium=client.insuranceType=="Putno"?3500:client.insuranceType=="Životno"?12000:client.insuranceType=="Auto"?18000:9000
      LET policy={_key:policyKey,clientId:client.id,insuranceType:client.insuranceType,saleDate:client.saleDate,validFrom:client.saleDate,validUntil:DATE_ADD(client.saleDate,1,"year"),premium:basePremium+client.age*25,status:"Aktivna"}
      UPSERT {_key:policyKey} INSERT policy UPDATE policy IN policies
  `);
  await db.query(aql`
    FOR client IN clients
      LET edgeKey=CONCAT("poseduje-",client.id)
      LET edge={_key:edgeKey,_from:client._id,_to:CONCAT("policies/polisa-",client.id)}
      UPSERT {_key:edgeKey} INSERT edge UPDATE edge IN owns
  `);
  await db.query(aql`
    FOR client IN clients
      LET insurer=FIRST(FOR item IN insurers FILTER item.name==client.insurer LIMIT 1 RETURN item)
      FILTER insurer!=null
      LET edgeKey=CONCAT("izdata-",client.id)
      LET edge={_key:edgeKey,_from:CONCAT("policies/polisa-",client.id),_to:insurer._id}
      UPSERT {_key:edgeKey} INSERT edge UPDATE edge IN issued_by
  `);
}
async function all(collection,fallback){if(mode!=='arango')return[...fallback];const cursor=await db.query(aql`FOR doc IN ${db.collection(collection)} SORT doc._key RETURN doc`);return(await cursor.all()).map(clean)}
async function save(collection,item,fallback){const record={...item,id:item.id||id(collection==='clients'?'korisnik':'kuca')};if(mode==='arango')await db.collection(collection).save({...record,_key:record.id});else fallback.push(record);return record}
function analytics(clients,insurers){
  const count=(key,value)=>clients.filter(client=>client[key]===value).length;
  const insurerDistribution=insurers.map(({name})=>({name,count:count('insurer',name)})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  const avgAgeByInsurance=TYPES.map(type=>{const group=clients.filter(client=>client.insuranceType===type);return{type,avgAge:group.length?+(group.reduce((sum,client)=>sum+client.age,0)/group.length).toFixed(1):0}});
  const monthlyTravelSales=MONTHS.map(month=>({month,count:0}));
  const julyTravelSales=Array.from({length:31},(_,index)=>({day:index+1,count:0}));
  clients.filter(client=>client.insuranceType==='Putno').forEach(client=>{
    const month=Number(client.saleDate?.slice(5,7))-1;
    if(month>=0&&month<12)monthlyTravelSales[month].count++;
    if(month===6){const day=Number(client.saleDate?.slice(8,10));if(day>=1&&day<=31)julyTravelSales[day-1].count++}
  });
  const topInsurer=insurerDistribution[0]||{name:'Nema podataka',count:0};
  const busiestMonth=monthlyTravelSales.reduce((best,current)=>current.count>best.count?current:best);
  const ageDistribution=[...clients.reduce((ages,client)=>ages.set(client.age,(ages.get(client.age)||0)+1),new Map())]
    .map(([age,count])=>({x:age,y:count})).sort((a,b)=>a.x-b.x);
  return{totalClients:clients.length,averageAge:clients.length?+(clients.reduce((sum,client)=>sum+client.age,0)/clients.length).toFixed(1):0,topInsurer,busiestMonth,travelShare:clients.length?+(count('insuranceType','Putno')*100/clients.length).toFixed(1):0,insurerDistribution,avgAgeByInsurance,monthlyTravelSales,julyTravelSales,ageDistribution,insuranceTypes:TYPES.map(type=>({type,count:count('insuranceType',type)}))}
}
function cookieValue(req,name){
  const cookies=String(req.headers.cookie||'').split(';').map(value=>value.trim());
  const match=cookies.find(value=>value.startsWith(`${name}=`));
  return match?decodeURIComponent(match.slice(name.length+1)):'';
}
function publicUser(user){return{id:user.id,username:user.username,displayName:user.displayName,role:user.role}}
async function findUser(username){
  const normalized=String(username||'').trim().toLowerCase();
  if(mode!=='arango')return memoryUsers.find(user=>user.username===normalized);
  const cursor=await db.query(aql`FOR user IN users FILTER user.username==${normalized} LIMIT 1 RETURN user`);
  return(await cursor.next())||null;
}
async function recordLoginAttempt(req,username,successful,reason){
  const attempt={id:id('login'),username:String(username||'').trim().toLowerCase(),successful,reason,timestamp:new Date().toISOString(),ip:req.ip,userAgent:String(req.headers['user-agent']||'').slice(0,300)};
  if(mode==='arango')await db.collection('login_attempts').save({...attempt,_key:attempt.id});else memoryLoginAttempts.push(attempt);
}
async function recentFailedAttempts(username){
  const since=new Date(Date.now()-15*60*1000).toISOString();
  if(mode!=='arango')return memoryLoginAttempts.filter(item=>item.username===username&&!item.successful&&item.timestamp>=since).length;
  const cursor=await db.query(aql`FOR attempt IN login_attempts FILTER attempt.username==${username} AND attempt.successful==false AND attempt.timestamp>=${since} COLLECT WITH COUNT INTO total RETURN total`);
  return(await cursor.next())||0;
}
function authenticate(req,res,next){
  const bearer=String(req.headers.authorization||'').startsWith('Bearer ')?String(req.headers.authorization).slice(7):'';
  const token=cookieValue(req,'kotva_session')||bearer;
  if(!token)return res.status(401).json({message:'Authentication is required.'});
  try{req.user=jwt.verify(token,JWT_SECRET);next()}catch(error){return res.status(401).json({message:'Your session has expired. Please sign in again.'})}
}
const authorize=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({message:'You do not have permission to perform this action.'});
app.use(cors());app.use(express.json({limit:'50kb'}));app.use(express.static(path.join(__dirname,'public')));
app.get('/api/health',(q,r)=>r.json({status:'ok',database:mode,databaseName:DB_NAME}));
app.post('/api/auth/login',async(req,res,next)=>{try{
  const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(!username||!password)return res.status(400).json({message:'Username and password are required.'});
  if(await recentFailedAttempts(username)>=5){await recordLoginAttempt(req,username,false,'locked');return res.status(429).json({message:'Too many failed attempts. Try again in 15 minutes.'})}
  const user=await findUser(username);
  if(!user||!user.active||!(await bcrypt.compare(password,user.passwordHash))){await recordLoginAttempt(req,username,false,'invalid_credentials');return res.status(401).json({message:'Invalid username or password.'})}
  await recordLoginAttempt(req,username,true,'success');
  const sessionUser=publicUser(user),token=jwt.sign(sessionUser,JWT_SECRET,{expiresIn:TOKEN_TTL_SECONDS,issuer:'kotva'});
  res.cookie('kotva_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:TOKEN_TTL_SECONDS*1000,path:'/'});
  res.json({user:sessionUser});
}catch(error){next(error)}});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('kotva_session',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/'});res.status(204).end()});
app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
app.use('/api',authenticate);
app.get('/api/auth/login-attempts',authorize('admin'),async(req,res,next)=>{try{
  if(mode!=='arango')return res.json([...memoryLoginAttempts].reverse().slice(0,100));
  const cursor=await db.query(aql`FOR attempt IN login_attempts SORT attempt.timestamp DESC LIMIT 100 RETURN UNSET(attempt,"_key","_id","_rev")`);res.json(await cursor.all());
}catch(error){next(error)}});
app.get('/api/config',(q,r)=>r.json({insuranceTypes:TYPES}));app.get('/api/clients',async(q,r,n)=>{try{r.json(await all('clients',memoryClients))}catch(e){n(e)}});app.get('/api/insurers',async(q,r,n)=>{try{r.json(await all('insurers',memoryInsurers))}catch(e){n(e)}});
app.post('/api/insurers',authorize('admin'),async(q,r,n)=>{try{const name=String(q.body.name||'').trim();if(name.length<2||name.length>80)return r.status(400).json({message:'Naziv mora imati od 2 do 80 znakova.'});const current=await all('insurers',memoryInsurers);if(current.some(x=>x.name.localeCompare(name,'sr',{sensitivity:'base'})===0))return r.status(409).json({message:'Ta osiguravajuća kuća već postoji.'});r.status(201).json(await save('insurers',{name},memoryInsurers))}catch(e){n(e)}});
app.post('/api/clients',authorize('admin','agent'),async(q,r,n)=>{try{
  const x={name:String(q.body.name||'').trim(),surname:String(q.body.surname||'').trim(),age:+q.body.age,insuranceType:String(q.body.insuranceType||''),insurer:String(q.body.insurer||'').trim(),saleDate:String(q.body.saleDate||'')};
  if(!x.name||!x.surname)return r.status(400).json({message:'Ime i prezime su obavezni.'});
  if(!Number.isInteger(x.age)||x.age<0||x.age>120)return r.status(400).json({message:'Godine moraju biti ceo broj od 0 do 120.'});
  if(!TYPES.includes(x.insuranceType))return r.status(400).json({message:'Izaberite važeći tip osiguranja.'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(x.saleDate))return r.status(400).json({message:'Datum prodaje nije ispravan.'});
  if(!(await all('insurers',memoryInsurers)).some(i=>i.name===x.insurer))return r.status(400).json({message:'Izaberite postojeću osiguravajuću kuću.'});
  const client=await save('clients',x,memoryClients);await syncInsuranceGraph();r.status(201).json(client)
}catch(e){n(e)}});
app.get('/api/search',async(q,r,n)=>{try{
  const term=String(q.query.q||'').trim();
  if(!term)return r.json(await all('clients',memoryClients));
  if(mode!=='arango')return r.json(memoryClients.filter(client=>`${client.name} ${client.surname}`.toLocaleLowerCase('sr').includes(term.toLocaleLowerCase('sr'))));
  const cursor=await db.query(aql`
    LET normalized=FIRST(TOKENS(${term},"sr_name_search"))
    FOR client IN ${db.view('client_search')}
      SEARCH ANALYZER(STARTS_WITH(client.name,normalized) OR STARTS_WITH(client.surname,normalized),"sr_name_search")
      SORT client.surname,client.name
      RETURN UNSET(client,"_key","_id","_rev")
  `);
  r.json(await cursor.all())
}catch(e){n(e)}});
app.get('/api/analytics',async(q,r,n)=>{try{r.json(analytics(await all('clients',memoryClients),await all('insurers',memoryInsurers)))}catch(e){n(e)}});app.use('/api',(q,r)=>r.status(404).json({message:'API ruta nije pronađena.'}));app.use((e,q,r,n)=>{console.error(e);r.status(500).json({message:'Greška na serveru.'})});app.use((q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
async function start(port=PORT){await init();return app.listen(port,()=>console.log(`Kotva: http://localhost:${port}`))}
if(require.main===module)start();
module.exports={app,start};
