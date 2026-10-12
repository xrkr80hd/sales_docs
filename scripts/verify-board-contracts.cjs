const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).formatToParts(new Date());
const period=month.find(p=>p.type==='year').value+'-'+month.find(p=>p.type==='month').value;
const state={profiles:[{id:'manager',role:'sales_manager',display_name:'Test manager'},{id:'consultant',role:'user',display_name:'Test consultant'},{id:'district',role:'sales_manager',display_name:'Test district manager'},{id:'admin',role:'admin',display_name:'Test admin'}],organizations:[{id:'store-a',name:'Test CDJR',slug:'test-cdjr'},{id:'store-b',name:'Other test store',slug:'other-test'}],organization_memberships:[{user_id:'manager',organization_id:'store-a'},{user_id:'consultant',organization_id:'store-a'},{user_id:'district',organization_id:'store-b'},{user_id:'admin',organization_id:'store-a'}],user_settings:[{user_id:'manager',dealer_info:{street:'Keep this address'},consultant_info:{name:'Keep manager contact'},updated_at:'2020-01-01T00:00:00.000Z'},{user_id:'consultant',dealer_info:{street:'Keep consultant address'},consultant_info:{phone:'Keep this phone'},updated_at:'2020-01-01T00:00:00.000Z'}],consultant_cards:[]};
const authUsers=Object.fromEntries(state.profiles.map(user=>[user.id,{id:user.id,email:`${user.id}@test.invalid`,app_metadata:{...(user.id==='district'?{workspace_role:'district_manager'}:{})}}]));
authUsers.admin.email='xrkr80hd@gmail.com';
const actions=[];
class Query {
 constructor(table){this.table=table;this.filters=[];this.operation='read';}
 select(){return this;}
 eq(key,value){this.filters.push(row=>key==='profiles.role'?(row.profiles||{}).role===value:row[key]===value);return this;}
 in(key,values){this.filters.push(row=>values.includes(key==='profiles.role'?(row.profiles||{}).role:row[key]));return this;}
 order(){return this;}
 is(key,value){this.filters.push(row=>row[key]===value);return this;}
 not(key,_operator,value){this.filters.push(row=>row[key]!==value);return this;}
 update(value){this.operation='update';this.value=value;return this;}
 insert(value){this.operation='insert';this.value=value;return this;}
 upsert(value){this.operation='upsert';this.value=value;return this;}
 attach(row){return {...row,profiles:state.profiles.find(profile=>profile.id===(row.user_id||row.id))};}
 async run(single=false){
  const rows=state[this.table]||(state[this.table]=[]);
  let selected=rows.filter(row=>this.filters.every(filter=>filter(this.attach(row))));
  if(this.operation==='update'){selected.forEach(row=>Object.assign(row,this.value));}
  if(this.operation==='insert'||this.operation==='upsert'){
   const values=Array.isArray(this.value)?this.value:[this.value];selected=[];
   for(const value of values){const idField=this.table==='profiles'||this.table==='organizations'?'id':'user_id';let existing=rows.find(row=>row[idField]===value[idField]);if(!existing){existing={dealer_info:{},consultant_info:{},...value};if(this.table==='organizations'&&!existing.id)existing.id='new-test-org';rows.push(existing);}else Object.assign(existing,value);selected.push(existing);}
  }
  return {data:single?selected.length?structuredClone(this.attach(selected[0])):null:selected.map(row=>structuredClone(this.attach(row))),error:null};
 }
 single(){return this.run(true);}
 maybeSingle(){return this.run(true);}
 then(resolve,reject){return this.run().then(resolve,reject);}
}
const db={from:table=>new Query(table),auth:{getUser:async token=>({data:{user:authUsers[token]||null},error:authUsers[token]?null:{message:'invalid'}}),admin:{listUsers:async()=>({data:{users:Object.values(authUsers)},error:null}),inviteUserByEmail:async email=>{actions.push('invite');const user={id:'new-test-user',email,app_metadata:{}};authUsers[user.id]=user;return {data:{user},error:null};},updateUserById:async(id,value)=>{actions.push('metadata');Object.assign(authUsers[id],value);return {data:{user:authUsers[id]},error:null};}}},storage:{getBucket:async()=>({error:{message:'not found'}}),createBucket:async name=>{actions.push('bucket:'+name);return {error:null};},from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'https://test.invalid/photo.jpg'}})})}};
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const requireLocal=name=>{if(name==='@/lib/supabase-server')return {getSupabaseServiceClient:()=>db};if(name==='@/lib/require-admin')return {requireAdmin:async request=>request.headers.get('authorization')==='Bearer admin'?{userId:'admin'}:Response.json({error:'Admin required'},{status:403})};if(name.startsWith('@/'))return load(path.resolve(name.slice(2)+'.ts'));return require(name);};vm.runInNewContext(code,{module,exports:module.exports,require:requireLocal,process:{env:{}},Response,Request,URL,File,FormData,Uint8Array,crypto:globalThis.crypto,structuredClone,Intl,Date,console},{filename:file});cache.set(file,module.exports);return module.exports;}
const queue=load(path.resolve('app/api/workspace/queue/route.ts'));
const board=load(path.resolve('app/api/manager-board/route.ts')); 
const links=load(path.resolve('app/api/consultant-links/route.ts'));
const photo=load(path.resolve('app/api/me/photo/route.ts'));
const workspace=load(path.resolve('app/api/admin/workspace/route.ts'));
const empty=load(path.resolve('lib/manager-board.ts')).emptyBoard;
function req(user,body,query='',endpoint='manager-board'){return new Request('https://test.invalid/api/'+endpoint+query,{method:body?'POST':'GET',headers:user?{authorization:'Bearer '+user,'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});}
async function json(response){const data=await response.json();return {status:response.status,data};}
(async()=>{
 assert.equal((await board.GET(req(''))).status,401);
 state.deals=[{id:'local-deal',user_id:'consultant',sm_ready:true,status:'open',sm_finished_at:null},{id:'foreign-deal',user_id:'outside-consultant',sm_ready:true,status:'open',sm_finished_at:null}];
 const scopedQueue=await json(await queue.GET(req('manager',undefined,'?type=sm')));assert.equal(scopedQueue.status,200,JSON.stringify(scopedQueue.data));assert.deepEqual(scopedQueue.data.deals.map(deal=>deal.id),['local-deal']);
 assert.equal((await board.POST(req('consultant',{action:'save-board',board:empty(),version:''}))).status,403);
 let response=await json(await board.POST(req('manager',{action:'save-board',board:{...empty(),newGoal:12,usedGoal:8,monthlyGross:54321,yearlyGross:654321,rows:{consultant:{objective:10,mtd:3,weeklyGoal:2,avg90:7.5,days:[1,0,0,1,0,1]}}},version:''})));
 assert.equal(response.status,200,JSON.stringify(response.data));let version=response.data.version;
 assert.equal(state.user_settings[0].dealer_info.street,'Keep this address');
 assert.equal((await board.POST(req('consultant',{action:'submit-projection',projection:8}))).status,200);
 assert.equal(state.user_settings[1].consultant_info.phone,'Keep this phone');
 let publicData=await json(await board.GET(req('consultant')));assert.equal(publicData.status,200);assert.equal(publicData.data.board.monthlyGross,undefined);assert.equal(publicData.data.board.yearlyGross,undefined);assert.equal(publicData.data.board.events,undefined);assert.equal(publicData.data.proposals.consultant.value,8);
 response=await json(await board.POST(req('manager',{action:'confirm-projection',userId:'consultant',expectedProjection:8,version})));assert.equal(response.status,200,JSON.stringify(response.data));version=response.data.version;
 assert.equal((await board.POST(req('consultant',{action:'submit-projection',projection:9}))).status,403);
 const approved=await json(await board.GET(req('manager')));assert.equal(approved.data.board.rows.consultant.projection,8);assert.ok(approved.data.board.rows.consultant.confirmedAt);
 const illegal=structuredClone(approved.data.board);illegal.rows.consultant.projection=15;
 assert.equal((await board.POST(req('manager',{action:'save-board',board:illegal,version}))).status,403);
 assert.equal((await board.POST(req('manager',{action:'change-projection',userId:'consultant',projection:10,reason:'',version}))).status,400);
 response=await json(await board.POST(req('manager',{action:'change-projection',userId:'consultant',projection:10,reason:'Test approved change',version})));assert.equal(response.status,200,JSON.stringify(response.data));version=response.data.version;
 const district=await json(await board.GET(req('district',undefined,'?district=1')));assert.ok(district.data.notifications.some(event=>event.type==='sale-update'));const projectionNotification=district.data.notifications.find(event=>event.type==='projection-change');assert.equal(projectionNotification.previous,8);assert.equal(projectionNotification.next,10);
 assert.equal((await board.GET(req('consultant',undefined,'?district=1'))).status,403);
 const spoof=await json(await board.GET(req('consultant',undefined,'?organization=store-b')));assert.equal(spoof.data.organization.id,'store-a');
 for(const event of district.data.notifications){response=await json(await board.POST(req('district',{action:'read-notification',eventId:event.id,version},'?organization=store-a')));assert.equal(response.status,200,JSON.stringify(response.data));version=response.data.version;}
 assert.equal((await json(await board.GET(req('district',undefined,'?district=1')))).data.notifications.length,0);
 assert.equal((await board.POST(req('manager',{action:'save-board',board:approved.data.board,version:'stale-version'}))).status,409);
 const put=body=>new Request('https://test.invalid/api/consultant-links',{method:'PUT',headers:{authorization:'Bearer manager','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await links.PUT(put({links:[{id:'bad',name:'Unsafe',url:'javascript:alert(1)'}]}))).status,400);
 assert.equal((await links.PUT(put({links:[{id:'dealer-connect',name:'Dealer Connect',url:'https://dealerconnect.chrysler.com/'}]}))).status,200);
 assert.equal(state.user_settings[0].dealer_info.street,'Keep this address');assert.ok(state.user_settings.find(row=>row.user_id==='admin').dealer_info.managerBoards);
 state.profiles.find(profile=>profile.id==='manager').role='user';const persisted=await json(await board.GET(req('consultant')));assert.equal(persisted.data.board.rows.consultant.projection,10);state.profiles.find(profile=>profile.id==='manager').role='sales_manager';
 assert.equal((await photo.POST(new Request('https://test.invalid/api/me/photo',{method:'POST'}))).status,401);
 assert.equal((await workspace.POST(req('consultant',{action:'create-organization',name:'Unauthorized'}))).status,403);
 response=await json(await workspace.POST(req('admin',{action:'create-user',name:'New test user',email:'new-user@test.invalid',role:'floor_manager',organizationId:'store-a',chatEnabled:true,canDm:true,canOrgChat:true,cardEnabled:true})));assert.equal(response.status,200,JSON.stringify(response.data));
 assert.equal(authUsers['new-test-user'].app_metadata.workspace_role,'floor_manager');assert.equal(state.profiles.find(user=>user.id==='new-test-user').role,'sales_manager');assert.equal(state.organization_memberships.find(member=>member.user_id==='new-test-user').organization_id,'store-a');assert.ok(actions.includes('bucket:consultant-media-new-test-user'));
 console.log('PASS: authorization, organization isolation, gross privacy, projection approval/lock, reason-required manager changes, district notifications/read, stale-write rejection, contact preservation, safe URLs, and invitation/role/membership/bucket contract.');
 console.log('All fixtures are in-memory. No live data, accounts, buckets, or emails were created.');
})().catch(error=>{console.error(error);process.exitCode=1;});
