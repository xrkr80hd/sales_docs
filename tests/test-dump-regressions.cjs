const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=require('../scripts/contract-loader.cjs');
test('website addresses accept www and bare domains while rejecting unsafe schemes and embedded credentials',()=>{
 const api=load()(path.resolve('lib/consultant-links.ts'));
 assert.equal(api.normalizedConsultantUrl('www.walker.com'),'https://www.walker.com/');
 assert.equal(api.normalizedConsultantUrl('walker.com/stock?q=1'),'https://walker.com/stock?q=1');
 assert.equal(api.normalizedConsultantUrl('https://walker.com/path'),'https://walker.com/path');
 for(const value of ['javascript:alert(1)','data:text/html,abc','https://user:pass@walker.com','www.walker.com\n','https://',''])assert.equal(api.normalizedConsultantUrl(value),null,value);
});
test('temporary authentication outage is not reported as sign-out and cannot write activity',async()=>{
 for(const status of [503,401]){
  let queries=0;const db={auth:{getUser:async()=>({data:{user:null},error:{status}})},from(){queries++;throw Error('Must not query');}};
  delete require.cache[path.resolve('app/api/me/sale-commander/route.ts')];
 const api=load({'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/organization-branding':{brandingOwner:async()=> 'owner'}})(path.resolve('app/api/me/sale-commander/route.ts'));
  for(const method of ['GET','PUT']){const response=await api[method](new Request('https://fixture/api/me/sale-commander',{method,headers:{authorization:'Bearer fixture'},...(method==='PUT'?{body:'{"goal":18}'}:{})}));assert.equal(response.status,status);if(status===503)assert(!/sign in/i.test((await response.json()).error));}assert.equal(queries,0);
 }
});
test('activity save acknowledges only after the scoped compare-and-set and preserves other consultant settings',async()=>{
 let saved,where=[];const columns=[];const db={auth:{getUser:async()=>({data:{user:{id:'me'}},error:null})},from(table){let writing=false;const q={select(value){columns.push(value);return q;},eq(k,v){where.push([k,v]);return q;},maybeSingle(){return q;},update(value){saved=value;writing=true;return q;},then(done){return Promise.resolve({data:writing?[{user_id:'me'}]:table==='organization_memberships'?null:{consultant_info:{phone:'keep-me'},updated_at:'old'},error:null}).then(done);}};return q;}};
 delete require.cache[path.resolve('app/api/me/sale-commander/route.ts')];
 const api=load({'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/organization-branding':{brandingOwner:async()=> 'owner'}})(path.resolve('app/api/me/sale-commander/route.ts'));
 const response=await api.PUT(new Request('https://fixture/api/me/sale-commander',{method:'PUT',headers:{authorization:'Bearer fixture'},body:'{"goal":18}'}));assert.equal(response.status,200);assert.equal((await response.json()).commander.goal,18);assert.equal(saved.consultant_info.phone,'keep-me');assert.equal(saved.consultant_info.saleCommander.goal,18);assert(where.some(([k,v])=>k==='user_id'&&v==='me'));assert(where.some(([k,v])=>k==='updated_at'&&v==='old'));assert(!columns.includes('dealer_info,consultant_info,updated_at'));
});
test('vehicle trim survives normalization and is included in vehicle description without mixing fields',()=>{
 const api=load()(path.resolve('lib/walker-workflow.ts'));const data=api.normalizeWorkflowData({vehicleYear:'2025',vehicleMake:'Toyota',vehicleModel:'Camry',vehicleTrim:'XSE',dealType:'used',tradeYear:'2020',tradeMake:'Honda'});assert.equal(data.vehicleTrim,'XSE');assert.equal(api.getYearMakeModel(data),'2025 Toyota Camry XSE');assert.equal(data.tradeYear,'2020');assert.equal(data.tradeMake,'Honda');
});
