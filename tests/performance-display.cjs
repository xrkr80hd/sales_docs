const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('../scripts/contract-loader.cjs');

test('monthly performance uses assigned new/used production, sums combined goals and handles zero denominators',()=>{
 const read=load();const {emptyBoard}=read(path.resolve('lib/manager-board.ts'));
 const {performanceSummary,attainment}=read(path.resolve('lib/performance-display.ts'));
 const board={...emptyBoard(),newGoal:10,usedGoal:30,newGrossGoal:100,usedGrossGoal:300,rows:{a:{newSold:5,usedSold:6,newGrossActual:80,usedGrossActual:90,mtd:99},outside:{newSold:999,usedSold:999}}};
 const groups=performanceSummary(board,[{id:'a'}]);
 assert.equal(groups[2].sold,11);assert.equal(groups[2].goal,40);assert.equal(groups[2].grossGoal,400);assert.equal(groups[2].grossActual,170);
 assert.equal(attainment(groups[2].sold,groups[2].goal),'28%');assert.equal(attainment(0,0),'N/A');assert.equal(attainment(5,0),'N/A');assert.equal(attainment(Infinity,10),'N/A');
});

function fixture(role='sales_manager',workspaceRole=''){
 const selections=[];const board={newGoal:10,usedGoal:20,newGrossGoal:10000,usedGrossGoal:20000,rows:{consultant:{objective:12,mtd:3,weeklyGoal:4,avg90:10,days:[99],appointmentsGoal:88,projection:15,newSold:2,usedSold:1,confirmedBy:'PRIVATE-APPROVER'}},yearlyGross:999,schedule:'PRIVATE-SCHEDULE',weeklyUpdate:'PRIVATE-MESSAGE',events:[{reason:'PRIVATE-EVENT'}],publishedAt:'2026-10-01T00:00:00Z'};
 const db={auth:{getUser:async()=>({data:{user:{id:'me',email:'fixture@example.test',app_metadata:{workspace_role:workspaceRole}}},error:null})},from(table){let columns;let organization='A';const q={select(c){columns=c;selections.push(c);return q;},eq(k,v){if(table==='organizations'&&k==='id')organization=v;return q;},in(){return q;},single(){return q;},maybeSingle(){return q;},then(resolve){const value=table==='profiles'?{role,display_name:'Fixture'}:table==='organizations'?{id:organization,name:'Store '+organization}:table==='organization_memberships'?(columns.startsWith('user_id,profiles')?[{user_id:'consultant',profiles:{role:'user',display_name:'Fixture consultant'}}]:{organization_id:'A'}):columns.startsWith('board:')?{board}:[{user_id:'consultant',projections:{'A:2026-10':{value:15}}}];return Promise.resolve({data:value,error:null}).then(resolve);}};return q;}};
 const read=load({'@/lib/supabase-server':{getSupabaseServiceClient:()=>db},'@/lib/organization-branding':{organizationBranding:async()=>({}),organizationSettings:async()=>({dealer_info:{managerBoards:{'A:2026-10':board}},updated_at:board.publishedAt}),brandingOwner:async()=>'owner'}});
 delete require.cache[path.resolve('app/api/manager-board/route.ts')];
 return {api:read(path.resolve('app/api/manager-board/route.ts')),selections};
}
const request=(query='',method='GET')=>new Request('http://fixture/api/manager-board?view=display&month=2026-10'+query,{method,headers:{Authorization:'Bearer synthetic'}});
test('display response is read-only, retains production and excludes scheduling, annual, messaging and audit fields',async()=>{
 const {api,selections}=fixture();const response=await api.GET(request());assert.equal(response.status,200);const body=await response.json();assert.equal(body.canManage,false);assert.equal(body.board.rows.consultant.newSold,2);assert.equal(body.board.newGrossGoal,10000);assert(selections.includes('board:dealer_info->managerBoards->"A:2026-10"'));assert(!selections.includes("user_id,dealer_info,updated_at"));
 const encoded=JSON.stringify(body);assert(!encoded.includes('PRIVATE'));for(const key of ['yearlyGross','schedule','weeklyUpdate','events'])assert.equal(body.board[key],undefined);assert.equal(body.board.rows.consultant.days,undefined);assert.equal(body.board.rows.consultant.appointmentsGoal,undefined);assert.equal((await api.POST(request('','POST'))).status,405);
});
test('ordinary consultant cannot request manager display or override their assigned organization',async()=>{
 const {api}=fixture('user');assert.equal((await api.GET(request('&organization=B'))).status,403);
});
test('assigned manager display ignores a foreign organization override, BDM remains read-only',async()=>{
 const {api}=fixture();const body=await (await api.GET(request('&organization=B'))).json();assert.equal(body.organization.id,'A');
 const bdm=fixture('user','bdm');const response=await bdm.api.GET(request());assert.equal(response.status,200);assert.equal((await response.json()).canManage,false);
});
