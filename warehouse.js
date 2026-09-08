const fs=require('node:fs');
const path=require('node:path');
const{Pool}=require('pg');

let pool=null,initialized=false;
const warehouseConfig=()=>process.env.WAREHOUSE_URL?{connectionString:process.env.WAREHOUSE_URL}:process.env.WAREHOUSE_HOST?{host:process.env.WAREHOUSE_HOST,port:Number(process.env.WAREHOUSE_DB_PORT)||5432,database:process.env.WAREHOUSE_DATABASE||'kotva_warehouse',user:process.env.WAREHOUSE_USER||'kotva',password:process.env.WAREHOUSE_PASSWORD}:null;

function disabledError(){const error=new Error('PostgreSQL analytics warehouse nije konfigurisan.');error.status=503;return error}
function dateParts(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))throw new Error(`Warehouse date is invalid: ${value}`);
  const date=new Date(`${value}T00:00:00Z`),year=date.getUTCFullYear(),month=date.getUTCMonth()+1,day=date.getUTCDate();
  return{key:year*10000+month*100+day,value,year,quarter:Math.ceil(month/3),month,monthName:new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(date),day};
}
async function initializeWarehouse(){
  const connection=warehouseConfig();if(!connection)return false;if(initialized)return true;
  pool=new Pool({...connection,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});
  const schema=fs.readFileSync(path.join(__dirname,'warehouse','schema.sql'),'utf8');await pool.query(schema);initialized=true;return true;
}
async function ensureDate(client,value){const date=dateParts(value);await client.query('INSERT INTO dim_date(date_key,full_date,calendar_year,calendar_quarter,calendar_month,month_name,day_of_month) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(date_key) DO NOTHING',[date.key,date.value,date.year,date.quarter,date.month,date.monthName,date.day]);return date.key}
async function dimensionKey(client,table,keyColumn,tenantId,naturalColumn,naturalValue,extraColumns=[],extraValues=[]){
  const columns=['tenant_id',naturalColumn,...extraColumns],values=[tenantId,naturalValue,...extraValues],placeholders=values.map((item,index)=>`$${index+1}`).join(','),updates=extraColumns.map(column=>`${column}=EXCLUDED.${column}`).join(',')||`${naturalColumn}=EXCLUDED.${naturalColumn}`;
  const result=await client.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${placeholders}) ON CONFLICT(tenant_id,${naturalColumn}) DO UPDATE SET ${updates} RETURNING ${keyColumn}`,values);return result.rows[0][keyColumn];
}
async function loadWarehouse({tenantId,user,clients,payments,claims,pseudonymize}){
  if(!warehouseConfig())throw disabledError();await initializeWarehouse();const connection=await pool.connect(),started=Date.now(),loadId=`warehouse-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
  try{
    await connection.query('BEGIN');const policyKeys=new Map();let policyRows=0,paymentRows=0,claimRows=0;
    for(const policy of clients){
      const customerKey=await dimensionKey(connection,'dim_customer','customer_key',tenantId,'customer_id',pseudonymize(policy.id),['age','age_group'],[Number(policy.age),Number(policy.age)<18?'0-17':Number(policy.age)<26?'18-25':Number(policy.age)<36?'26-35':Number(policy.age)<46?'36-45':Number(policy.age)<56?'46-55':Number(policy.age)<66?'56-65':'66+']),insurerKey=await dimensionKey(connection,'dim_insurer','insurer_key',tenantId,'insurer_name',policy.insurer),typeKey=await dimensionKey(connection,'dim_insurance_type','insurance_type_key',tenantId,'insurance_type',policy.insuranceType),saleDateKey=await ensureDate(connection,policy.saleDate),validFromDateKey=await ensureDate(connection,policy.validFrom),validUntilDateKey=await ensureDate(connection,policy.validUntil),sourceUpdatedAt=policy.policyHistory?.at(-1)?.timestamp||null;
      const result=await connection.query('INSERT INTO fact_policies(tenant_id,policy_number,customer_key,insurer_key,insurance_type_key,sale_date_key,valid_from_date_key,valid_until_date_key,premium,currency,policy_status,payment_status,source_updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(tenant_id,policy_number) DO UPDATE SET customer_key=EXCLUDED.customer_key,insurer_key=EXCLUDED.insurer_key,insurance_type_key=EXCLUDED.insurance_type_key,sale_date_key=EXCLUDED.sale_date_key,valid_from_date_key=EXCLUDED.valid_from_date_key,valid_until_date_key=EXCLUDED.valid_until_date_key,premium=EXCLUDED.premium,currency=EXCLUDED.currency,policy_status=EXCLUDED.policy_status,payment_status=EXCLUDED.payment_status,source_updated_at=EXCLUDED.source_updated_at,loaded_at=NOW() RETURNING policy_key',[tenantId,policy.policyNumber,customerKey,insurerKey,typeKey,saleDateKey,validFromDateKey,validUntilDateKey,Number(policy.premium),policy.currency,policy.policyStatus,policy.paymentStatus,sourceUpdatedAt]);policyKeys.set(policy.id,result.rows[0].policy_key);policyRows++;
    }
    for(const payment of payments){const policyKey=policyKeys.get(payment.clientId);if(!policyKey)continue;const dateKey=await ensureDate(connection,payment.paymentDate);await connection.query('INSERT INTO fact_payments(tenant_id,receipt_number,policy_key,payment_date_key,amount,currency,payment_method) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,receipt_number) DO UPDATE SET policy_key=EXCLUDED.policy_key,payment_date_key=EXCLUDED.payment_date_key,amount=EXCLUDED.amount,currency=EXCLUDED.currency,payment_method=EXCLUDED.payment_method,loaded_at=NOW()',[tenantId,payment.receiptNumber,policyKey,dateKey,Number(payment.amount),payment.currency,payment.method]);paymentRows++}
    for(const claim of claims){const policyKey=policyKeys.get(claim.clientId);if(!policyKey)continue;const dateKey=await ensureDate(connection,claim.incidentDate);await connection.query('INSERT INTO fact_claims(tenant_id,claim_number,policy_key,incident_date_key,estimated_amount,currency,claim_status) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,claim_number) DO UPDATE SET policy_key=EXCLUDED.policy_key,incident_date_key=EXCLUDED.incident_date_key,estimated_amount=EXCLUDED.estimated_amount,currency=EXCLUDED.currency,claim_status=EXCLUDED.claim_status,loaded_at=NOW()',[tenantId,claim.claimNumber,policyKey,dateKey,Number(claim.estimatedAmount),claim.currency,claim.status]);claimRows++}
    const completedAt=new Date(),durationMs=Date.now()-started;await connection.query('INSERT INTO warehouse_loads(load_id,tenant_id,started_at,completed_at,duration_ms,policy_rows,payment_rows,claim_rows,initiated_by,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[loadId,tenantId,new Date(started),completedAt,durationMs,policyRows,paymentRows,claimRows,user.username,'completed']);await connection.query('COMMIT');return{loadId,status:'completed',startedAt:new Date(started).toISOString(),completedAt:completedAt.toISOString(),durationMs,rows:{policies:policyRows,payments:paymentRows,claims:claimRows},initiatedBy:{id:user.id,username:user.username,displayName:user.displayName,role:user.role}};
  }catch(error){await connection.query('ROLLBACK');throw error}finally{connection.release()}
}
async function warehouseStatus(tenantId){
  if(!warehouseConfig())return{configured:false,connected:false};await initializeWarehouse();const result=await pool.query("SELECT (SELECT COUNT(*)::int FROM fact_policies WHERE tenant_id=$1) AS policies,(SELECT COUNT(*)::int FROM fact_payments WHERE tenant_id=$1) AS payments,(SELECT COUNT(*)::int FROM fact_claims WHERE tenant_id=$1) AS claims,(SELECT MAX(completed_at) FROM warehouse_loads WHERE tenant_id=$1 AND status='completed') AS last_loaded_at",[tenantId]);return{configured:true,connected:true,...result.rows[0]};
}
async function warehouseReport(tenantId,report){
  if(!warehouseConfig())throw disabledError();await initializeWarehouse();const reports={monthly:"SELECT calendar_year,calendar_quarter,calendar_month,currency,policy_count::int,written_premium::float8 FROM vw_monthly_portfolio WHERE tenant_id=$1 ORDER BY calendar_year,calendar_month,currency",insurers:"SELECT insurer_name,currency,policy_count::int,written_premium::float8,collected_premium::float8,claim_count::int,estimated_claims::float8,collection_rate::float8,estimated_loss_ratio::float8 FROM vw_insurer_performance WHERE tenant_id=$1 ORDER BY currency,written_premium DESC"};if(!reports[report]){const error=new Error('Warehouse izveštaj nije pronađen.');error.status=404;throw error}return(await pool.query(reports[report],[tenantId])).rows;
}
async function closeWarehouse(){if(pool)await pool.end()}

module.exports={initializeWarehouse,loadWarehouse,warehouseStatus,warehouseReport,closeWarehouse,isConfigured:()=>Boolean(warehouseConfig())};
