const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n],Date,Object,Array,String,Number,Boolean,Response,Request,console,...globals});return exports;}
function storage(){const items=new Map();return{getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};}
const workflow=load('lib/walker-workflow.ts');
const sensitive={socialSecurityNumber:'SYNTHETIC-SECRET',social_security_number:'SYNTHETIC-SECRET',SSN:'SYNTHETIC-SECRET',buyer_ssn:'SYNTHETIC-SECRET'};
test('workflow allowlist removes SSN aliases and nested legacy keys but retains payoff and customer fields',()=>{
 const clean=workflow.normalizeWorkflowData({...sensitive,customerName:'Synthetic Customer',tradeIn:'yes',tradeVin:'TESTVIN',accountNumber:'TEST-ACCOUNT',payoff15Day:'12000',perDiem:'2.75',sectionComplete:{...sensitive,trade:true},unexpected:{ssn:'SYNTHETIC-SECRET'}});
 assert(!JSON.stringify(clean).includes('SYNTHETIC-SECRET'));assert(!JSON.stringify(clean).match(/ssn|socialSecurity|social_security/i));
 for(const[k,v]of Object.entries({customerName:'Synthetic Customer',tradeIn:'yes',tradeVin:'TESTVIN',accountNumber:'TEST-ACCOUNT',payoff15Day:'12000',perDiem:'2.75'}))assert.equal(clean[k],v);
});
test('loading rewrites existing browser workflow without extending the retention timestamp',()=>{
 const sessionStorage=storage(),created=String(Date.now()-3600000);sessionStorage.setItem('walker.workflow.created-at.v1',created);sessionStorage.setItem(workflow.WORKFLOW_STORAGE_KEY,JSON.stringify({...sensitive,customerName:'Synthetic Customer'}));
 const w=load('lib/walker-workflow.ts',{}, {window:{sessionStorage}});assert.equal(w.loadWorkflow().customerName,'Synthetic Customer');assert(!sessionStorage.getItem(w.WORKFLOW_STORAGE_KEY).includes('SYNTHETIC-SECRET'));assert.equal(sessionStorage.getItem('walker.workflow.created-at.v1'),created);
 w.saveWorkflow({...w.createDefaultWorkflowData(),...sensitive});assert(!sessionStorage.getItem(w.WORKFLOW_STORAGE_KEY).includes('SYNTHETIC-SECRET'));
});
test('existing 24-hour browser expiry still removes workflow, notes, signatures and deal ID',()=>{
 const sessionStorage=storage();for(const key of [workflow.WORKFLOW_STORAGE_KEY,workflow.SIGNATURE_STORAGE_KEY,workflow.DELIVERY_CHECKLIST_NOTES_STORAGE_KEY,'walker.deal.id.v1'])sessionStorage.setItem(key,'{}');sessionStorage.setItem('walker.workflow.created-at.v1',String(Date.now()-25*3600000));load('lib/walker-workflow.ts',{}, {window:{sessionStorage}}).loadWorkflow();for(const key of [workflow.WORKFLOW_STORAGE_KEY,workflow.SIGNATURE_STORAGE_KEY,workflow.DELIVERY_CHECKLIST_NOTES_STORAGE_KEY,'walker.deal.id.v1'])assert.equal(sessionStorage.getItem(key),null);
});
function api(){const rows=[{id:'mine',user_id:'consultant',status:'open',workflow_data:{...sensitive,customerName:'Synthetic Customer'},signatures:{...sensitive,valid:'test-signature'}}];const writes=[];let valid=true;
 const db={auth:{getUser:async()=>({data:{user:valid?{id:'consultant'}:null},error:null})},from(){let filters=[],payload;const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},order:()=>q,update:p=>{payload=p;return q;},insert:p=>{payload=p;return q;},single:()=>q,then(resolve,reject){if(payload)writes.push(payload);const matches=rows.filter(r=>filters.every(f=>f(r)));return Promise.resolve({data:payload?{id:'mine',updated_at:'test'}:matches,error:null}).then(resolve,reject);}};return q;}};
 const routes=load('app/api/deals/route.ts',{'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/walker-workflow':workflow});return{...routes,writes,setValid:v=>valid=v};}
const req=body=>new Request('http://local/api/deals',{method:body?'POST':'GET',headers:{Authorization:'Bearer synthetic'},...(body?{body:JSON.stringify(body)}:{})});
test('server strips legacy SSN on reads and untrusted SSN on create/update before persistence',async()=>{const h=api();let r=await h.GET(req());assert(!JSON.stringify(await r.json()).includes('SYNTHETIC-SECRET'));for(const id of [undefined,'mine']){r=await h.POST(req({id,workflowData:{...sensitive,accountNumber:'TEST-LOAN',sectionComplete:{...sensitive}},signatures:{...sensitive,valid:'test-signature'}}));assert.equal(r.status,200);}assert.equal(h.writes.length,2);assert(!JSON.stringify(h.writes).includes('SYNTHETIC-SECRET'));assert.equal(h.writes[0].workflow_data.accountNumber,'TEST-LOAN');assert.equal(h.writes[0].signatures.valid,'test-signature');});
test('arrays and invalid sessions cannot create deal records',async()=>{const h=api();assert.equal((await h.POST(req({workflowData:[]}))).status,400);h.setValid(false);assert.equal((await h.POST(req({workflowData:{}}))).status,401);assert.equal(h.writes.length,0);});
test('acceptance requires current version, finite nonfuture timestamp, and 72-hour TTL',()=>{const d=load('lib/disclosure.ts'),now=1000000000000;assert(d.validDisclosureAcceptance({version:d.DISCLOSURE_VERSION,acceptedAt:now},now));for(const v of [now,{version:'old',acceptedAt:now},{version:d.DISCLOSURE_VERSION,acceptedAt:now+1},{version:d.DISCLOSURE_VERSION,acceptedAt:now-d.DISCLOSURE_TTL_MS}])assert.equal(d.validDisclosureAcceptance(v,now),false);});
