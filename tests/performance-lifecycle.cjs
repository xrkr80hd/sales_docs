const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,globals={},deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>deps[n],Date,Map,Promise,Response,Request,URL,AbortSignal,console,...globals});return exports;}
function storage(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};}
test('300 callers share one resource request, then reuse it; account/resource scopes remain isolated',async()=>{
 const cache=load('lib/client-resource-cache.ts');let calls=0;const fetch=async()=>{calls++;return{value:12};};
 const values=await Promise.all(Array.from({length:300},()=>cache.loadResource('account-A','board',fetch)));
 assert.equal(calls,1);assert(values.every(v=>v.value===12));await cache.loadResource('account-A','board',fetch);assert.equal(calls,1);
 await cache.loadResource('account-B','board',fetch);await cache.loadResource('account-A','settings',fetch);assert.equal(calls,3);
 cache.invalidateResource('account-A','board');await cache.loadResource('account-A','board',fetch);assert.equal(calls,4);
});
test('TTL and explicit refresh request fresh data; logout prevents a late request repopulating cache',async()=>{
 let now=100;class Clock extends Date{static now(){return now;}}const cache=load('lib/client-resource-cache.ts',{Date:Clock});let calls=0;const fetch=async()=>++calls;
 await cache.loadResource('account','board',fetch,10);now=111;await cache.loadResource('account','board',fetch,10);assert.equal(calls,2);await cache.loadResource('account','board',fetch,10,true);assert.equal(calls,3);
 let finish;const pending=cache.loadResource('account','late',()=>new Promise(resolve=>finish=resolve));await Promise.resolve();cache.clearResourceCache();finish('private');await pending;assert.equal(cache.cachedResource('account','late'),undefined);
});
test('successful board changes invalidate all scoped board views while retaining unrelated and other-account cache',async()=>{
 const cache=load('lib/client-resource-cache.ts');
 await cache.loadResource('A','board:management',async()=>1);
 await cache.loadResource('A','board:display',async()=>2);
 await cache.loadResource('A','paperwork-settings',async()=>3);
 await cache.loadResource('B','board:display',async()=>4);
 cache.invalidateResourceGroup('A','board:');
 assert.equal(cache.cachedResource('A','board:management'),undefined);
 assert.equal(cache.cachedResource('A','board:display'),undefined);
 assert.equal(cache.cachedResource('A','paperwork-settings'),3);
 assert.equal(cache.cachedResource('B','board:display'),4);
});
test('persistent appearance cache strips roles, tokens, forms and messages and expires after five minutes',()=>{
 const store=storage();let now=1000;class Clock extends Date{static now(){return now;}}const cache=load('lib/workspace-appearance-cache.ts',{sessionStorage:store,Date:Clock});
 cache.saveAppearance('A:org:user',{profileImageUrl:'https://fixture.test/icon',role:'admin',access_token:'SECRET',workflow:{customerName:'PRIVATE'},messages:['PRIVATE']});
 assert(![...store.values.values()].join('').includes('PRIVATE'));assert(![...store.values.values()].join('').includes('SECRET'));assert.equal(cache.readAppearance('A:org:user').profileImageUrl,'https://fixture.test/icon');assert.equal(cache.readAppearance('B:org:user'),undefined);
 now+=300000;assert.equal(cache.readAppearance('A:org:user'),undefined);
});
test('browser inactivity survives reload, shares active tabs, and expires at eight hours without extending on reads',()=>{
 const store=storage();const clock=load('lib/browser-activity.ts',{localStorage:store});const start=100000;
 clock.recordBrowserActivity('A',true,start);assert.equal(clock.browserSessionExpired('A',start+clock.BROWSER_IDLE_MS-1),false);assert.equal(clock.browserSessionExpired('A',start+clock.BROWSER_IDLE_MS),true);
 const reloaded=load('lib/browser-activity.ts',{localStorage:store});assert.equal(reloaded.browserSessionExpired('A',start+clock.BROWSER_IDLE_MS),true);
 clock.recordBrowserActivity('A',true,start+1000);assert.equal(reloaded.browserLastActiveAt('A'),start+1000);assert.equal(reloaded.browserSessionExpired('A',start+clock.BROWSER_IDLE_MS),false);assert.equal(reloaded.browserSessionExpired('B',start+clock.BROWSER_IDLE_MS),false);
});
test('consultant board uses one-month projection, own proposal, assigned organization and excludes manager data even for admin',async()=>{
 const selections=[],orgs=[];const data={profiles:{role:'admin',display_name:'Fixture admin'},organization_memberships:{organization_id:'assigned'},organizations:{id:'assigned',name:'Assigned store'},user_settings:{board:{newGoal:12,usedGoal:10,rows:{me:{mtd:2,objective:12,days:[],newGrossActual:999}},events:[{reason:'PRIVATE'}],yearlyGross:888,weeklyUpdate:'Team update',publishedAt:'version'},projections:{'assigned:2026-10':{value:12}}}};
 const db={auth:{getUser:async()=>({data:{user:{id:'me',email:'admin@example.test'}},error:null})},from(table){let columns;const q={select:c=>{columns=c;selections.push(c);return q;},eq:(k,v)=>{if(table==='organizations'&&k==='id')orgs.push(v);return q;},single:()=>q,maybeSingle:()=>q,then:resolve=>Promise.resolve({data:table==='organization_memberships'&&columns.startsWith('user_id,profiles')?[{user_id:'me',profiles:{role:'user',display_name:'Fixture'}}]:data[table],error:null}).then(resolve)};return q;}};
 const types=load('lib/manager-board.ts');const route=load('app/api/manager-board/route.ts',{}, {'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/organization-branding':{brandingOwner:async()=> 'owner',organizationBranding:async()=>({}),organizationSettings:()=>{throw Error('Must not load entire settings');}},'@/lib/manager-board':types});
 const response=await route.GET(new Request('http://fixture/api/manager-board?view=consultant&organization=OTHER&month=2026-10',{headers:{Authorization:'Bearer synthetic'}}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.organization.id,'assigned');assert.equal(body.canManage,false);assert.equal(body.board.rows.me.mtd,2);assert(!JSON.stringify(body).includes('999'));assert(!JSON.stringify(body).includes('PRIVATE'));assert.equal(body.board.yearlyGross,undefined);assert.equal(body.proposals.me.value,12);assert.deepEqual(orgs,['assigned']);assert(selections.includes('board:dealer_info->managerBoards->"assigned:2026-10"'));assert(!selections.includes('user_id,dealer_info,updated_at'));
});
