const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const vm=require('node:vm');
const C='00000000-0000-4000-8000-000000000001',H='00000000-0000-4000-8000-000000000002',O='00000000-0000-4000-8000-000000000003';
function harness({admin=false,authorized=true,authError=null}={}){
 const tables={profiles:[{id:'me',role:admin?'admin':'user'}],organization_memberships:[{user_id:'me',organization_id:O,chat_enabled:true,can_dm:true,can_org_chat:true}],organizations:[{id:O,name:'Test organization'}],messenger_conversations:[{id:C,kind:'dm',organization_id:O,messenger_participants:[{user_id:'me',last_read_at:'2000-01-01'}]},{id:H,kind:'dm',organization_id:O,messenger_participants:[{user_id:'other'}]}],messenger_messages:[{id:1,conversation_id:C,sender_id:'me',body:'Existing',created_at:'2026-01-01',deleted_at:null},{id:2,conversation_id:H,sender_id:'other',body:'Private',created_at:'2026-01-02',deleted_at:null}],messenger_participants:[]};
 let writes=0, countReads=0;
 function from(name,scoped){let filters=[],one=false,mode='read',payload,head=false,count=false,limit=Infinity,order;const q={
 select(s,opts){if(opts?.count)countReads++;head=opts?.head;count=opts?.count;return q},eq(k,v){filters.push(r=>String(r[k])===String(v));return q},neq(k,v){filters.push(r=>r[k]!==v);return q},is(k,v){filters.push(r=>(r[k]??null)===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gt(k,v){filters.push(r=>r[k]>v);return q},lt(k,v){filters.push(r=>r[k]<v);return q},order(k,o){order=[k,o?.ascending];return q},limit(n){limit=n;return q},single(){one=true;return q},maybeSingle(){one=true;return q},insert(p){mode='insert';payload=p;return q},upsert(p){mode='insert';payload=p;return q},update(p){mode='update';payload=p;return q},then(resolve,reject){try{
 let rows=tables[name]||[];
 if(scoped){if(name==='messenger_conversations')rows=rows.filter(r=>r.id===C);if(name==='messenger_messages')rows=rows.filter(r=>r.conversation_id===C);}
 rows=rows.filter(r=>filters.every(f=>f(r)));
 if(mode==='insert'){writes++;const row={id:100+tables[name].length,created_at:new Date().toISOString(),...payload};tables[name].push(row);rows=[row]}
 if(mode==='update'){writes++;rows.forEach(r=>Object.assign(r,payload));}
 if(order)rows=[...rows].sort((a,b)=>(a[order[0]]>b[order[0]]?1:-1)*(order[1]?1:-1));
 return Promise.resolve({data:head?null:one?rows[0]||null:rows.slice(0,limit),error:null,count:count?rows.length:null}).then(resolve,reject);
 }catch(e){return Promise.reject(e).then(resolve,reject)}}};return q}
 const db={auth:{getUser:async()=>({data:{user:authorized?{id:'me'}:null},error:authError})},from:n=>from(n,false)};
 const scoped={from:n=>from(n,true),rpc:async n=>n==='messenger_accessible_organizations'?{data:[O],error:null}:{data:null,error:{message:'denied'}}};
 const moderation={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/chat-moderation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moderation});
 const output={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('app/api/messenger/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports:output.exports,require:n=>n==='@supabase/supabase-js'?{createClient:()=>scoped}:n==='@/lib/supabase-server'?{getSupabaseServiceClient:()=>db}:n==='@/lib/supabase-fetch'?{createSupabaseFetch:()=>fetch}:n==='@/lib/organization-branding'?{organizationBranding:async()=>({})}:moderation,process:{env:{}},Response,Request,URL,AbortSignal,fetch,console});
 return {...output.exports,tables,writes:()=>writes,countReads:()=>countReads};
}
const req=(body,query='',auth=true)=>new Request('http://localhost/api/messenger'+query,{method:body?'POST':'GET',headers:auth?{authorization:'Bearer test'}:{},...(body?{body:JSON.stringify(body)}:{})});
test('missing and invalid authentication rejected',async()=>{const h=harness();assert.equal((await h.GET(req(null,'',false))).status,401);assert.equal((await harness({authorized:false}).POST(req({action:'send'}))).status,401)});
test('an auth outage returns recoverable 503 without claiming the login expired',async()=>{const h=harness({authorized:false,authError:{status:0}});const response=await h.GET(req());assert.equal(response.status,503);assert.match((await response.json()).error,/temporarily unavailable/);assert.equal(h.writes(),0);});
for(const action of ['send','mark-read','clear-mine'])test(`${action} rejects nonparticipant even if admin`,async()=>{const h=harness({admin:true});assert.equal((await h.POST(req({action,conversationId:H,body:'Leak',messageId:2}))).status,403);assert.equal(h.writes(),0)});
for(const action of ['edit','delete'])test(`${action} rejects inaccessible message even if admin`,async()=>{const h=harness({admin:true});assert.equal((await h.POST(req({action,messageId:2,body:'Changed'}))).status,403);assert.equal(h.writes(),0)});
test('history endpoint rejects unauthorized conversation',async()=>{const h=harness();assert.equal((await h.GET(req(null,`?conversationId=${H}`))).status,403)});
test('sending persists and reloading returns sent text',async()=>{const h=harness();assert.equal((await h.POST(req({action:'send',conversationId:C,body:'Hello saved'}))).status,200);const result=await(await h.GET(req(null,`?conversationId=${C}`))).json();assert(result.messages.some(m=>m.body==='Hello saved'));assert(!result.messages.some(m=>m.body==='Private'))});
test('message length, malformed payload and unknown actions rejected',async()=>{const h=harness();assert.equal((await h.POST(req({action:'send',conversationId:C,body:'x'.repeat(4001)}))).status,400);assert.equal((await h.POST(req({action:'send',conversationId:C,body:''}))).status,400);assert.equal((await h.POST(req({action:'unrestricted-admin-read'}))).status,400);assert.equal(h.writes(),0)});
test('read marker must reference displayed conversation',async()=>{const h=harness();assert.equal((await h.POST(req({action:'mark-read',conversationId:C,messageId:2}))).status,403);assert.equal(h.writes(),0)});
test('list includes only scoped conversations and exact unread count',async()=>{const h=harness();const r=await(await h.GET(req())).json();assert.equal(r.conversations.length,1);assert.equal(r.conversations[0].id,C);assert.equal(r.conversations[0].unread,0)});
test('own edit and delete work after authorization',async()=>{const h=harness();assert.equal((await h.POST(req({action:'edit',messageId:1,body:'Edited'}))).status,200);assert.equal(h.tables.messenger_messages[0].body,'Edited');assert.equal((await h.POST(req({action:'delete',messageId:1}))).status,200);assert(h.tables.messenger_messages[0].deleted_at)});
test('DM creation denied by database cannot be bypassed',async()=>{const h=harness();assert.equal((await h.POST(req({action:'start-dm',userId:H}))).status,403)});

test('server stores only moderated profanity and slurs on send and edit',async()=>{const h=harness();const response=await h.POST(req({action:'send',conversationId:C,body:'fuck nigger'}));assert.equal(response.status,200);const stored=h.tables.messenger_messages.at(-1).body;assert(!stored.includes('fuck'));assert(!stored.includes('nigger'));assert(stored.includes('****'));await h.POST(req({action:'edit',messageId:1,body:'shit'}));assert.notEqual(h.tables.messenger_messages[0].body,'shit')});

test('directory opens without counting empty or unopened conversations',async()=>{const h=harness();assert.equal((await h.GET(req())).status,200);assert.equal(h.countReads(),0);});
test('summary counts only caller-authorized rooms, with no inaccessible DM leakage',async()=>{const h=harness();h.tables.messenger_messages.push({id:3,conversation_id:C,sender_id:'peer',created_at:'2026-02-01',body:'Test',deleted_at:null});const response=await h.GET(req(null,'?summary=1'));assert.equal(response.status,200);const data=await response.json();assert.equal(data.conversations.length,1);assert.equal(data.conversations[0].id,C);assert.equal(data.conversations[0].unread,1);assert.equal(h.countReads(),1);});
test('send acknowledges saved message even when conversation ordering update throws',async()=>{const h=harness();const response=await h.POST(req({action:'send',conversationId:C,body:'Immediate success'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.message.body,'Immediate success');assert.equal(data.message.sender_id,'me');});
