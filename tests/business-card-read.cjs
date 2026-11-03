const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const createLoader=require('../scripts/contract-loader.cjs');
function fixture(failedSection=false){
 const db={auth:{getUser:async()=>({data:{user:{id:'fixture',email:'fixture@example.test'}},error:null})},from(table){const q={select:()=>q,eq:()=>q,single:()=>q,maybeSingle:()=>q,order:()=>q,then(resolve){const data=table==='profiles'?{role:'user',card_enabled:true,display_name:'Old setup name'}:table==='consultant_cards'?{id:'card',slug:'saved-card',display_name:'Saved card name',phone:'SAVED-PHONE',email:'saved@example.test',published_at:'2026-10-24'}:table==='user_settings'?{dealer_info:{},consultant_info:{name:'Old setup name',phone:'OLD-PHONE',email:'old@example.test'}}:table==='organization_memberships'?null:[];return Promise.resolve({data,error:failedSection&&table==='consultant_vehicles'?{message:'unavailable'}:null}).then(resolve);}};return q;}};
 const read=createLoader({'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/organization-branding':{organizationBranding:async()=>({})}});
 delete require.cache[path.resolve('app/api/me/business-card/route.ts')];return read(path.resolve('app/api/me/business-card/route.ts'));
}
const request=()=>new Request('http://fixture/api/me/business-card',{headers:{Authorization:'Bearer synthetic'}});
test('a saved business card retains its contact edits instead of reverting to consultant defaults',async()=>{const response=await fixture().GET(request());assert.equal(response.status,200);const result=await response.json();assert.equal(result.card.draft.identity.displayName,'Saved card name');assert.equal(result.card.draft.identity.phone,'SAVED-PHONE');assert.equal(result.card.draft.identity.email,'saved@example.test');});
test('a failed saved-section read returns an error instead of silently showing an empty card',async()=>{assert.equal((await fixture(true).GET(request())).status,503);});
