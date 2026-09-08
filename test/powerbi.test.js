const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..'),modelPath=path.join(root,'powerbi','KotvaAnalytics.SemanticModel','model.bim');

test('Power BI semantic model is valid and follows the warehouse star schema',()=>{
  const model=JSON.parse(fs.readFileSync(modelPath,'utf8')).model,tables=new Map(model.tables.map(table=>[table.name,table]));
  for(const table of['Date','Customer','Insurer','Insurance Type','Policies'])assert.ok(tables.has(table),`Missing ${table}`);
  assert.equal(model.relationships.length,4);assert.ok(model.relationships.every(item=>item.fromTable==='Policies'));
  const measures=tables.get('Policies').measures.map(item=>item.name);
  for(const measure of['Policy Count','Written Premium','Collection Rate','Estimated Loss Ratio','MoM Premium Growth'])assert.ok(measures.includes(measure),`Missing ${measure}`);
  const source=JSON.stringify(model.tables.map(table=>table.partitions));assert.match(source,/bi_policy_performance/);assert.match(source,/PostgreSQLServer/);assert.ok(model.expressions.some(item=>item.name==='TenantId'));assert.equal((source.match(/TenantId/g)||[]).length,5);
});

test('Power BI assets contain no direct personal data fields',()=>{
  const content=fs.readFileSync(modelPath,'utf8').toLowerCase();
  for(const field of ['jmbg','passport','first_name','surname'])assert.equal(content.includes(field),false,`Direct identifier found: ${field}`);
  JSON.parse(fs.readFileSync(path.join(root,'powerbi','kotva-theme.json'),'utf8'));
});
