const express=require('express');const path=require('path');const fs=require('fs');const crypto=require('crypto');const cors=require('cors');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const multer=require('multer');const ExcelJS=require('exceljs');const PDFDocument=require('pdfkit');const warehouse=require('./warehouse');const{Database,aql}=require('arangojs');require('dotenv').config();
const app=express(),PORT=+process.env.PORT||3000,DB_NAME=process.env.ARANGO_DB||'kotva';
const JWT_SECRET=process.env.JWT_SECRET||'kotva-local-demo-secret-change-before-production';
const TOKEN_TTL_SECONDS=8*60*60;
const startedAt=Date.now(),databaseRequired=process.env.USE_ARANGO==='true',runtimeMetrics={requests:0,clientErrors:0,serverErrors:0,totalDurationMs:0,maxDurationMs:0,statusCodes:{},methods:{}};
const UPLOAD_DIR=path.resolve(process.env.UPLOAD_DIR||path.join(__dirname,'uploads'));fs.mkdirSync(UPLOAD_DIR,{recursive:true});
const DEFAULT_TENANT_ID='tenant-kotva';
const TENANTS=[
  {id:DEFAULT_TENANT_ID,name:'Kotva Insurance',slug:'kotva'},
  {id:'tenant-adria',name:'Adria Brokers',slug:'adria'}
];
const DEMO_USERS=[
  {id:'user-admin',tenantId:DEFAULT_TENANT_ID,tenantName:'Kotva Insurance',username:'admin',displayName:'Kotva Administrator',role:'admin',password:process.env.ADMIN_PASSWORD||'Admin123!'},
  {id:'user-agent',tenantId:DEFAULT_TENANT_ID,tenantName:'Kotva Insurance',username:'agent',displayName:'Insurance Agent',role:'agent',password:process.env.AGENT_PASSWORD||'Agent123!'},
  {id:'user-analyst',tenantId:DEFAULT_TENANT_ID,tenantName:'Kotva Insurance',username:'analyst',displayName:'Portfolio Analyst',role:'analyst',password:process.env.ANALYST_PASSWORD||'Analyst123!'},
  {id:'user-adria-admin',tenantId:'tenant-adria',tenantName:'Adria Brokers',username:'adria-admin',displayName:'Adria Administrator',role:'admin',password:process.env.ADRIA_ADMIN_PASSWORD||'Adria123!'}
];
const TYPES=['Putno','Životno','Auto','Privatna svojina','DZO'],MONTHS=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Avg','Sep','Okt','Nov','Dec'];
const EXPORT_TYPES=['Putno','Auto','Privatna svojina','DZO'];
const POLICY_STATUSES=['Nacrt','Aktivna','Istekla','Otkazana'];
const PAYMENT_METHODS=['Gotovina','Kartica','Bankovni transfer','Rate'];
const PAYMENT_STATUSES=['Neplaćeno','Delimično plaćeno','Plaćeno'];
const CURRENCIES=['RSD','EUR'];
const CLAIM_STATUSES=['Prijavljena','U obradi','Odobrena','Odbijena','Isplaćena'];
const VEHICLE_TYPES=['Putničko','Teretno','Motor'],BODY_TYPES=['Limuzina','SUV','Karavan'];
const INSURERS=['Uniqa','Generali','Milenijum','Sava'].map((name,i)=>({id:`kuca-${i+1}`,tenantId:DEFAULT_TENANT_ID,name}));
const CLIENTS=[['Ana','Marković',29,'Putno','Uniqa','2026-01-15'],['Nemanja','Petrović',41,'Životno','Generali','2026-01-18'],['Milica','Jovanović',34,'Auto','Milenijum','2026-02-09'],['Stefan','Đurić',52,'Privatna svojina','Sava','2026-02-12'],['Jovana','Nikolić',27,'Putno','Uniqa','2026-03-15'],['Viktor','Bojić',46,'Životno','Generali','2026-03-21'],['Sara','Pavlović',31,'Putno','Sava','2026-04-04'],['Luka','Mihajlović',39,'Auto','Milenijum','2026-04-20'],['Marija','Stojanović',48,'Privatna svojina','Sava','2026-05-09'],['Petar','Milošević',36,'Putno','Generali','2026-05-24'],['Ivana','Kostić',44,'Auto','Uniqa','2026-06-11'],['Marko','Lukić',51,'Životno','Sava','2026-06-19'],['Teodora','Ilić',28,'Putno','Milenijum','2026-07-13'],['Nikola','Perić',42,'Privatna svojina','Generali','2026-08-02'],['Katarina','Savić',33,'Auto','Uniqa','2026-09-17']].map(([name,surname,age,insuranceType,insurer,saleDate],i)=>({id:`korisnik-${i+1}`,tenantId:DEFAULT_TENANT_ID,name,surname,age,insuranceType,insurer,saleDate}));
const TRAVEL_TARGETS=[6,5,4,3,2,6,7,6,4,3,2,8];
const FIRST_NAMES=['Aleksa','Anđela','Bojan','Danica','Filip','Gorana','Igor','Jelena','Kristina','Milan','Nataša','Ognjen','Sofija','Uroš','Vanja'];
const LAST_NAMES=['Arsić','Babić','Cvetković','Dabić','Eraković','Gajić','Horvat','Isaković','Jakšić','Knežević','Lazić','Matić','Novaković','Obradović','Popović'];
TRAVEL_TARGETS.forEach((target,monthIndex)=>{
  const existing=CLIENTS.filter(client=>client.insuranceType==='Putno'&&Number(client.saleDate.slice(5,7))===monthIndex+1).length;
  for(let index=existing;index<target;index++){
    const sequence=monthIndex*8+index;
    CLIENTS.push({
      id:`putno-2026-${String(monthIndex+1).padStart(2,'0')}-${index+1}`,
      tenantId:DEFAULT_TENANT_ID,
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
  id:`putno-jul-17-dodatni-${index+1}`,tenantId:DEFAULT_TENANT_ID,name,surname,age,insuranceType:'Putno',insurer,saleDate:'2026-07-17'
}));
[
  ['Nevena','Todorović',29,'Uniqa','2026-02-14'],['Miloš','Stevanović',35,'Generali','2026-03-22'],
  ['Andrea','Radosavljević',42,'Milenijum','2026-04-18'],['Pavle','Simić',51,'Sava','2026-05-27'],
  ['Isidora','Mladenović',33,'Uniqa','2026-07-06'],['Veljko','Janković',47,'Generali','2026-08-19'],
  ['Lena','Grujić',24,'Milenijum','2026-10-11'],['Strahinja','Đorđević',39,'Sava','2026-12-03']
].forEach(([name,surname,age,insurer,saleDate],index)=>CLIENTS.push({
  id:`auto-dodatni-${index+1}`,tenantId:DEFAULT_TENANT_ID,name,surname,age,insuranceType:'Auto',insurer,saleDate
}));
INSURERS.push(
  {id:'adria-insurer-1',tenantId:'tenant-adria',name:'Adria Secure'},
  {id:'adria-insurer-2',tenantId:'tenant-adria',name:'Blue Shield'}
);
CLIENTS.push(
  {id:'adria-client-1',tenantId:'tenant-adria',name:'Mina',surname:'Kovač',age:32,insuranceType:'Putno',insurer:'Adria Secure',saleDate:'2026-07-12'},
  {id:'adria-client-2',tenantId:'tenant-adria',name:'Ivan',surname:'Marić',age:45,insuranceType:'Auto',insurer:'Blue Shield',saleDate:'2026-08-08'}
);
let memoryInsurers=[...INSURERS],memoryClients=[...CLIENTS],memoryClaims=[],memoryPayments=[],memoryPolicyDocuments=[],memoryNotificationDismissals=[],memoryBusinessAudit=[],memoryEtlRuns=[],memoryUsers=[],memoryLoginAttempts=[],db,mode='memory';const clean=({_key,_id,_rev,...x})=>x,id=p=>`${p}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,validIsoDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00Z`);return!Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value},newPolicyNumber=tenantId=>`POL-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${tenantId.replace('tenant-','').slice(0,6).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,newClaimNumber=tenantId=>`CLM-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${tenantId.replace('tenant-','').slice(0,6).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`,newReceiptNumber=tenantId=>`PAY-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${tenantId.replace('tenant-','').slice(0,6).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
const DOCUMENT_TYPES={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'},documentStorage=multer.diskStorage({destination:(req,file,callback)=>callback(null,UPLOAD_DIR),filename:(req,file,callback)=>callback(null,`${crypto.randomUUID()}${DOCUMENT_TYPES[file.mimetype]||''}`)}),documentUpload=multer({storage:documentStorage,limits:{fileSize:5*1024*1024,files:1},fileFilter:(req,file,callback)=>DOCUMENT_TYPES[file.mimetype]?callback(null,true):callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE','document'))});
const uploadPolicyDocument=(req,res,next)=>documentUpload.single('document')(req,res,error=>error?res.status(400).json({message:error.code==='LIMIT_FILE_SIZE'?'Dokument može imati najviše 5 MB.':'Dozvoljeni su samo PDF, JPG i PNG dokumenti.'}):next());
function generatePolicyPdf(client,tenantName,response){
  const navy='#102a43',accent='#e76f51',muted='#627d98',line='#d9e2ec',pageWidth=595.28,margin=48,contentWidth=pageWidth-margin*2;
  const doc=new PDFDocument({size:'A4',margin,info:{Title:`Polisa ${client.policyNumber}`,Author:tenantName,Subject:'Polisa osiguranja',Keywords:'insurance policy, Kotva'}});
  const value=item=>item===undefined||item===null||item===''?'—':String(item),date=item=>item?new Intl.DateTimeFormat('sr-RS').format(new Date(`${item}T00:00:00Z`)):'—',money=amount=>`${Number(amount||0).toLocaleString('sr-RS',{minimumFractionDigits:2,maximumFractionDigits:2})} ${value(client.currency)}`;
  const section=title=>{doc.moveDown(.8).fillColor(navy).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase());doc.moveDown(.3).strokeColor(line).lineWidth(1).moveTo(margin,doc.y).lineTo(margin+contentWidth,doc.y).stroke();doc.moveDown(.5)};
  const row=(label,left,rightLabel,right)=>{const y=doc.y;doc.fillColor(muted).font('Helvetica').fontSize(8).text(label.toUpperCase(),margin,y,{width:112});doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text(value(left),margin+112,y,{width:138});if(rightLabel){doc.fillColor(muted).font('Helvetica').fontSize(8).text(rightLabel.toUpperCase(),margin+270,y,{width:100});doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text(value(right),margin+370,y,{width:129})}doc.y=Math.max(doc.y,y+22)};
  doc.pipe(response);
  doc.rect(0,0,pageWidth,116).fill(navy);doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text(tenantName,margin,35);doc.font('Helvetica').fontSize(10).fillColor('#bcccdc').text('POLISA OSIGURANJA',margin,70);doc.roundedRect(pageWidth-205,31,157,54,7).fill(accent);doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('BROJ POLISE',pageWidth-190,43);doc.fontSize(11).text(value(client.policyNumber),pageWidth-190,58,{width:128});
  doc.y=142;row('Status polise',client.policyStatus,'Status placanja',client.paymentStatus);row('Datum prodaje',date(client.saleDate),'Generisano',new Intl.DateTimeFormat('sr-RS',{dateStyle:'medium',timeStyle:'short'}).format(new Date()));
  section('Osiguranik');row('Ime i prezime',`${value(client.name)} ${value(client.surname)}`,'Godine',client.age);row('Tip osiguranja',client.insuranceType,'Osiguravajuca kuca',client.insurer);row('Predmet osiguranja',client.insuredSubject);
  section('Pokrice i premija');row('Pocetak vazenja',date(client.validFrom),'Istek polise',date(client.validUntil));row('Premija',money(client.premium),'Nacin placanja',client.paymentMethod);row('Prodajni agent',client.soldBy?.displayName||client.soldBy?.username||'—');
  if(client.insuranceType==='Putno'){section('Detalji putnog osiguranja');row('Destinacija',client.destination,'Broj pasosa',client.passportNumber);row('JMBG',client.jmbg)}
  if(client.insuranceType==='Auto'){section('Podaci o vozilu');row('Marka',client.vehicleMake,'Kubikaza',client.engineCapacity?`${client.engineCapacity} cm3`:'—');row('Vrsta vozila',client.vehicleType,'Karoserija',client.bodyType);const confirmed=client.brokerApproval?.status==='confirmed';row('Brokerska potvrda',confirmed?'POTVRDJENO':'CEKA POTVRDU','Potvrdio',confirmed?(client.brokerApproval.confirmedBy?.displayName||client.brokerApproval.confirmedBy?.username):'—')}
  section('Potvrda');doc.fillColor(muted).font('Helvetica').fontSize(8).text('Dokument je automatski generisan iz aktuelnih podataka informacionog sistema. Autenticnost se proverava prema broju polise.',margin,doc.y,{width:contentWidth});doc.moveDown(2);const signatureY=doc.y+16;doc.strokeColor(line).moveTo(margin,signatureY).lineTo(margin+190,signatureY).stroke().moveTo(pageWidth-margin-190,signatureY).lineTo(pageWidth-margin,signatureY).stroke();doc.fillColor(muted).fontSize(8).text('Potpis osiguranika',margin,signatureY+7,{width:190,align:'center'}).text('Ovlasteno lice',pageWidth-margin-190,signatureY+7,{width:190,align:'center'});
  doc.fillColor(muted).fontSize(7).text(`${tenantName} · ${value(client.policyNumber)} · poverljiv dokument`,margin,780,{width:contentWidth,align:'center'});doc.end();
}
async function initializeAuthUsers(){
  memoryUsers=await Promise.all(DEMO_USERS.map(async({password,...user})=>({...user,passwordHash:await bcrypt.hash(password,12),active:true})));
}
function initializeMemoryPolicies(){
  const timestamp=new Date().toISOString();
  memoryClients.forEach(client=>{if(client.policyNumber)return;const basePremium=client.insuranceType==='Putno'?3500:client.insuranceType==='Životno'?12000:client.insuranceType==='Auto'?18000:9000;Object.assign(client,{policyNumber:`LEGACY-${client.id.toUpperCase()}`,validFrom:client.saleDate,validUntil:`${Number(client.saleDate.slice(0,4))+1}${client.saleDate.slice(4)}`,premium:basePremium+client.age*25,currency:'RSD',policyStatus:'Aktivna',paymentMethod:'Nije evidentirano',paymentStatus:'Plaćeno',insuredSubject:`${client.name} ${client.surname}`,documents:[],soldBy:{id:'system',username:'system',displayName:'Demo data migration'},policyHistory:[{action:'created',timestamp,performedBy:{id:'system',username:'system',displayName:'Demo data migration'}}]})});
}
async function init(){
  await initializeAuthUsers();
  initializeMemoryPolicies();
  if(process.env.USE_ARANGO!=='true'){await warehouse.initializeWarehouse();return}
  try{
    const connection={url:process.env.ARANGO_URL||'http://127.0.0.1:8529',auth:{username:process.env.ARANGO_USER||'root',password:process.env.ARANGO_PASSWORD||'kotva123'}};
    const system=new Database({...connection,databaseName:'_system'});
    if(!(await system.listDatabases()).includes(DB_NAME))await system.createDatabase(DB_NAME);
    db=new Database({...connection,databaseName:DB_NAME});
    for(const name of['clients','insurers','users','login_attempts','business_audit','etl_runs','tenants','claims','payments','policy_documents','notification_dismissals']){const col=db.collection(name);if(!(await col.exists()))await col.create()}
    const insurerCollection=db.collection('insurers'),clientCollection=db.collection('clients');
    await clientCollection.ensureIndex({
      type:'persistent',name:'idx_tenant_insurance_type_sale_date',
      fields:['tenantId','insuranceType','saleDate'],unique:false,sparse:false
    });
    await clientCollection.ensureIndex({
      type:'persistent',name:'idx_tenant_jmbg',fields:['tenantId','jmbg'],unique:true,sparse:true
    });
    await clientCollection.ensureIndex({
      type:'persistent',name:'idx_tenant_policy_number',fields:['tenantId','policyNumber'],unique:true,sparse:true
    });
    await db.collection('claims').ensureIndex({type:'persistent',name:'idx_tenant_claim_number',fields:['tenantId','claimNumber'],unique:true,sparse:false});
    await db.collection('claims').ensureIndex({type:'persistent',name:'idx_tenant_claim_status_incident',fields:['tenantId','status','incidentDate'],unique:false,sparse:false});
    await db.collection('payments').ensureIndex({type:'persistent',name:'idx_tenant_receipt_number',fields:['tenantId','receiptNumber'],unique:true,sparse:false});
    await db.collection('payments').ensureIndex({type:'persistent',name:'idx_tenant_payment_date',fields:['tenantId','paymentDate'],unique:false,sparse:false});
    await db.collection('payments').ensureIndex({type:'persistent',name:'idx_tenant_payment_reference',fields:['tenantId','reference'],unique:true,sparse:true});
    await db.collection('notification_dismissals').ensureIndex({type:'persistent',name:'idx_user_notification',fields:['tenantId','userId','notificationKey'],unique:true,sparse:false});
    await db.collection('policy_documents').ensureIndex({type:'persistent',name:'idx_tenant_policy_documents',fields:['tenantId','clientId','uploadedAt'],unique:false,sparse:false});
    await db.collection('business_audit').ensureIndex({type:'persistent',name:'idx_tenant_audit_time',fields:['tenantId','timestamp'],unique:false,sparse:false});
    await db.collection('business_audit').ensureIndex({type:'persistent',name:'idx_tenant_audit_entity',fields:['tenantId','entityType','entityId'],unique:false,sparse:false});
    await db.collection('etl_runs').ensureIndex({type:'persistent',name:'idx_tenant_etl_completed',fields:['tenantId','completedAt'],unique:false,sparse:false});
    await insurerCollection.ensureIndex({type:'persistent',name:'idx_tenant_insurer_name',fields:['tenantId','name'],unique:true,sparse:false});
    await db.collection('login_attempts').ensureIndex({type:'persistent',name:'idx_tenant_login_time',fields:['tenantId','timestamp'],unique:false,sparse:true});
    const graph=db.graph('kotva_insurance_graph');
    if(!(await graph.exists()))await graph.create([
      {collection:'owns',from:['clients'],to:['policies']},
      {collection:'issued_by',from:['policies'],to:['insurers']},
      {collection:'has_claim',from:['policies'],to:['claims']},
      {collection:'has_payment',from:['policies'],to:['payments']},
      {collection:'has_document',from:['policies'],to:['policy_documents']}
    ]);
    else{const edges=await graph.listEdgeCollections();if(!edges.includes('has_claim'))await graph.addEdgeDefinition({collection:'has_claim',from:['policies'],to:['claims']});if(!edges.includes('has_payment'))await graph.addEdgeDefinition({collection:'has_payment',from:['policies'],to:['payments']});if(!edges.includes('has_document'))await graph.addEdgeDefinition({collection:'has_document',from:['policies'],to:['policy_documents']})}
    for(const collectionName of['clients','insurers','policies','claims','payments','policy_documents','owns','issued_by','has_claim','has_payment','has_document']){
      await db.query(aql`FOR doc IN ${db.collection(collectionName)} FILTER !HAS(doc,"tenantId") UPDATE doc WITH {tenantId:${DEFAULT_TENANT_ID}} IN ${db.collection(collectionName)}`);
    }
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
    const migrationTimestamp=new Date().toISOString();
    await db.query(aql`
      FOR client IN clients
        FILTER !HAS(client,"policyNumber")
        LET basePremium=client.insuranceType=="Putno"?3500:client.insuranceType=="Životno"?12000:client.insuranceType=="Auto"?18000:9000
        UPDATE client WITH {
          policyNumber:CONCAT("LEGACY-",UPPER(client.id)),validFrom:client.saleDate,validUntil:SUBSTRING(DATE_ADD(client.saleDate,1,"year"),0,10),
          premium:basePremium+client.age*25,currency:"RSD",policyStatus:"Aktivna",paymentMethod:"Nije evidentirano",paymentStatus:"Plaćeno",
          insuredSubject:CONCAT(client.name," ",client.surname),documents:[],soldBy:{id:"system",username:"system",displayName:"Demo data migration"},
          policyHistory:[{action:"created",timestamp:${migrationTimestamp},performedBy:{id:"system",username:"system",displayName:"Demo data migration"}}]
        } IN clients
    `);
    for(const tenant of TENANTS){
      const tenantDocument={...tenant,_key:tenant.id};
      await db.query(aql`UPSERT {_key:${tenant.id}} INSERT ${tenantDocument} UPDATE ${tenant} IN tenants`);
    }
    for(const user of memoryUsers){
      const userDocument={...user,_key:user.id};
      await db.query(aql`UPSERT {_key:${user.id}} INSERT ${userDocument} UPDATE ${user} IN users`);
    }
    mode='arango';
    await syncInsuranceGraph();
    console.log(`ArangoDB baza "${DB_NAME}" je aktivna. Dodato demo korisnika: ${missingClients.length}.`)
  }catch(e){console.warn(`ArangoDB nije dostupan (${e.message}). Koristi se memorija.`)}
  await warehouse.initializeWarehouse();
}
async function syncInsuranceGraph(){
  if(mode!=='arango'||!db)return;
  await db.query(aql`
    FOR client IN clients
      LET policyKey=CONCAT("polisa-",client.id)
      LET vehicleDetails=client.insuranceType=="Auto"?{make:client.vehicleMake,engineCapacity:client.engineCapacity,vehicleType:client.vehicleType,bodyType:client.bodyType}:null
      LET policy={_key:policyKey,tenantId:client.tenantId,clientId:client.id,policyNumber:client.policyNumber,insuranceType:client.insuranceType,saleDate:client.saleDate,validFrom:client.validFrom,validUntil:client.validUntil,premium:client.premium,currency:client.currency,status:client.policyStatus,paymentMethod:client.paymentMethod,paymentStatus:client.paymentStatus,insuredSubject:client.insuredSubject,documents:client.documents,soldBy:client.soldBy,history:client.policyHistory,vehicleDetails,brokerApproval:client.brokerApproval}
      UPSERT {_key:policyKey} INSERT policy UPDATE policy IN policies
  `);
  await db.query(aql`
    FOR client IN clients
      LET edgeKey=CONCAT("poseduje-",client.id)
      LET edge={_key:edgeKey,tenantId:client.tenantId,_from:client._id,_to:CONCAT("policies/polisa-",client.id)}
      UPSERT {_key:edgeKey} INSERT edge UPDATE edge IN owns
  `);
  await db.query(aql`
    FOR client IN clients
      LET insurer=FIRST(FOR item IN insurers FILTER item.tenantId==client.tenantId AND item.name==client.insurer LIMIT 1 RETURN item)
      FILTER insurer!=null
      LET edgeKey=CONCAT("izdata-",client.id)
      LET edge={_key:edgeKey,tenantId:client.tenantId,_from:CONCAT("policies/polisa-",client.id),_to:insurer._id}
      UPSERT {_key:edgeKey} INSERT edge UPDATE edge IN issued_by
  `);
}
async function all(collection,fallback,tenantId){if(mode!=='arango')return fallback.filter(item=>item.tenantId===tenantId);const cursor=await db.query(aql`FOR doc IN ${db.collection(collection)} FILTER doc.tenantId==${tenantId} SORT doc._key RETURN doc`);return(await cursor.all()).map(clean)}
async function save(collection,item,fallback,tenantId){const record={...item,tenantId,id:item.id||id(collection==='clients'?'korisnik':'kuca')};if(mode==='arango')await db.collection(collection).save({...record,_key:record.id});else fallback.push(record);return record}
async function saveClaim(item,tenantId){const record={...item,tenantId,id:id('steta')};if(mode==='arango'){await db.collection('claims').save({...record,_key:record.id});const edge={_key:`steta-${record.id}`,tenantId,_from:`policies/polisa-${record.clientId}`,_to:`claims/${record.id}`};await db.collection('has_claim').save(edge)}else memoryClaims.push(record);return record}
async function updateClaimStatus(claimId,tenantId,user,status){const performedBy={id:user.id,username:user.username,displayName:user.displayName},timestamp=new Date().toISOString();if(mode!=='arango'){const claim=memoryClaims.find(item=>item.id===claimId&&item.tenantId===tenantId);if(!claim)return null;const previousStatus=claim.status;claim.status=status;claim.history.push({action:'status_changed',timestamp,performedBy,previousStatus,status});return claim}const cursor=await db.query(aql`FOR claim IN claims FILTER claim.id==${claimId} AND claim.tenantId==${tenantId} LIMIT 1 RETURN claim`),claim=await cursor.next();if(!claim)return null;const history=[...(claim.history||[]),{action:'status_changed',timestamp,performedBy,previousStatus:claim.status,status}],updateCursor=await db.query(aql`UPDATE ${claim._key} WITH {status:${status},history:${history}} IN claims RETURN NEW`);return clean(await updateCursor.next())}
async function savePayment(item,tenantId,client,paymentStatus,historyEntry){const record={...item,tenantId,id:id('uplata')},policyHistory=[...(client.policyHistory||[]),historyEntry];if(mode==='arango'){await db.collection('payments').save({...record,_key:record.id});await db.query(aql`FOR stored IN clients FILTER stored.id==${client.id} AND stored.tenantId==${tenantId} UPDATE stored WITH {paymentStatus:${paymentStatus},policyHistory:${policyHistory}} IN clients`);const edge={_key:`uplata-${record.id}`,tenantId,_from:`policies/polisa-${record.clientId}`,_to:`payments/${record.id}`};await db.collection('has_payment').save(edge)}else{memoryPayments.push(record);client.paymentStatus=paymentStatus;client.policyHistory=policyHistory}return record}
function buildNotifications(clients,claims,dismissals,user){const today=new Date().toISOString().slice(0,10),day=86400000,dismissed=new Set(dismissals.filter(item=>item.userId===user.id).map(item=>item.notificationKey)),items=[];for(const client of clients){const days=Math.ceil((new Date(`${client.validUntil}T00:00:00Z`)-new Date(`${today}T00:00:00Z`))/day);if(client.policyStatus!=='Otkazana'&&days<0)items.push({key:`policy-expired:${client.id}`,type:'policy_expired',severity:'critical',title:'Polisa je istekla',message:`${client.policyNumber} · ${client.name} ${client.surname} · istekla pre ${Math.abs(days)} dana`,dueDate:client.validUntil,entityId:client.id});else if(client.policyStatus!=='Otkazana'&&days<=30)items.push({key:`policy-expiring:${client.id}`,type:'policy_expiring',severity:days<=7?'high':'medium',title:'Polisa uskoro ističe',message:`${client.policyNumber} · ${client.name} ${client.surname} · još ${days} dana`,dueDate:client.validUntil,entityId:client.id});if(client.paymentStatus==='Neplaćeno'||client.paymentStatus==='Delimično plaćeno')items.push({key:`payment-due:${client.id}`,type:'payment_due',severity:client.paymentStatus==='Neplaćeno'?'high':'medium',title:'Otvoreno dugovanje premije',message:`${client.policyNumber} · ${client.name} ${client.surname} · ${client.paymentStatus}`,dueDate:client.validUntil,entityId:client.id})}for(const claim of claims){const age=Math.floor((Date.now()-new Date(claim.reportedAt).valueOf())/day);if(!['Odbijena','Isplaćena'].includes(claim.status)&&age>=7)items.push({key:`claim-pending:${claim.id}`,type:'claim_pending',severity:age>=14?'high':'medium',title:'Šteta čeka obradu',message:`${claim.claimNumber} · ${claim.clientName} · ${age} dana u statusu ${claim.status}`,dueDate:claim.incidentDate,entityId:claim.id})}const rank={critical:0,high:1,medium:2};return items.filter(item=>!dismissed.has(item.key)).sort((a,b)=>rank[a.severity]-rank[b.severity]||a.dueDate.localeCompare(b.dueDate))}
async function dismissNotification(notificationKey,user){const existing=await all('notification_dismissals',memoryNotificationDismissals,user.tenantId);if(existing.some(item=>item.userId===user.id&&item.notificationKey===notificationKey))return;await save('notification_dismissals',{userId:user.id,notificationKey,dismissedAt:new Date().toISOString()},memoryNotificationDismissals,user.tenantId)}
async function savePolicyDocument(item,tenantId,client){const record={...item,tenantId,id:id('dokument')},summary={id:record.id,name:record.originalName,mimeType:record.mimeType,size:record.size,uploadedAt:record.uploadedAt},documents=[...(client.documents||[]),summary];if(mode==='arango'){await db.collection('policy_documents').save({...record,_key:record.id});await db.query(aql`FOR stored IN clients FILTER stored.id==${client.id} AND stored.tenantId==${tenantId} UPDATE stored WITH {documents:${documents}} IN clients`);const edge={_key:`dokument-${record.id}`,tenantId,_from:`policies/polisa-${client.id}`,_to:`policy_documents/${record.id}`};await db.collection('has_document').save(edge)}else{memoryPolicyDocuments.push(record);client.documents=documents}const{storageName,...publicDocument}=clean(record);return publicDocument}
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
function insuranceKpis(clients,payments,claims){
  const currencies=[...new Set([...clients.map(item=>item.currency||'RSD'),...payments.map(item=>item.currency),...claims.map(item=>item.currency)].filter(Boolean))].sort(),paymentsByClient=new Map(),claimsByClient=new Map();
  for(const payment of payments){const items=paymentsByClient.get(payment.clientId)||[];items.push(payment);paymentsByClient.set(payment.clientId,items)}for(const claim of claims){const items=claimsByClient.get(claim.clientId)||[];items.push(claim);claimsByClient.set(claim.clientId,items)}
  const collectedFor=client=>{const items=paymentsByClient.get(client.id)||[],recorded=items.filter(item=>item.currency===client.currency).reduce((sum,item)=>sum+Number(item.amount||0),0);return items.length?Math.min(Number(client.premium||0),recorded):client.paymentStatus==='Plaćeno'?Number(client.premium||0):0};
  const byCurrency=currencies.map(currency=>{const policies=clients.filter(item=>(item.currency||'RSD')===currency),currencyClaims=claims.filter(item=>item.currency===currency),writtenPremium=policies.reduce((sum,item)=>sum+Number(item.premium||0),0),collectedPremium=policies.reduce((sum,item)=>sum+collectedFor(item),0),claimExposure=currencyClaims.reduce((sum,item)=>sum+Number(item.estimatedAmount||0),0),claimedPolicies=new Set(currencyClaims.map(item=>item.clientId)).size;return{currency,policyCount:policies.length,writtenPremium:+writtenPremium.toFixed(2),collectedPremium:+collectedPremium.toFixed(2),outstandingPremium:+Math.max(0,writtenPremium-collectedPremium).toFixed(2),collectionRate:writtenPremium?+(collectedPremium*100/writtenPremium).toFixed(1):0,claimCount:currencyClaims.length,claimFrequency:policies.length?+(claimedPolicies*100/policies.length).toFixed(1):0,claimSeverity:currencyClaims.length?+(claimExposure/currencyClaims.length).toFixed(2):0,claimExposure:+claimExposure.toFixed(2),estimatedLossRatio:writtenPremium?+(claimExposure*100/writtenPremium).toFixed(1):0,averagePremium:policies.length?+(writtenPremium/policies.length).toFixed(2):0,cancellationRate:policies.length?+(policies.filter(item=>item.policyStatus==='Otkazana').length*100/policies.length).toFixed(1):0}});
  const months=[...new Set(clients.map(item=>item.saleDate?.slice(0,7)).filter(Boolean))].sort(),monthlyTrend=currencies.map(currency=>({currency,points:months.map(month=>{const policies=clients.filter(item=>(item.currency||'RSD')===currency&&item.saleDate?.startsWith(month)),writtenPremium=policies.reduce((sum,item)=>sum+Number(item.premium||0),0),collectedPremium=policies.reduce((sum,item)=>sum+collectedFor(item),0);return{month,policyCount:policies.length,writtenPremium:+writtenPremium.toFixed(2),collectedPremium:+collectedPremium.toFixed(2)}})}));
  const insurerPerformance=[];for(const currency of currencies)for(const insurer of [...new Set(clients.map(item=>item.insurer))].sort((a,b)=>a.localeCompare(b,'sr'))){const policies=clients.filter(item=>item.insurer===insurer&&(item.currency||'RSD')===currency);if(!policies.length)continue;const writtenPremium=policies.reduce((sum,item)=>sum+Number(item.premium||0),0),collectedPremium=policies.reduce((sum,item)=>sum+collectedFor(item),0),policyIds=new Set(policies.map(item=>item.id)),currencyClaims=claims.filter(item=>item.currency===currency&&policyIds.has(item.clientId)),claimExposure=currencyClaims.reduce((sum,item)=>sum+Number(item.estimatedAmount||0),0);insurerPerformance.push({currency,insurer,policyCount:policies.length,writtenPremium:+writtenPremium.toFixed(2),collectionRate:writtenPremium?+(collectedPremium*100/writtenPremium).toFixed(1):0,estimatedLossRatio:writtenPremium?+(claimExposure*100/writtenPremium).toFixed(1):0,claimFrequency:+(new Set(currencyClaims.map(item=>item.clientId)).size*100/policies.length).toFixed(1)})}
  const growth=monthlyTrend.map(group=>{const active=group.points.filter(point=>point.writtenPremium>0),current=active.at(-1),previous=active.at(-2),previousYear=current?group.points.find(point=>point.month===`${Number(current.month.slice(0,4))-1}${current.month.slice(4)}`):null,rate=baseline=>current&&baseline?.writtenPremium?+((current.writtenPremium-baseline.writtenPremium)*100/baseline.writtenPremium).toFixed(1):null;return{currency:group.currency,currentMonth:current?.month||null,monthOverMonth:rate(previous),yearOverYear:rate(previousYear)}});return{generatedAt:new Date().toISOString(),currencies,byCurrency,monthlyTrend,insurerPerformance,growth,definitions:{writtenPremium:'Sum of policy premiums',collectedPremium:'Recorded payments, with paid legacy policies inferred at full premium',estimatedLossRatio:'Estimated claim value divided by written premium; not an incurred-loss accounting ratio',claimFrequency:'Policies with at least one claim divided by policy count',claimSeverity:'Average estimated value per claim'}};
}
async function buildMarketShareWorkbook(clients,insurers,tenantName){
  const workbook=new ExcelJS.Workbook();workbook.creator='Kotva';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;
  const report=workbook.addWorksheet('Market Share',{views:[{state:'frozen',xSplit:1,ySplit:5}]});
  const source=workbook.addWorksheet('Source Counts',{views:[{state:'frozen',xSplit:1,ySplit:1}]});
  const insurerNames=insurers.map(item=>item.name).sort((a,b)=>a.localeCompare(b,'sr'));
  const counts=insurerNames.map(name=>EXPORT_TYPES.map(type=>clients.filter(client=>client.insurer===name&&client.insuranceType===type).length));
  const totals=EXPORT_TYPES.map((type,index)=>counts.reduce((sum,row)=>sum+row[index],0));
  const selectedTotal=totals.reduce((sum,value)=>sum+value,0);

  source.addRow(['Insurance Company',...EXPORT_TYPES,'Total']);
  counts.forEach((row,index)=>source.addRow([insurerNames[index],...row,row.reduce((sum,value)=>sum+value,0)]));
  source.addRow(['Total',...totals,selectedTotal]);
  source.columns=[{width:28},...EXPORT_TYPES.map(()=>({width:20})),{width:16}];
  source.getRow(1).height=26;source.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};source.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102D46'}};
  source.getRow(source.rowCount).font={bold:true};source.getRow(source.rowCount).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF0F4'}};
  source.eachRow(row=>row.eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FFE1E7EB'}}};cell.alignment={vertical:'middle',horizontal:cell.column===1?'left':'right'}}));

  report.mergeCells('A1:F1');report.getCell('A1').value='INSURANCE MARKET SHARE';report.getCell('A1').font={name:'Arial',size:20,bold:true,color:{argb:'FFFFFFFF'}};report.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF102D46'}};report.getCell('A1').alignment={vertical:'middle',horizontal:'left'};report.getRow(1).height=38;
  report.mergeCells('A2:F2');report.getCell('A2').value=`Company: ${tenantName}  |  Generated: ${new Date().toLocaleString('en-GB')}`;report.getCell('A2').font={italic:true,color:{argb:'FF5C6B76'}};
  report.mergeCells('A3:F3');report.getCell('A3').value='Each percentage shows an insurer’s share of all policies sold in that insurance category. Column totals equal 100% when sales exist.';report.getCell('A3').font={size:10,color:{argb:'FF6B7882'}};
  report.addRow([]);report.addRow(['Insurance Company',...EXPORT_TYPES,'Selected Types Total']);
  const header=report.getRow(5);header.height=30;header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFF6B35'}};header.alignment={vertical:'middle',horizontal:'center',wrapText:true};
  const sourceTotalRow=insurerNames.length+2;
  insurerNames.forEach((name,index)=>{
    const reportRow=index+6,sourceRow=index+2,row=report.getRow(reportRow);row.getCell(1).value=name;row.getCell(1).font={bold:true,color:{argb:'FF17232D'}};
    EXPORT_TYPES.forEach((type,typeIndex)=>{
      const column=String.fromCharCode(66+typeIndex),value=totals[typeIndex]?counts[index][typeIndex]/totals[typeIndex]:0,cell=row.getCell(typeIndex+2);
      cell.value={formula:`IF('Source Counts'!${column}$${sourceTotalRow}=0,0,'Source Counts'!${column}${sourceRow}/'Source Counts'!${column}$${sourceTotalRow})`,result:value};cell.numFmt='0.0%';
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:value>=0.4?'FFBDE8DA':value>=0.2?'FFE3F3EC':'FFF7F9FA'}};
    });
    const totalValue=selectedTotal?counts[index].reduce((sum,value)=>sum+value,0)/selectedTotal:0;
    row.getCell(6).value={formula:`IF('Source Counts'!F$${sourceTotalRow}=0,0,'Source Counts'!F${sourceRow}/'Source Counts'!F$${sourceTotalRow})`,result:totalValue};row.getCell(6).numFmt='0.0%';row.getCell(6).font={bold:true};row.height=25;
  });
  const totalRow=report.getRow(insurerNames.length+6);totalRow.getCell(1).value='Total';
  EXPORT_TYPES.forEach((type,index)=>{const column=String.fromCharCode(66+index),hasSales=totals[index]>0;totalRow.getCell(index+2).value={formula:`IF('Source Counts'!${column}$${sourceTotalRow}=0,0,SUM(${column}6:${column}${insurerNames.length+5}))`,result:hasSales?1:0};totalRow.getCell(index+2).numFmt='0.0%'});
  totalRow.getCell(6).value={formula:`IF('Source Counts'!F$${sourceTotalRow}=0,0,SUM(F6:F${insurerNames.length+5}))`,result:selectedTotal?1:0};totalRow.getCell(6).numFmt='0.0%';totalRow.font={bold:true};totalRow.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEAF0F4'}};totalRow.height=27;
  report.columns=[{width:28},{width:18},{width:18},{width:22},{width:18},{width:22}];report.showGridLines=false;
  for(let rowIndex=5;rowIndex<=insurerNames.length+6;rowIndex++)report.getRow(rowIndex).eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FFE1E7EB'}}};cell.alignment={vertical:'middle',horizontal:cell.column===1?'left':'center'}});
  return workbook;
}
function parseEtlFilters(source={}){
  const filters={dateFrom:String(source.dateFrom||''),dateTo:String(source.dateTo||''),insuranceType:String(source.insuranceType||''),insurer:String(source.insurer||'').trim(),policyStatus:String(source.policyStatus||'')};
  if(filters.dateFrom&&!validIsoDate(filters.dateFrom))throw Object.assign(new Error('Početni datum nije ispravan.'),{status:400});if(filters.dateTo&&!validIsoDate(filters.dateTo))throw Object.assign(new Error('Krajnji datum nije ispravan.'),{status:400});if(filters.dateFrom&&filters.dateTo&&filters.dateFrom>filters.dateTo)throw Object.assign(new Error('Početni datum mora biti pre krajnjeg datuma.'),{status:400});if(filters.insuranceType&&!TYPES.includes(filters.insuranceType))throw Object.assign(new Error('Tip osiguranja nije ispravan.'),{status:400});if(filters.policyStatus&&!POLICY_STATUSES.includes(filters.policyStatus))throw Object.assign(new Error('Status polise nije ispravan.'),{status:400});if(filters.insurer.length>80)throw Object.assign(new Error('Naziv osiguravajuće kuće je predugačak.'),{status:400});return filters;
}
const ageGroup=age=>age<18?'0-17':age<26?'18-25':age<36?'26-35':age<46?'36-45':age<56?'46-55':age<66?'56-65':'66+',daysBetween=(from,to)=>validIsoDate(from)&&validIsoDate(to)?Math.round((new Date(`${to}T00:00:00Z`)-new Date(`${from}T00:00:00Z`))/86400000):'';
const anonymousCustomerId=(tenantId,clientId)=>`CUST-${crypto.createHmac('sha256',JWT_SECRET).update(`${tenantId}:${clientId}`).digest('hex').slice(0,16).toUpperCase()}`;
const csvCell=input=>{let value=input===undefined||input===null?'':typeof input==='object'?JSON.stringify(input):String(input);if(/^[=+\-@]/.test(value))value=`'${value}`;return/[",\r\n]/.test(value)?`"${value.replaceAll('"','""')}"`:value},toCsv=(columns,rows)=>`\uFEFF${columns.join(',')}\r\n${rows.map(row=>columns.map(column=>csvCell(row[column])).join(',')).join('\r\n')}\r\n`;
function filterEtlClients(clients,filters){return clients.filter(client=>(!filters.dateFrom||client.saleDate>=filters.dateFrom)&&(!filters.dateTo||client.saleDate<=filters.dateTo)&&(!filters.insuranceType||client.insuranceType===filters.insuranceType)&&(!filters.insurer||client.insurer.localeCompare(filters.insurer,'sr',{sensitivity:'base'})===0)&&(!filters.policyStatus||client.policyStatus===filters.policyStatus))}
function etlQualityIssues(clients,payments,claims){
  const issues=[],clientIds=new Set(clients.map(client=>client.id)),policyNumbers=new Map();
  for(const client of clients){
    const reference=client.policyNumber||client.id;
    if(!client.policyNumber)issues.push({severity:'error',issue_type:'missing_policy_number',entity_type:'policy',reference,detail:'Policy number is missing'});
    if(!client.name||!client.surname||!client.insuranceType||!client.insurer)issues.push({severity:'error',issue_type:'missing_required_value',entity_type:'policy',reference,detail:'One or more required policy attributes are missing'});
    if(!validIsoDate(client.saleDate)||!validIsoDate(client.validFrom)||!validIsoDate(client.validUntil)||client.validFrom>client.validUntil)issues.push({severity:'error',issue_type:'invalid_policy_dates',entity_type:'policy',reference,detail:'Sale or coverage dates are invalid'});
    if(!Number.isFinite(Number(client.premium))||Number(client.premium)<=0)issues.push({severity:'error',issue_type:'invalid_premium',entity_type:'policy',reference,detail:'Premium must be a positive number'});
    if(client.policyNumber){const count=(policyNumbers.get(client.policyNumber)||0)+1;policyNumbers.set(client.policyNumber,count)}
    if(client.insuranceType==='Putno'&&(!client.jmbg||!client.passportNumber||!client.destination))issues.push({severity:'warning',issue_type:'incomplete_travel_details',entity_type:'policy',reference,detail:'Travel identity or destination data is incomplete'});
    if(client.insuranceType==='Auto'&&(!client.vehicleMake||!client.engineCapacity||!client.vehicleType))issues.push({severity:'warning',issue_type:'incomplete_vehicle_details',entity_type:'policy',reference,detail:'Vehicle data is incomplete'});
  }
  for(const[policyNumber,count]of policyNumbers)if(count>1)issues.push({severity:'error',issue_type:'duplicate_policy_number',entity_type:'policy',reference:policyNumber,detail:`Policy number appears ${count} times`});for(const payment of payments)if(!clientIds.has(payment.clientId))issues.push({severity:'error',issue_type:'orphan_payment',entity_type:'payment',reference:payment.receiptNumber||payment.id,detail:'Payment has no matching policy'});for(const claim of claims)if(!clientIds.has(claim.clientId))issues.push({severity:'error',issue_type:'orphan_claim',entity_type:'claim',reference:claim.claimNumber||claim.id,detail:'Claim has no matching policy'});return issues;
}
const qualityPercent=(passed,total)=>total?+(passed*100/total).toFixed(1):100,qualityStatus=(value,target)=>value>=target?'pass':value>=target-5?'warning':'fail';
function calculateDataQuality(clients,payments,claims){
  const clientIds=new Set(clients.map(item=>item.id)),requiredValues=[];for(const client of clients){requiredValues.push(client.id,client.name,client.surname,client.age,client.insuranceType,client.insurer,client.saleDate,client.policyNumber,client.validFrom,client.validUntil,client.premium,client.currency,client.policyStatus,client.paymentStatus,client.insuredSubject);if(client.insuranceType==='Putno')requiredValues.push(client.jmbg,client.passportNumber,client.destination);if(client.insuranceType==='Auto'){requiredValues.push(client.vehicleMake,client.engineCapacity,client.vehicleType);if(client.vehicleType==='Putničko')requiredValues.push(client.bodyType)}}for(const payment of payments)requiredValues.push(payment.id,payment.receiptNumber,payment.clientId,payment.policyNumber,payment.paymentDate,payment.amount,payment.currency,payment.method);for(const claim of claims)requiredValues.push(claim.id,claim.claimNumber,claim.clientId,claim.policyNumber,claim.incidentDate,claim.estimatedAmount,claim.currency,claim.status);
  const completeness=qualityPercent(requiredValues.filter(value=>value!==undefined&&value!==null&&value!=='').length,requiredValues.length),validityChecks=[];for(const client of clients)validityChecks.push(Number.isInteger(Number(client.age))&&Number(client.age)>=0&&Number(client.age)<=120,TYPES.includes(client.insuranceType),CURRENCIES.includes(client.currency||'RSD'),POLICY_STATUSES.includes(client.policyStatus),PAYMENT_STATUSES.includes(client.paymentStatus),validIsoDate(client.saleDate),validIsoDate(client.validFrom)&&validIsoDate(client.validUntil)&&client.validFrom<=client.validUntil,Number.isFinite(Number(client.premium))&&Number(client.premium)>0);for(const payment of payments)validityChecks.push(validIsoDate(payment.paymentDate),Number(payment.amount)>0,CURRENCIES.includes(payment.currency),clientIds.has(payment.clientId));for(const claim of claims)validityChecks.push(validIsoDate(claim.incidentDate),Number(claim.estimatedAmount)>0,CURRENCIES.includes(claim.currency),CLAIM_STATUSES.includes(claim.status),clientIds.has(claim.clientId));const validity=qualityPercent(validityChecks.filter(Boolean).length,validityChecks.length);
  const businessKeys=[...clients.map(item=>item.policyNumber),...payments.map(item=>item.receiptNumber),...claims.map(item=>item.claimNumber)].filter(Boolean),uniqueness=qualityPercent(new Set(businessKeys).size,businessKeys.length),related=[...payments,...claims],linked=related.filter(item=>clientIds.has(item.clientId)).length,referentialIntegrity=qualityPercent(linked,related.length),today=new Date().toISOString().slice(0,10),observedDates=[...clients.map(item=>item.saleDate),...payments.map(item=>item.paymentDate),...claims.map(item=>item.incidentDate)].filter(date=>validIsoDate(date)&&date<=today).sort(),latestRecordDate=observedDates.at(-1)||null,freshnessDays=latestRecordDate?Math.max(0,Math.floor((new Date(`${today}T00:00:00Z`)-new Date(`${latestRecordDate}T00:00:00Z`))/86400000)):null,freshnessScore=freshnessDays===null?0:freshnessDays<=7?100:freshnessDays<=30?90:Math.max(0,100-freshnessDays),thresholds={completeness:98,validity:99,uniqueness:100,referentialIntegrity:100,freshnessDays:30},dimensions=[{key:'completeness',label:'Completeness',value:completeness,target:thresholds.completeness,unit:'%'},{key:'validity',label:'Validity',value:validity,target:thresholds.validity,unit:'%'},{key:'uniqueness',label:'Uniqueness',value:uniqueness,target:thresholds.uniqueness,unit:'%'},{key:'referentialIntegrity',label:'Referential integrity',value:referentialIntegrity,target:thresholds.referentialIntegrity,unit:'%'},{key:'freshness',label:'Freshness',value:freshnessDays,target:thresholds.freshnessDays,unit:'days',status:freshnessDays!==null&&freshnessDays<=thresholds.freshnessDays?'pass':'fail'}];dimensions.forEach(item=>{if(!item.status)item.status=qualityStatus(item.value,item.target)});const issues=etlQualityIssues(clients,payments,claims),issueDistribution=[...issues.reduce((map,issue)=>map.set(issue.issue_type,(map.get(issue.issue_type)||0)+1),new Map())].map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count),overallScore=+((completeness+validity+uniqueness+referentialIntegrity+freshnessScore)/5).toFixed(1);return{generatedAt:new Date().toISOString(),overallScore,status:qualityStatus(overallScore,95),thresholds,dimensions,latestRecordDate,freshnessDays,totalRecords:clients.length+payments.length+claims.length,recordCounts:{policies:clients.length,payments:payments.length,claims:claims.length},issueCount:issues.length,errorCount:issues.filter(item=>item.severity==='error').length,warningCount:issues.filter(item=>item.severity==='warning').length,orphanCount:related.length-linked,issueDistribution,issues:issues.slice(0,100)};
}
async function prepareEtlData(tenantId,filters){
  const[allClients,payments,claims]=await Promise.all([all('clients',memoryClients,tenantId),all('payments',memoryPayments,tenantId),all('claims',memoryClaims,tenantId)]),clients=filterEtlClients(allClients,filters),selectedIds=new Set(clients.map(client=>client.id)),selectedPayments=payments.filter(item=>selectedIds.has(item.clientId)),selectedClaims=claims.filter(item=>selectedIds.has(item.clientId)),customerId=client=>anonymousCustomerId(tenantId,client.id);
  const policies=clients.map(client=>({policy_number:client.policyNumber,customer_id:customerId(client),customer_age:client.age,customer_age_group:ageGroup(Number(client.age)),insurance_type:client.insuranceType,insurer:client.insurer,sale_date:client.saleDate,valid_from:client.validFrom,valid_until:client.validUntil,premium:client.premium,currency:client.currency,policy_status:client.policyStatus,payment_status:client.paymentStatus,vehicle_type:client.vehicleType||'',vehicle_body_type:client.bodyType||'',travel_destination:client.destination||''}));
  const paymentRows=selectedPayments.map(payment=>({receipt_number:payment.receiptNumber,policy_number:payment.policyNumber,customer_id:anonymousCustomerId(tenantId,payment.clientId),payment_date:payment.paymentDate,amount:payment.amount,currency:payment.currency,method:payment.method,has_external_reference:payment.reference?true:false}));
  const claimRows=selectedClaims.map(claim=>({claim_number:claim.claimNumber,policy_number:claim.policyNumber,customer_id:anonymousCustomerId(tenantId,claim.clientId),incident_date:claim.incidentDate,estimated_amount:claim.estimatedAmount,currency:claim.currency,status:claim.status}));
  const dataset=clients.map(client=>{const policyPayments=selectedPayments.filter(item=>item.clientId===client.id),policyClaims=selectedClaims.filter(item=>item.clientId===client.id),recordedPaid=policyPayments.reduce((sum,item)=>sum+Number(item.amount||0),0),amountPaid=policyPayments.length?recordedPaid:client.paymentStatus==='Plaćeno'?Number(client.premium||0):0,premium=Number(client.premium||0),saleYear=Number(client.saleDate?.slice(0,4))||'',saleMonth=Number(client.saleDate?.slice(5,7))||'';return{policy_number:client.policyNumber,customer_id:customerId(client),customer_age:client.age,customer_age_group:ageGroup(Number(client.age)),insurance_type:client.insuranceType,insurer:client.insurer,sale_date:client.saleDate,sale_year:saleYear,sale_month:saleMonth,sale_quarter:saleMonth?`Q${Math.ceil(saleMonth/3)}`:'',valid_from:client.validFrom,valid_until:client.validUntil,policy_duration_days:daysBetween(client.validFrom,client.validUntil),premium,currency:client.currency,amount_paid:+amountPaid.toFixed(2),remaining_amount:+Math.max(0,premium-amountPaid).toFixed(2),policy_status:client.policyStatus,payment_status:client.paymentStatus,claim_count:policyClaims.length,open_claim_count:policyClaims.filter(item=>!['Odbijena','Isplaćena'].includes(item.status)).length,total_estimated_claim_value:+policyClaims.reduce((sum,item)=>sum+Number(item.estimatedAmount||0),0).toFixed(2)} });
  return{clients,payments:selectedPayments,claims:selectedClaims,policies,paymentRows,claimRows,dataset,quality:etlQualityIssues(allClients,payments,claims),qualityMetrics:calculateDataQuality(allClients,payments,claims),sourceCounts:{policies:allClients.length,payments:payments.length,claims:claims.length}};
}
const ETL_EXPORTS={
  'policies.csv':{key:'policies',columns:['policy_number','customer_id','customer_age','customer_age_group','insurance_type','insurer','sale_date','valid_from','valid_until','premium','currency','policy_status','payment_status','vehicle_type','vehicle_body_type','travel_destination']},
  'payments.csv':{key:'paymentRows',columns:['receipt_number','policy_number','customer_id','payment_date','amount','currency','method','has_external_reference']},
  'claims.csv':{key:'claimRows',columns:['claim_number','policy_number','customer_id','incident_date','estimated_amount','currency','status']},
  'analytics-dataset.csv':{key:'dataset',columns:['policy_number','customer_id','customer_age','customer_age_group','insurance_type','insurer','sale_date','sale_year','sale_month','sale_quarter','valid_from','valid_until','policy_duration_days','premium','currency','amount_paid','remaining_amount','policy_status','payment_status','claim_count','open_claim_count','total_estimated_claim_value']},
  'etl-quality-report.csv':{key:'quality',columns:['severity','issue_type','entity_type','reference','detail']}
};
async function confirmBrokerApproval(clientId,tenantId,user){
  if(mode!=='arango'){
    const client=memoryClients.find(item=>item.id===clientId&&item.tenantId===tenantId);
    if(!client)return null;if(client.insuranceType!=='Auto')return false;if(client.brokerApproval?.status==='confirmed')return client;
    const performedBy={id:user.id,username:user.username,displayName:user.displayName},timestamp=new Date().toISOString();client.brokerApproval={status:'confirmed',confirmedAt:timestamp,confirmedBy:performedBy};client.policyHistory.push({action:'broker_confirmed',timestamp,performedBy});return client;
  }
  const cursor=await db.query(aql`FOR client IN clients FILTER client.id==${clientId} AND client.tenantId==${tenantId} LIMIT 1 RETURN client`);
  const client=await cursor.next();if(!client)return null;if(client.insuranceType!=='Auto')return false;if(client.brokerApproval?.status==='confirmed')return clean(client);
  const performedBy={id:user.id,username:user.username,displayName:user.displayName},timestamp=new Date().toISOString(),brokerApproval={status:'confirmed',confirmedAt:timestamp,confirmedBy:performedBy},policyHistory=[...(client.policyHistory||[]),{action:'broker_confirmed',timestamp,performedBy}];
  const updateCursor=await db.query(aql`UPDATE ${client._key} WITH {brokerApproval:${brokerApproval},policyHistory:${policyHistory}} IN clients RETURN NEW`);
  return clean(await updateCursor.next());
}
async function updatePolicyState(clientId,tenantId,user,changes){
  const performedBy={id:user.id,username:user.username,displayName:user.displayName},timestamp=new Date().toISOString();
  if(mode!=='arango'){
    const client=memoryClients.find(item=>item.id===clientId&&item.tenantId===tenantId);if(!client)return null;
    const previous={policyStatus:client.policyStatus,paymentStatus:client.paymentStatus};Object.assign(client,changes);
    client.policyHistory.push({action:'policy_updated',timestamp,performedBy,previous,changes});return client;
  }
  const cursor=await db.query(aql`FOR client IN clients FILTER client.id==${clientId} AND client.tenantId==${tenantId} LIMIT 1 RETURN client`),client=await cursor.next();if(!client)return null;
  const previous={policyStatus:client.policyStatus,paymentStatus:client.paymentStatus},historyEntry={action:'policy_updated',timestamp,performedBy,previous,changes},policyHistory=[...(client.policyHistory||[]),historyEntry],update={...changes,policyHistory};
  const updateCursor=await db.query(aql`UPDATE ${client._key} WITH ${update} IN clients RETURN NEW`);
  return clean(await updateCursor.next());
}
function cookieValue(req,name){
  const cookies=String(req.headers.cookie||'').split(';').map(value=>value.trim());
  const match=cookies.find(value=>value.startsWith(`${name}=`));
  return match?decodeURIComponent(match.slice(name.length+1)):'';
}
function publicUser(user){return{id:user.id,tenantId:user.tenantId,tenantName:user.tenantName,username:user.username,displayName:user.displayName,role:user.role}}
async function findUser(username){
  const normalized=String(username||'').trim().toLowerCase();
  if(mode!=='arango')return memoryUsers.find(user=>user.username===normalized);
  const cursor=await db.query(aql`FOR user IN users FILTER user.username==${normalized} LIMIT 1 RETURN user`);
  return(await cursor.next())||null;
}
async function recordLoginAttempt(req,username,successful,reason,tenantId=null){
  const attempt={id:id('login'),tenantId,username:String(username||'').trim().toLowerCase(),successful,reason,timestamp:new Date().toISOString(),ip:req.ip,userAgent:String(req.headers['user-agent']||'').slice(0,300)};
  if(mode==='arango')await db.collection('login_attempts').save({...attempt,_key:attempt.id});else memoryLoginAttempts.push(attempt);
}
async function recordBusinessAudit(req,action,entityType,entityId,summary,changes={}){const user=req.user,event={id:id('audit'),tenantId:user.tenantId,action,entityType,entityId:String(entityId),summary:String(summary).slice(0,300),changes,timestamp:new Date().toISOString(),actor:{id:user.id,username:user.username,displayName:user.displayName,role:user.role},ip:req.ip,userAgent:String(req.headers['user-agent']||'').slice(0,300)};if(mode==='arango')await db.collection('business_audit').save({...event,_key:event.id});else memoryBusinessAudit.push(event);return event}
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
app.use((req,res,next)=>{const requestId=crypto.randomUUID(),started=process.hrtime.bigint();req.requestId=requestId;res.setHeader('X-Request-Id',requestId);res.on('finish',()=>{const durationMs=Number(process.hrtime.bigint()-started)/1e6;runtimeMetrics.requests++;runtimeMetrics.totalDurationMs+=durationMs;runtimeMetrics.maxDurationMs=Math.max(runtimeMetrics.maxDurationMs,durationMs);runtimeMetrics.statusCodes[res.statusCode]=(runtimeMetrics.statusCodes[res.statusCode]||0)+1;runtimeMetrics.methods[req.method]=(runtimeMetrics.methods[req.method]||0)+1;if(res.statusCode>=500)runtimeMetrics.serverErrors++;else if(res.statusCode>=400)runtimeMetrics.clientErrors++;if(process.env.REQUEST_LOGGING==='true')console.log(JSON.stringify({type:'http_request',requestId,method:req.method,path:req.path,status:res.statusCode,durationMs:+durationMs.toFixed(2),timestamp:new Date().toISOString()}))});next()});
app.use(cors());app.use(express.json({limit:'50kb'}));app.use(express.static(path.join(__dirname,'public')));
app.get('/api/health',(q,r)=>r.json({status:'ok',database:mode,databaseName:DB_NAME}));
app.get('/api/health/live',(q,r)=>r.json({status:'alive',uptimeSeconds:Math.floor((Date.now()-startedAt)/1000)}));
app.get('/api/health/ready',async(q,r)=>{let databaseReady=mode==='arango'||!databaseRequired;if(mode==='arango')try{await db.query(aql`RETURN 1`)}catch(error){databaseReady=false}r.status(databaseReady?200:503).json({status:databaseReady?'ready':'not_ready',database:mode,databaseRequired,databaseReady})});
app.post('/api/auth/login',async(req,res,next)=>{try{
  const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||'');
  if(!username||!password)return res.status(400).json({message:'Username and password are required.'});
  const user=await findUser(username);
  if(await recentFailedAttempts(username)>=5){await recordLoginAttempt(req,username,false,'locked',user?.tenantId);return res.status(429).json({message:'Too many failed attempts. Try again in 15 minutes.'})}
  if(!user||!user.active||!(await bcrypt.compare(password,user.passwordHash))){await recordLoginAttempt(req,username,false,'invalid_credentials',user?.tenantId);return res.status(401).json({message:'Invalid username or password.'})}
  await recordLoginAttempt(req,username,true,'success',user.tenantId);
  const sessionUser=publicUser(user),token=jwt.sign(sessionUser,JWT_SECRET,{expiresIn:TOKEN_TTL_SECONDS,issuer:'kotva'});
  res.cookie('kotva_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:TOKEN_TTL_SECONDS*1000,path:'/'});
  res.json({user:sessionUser});
}catch(error){next(error)}});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('kotva_session',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/'});res.status(204).end()});
app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
app.use('/api',authenticate);
app.get('/api/auth/login-attempts',authorize('admin'),async(req,res,next)=>{try{
  if(mode!=='arango')return res.json(memoryLoginAttempts.filter(item=>item.tenantId===req.user.tenantId).reverse().slice(0,100));
  const cursor=await db.query(aql`FOR attempt IN login_attempts FILTER attempt.tenantId==${req.user.tenantId} SORT attempt.timestamp DESC LIMIT 100 RETURN UNSET(attempt,"_key","_id","_rev")`);res.json(await cursor.all());
}catch(error){next(error)}});
app.get('/api/audit',authorize('admin'),async(req,res,next)=>{try{const entityType=String(req.query.entityType||''),action=String(req.query.action||''),limit=Math.min(200,Math.max(1,Number(req.query.limit)||100));if(mode!=='arango'){let events=memoryBusinessAudit.filter(item=>item.tenantId===req.user.tenantId);if(entityType)events=events.filter(item=>item.entityType===entityType);if(action)events=events.filter(item=>item.action===action);return res.json(events.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,limit))}const cursor=await db.query(aql`FOR event IN business_audit FILTER event.tenantId==${req.user.tenantId} FILTER ${entityType}=="" OR event.entityType==${entityType} FILTER ${action}=="" OR event.action==${action} SORT event.timestamp DESC LIMIT ${limit} RETURN UNSET(event,"_key","_id","_rev")`);res.json(await cursor.all())}catch(error){next(error)}});
app.get('/api/metrics',authorize('admin'),(req,res)=>{const uptimeSeconds=Math.floor((Date.now()-startedAt)/1000),averageDurationMs=runtimeMetrics.requests?runtimeMetrics.totalDurationMs/runtimeMetrics.requests:0,memory=process.memoryUsage();res.json({uptimeSeconds,requests:runtimeMetrics.requests,clientErrors:runtimeMetrics.clientErrors,serverErrors:runtimeMetrics.serverErrors,averageDurationMs:+averageDurationMs.toFixed(2),maxDurationMs:+runtimeMetrics.maxDurationMs.toFixed(2),statusCodes:{...runtimeMetrics.statusCodes},methods:{...runtimeMetrics.methods},memory:{rssMb:+(memory.rss/1048576).toFixed(2),heapUsedMb:+(memory.heapUsed/1048576).toFixed(2),heapTotalMb:+(memory.heapTotal/1048576).toFixed(2)},database:mode,timestamp:new Date().toISOString()})});
app.get('/api/config',(q,r)=>r.json({insuranceTypes:TYPES,vehicleTypes:VEHICLE_TYPES,bodyTypes:BODY_TYPES,policyStatuses:POLICY_STATUSES,paymentMethods:PAYMENT_METHODS,paymentStatuses:PAYMENT_STATUSES,currencies:CURRENCIES,claimStatuses:CLAIM_STATUSES,tenant:{id:q.user.tenantId,name:q.user.tenantName}}));app.get('/api/clients',async(q,r,n)=>{try{r.json(await all('clients',memoryClients,q.user.tenantId))}catch(e){n(e)}});app.get('/api/insurers',async(q,r,n)=>{try{r.json(await all('insurers',memoryInsurers,q.user.tenantId))}catch(e){n(e)}});app.get('/api/claims',async(q,r,n)=>{try{const claims=await all('claims',memoryClaims,q.user.tenantId);r.json(claims.sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt)))}catch(e){n(e)}});app.get('/api/payments',async(q,r,n)=>{try{const payments=await all('payments',memoryPayments,q.user.tenantId);r.json(payments.sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)))}catch(e){n(e)}});
app.get('/api/exports/insurance-market-share.xlsx',async(q,r,n)=>{try{
  const clients=await all('clients',memoryClients,q.user.tenantId),insurers=await all('insurers',memoryInsurers,q.user.tenantId),workbook=await buildMarketShareWorkbook(clients,insurers,q.user.tenantName);
  const buffer=await workbook.xlsx.writeBuffer(),date=new Date().toISOString().slice(0,10);
  r.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');r.setHeader('Content-Disposition',`attachment; filename="kotva-market-share-${date}.xlsx"`);r.setHeader('Cache-Control','no-store');r.send(Buffer.from(buffer));
}catch(e){n(e)}});
app.get('/api/etl/runs',authorize('admin','analyst'),async(q,r,n)=>{try{const runs=await all('etl_runs',memoryEtlRuns,q.user.tenantId);r.json(runs.sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).slice(0,25))}catch(e){n(e)}});
app.get('/api/analytics/data-quality',authorize('admin','analyst'),async(q,r,n)=>{try{const[clients,payments,claims,runs]=await Promise.all([all('clients',memoryClients,q.user.tenantId),all('payments',memoryPayments,q.user.tenantId),all('claims',memoryClaims,q.user.tenantId),all('etl_runs',memoryEtlRuns,q.user.tenantId)]),quality=calculateDataQuality(clients,payments,claims),trend=runs.filter(item=>item.qualitySnapshot).sort((a,b)=>a.completedAt.localeCompare(b.completedAt)).slice(-20).map(item=>({runId:item.id,completedAt:item.completedAt,overallScore:item.qualitySnapshot.overallScore,issueCount:item.qualitySnapshot.issueCount,errorCount:item.qualitySnapshot.errorCount,warningCount:item.qualitySnapshot.warningCount}));r.json({...quality,lastSuccessfulEtl:runs.filter(item=>item.status==='completed').sort((a,b)=>b.completedAt.localeCompare(a.completedAt))[0]?.completedAt||null,trend})}catch(e){n(e)}});
app.post('/api/etl/runs',authorize('admin','analyst'),async(q,r,n)=>{const started=Date.now();try{const filters=parseEtlFilters(q.body),data=await prepareEtlData(q.user.tenantId,filters),completedAt=new Date().toISOString(),qualitySnapshot={overallScore:data.qualityMetrics.overallScore,status:data.qualityMetrics.status,dimensions:Object.fromEntries(data.qualityMetrics.dimensions.map(item=>[item.key,item.value])),issueCount:data.qualityMetrics.issueCount,errorCount:data.qualityMetrics.errorCount,warningCount:data.qualityMetrics.warningCount,orphanCount:data.qualityMetrics.orphanCount,freshnessDays:data.qualityMetrics.freshnessDays},run={id:id('etl'),status:'completed',startedAt:new Date(started).toISOString(),completedAt,durationMs:Date.now()-started,filters,sourceCounts:data.sourceCounts,extractedRecords:data.clients.length+data.payments.length+data.claims.length,transformedRows:data.dataset.length,qualityIssues:data.quality.length,rejectedRecords:data.quality.filter(issue=>issue.severity==='error').length,qualitySnapshot,initiatedBy:{id:q.user.id,username:q.user.username,displayName:q.user.displayName,role:q.user.role}};if(mode==='arango')await db.collection('etl_runs').save({...run,tenantId:q.user.tenantId,_key:run.id});else memoryEtlRuns.push({...run,tenantId:q.user.tenantId});await recordBusinessAudit(q,'etl.completed','etl_run',run.id,`ETL završen: ${run.transformedRows} analitičkih redova, kvalitet ${qualitySnapshot.overallScore}%`,{filters,sourceCounts:run.sourceCounts,transformedRows:run.transformedRows,qualitySnapshot});r.status(201).json({...run,tenantId:q.user.tenantId})}catch(e){if(e.status)return r.status(e.status).json({message:e.message});n(e)}});
app.get('/api/etl/exports/:dataset',authorize('admin','analyst'),async(q,r,n)=>{try{const definition=ETL_EXPORTS[String(q.params.dataset||'')];if(!definition)return r.status(404).json({message:'CSV dataset nije pronađen.'});const filters=parseEtlFilters(q.query),data=await prepareEtlData(q.user.tenantId,filters),rows=data[definition.key],csv=toCsv(definition.columns,rows),date=new Date().toISOString().slice(0,10);r.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="kotva-${q.params.dataset.replace('.csv','')}-${date}.csv"`,'Cache-Control':'private, no-store','X-ETL-Row-Count':String(rows.length)});r.send(csv)}catch(e){if(e.status)return r.status(e.status).json({message:e.message});n(e)}});
app.get('/api/warehouse/status',authorize('admin','analyst'),async(q,r,n)=>{try{r.json(await warehouse.warehouseStatus(q.user.tenantId))}catch(e){n(e)}});
app.post('/api/warehouse/load',authorize('admin','analyst'),async(q,r,n)=>{try{const[clients,payments,claims]=await Promise.all([all('clients',memoryClients,q.user.tenantId),all('payments',memoryPayments,q.user.tenantId),all('claims',memoryClaims,q.user.tenantId)]),result=await warehouse.loadWarehouse({tenantId:q.user.tenantId,user:q.user,clients,payments,claims,pseudonymize:clientId=>anonymousCustomerId(q.user.tenantId,clientId)});await recordBusinessAudit(q,'warehouse.loaded','warehouse_load',result.loadId,`PostgreSQL warehouse učitan: ${result.rows.policies} polisa, ${result.rows.payments} uplata, ${result.rows.claims} šteta`,result.rows);r.status(201).json(result)}catch(e){if(e.status)return r.status(e.status).json({message:e.message});n(e)}});
app.get('/api/warehouse/reports/:report',authorize('admin','analyst'),async(q,r,n)=>{try{r.json(await warehouse.warehouseReport(q.user.tenantId,String(q.params.report||'')))}catch(e){if(e.status)return r.status(e.status).json({message:e.message});n(e)}});
app.post('/api/insurers',authorize('admin'),async(q,r,n)=>{try{const name=String(q.body.name||'').trim();if(name.length<2||name.length>80)return r.status(400).json({message:'Naziv mora imati od 2 do 80 znakova.'});const current=await all('insurers',memoryInsurers,q.user.tenantId);if(current.some(x=>x.name.localeCompare(name,'sr',{sensitivity:'base'})===0))return r.status(409).json({message:'Ta osiguravajuća kuća već postoji.'});const insurer=await save('insurers',{name},memoryInsurers,q.user.tenantId);await recordBusinessAudit(q,'insurer.created','insurer',insurer.id,`Dodata osiguravajuća kuća ${name}`,{name});r.status(201).json(insurer)}catch(e){n(e)}});
app.post('/api/clients',authorize('admin','agent'),async(q,r,n)=>{try{
  const x={name:String(q.body.name||'').trim(),surname:String(q.body.surname||'').trim(),age:+q.body.age,insuranceType:String(q.body.insuranceType||''),insurer:String(q.body.insurer||'').trim(),saleDate:String(q.body.saleDate||'')};
  if(!x.name||!x.surname)return r.status(400).json({message:'Ime i prezime su obavezni.'});
  if(!Number.isInteger(x.age)||x.age<0||x.age>120)return r.status(400).json({message:'Godine moraju biti ceo broj od 0 do 120.'});
  if(!TYPES.includes(x.insuranceType))return r.status(400).json({message:'Izaberite važeći tip osiguranja.'});
  if(!validIsoDate(x.saleDate))return r.status(400).json({message:'Datum prodaje nije ispravan.'});
  x.validFrom=String(q.body.validFrom||'');x.validUntil=String(q.body.validUntil||'');x.premium=Number(q.body.premium);x.currency=String(q.body.currency||'');x.policyStatus=String(q.body.policyStatus||'');x.paymentMethod=String(q.body.paymentMethod||'');x.paymentStatus=String(q.body.paymentStatus||'');x.insuredSubject=String(q.body.insuredSubject||'').trim();
  if(!validIsoDate(x.validFrom)||!validIsoDate(x.validUntil))return r.status(400).json({message:'Datumi početka i isteka polise nisu ispravni.'});
  if(x.validFrom<x.saleDate)return r.status(400).json({message:'Početak važenja ne može biti pre datuma prodaje.'});
  if(x.validUntil<=x.validFrom)return r.status(400).json({message:'Datum isteka mora biti posle početka važenja.'});
  if(!Number.isFinite(x.premium)||x.premium<=0||x.premium>100000000)return r.status(400).json({message:'Premija mora biti pozitivan iznos do 100.000.000.'});
  if(!CURRENCIES.includes(x.currency))return r.status(400).json({message:'Izaberite podržanu valutu.'});
  if(!POLICY_STATUSES.includes(x.policyStatus))return r.status(400).json({message:'Izaberite važeći status polise.'});
  if(!PAYMENT_METHODS.includes(x.paymentMethod))return r.status(400).json({message:'Izaberite način plaćanja.'});
  if(!PAYMENT_STATUSES.includes(x.paymentStatus))return r.status(400).json({message:'Izaberite status plaćanja.'});
  if(x.insuredSubject.length<2||x.insuredSubject.length>200)return r.status(400).json({message:'Predmet osiguranja mora imati od 2 do 200 znakova.'});
  const performedBy={id:q.user.id,username:q.user.username,displayName:q.user.displayName},timestamp=new Date().toISOString(),documentReference=String(q.body.documentReference||'').trim();
  if(documentReference.length>300)return r.status(400).json({message:'Referenca dokumenta može imati najviše 300 znakova.'});
  x.policyNumber=newPolicyNumber(q.user.tenantId);x.soldBy=performedBy;x.documents=documentReference?[{id:id('document'),name:'Prateći dokument',reference:documentReference,addedAt:timestamp,addedBy:performedBy}]:[];x.policyHistory=[{action:'created',timestamp,performedBy,status:x.policyStatus,paymentStatus:x.paymentStatus}];
  if(x.insuranceType==='Putno'){
    x.jmbg=String(q.body.jmbg||'').trim();x.passportNumber=String(q.body.passportNumber||'').trim().toUpperCase();x.destination=String(q.body.destination||'').trim();
    if(!/^\d{13}$/.test(x.jmbg))return r.status(400).json({message:'JMBG mora sadržati tačno 13 cifara.'});
    if(!/^[A-Z0-9-]{6,15}$/.test(x.passportNumber))return r.status(400).json({message:'Broj pasoša mora imati 6–15 slova, cifara ili crtica.'});
    if(x.destination.length<2||x.destination.length>80)return r.status(400).json({message:'Destinacija mora imati od 2 do 80 znakova.'});
    if((await all('clients',memoryClients,q.user.tenantId)).some(client=>client.jmbg===x.jmbg))return r.status(409).json({message:'Korisnik sa tim JMBG-om već postoji u vašoj firmi.'});
  }
  if(x.insuranceType==='Auto'){
    x.vehicleMake=String(q.body.vehicleMake||'').trim();x.engineCapacity=Number(q.body.engineCapacity);x.vehicleType=String(q.body.vehicleType||'').trim();x.bodyType=String(q.body.bodyType||'').trim();
    if(x.vehicleMake.length<2||x.vehicleMake.length>50)return r.status(400).json({message:'Marka vozila mora imati od 2 do 50 znakova.'});
    if(!Number.isInteger(x.engineCapacity)||x.engineCapacity<50||x.engineCapacity>10000)return r.status(400).json({message:'Kubikaža mora biti ceo broj između 50 i 10000 cm³.'});
    if(!VEHICLE_TYPES.includes(x.vehicleType))return r.status(400).json({message:'Izaberite važeću vrstu vozila.'});
    if(x.vehicleType==='Putničko'&&!BODY_TYPES.includes(x.bodyType))return r.status(400).json({message:'Za putničko vozilo izaberite limuzinu, SUV ili karavan.'});
    if(x.vehicleType!=='Putničko')delete x.bodyType;
    x.brokerApproval={status:'pending',confirmedAt:null,confirmedBy:null};
  }
  if(!(await all('insurers',memoryInsurers,q.user.tenantId)).some(i=>i.name===x.insurer))return r.status(400).json({message:'Izaberite postojeću osiguravajuću kuću.'});
  const client=await save('clients',x,memoryClients,q.user.tenantId);await syncInsuranceGraph();await recordBusinessAudit(q,'policy.created','policy',client.id,`Kreirana polisa ${client.policyNumber} za ${client.name} ${client.surname}`,{policyNumber:client.policyNumber,insuranceType:client.insuranceType,insurer:client.insurer,premium:client.premium,currency:client.currency});r.status(201).json(client)
}catch(e){n(e)}});
app.post('/api/clients/:id/broker-approval',authorize('admin','agent'),async(q,r,n)=>{try{
  const clientId=String(q.params.id||'');if(!clientId||clientId.length>120)return r.status(400).json({message:'Identifikator korisnika nije ispravan.'});
  const client=await confirmBrokerApproval(clientId,q.user.tenantId,q.user);
  if(client===null)return r.status(404).json({message:'Korisnik nije pronađen.'});
  if(client===false)return r.status(400).json({message:'Broker potvrda je dostupna samo za auto-osiguranje.'});
  await syncInsuranceGraph();await recordBusinessAudit(q,'broker.confirmed','policy',client.id,`Broker potvrdio podatke za polisu ${client.policyNumber}`,{brokerApproval:client.brokerApproval});r.json(client);
}catch(e){n(e)}});
app.patch('/api/clients/:id/policy',authorize('admin','agent'),async(q,r,n)=>{try{
  const clientId=String(q.params.id||''),changes={};if(!clientId||clientId.length>120)return r.status(400).json({message:'Identifikator korisnika nije ispravan.'});
  if(q.body.policyStatus!==undefined){if(!POLICY_STATUSES.includes(q.body.policyStatus))return r.status(400).json({message:'Izaberite važeći status polise.'});changes.policyStatus=q.body.policyStatus}
  if(q.body.paymentStatus!==undefined){if(!PAYMENT_STATUSES.includes(q.body.paymentStatus))return r.status(400).json({message:'Izaberite status plaćanja.'});changes.paymentStatus=q.body.paymentStatus}
  if(!Object.keys(changes).length)return r.status(400).json({message:'Pošaljite status polise ili status plaćanja.'});
  const client=await updatePolicyState(clientId,q.user.tenantId,q.user,changes);if(!client)return r.status(404).json({message:'Korisnik nije pronađen.'});await syncInsuranceGraph();await recordBusinessAudit(q,'policy.status_updated','policy',client.id,`Ažuriran status polise ${client.policyNumber}`,changes);r.json(client);
}catch(e){n(e)}});
app.post('/api/claims',authorize('admin','agent'),async(q,r,n)=>{try{
  const clientId=String(q.body.clientId||''),incidentDate=String(q.body.incidentDate||''),description=String(q.body.description||'').trim(),estimatedAmount=Number(q.body.estimatedAmount),currency=String(q.body.currency||'');
  const client=(await all('clients',memoryClients,q.user.tenantId)).find(item=>item.id===clientId);if(!client)return r.status(400).json({message:'Izaberite postojeću polisu vaše firme.'});
  if(!validIsoDate(incidentDate)||incidentDate>new Date().toISOString().slice(0,10))return r.status(400).json({message:'Datum štete nije ispravan ili je u budućnosti.'});
  if(incidentDate<client.validFrom||incidentDate>client.validUntil)return r.status(400).json({message:'Datum štete mora biti unutar perioda važenja polise.'});
  if(description.length<10||description.length>1000)return r.status(400).json({message:'Opis štete mora imati od 10 do 1000 znakova.'});
  if(!Number.isFinite(estimatedAmount)||estimatedAmount<=0||estimatedAmount>100000000)return r.status(400).json({message:'Procenjeni iznos mora biti pozitivan broj do 100.000.000.'});if(!CURRENCIES.includes(currency))return r.status(400).json({message:'Izaberite podržanu valutu.'});
  const performedBy={id:q.user.id,username:q.user.username,displayName:q.user.displayName},reportedAt=new Date().toISOString(),claim={claimNumber:newClaimNumber(q.user.tenantId),clientId:client.id,policyNumber:client.policyNumber,clientName:`${client.name} ${client.surname}`,insuranceType:client.insuranceType,insurer:client.insurer,incidentDate,description,estimatedAmount,currency,status:'Prijavljena',reportedAt,createdBy:performedBy,history:[{action:'created',timestamp:reportedAt,performedBy,status:'Prijavljena'}]},saved=await saveClaim(claim,q.user.tenantId);await recordBusinessAudit(q,'claim.created','claim',saved.id,`Prijavljena šteta ${saved.claimNumber} za polisu ${saved.policyNumber}`,{incidentDate,estimatedAmount,currency});r.status(201).json(saved);
}catch(e){n(e)}});
app.patch('/api/claims/:id/status',authorize('admin','agent'),async(q,r,n)=>{try{const claimId=String(q.params.id||''),status=String(q.body.status||'');if(!claimId||claimId.length>120)return r.status(400).json({message:'Identifikator štete nije ispravan.'});if(!CLAIM_STATUSES.includes(status))return r.status(400).json({message:'Izaberite važeći status štete.'});const claim=await updateClaimStatus(claimId,q.user.tenantId,q.user,status);if(!claim)return r.status(404).json({message:'Šteta nije pronađena.'});await recordBusinessAudit(q,'claim.status_updated','claim',claim.id,`Status štete ${claim.claimNumber} promenjen na ${status}`,{status});r.json(claim)}catch(e){n(e)}});
app.post('/api/payments',authorize('admin','agent'),async(q,r,n)=>{try{
  const clientId=String(q.body.clientId||''),paymentDate=String(q.body.paymentDate||''),amount=Number(q.body.amount),method=String(q.body.method||''),reference=String(q.body.reference||'').trim();
  const client=(await all('clients',memoryClients,q.user.tenantId)).find(item=>item.id===clientId);if(!client)return r.status(400).json({message:'Izaberite postojeću polisu vaše firme.'});if(!validIsoDate(paymentDate)||paymentDate>new Date().toISOString().slice(0,10))return r.status(400).json({message:'Datum uplate nije ispravan ili je u budućnosti.'});if(paymentDate<client.saleDate)return r.status(400).json({message:'Datum uplate ne može biti pre datuma prodaje polise.'});if(!Number.isFinite(amount)||amount<=0)return r.status(400).json({message:'Iznos uplate mora biti pozitivan broj.'});if(!PAYMENT_METHODS.includes(method))return r.status(400).json({message:'Izaberite podržan način plaćanja.'});if(reference.length>100)return r.status(400).json({message:'Referenca uplate može imati najviše 100 znakova.'});
  const existing=await all('payments',memoryPayments,q.user.tenantId);if(reference&&existing.some(payment=>payment.reference===reference))return r.status(409).json({message:'Uplata sa tom referencom već postoji.'});const policyPayments=existing.filter(payment=>payment.clientId===client.id),paid=policyPayments.length?policyPayments.reduce((sum,payment)=>sum+payment.amount,0):client.paymentStatus==='Plaćeno'?client.premium:0,remaining=+(client.premium-paid).toFixed(2);if(amount>remaining+0.001)return r.status(400).json({message:`Uplata prelazi preostali dug od ${remaining} ${client.currency}.`});
  const totalPaid=+(paid+amount).toFixed(2),paymentStatus=totalPaid+0.001>=client.premium?'Plaćeno':'Delimično plaćeno',performedBy={id:q.user.id,username:q.user.username,displayName:q.user.displayName},recordedAt=new Date().toISOString(),payment={receiptNumber:newReceiptNumber(q.user.tenantId),clientId:client.id,policyNumber:client.policyNumber,clientName:`${client.name} ${client.surname}`,paymentDate,amount,currency:client.currency,method,reference:reference||null,recordedAt,recordedBy:performedBy},historyEntry={action:'payment_recorded',timestamp:recordedAt,performedBy,receiptNumber:payment.receiptNumber,amount,currency:client.currency,previousPaymentStatus:client.paymentStatus,paymentStatus};const saved=await savePayment(payment,q.user.tenantId,client,paymentStatus,historyEntry);await syncInsuranceGraph();await recordBusinessAudit(q,'payment.recorded','payment',saved.id,`Evidentirana uplata ${saved.receiptNumber} za polisu ${saved.policyNumber}`,{amount,currency:client.currency,method,paymentStatus});r.status(201).json({...saved,totalPaid,remaining:Math.max(0,+(client.premium-totalPaid).toFixed(2)),paymentStatus});
}catch(e){n(e)}});
app.get('/api/notifications',async(q,r,n)=>{try{const[clients,claims,dismissals]=await Promise.all([all('clients',memoryClients,q.user.tenantId),all('claims',memoryClaims,q.user.tenantId),all('notification_dismissals',memoryNotificationDismissals,q.user.tenantId)]);r.json(buildNotifications(clients,claims,dismissals,q.user))}catch(e){n(e)}});
app.post('/api/notifications/:key/dismiss',async(q,r,n)=>{try{const key=String(q.params.key||'');if(!/^(policy-expired|policy-expiring|payment-due|claim-pending):[A-Za-z0-9._-]{1,120}$/.test(key))return r.status(400).json({message:'Identifikator obaveštenja nije ispravan.'});const[clients,claims,dismissals]=await Promise.all([all('clients',memoryClients,q.user.tenantId),all('claims',memoryClaims,q.user.tenantId),all('notification_dismissals',memoryNotificationDismissals,q.user.tenantId)]),notification=buildNotifications(clients,claims,dismissals,q.user).find(item=>item.key===key);if(!notification)return r.status(404).json({message:'Obaveštenje nije pronađeno ili je već označeno kao pročitano.'});await dismissNotification(key,q.user);await recordBusinessAudit(q,'notification.dismissed','notification',key,`Obaveštenje označeno kao pročitano: ${notification.title}`,{notificationType:notification.type});r.status(204).end()}catch(e){n(e)}});
app.get('/api/documents',async(q,r,n)=>{try{const documents=await all('policy_documents',memoryPolicyDocuments,q.user.tenantId);r.json(documents.sort((a,b)=>b.uploadedAt.localeCompare(a.uploadedAt)).map(({storageName,...document})=>document))}catch(e){n(e)}});
app.get('/api/clients/:id/policy.pdf',async(q,r,n)=>{try{const clientId=String(q.params.id||''),client=(await all('clients',memoryClients,q.user.tenantId)).find(item=>item.id===clientId);if(!client)return r.status(404).json({message:'Polisa nije pronađena.'});const safePolicyNumber=String(client.policyNumber||client.id).replace(/[^A-Za-z0-9._-]/g,'-');r.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="kotva-policy-${safePolicyNumber}.pdf"`,'Cache-Control':'private, no-store'});generatePolicyPdf(client,q.user.tenantName,r)}catch(e){n(e)}});
app.post('/api/clients/:id/documents',authorize('admin','agent'),uploadPolicyDocument,async(q,r,n)=>{try{const clientId=String(q.params.id||''),client=(await all('clients',memoryClients,q.user.tenantId)).find(item=>item.id===clientId);if(!client){if(q.file)fs.rmSync(q.file.path,{force:true});return r.status(404).json({message:'Polisa nije pronađena.'})}if(!q.file)return r.status(400).json({message:'Izaberite dokument za upload.'});const uploadedAt=new Date().toISOString(),uploadedBy={id:q.user.id,username:q.user.username,displayName:q.user.displayName},document=await savePolicyDocument({clientId:client.id,policyNumber:client.policyNumber,clientName:`${client.name} ${client.surname}`,originalName:path.basename(q.file.originalname).slice(0,200),storageName:q.file.filename,mimeType:q.file.mimetype,size:q.file.size,uploadedAt,uploadedBy},q.user.tenantId,client);await syncInsuranceGraph();await recordBusinessAudit(q,'document.uploaded','document',document.id,`Dodat dokument ${document.originalName} polisi ${document.policyNumber}`,{mimeType:document.mimeType,size:document.size,policyNumber:document.policyNumber});r.status(201).json(document)}catch(e){if(q.file)fs.rmSync(q.file.path,{force:true});n(e)}});
app.get('/api/documents/:id/download',async(q,r,n)=>{try{const documentId=String(q.params.id||''),document=(await all('policy_documents',memoryPolicyDocuments,q.user.tenantId)).find(item=>item.id===documentId);if(!document)return r.status(404).json({message:'Dokument nije pronađen.'});const filePath=path.resolve(UPLOAD_DIR,document.storageName);if(path.dirname(filePath)!==UPLOAD_DIR||!fs.existsSync(filePath))return r.status(404).json({message:'Fajl dokumenta nije pronađen.'});r.download(filePath,document.originalName)}catch(e){n(e)}});
app.get('/api/search',async(q,r,n)=>{try{
  const term=String(q.query.q||'').trim();
  if(!term)return r.json(await all('clients',memoryClients,q.user.tenantId));
  if(mode!=='arango')return r.json(memoryClients.filter(client=>client.tenantId===q.user.tenantId&&`${client.name} ${client.surname}`.toLocaleLowerCase('sr').includes(term.toLocaleLowerCase('sr'))));
  const cursor=await db.query(aql`
    LET normalized=FIRST(TOKENS(${term},"sr_name_search"))
    FOR client IN ${db.view('client_search')}
      SEARCH ANALYZER(STARTS_WITH(client.name,normalized) OR STARTS_WITH(client.surname,normalized),"sr_name_search")
      FILTER client.tenantId==${q.user.tenantId}
      SORT client.surname,client.name
      RETURN UNSET(client,"_key","_id","_rev")
  `);
  r.json(await cursor.all())
}catch(e){n(e)}});
app.get('/api/analytics/kpis',async(q,r,n)=>{try{const[clients,payments,claims]=await Promise.all([all('clients',memoryClients,q.user.tenantId),all('payments',memoryPayments,q.user.tenantId),all('claims',memoryClaims,q.user.tenantId)]);r.json(insuranceKpis(clients,payments,claims))}catch(e){n(e)}});
app.get('/api/analytics',async(q,r,n)=>{try{r.json(analytics(await all('clients',memoryClients,q.user.tenantId),await all('insurers',memoryInsurers,q.user.tenantId)))}catch(e){n(e)}});app.use('/api',(q,r)=>r.status(404).json({message:'API ruta nije pronađena.',requestId:q.requestId}));app.use((e,q,r,n)=>{console.error(JSON.stringify({type:'server_error',requestId:q.requestId,message:e.message,timestamp:new Date().toISOString()}));r.status(500).json({message:'Greška na serveru.',requestId:q.requestId})});app.use((q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
async function start(port=PORT){await init();return app.listen(port,()=>console.log(`Kotva: http://localhost:${port}`))}
if(require.main===module)start().then(server=>{let shuttingDown=false;const shutdown=signal=>{if(shuttingDown)return;shuttingDown=true;console.log(JSON.stringify({type:'shutdown',signal,timestamp:new Date().toISOString()}));const timer=setTimeout(()=>process.exit(1),10000);timer.unref();server.close(async()=>{await warehouse.closeWarehouse();clearTimeout(timer);process.exit(0)})};process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'))}).catch(error=>{console.error(error);process.exit(1)});
module.exports={app,start};
