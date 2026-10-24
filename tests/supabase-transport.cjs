const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
function load(file,deps={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n],Request,Response,Headers,URL,AbortController,setTimeout,clearTimeout,fetch,console,...globals});
 return exports;
}
const {createSupabaseFetch}=load('lib/supabase-fetch.ts');
const json=value=>Response.json(value);
test('stalled network and stalled JSON body both abort actual transport without retrying',async()=>{
 for(const bodyStalls of [false,true]){
  let signal,calls=0;
  const bounded=createSupabaseFetch({timeoutMs:15,fetcher:async(_,init)=>{calls++;signal=init.signal;return bodyStalls?new Response(new ReadableStream({start(){}}),{headers:{'content-type':'application/json'}}):new Promise(()=>{});}});
  await assert.rejects(bounded('https://fixture.test/auth/v1/token',{method:'POST'}),/did not respond/);
  assert.equal(signal.aborted,true);assert.equal(calls,1);
 }
});
test('caller cancellation stops upstream immediately and already-cancelled calls do not start',async()=>{
 const parent=new AbortController();let upstream,calls=0;
 const bounded=createSupabaseFetch({signal:parent.signal,fetcher:async(_,init)=>{calls++;upstream=init.signal;return new Promise(()=>{});}});
 const operation=bounded('https://fixture.test/rest/v1/profiles');parent.abort();
 await assert.rejects(operation,/interrupted/);assert(upstream.aborted);
 await assert.rejects(bounded('https://fixture.test/rest/v1/profiles'),/interrupted/);assert.equal(calls,1);
});
test('successful JSON responses preserve status, headers and body for SDK decoding',async()=>{
 const bounded=createSupabaseFetch({fetcher:async()=>Response.json({ok:true},{status:201,headers:{'x-test':'preserved'}})});
 const response=await bounded('https://fixture.test/rest/v1/profiles');assert.equal(response.status,201);assert.equal(response.headers.get('x-test'),'preserved');assert.deepEqual(await response.json(),{ok:true});
});
test('real Supabase SDK exits a hung password login and the next attempt succeeds',async()=>{
 let calls=0,signal;
 const bounded=createSupabaseFetch({timeoutMs:15,fetcher:async(_,init)=>{
  calls++;signal=init.signal;
  if(calls===1)return new Promise(()=>{});
  return json({access_token:'fixture-token',refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:{id:'fixture-user',email:'fixture@example.test',app_metadata:{},user_metadata:{}}});
 }});
 const client=createClient('https://fixture.test','synthetic-public-key',{global:{fetch:bounded},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const result=await client.auth.signInWithPassword({email:'fixture@example.test',password:'synthetic-password'});
 assert(result.error);assert.equal(signal.aborted,true);assert.equal(calls,1);
 const recovered=await client.auth.signInWithPassword({email:'fixture@example.test',password:'synthetic-password'});
 assert.equal(recovered.error,null);assert.equal(recovered.data.session.user.id,'fixture-user');assert.equal(calls,2);
});
test('repeated session checks share pending refresh and allow a fresh check after settlement',async()=>{
 let calls=0,resolve;
 const browser=load('lib/supabase-browser.ts',{'@supabase/supabase-js':{createClient:()=>({auth:{getSession:()=>{calls++;return new Promise(r=>{resolve=r});}}})},'@/lib/supabase-fetch':{createSupabaseFetch}}, {process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-public-key'}}});
 const first=browser.restoreBrowserSession(),second=browser.restoreBrowserSession();assert.equal(first,second);assert.equal(calls,1);resolve({data:{session:null},error:null});await first;
 const next=browser.restoreBrowserSession();assert.equal(calls,2);resolve({data:{session:null},error:null});await next;
});
