const assert=require('node:assert/strict');
const path=require('node:path');
const state={profiles:[{id:'manager',role:'sales_manager',display_name:'Test manager'},{id:'consultant',role:'user',display_name:'Test consultant'},{id:'district',role:'sales_manager',display_name:'Test district manager'},{id:'admin',role:'admin',display_name:'Test admin'}],organizations:[{id:'store-a',name:'Test CDJR',slug:'test-cdjr'},{id:'store-b',name:'Other test store',slug:'other-test'}],organization_memberships:[{user_id:'manager',organization_id:'store-a'},{user_id:'consultant',organization_id:'store-a'},{user_id:'district',organization_id:'store-b'},{user_id:'admin',organization_id:'store-a'}],user_settings:[{user_id:'manager',dealer_info:{street:'Keep this address'},consultant_info:{name:'Keep manager contact'},updated_at:'2020-01-01T00:00:00.000Z'},{user_id:'consultant',dealer_info:{street:'Keep consultant address'},consultant_info:{phone:'Keep this phone'},updated_at:'2020-01-01T00:00:00.000Z'}],consultant_cards:[]};
const authUsers=Object.fromEntries(state.profiles.map(user=>[user.id,{id:user.id,email:`${user.id}@test.invalid`,app_metadata:{...(user.id==='district'?{workspace_role:'district_manager'}:{})}}]));
authUsers.admin.email='xrkr80hd@gmail.com';
const actions=[];
class Query {
 constructor(table){this.table=table;this.filters=[];this.operation='read';}
 select(columns){this.columns=columns;return this;}
 eq(key,value){this.filters.push(row=>key==='profiles.role'?(row.profiles||{}).role===value:row[key]===value);return this;}
 in(key,values){this.filters.push(row=>values.includes(key==='profiles.role'?(row.profiles||{}).role:row[key]));return this;}
 order(){return this;}
 is(key,value){this.filters.push(row=>row[key]===value);return this;}
 not(key,_operator,value){this.filters.push(row=>row[key]!==value);return this;}
 update(value){this.operation='update';this.value=value;return this;}
 insert(value){this.operation='insert';this.value=value;return this;}
 upsert(value){this.operation='upsert';this.value=value;return this;}
 attach(row){const aliases={};for(const field of (this.columns||'').split(',')){const match=field.trim().match(/^(\w+):(\w+)((?:->.*)?)$/);if(!match)continue;const parts=[match[2],...match[3].split(/->>?/).filter(Boolean).map(p=>p.replace(/^"|"$/g,''))];aliases[match[1]]=parts.reduce((value,key)=>value?.[key],row);}return {...row,...aliases,profiles:state.profiles.find(profile=>profile.id===(row.user_id||row.id))};}
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
}
function query(table){const builder=new Query(table);return Object.assign(builder,{then:(resolve,reject)=>builder.run().then(resolve,reject)});}
const db={from:query,auth:{getUser:async token=>({data:{user:authUsers[token]||null},error:authUsers[token]?null:{message:'invalid'}}),admin:{listUsers:async()=>({data:{users:Object.values(authUsers)},error:null}),inviteUserByEmail:async email=>{actions.push('invite');const user={id:'new-test-user',email,app_metadata:{}};authUsers[user.id]=user;return {data:{user},error:null};},updateUserById:async(id,value)=>{actions.push('metadata');Object.assign(authUsers[id],value);return {data:{user:authUsers[id]},error:null};}}},storage:{getBucket:async()=>({error:{message:'not found'}}),createBucket:async name=>{actions.push('bucket:'+name);return {error:null};},from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:'https://test.invalid/photo.jpg'}})})}};
const load=require('./contract-loader.cjs')({'@/lib/supabase-server':{getSupabaseServiceClient:()=>({...db})},'@/lib/require-admin':{requireAdmin:async request=>request.headers.get('authorization')==='Bearer admin'?{userId:'admin'}:Response.json({error:'Admin required'},{status:403})}});

db.auth.admin.getUserById=async id=>({data:{user:authUsers[id]},error:authUsers[id]?null:{message:'missing'}});
db.auth.admin.createUser=async value=>{const user={id:'direct-user',...value};authUsers[user.id]=user;return {data:{user},error:null};};
const accounts=load(path.resolve('app/api/admin/users/[id]/route.ts'));
const security=load(path.resolve('app/api/admin/users/[id]/security/route.ts'));
const settings=load(path.resolve('app/api/me/settings/route.ts'));
const photo=load(path.resolve('app/api/me/photo/route.ts'));
const me=load(path.resolve('app/api/me/route.ts'));
const password=load(path.resolve('app/api/me/password/route.ts'));
const workspace=load(path.resolve('app/api/admin/workspace/route.ts'));
const board=load(path.resolve('app/api/manager-board/route.ts'));
const empty=load(path.resolve('lib/manager-board.ts')).emptyBoard;
function req(user,body,method='POST',query=''){return new Request('https://test.invalid/api/test'+query,{method,headers:user?{authorization:'Bearer '+user,'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});}
const target=id=>({params:Promise.resolve({id})});
(async()=>{
 state.consultant_cards=[{user_id:'consultant',display_name:'Public Name',profile_image_url:'https://test.invalid/public.jpg',phone:'public-phone'}];
 const publicBefore=JSON.stringify(state.consultant_cards);
 assert.equal((await accounts.PATCH(req('consultant',{display_name:'No'}),target('manager'))).status,403);
 assert.equal((await accounts.PATCH(req('admin',{display_name:'  '}),target('consultant'))).status,400);
 assert.equal((await accounts.PATCH(req('admin',{display_name:'Full Internal Name'}),target('consultant'))).status,200);
 let res=await settings.GET(req('consultant',undefined,'GET'));assert.equal((await res.json()).consultant_info.name,'Full Internal Name');
 assert.equal((await settings.PUT(req('consultant',{consultant_info:{name:'Internal Updated',phone:'internal-phone',email:'internal@test.invalid'},dealer_info:{dealershipName:'Internal Store'}},'PUT'))).status,200);
 const form=new FormData();form.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],'fixture.png',{type:'image/png'}));
 assert.equal((await photo.POST(new Request('https://test.invalid/api/me/photo',{method:'POST',headers:{authorization:'Bearer consultant'},body:form}))).status,200);
 assert.equal(JSON.stringify(state.consultant_cards),publicBefore,'Internal edits must never change public cards');
 assert.equal((await security.POST(req('consultant',{action:'verify'}),target('manager'))).status,403);
 assert.equal((await security.POST(req('admin',{action:'set-password',password:'short'}),target('consultant'))).status,400);
 assert.equal((await security.POST(req('admin',{action:'verify'}),target('consultant'))).status,200);assert.equal(authUsers.consultant.email_confirm,true);
 assert.equal((await security.POST(req('admin',{action:'require-password-change'}),target('consultant'))).status,200);
 assert.equal((await (await me.GET(req('consultant',undefined,'GET'))).json()).mustChangePassword,true);
 assert.equal((await password.POST(req('',{password:'in-memory-fixture-only'}))).status,401);
 assert.equal((await password.POST(req('consultant',{password:'short'}))).status,400);
 assert.equal((await password.POST(req('consultant',{password:'in-memory-fixture-only'}))).status,200);assert.equal(authUsers.consultant.app_metadata.must_change_password,false);
 for(const email of ['missing-at.invalid','a@@test.invalid','a@localhost','a@test.','a@ test.invalid','a'.repeat(100000)+'@test.invalid']){
  assert.equal((await workspace.POST(req('admin',{action:'create-user',name:'Invalid fixture',email,role:'bdm',organizationId:'store-a'}))).status,400);
 }
 assert.equal((await workspace.POST(req('admin',{action:'create-user',name:'Fixture BDM',email:'bdm@test.invalid',role:'bdm',organizationId:'store-a',createMode:'direct',password:'In-memory-fixture-only!',forceChange:false}))).status,200);
 assert.equal(authUsers['direct-user'].email_confirm,true);assert.equal(authUsers['direct-user'].app_metadata.must_change_password,false);assert.equal(authUsers['direct-user'].app_metadata.workspace_role,'bdm');
 let response=await board.POST(req('manager',{action:'save-board',board:{...empty(),newGrossGoal:15000,rows:{consultant:{objective:10,mtd:0,weeklyGoal:2,avg90:3,appointmentsGoal:40,appointmentsSet:12}}},version:''}));assert.equal(response.status,200,await response.clone().text());
 let payload=await (await board.GET(req('direct-user',undefined,'GET'))).json();assert.equal(payload.canManage,false);assert.equal(payload.canViewStats,true);assert.equal(payload.board.monthlyGross,15000);assert.equal(payload.board.rows.consultant.appointmentsGoal,40);assert.equal(payload.board.rows.consultant.appointmentsSet,12);
 assert.equal((await board.POST(req('direct-user',{action:'save-board',board:empty(),version:payload.version}))).status,403);
 assert.equal((await board.POST(req('direct-user',{action:'submit-projection',projection:5}))).status,403);
 assert.equal((await board.GET(req('direct-user',undefined,'GET','?district=1'))).status,403);
 payload=await (await board.GET(req('direct-user',undefined,'GET','?organization=store-b'))).json();assert.equal(payload.organization.id,'store-a');
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';
 process.env.SUPABASE_SERVICE_ROLE_KEY='fixture-only';
 const guardLoad=require('./contract-loader.cjs')({'@supabase/supabase-js':{AuthError:class extends Error{},createClient:()=>({auth:{getUser:async()=>({data:{user:{app_metadata:{must_change_password:true}}},error:null})}})}});
 const guard=guardLoad(path.resolve('lib/supabase-server.ts'));
 assert.equal((await guard.getSupabaseServiceClient().auth.getUser('fixture')).data.user,null);
 assert.equal((await guard.getSupabaseServiceClient({allowPasswordChange:true}).auth.getUser('fixture')).data.user.app_metadata.must_change_password,true);
 console.log('PASS: admin-only name/security edits, public/internal identity isolation, internal photo isolation, verification, required password change, direct account creation, BDM read-only scoped stats, and monthly appointment persistence. All users and passwords are isolated in-memory fixtures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
