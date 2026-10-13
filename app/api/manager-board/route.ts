import { organizationBranding } from "@/lib/organization-branding";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { emptyBoard,emptyRow,currentBoardMonth,safeBoardNumber,type MonthBoard } from "@/lib/manager-board";
function record(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
async function context(request:Request){
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return Response.json({error:"Sign in required."},{status:401});
 const db=getSupabaseServiceClient();const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return Response.json({error:"Invalid session."},{status:401});
 const [{data:profile},{data:membership}]=await Promise.all([db.from("profiles").select("role,display_name").eq("id",user.id).single(),db.from("organization_memberships").select("organization_id").eq("user_id",user.id).maybeSingle()]);
 const admin=profile?.role==="admin"||user.email?.toLowerCase()==="xrkr80hd@gmail.com";
 const district=admin||(profile?.role==="sales_manager"&&user.app_metadata?.workspace_role==="district_manager");
 const bdm=profile?.role==="user"&&user.app_metadata?.workspace_role==="bdm";
 const manager=admin||profile?.role==="sales_manager";
 const url=new URL(request.url);const requested=url.searchParams.get("organization");const organizationId=district&&requested?requested:membership?.organization_id;
 if(organizationId&&(await organizationBranding(db))[organizationId]?.deletedAt)return Response.json({error:"This organization was deleted. Assigned users have moved to Walker Automotive."},{status:404});
 const month=url.searchParams.get("month")||currentBoardMonth();
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return Response.json({error:"Invalid month."},{status:400});
 return {db,user,profile,admin,district,manager,bdm,organizationId,month};
}
let ownerLookup: Promise<string> | undefined;
async function boardOwner(db:ReturnType<typeof getSupabaseServiceClient>){
 if(!ownerLookup)ownerLookup=(async()=>{
  for(let page=1;page<=50;page++){
   const {data,error}=await db.auth.admin.listUsers({page,perPage:200});if(error)throw error;
   const owner=data.users.find(user=>user.email?.toLowerCase()==="xrkr80hd@gmail.com");if(owner)return owner.id;
   if(data.users.length<200)break;
  }
  throw new Error("The Master Admin account could not be found.");
 })().catch(error=>{ownerLookup=undefined;throw error;});
 return ownerLookup;
}
async function boardRecords(db:ReturnType<typeof getSupabaseServiceClient>,organizationId?:string,month?:string){
 // A protected, permanent Master Admin owns shared board records. Reassigning
 // or deleting a manager leaves the organization's objectives and approvals intact.
 const ownerId=await boardOwner(db);
 const {data:row,error}=await db.from("user_settings").select("user_id,dealer_info,updated_at").eq("user_id",ownerId).maybeSingle();
 if(error)throw error;if(!row)return [];
 const boards=record(record(row.dealer_info).managerBoards);
 const saved=organizationId&&month?record(boards[`${organizationId}:${month}`]):{};
 return [{...row,boards,saved:saved.publishedAt?saved as unknown as MonthBoard:undefined}];
}
function annualDefault(records:Awaited<ReturnType<typeof boardRecords>>,organizationId:string,month:string){
 const result=emptyBoard();let newest="";
 for(const row of records)for(const [key,value]of Object.entries(row.boards)){const board=value as MonthBoard;if(key.startsWith(`${organizationId}:${month.slice(0,4)}-`)&&board.publishedAt>newest){result.yearlyGross=board.yearlyGross;newest=board.publishedAt;}}
 return result;
}
export async function GET(request:Request){
 try{
  const ctx=await context(request);if(ctx instanceof Response)return ctx;
  const {db,user,manager,bdm,district,organizationId,month}=ctx;
  if(new URL(request.url).searchParams.get("district")==="1"){
   if(!district)return Response.json({error:"District manager access required."},{status:403});
   const records=await boardRecords(db);const stores:Record<string,MonthBoard>={};const periods:Record<string,MonthBoard>={};
   for(const row of records)for(const [key,value]of Object.entries(row.boards)){const board=value as MonthBoard;if(!periods[key]||board.publishedAt>periods[key].publishedAt)periods[key]=board;}
   for(const [key,board]of Object.entries(periods)){const id=key.slice(0,-8);if(key.endsWith(`:${month}`))stores[id]=board;else if(!stores[id])stores[id]=annualDefault(records,id,month);}
   const branding=await organizationBranding(db);
   for(const id of Object.keys(stores))if(branding[id]?.deletedAt)delete stores[id];
   const notifications=Object.entries(periods).flatMap(([key,board])=>(board.events||[]).filter(event=>!event.readBy.includes(user.id)).map(event=>({...event,organizationId:key.slice(0,-8),month:key.slice(-7),version:board.publishedAt})));
   return Response.json({stores,notifications,month},{headers:{"Cache-Control":"private, no-store"}});
  }
  if(!organizationId)return Response.json({error:"Assign this account to an organization to use the board."},{status:400});
  const [{data:organization,error:orgError},{data:members,error:memberError},records]=await Promise.all([db.from("organizations").select("id,name").eq("id",organizationId).single(),db.from("organization_memberships").select("user_id,profiles!organization_memberships_user_id_fkey(display_name,role)").eq("organization_id",organizationId),boardRecords(db,organizationId,month)]);
  if(orgError||memberError)throw orgError||memberError;
  const latest=records.filter(row=>"saved" in row&&row.saved).sort((a,b)=>(b.saved as MonthBoard).publishedAt.localeCompare((a.saved as MonthBoard).publishedAt))[0];
  const board=latest&&"saved"in latest?latest.saved as MonthBoard:annualDefault(records,organizationId,month);
  const roster=(members||[]).filter(member=>(member.profiles as unknown as {role:string})?.role==="user").map(member=>({id:member.user_id,name:(member.profiles as unknown as {display_name:string})?.display_name||"Unnamed consultant"}));
  const ids=roster.map(person=>person.id);
  const {data:settings,error:settingsError}=ids.length?await db.from("user_settings").select("user_id,consultant_info").in("user_id",ids):{data:[],error:null};
  if(settingsError)throw settingsError;
  const proposals=Object.fromEntries((settings||[]).map(row=>[row.user_id,record(record(row.consultant_info).monthlyProjections)[`${organizationId}:${month}`]]));
  const publicBoard={newGoal:board.newGoal,usedGoal:board.usedGoal,rows:board.rows,schedule:board.schedule,weeklyUpdate:board.weeklyUpdate,publishedAt:board.publishedAt};
  const branding=(await organizationBranding(db))[organizationId];
  return Response.json({organization:{...organization,...branding},month,board:manager||bdm?{...board,...(!manager?{events:[]}: {})}:publicBoard,roster,proposals:manager?proposals:{[user.id]:proposals[user.id]},me:user.id,canManage:manager,canViewStats:manager||bdm,version:board.publishedAt},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not load the board."},{status:500});}
}
export async function POST(request:Request){
 try{
  const ctx=await context(request);if(ctx instanceof Response)return ctx;
  const {db,user,profile,manager,district,organizationId,month}=ctx;
  if(!organizationId)return Response.json({error:"Choose an assigned organization."},{status:400});
  const {data:organizationExists}=await db.from("organizations").select("id").eq("id",organizationId).maybeSingle();if(!organizationExists)return Response.json({error:"Organization not found."},{status:404});
  const body=await request.json().catch(()=>null);if(!body)return Response.json({error:"Invalid request."},{status:400});
  if(body.month&&body.month!==month)return Response.json({error:"The reporting month changed. Reload before saving."},{status:409});
  const key=`${organizationId}:${month}`;
  const records=await boardRecords(db,organizationId,month);
  const latest=records.filter(row=>"saved"in row&&row.saved).sort((a,b)=>(b.saved as MonthBoard).publishedAt.localeCompare((a.saved as MonthBoard).publishedAt))[0];
  const board=structuredClone(latest&&"saved"in latest?latest.saved as MonthBoard:annualDefault(records,organizationId,month));
  if(ctx.bdm)return Response.json({error:"BDM board access is read only."},{status:403});
  if(body.action==="submit-projection"){
   if(board.rows[user.id]?.confirmedAt)return Response.json({error:"Your projection is confirmed and locked. Ask your manager for a change."},{status:403});
   const {data:membership}=await db.from("organization_memberships").select("user_id").eq("user_id",user.id).eq("organization_id",organizationId).maybeSingle();
   if(!membership)return Response.json({error:"Organization access required."},{status:403});
   const projection=safeBoardNumber(body.projection);
   const {data:settings,error}=await db.from("user_settings").select("consultant_info,updated_at").eq("user_id",user.id).maybeSingle();if(error)throw error;
   const info=record(settings?.consultant_info);const next={...info,monthlyProjections:{...record(info.monthlyProjections),[key]:{value:projection,submittedAt:new Date().toISOString()}}};
   const {error:saveError}=await db.from("user_settings").upsert({user_id:user.id,consultant_info:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(saveError)throw saveError;
   return Response.json({saved:true,projection});
  }
  if(!manager && !(district&&body.action==="read-notification"))return Response.json({error:"Manager access required."},{status:403});
  if(body.version!==board.publishedAt)return Response.json({error:"The board changed. Reload before saving so another update is preserved."},{status:409});
  if(body.action==="save-board"){
   const input=record(body.board);
   board.newGoal=safeBoardNumber(input.newGoal);board.usedGoal=safeBoardNumber(input.usedGoal);board.newGrossGoal=safeBoardNumber(input.newGrossGoal??0,false);board.usedGrossGoal=safeBoardNumber(input.usedGrossGoal??0,false);board.monthlyGross=board.newGrossGoal+board.usedGrossGoal;board.yearlyGross=safeBoardNumber(input.yearlyGross,false);
   board.schedule=String(input.schedule||"").slice(0,4000);
   const weeklyUpdate=String(input.weeklyUpdate||"").slice(0,4000);
   if(weeklyUpdate!==board.weeklyUpdate&&weeklyUpdate)board.events.push({id:crypto.randomUUID(),type:"weekly-update",consultantId:"",consultantName:"Weekly update",previous:0,next:0,reason:weeklyUpdate,by:profile?.display_name||user.email||"Manager",at:new Date().toISOString(),readBy:[]});
   board.weeklyUpdate=weeklyUpdate;
   const {data:members,error}=await db.from("organization_memberships").select("user_id").eq("organization_id",organizationId);if(error)throw error;
   const memberIds=new Set((members||[]).map(member=>member.user_id));
   for(const [id,value]of Object.entries(record(input.rows))){
    if(!memberIds.has(id))return Response.json({error:"A consultant is not assigned to this organization."},{status:400});
    const row=record(value);const previous=board.rows[id]||emptyRow();
    // Generic edits can never change an approved projection or confirmation.
    if(previous.confirmedAt&&row.projection!==undefined&&Number(row.projection)!==previous.projection)return Response.json({error:"Use Change projection and provide a reason."},{status:403});
    const nextMtd=safeBoardNumber(row.mtd);
    if(nextMtd!==previous.mtd){
     const {data:person}=await db.from("profiles").select("display_name").eq("id",id).maybeSingle();
     board.events.push({id:crypto.randomUUID(),type:"sale-update",consultantId:id,consultantName:person?.display_name||"Consultant",previous:previous.mtd,next:nextMtd,reason:"Manager reported an updated month-to-date sold count.",by:profile?.display_name||user.email||"Manager",at:new Date().toISOString(),readBy:[]});
    }
    board.rows[id]={...previous,newSold:safeBoardNumber(row.newSold??previous.newSold??0),usedSold:safeBoardNumber(row.usedSold??previous.usedSold??0),newGrossActual:safeBoardNumber(row.newGrossActual??previous.newGrossActual??0,false),usedGrossActual:safeBoardNumber(row.usedGrossActual??previous.usedGrossActual??0,false),objective:safeBoardNumber(row.objective),appointmentsGoal:safeBoardNumber(row.appointmentsGoal??previous.appointmentsGoal??0),appointmentsSet:safeBoardNumber(row.appointmentsSet??previous.appointmentsSet??0),mtd:nextMtd,weeklyGoal:safeBoardNumber(row.weeklyGoal),avg90:safeBoardNumber(row.avg90,false),days:Array.from({length:7},(_,index)=>safeBoardNumber(Array.isArray(row.days)?row.days[index]||0:0))};
   }
  }else if(body.action==="confirm-projection"||body.action==="change-projection"){
   const {data:member}=await db.from("organization_memberships").select("user_id,profiles!organization_memberships_user_id_fkey(display_name,role)").eq("user_id",body.userId).eq("organization_id",organizationId).maybeSingle();
   if(!member||(member.profiles as unknown as {role:string})?.role!=="user")return Response.json({error:"Choose a consultant assigned to this dealership."},{status:400});
   const previous=board.rows[body.userId]||emptyRow();let value:number;
   if(body.action==="confirm-projection"){
    if(previous.confirmedAt)return Response.json({error:"Already confirmed. Use Change projection."},{status:409});
    const {data:settings,error}=await db.from("user_settings").select("consultant_info").eq("user_id",body.userId).maybeSingle();if(error)throw error;
    const proposal=record(record(record(settings?.consultant_info).monthlyProjections)[key]);
    if(proposal.value===undefined)return Response.json({error:"The consultant has not submitted a projection."},{status:400});
    value=safeBoardNumber(proposal.value);
    if(Number(body.expectedProjection)!==value)return Response.json({error:"The consultant revised their projection. Reload before confirming."},{status:409});
   }else{
    if(!previous.confirmedAt)return Response.json({error:"Confirm the initial projection first."},{status:400});
    const reason=typeof body.reason==="string"?body.reason.trim().slice(0,1000):"";
    if(!reason)return Response.json({error:"A reason is required to notify the District Manager."},{status:400});
    value=safeBoardNumber(body.projection);
    board.events.push({id:crypto.randomUUID(),type:"projection-change",consultantId:body.userId,consultantName:(member.profiles as unknown as {display_name:string}).display_name||"Consultant",previous:previous.projection||0,next:value,reason,by:profile?.display_name||user.email||"Manager",at:new Date().toISOString(),readBy:[]});
   }
   board.rows[body.userId]={...previous,projection:value,confirmedAt:new Date().toISOString(),confirmedBy:user.id};
  }else if(body.action==="read-notification"){
   if(!district)return Response.json({error:"District manager access required."},{status:403});
   const event=board.events.find(event=>event.id===body.eventId);if(!event)return Response.json({error:"Notification not found."},{status:404});if(!event.readBy.includes(user.id))event.readBy.push(user.id);
  }else return Response.json({error:"Unknown board action."},{status:400});
  board.publishedAt=new Date(Math.max(Date.now(),(Date.parse(board.publishedAt)||0)+1)).toISOString();
  // Preserve the existing dealer/contact JSON and use a compare-and-set to protect concurrent writes.
  const storageUser=await boardOwner(db);
  const {data:settings,error:readError}=await db.from("user_settings").select("dealer_info,updated_at").eq("user_id",storageUser).maybeSingle();if(readError)throw readError;
  const dealer=record(settings?.dealer_info);const dealerInfo={...dealer,managerBoards:{...record(dealer.managerBoards),[key]:board}};
  if(settings){
   if(latest&&settings.updated_at!==latest.updated_at)return Response.json({error:"Account or board data changed. Reload before saving."},{status:409});
   const {data:saved,error}=await db.from("user_settings").update({dealer_info:dealerInfo,updated_at:board.publishedAt}).eq("user_id",storageUser).eq("updated_at",settings.updated_at).select("user_id");if(error)throw error;if(!saved?.length)return Response.json({error:"Another update was saved first. Reload the board."},{status:409});
  }else{
   const {error}=await db.from("user_settings").insert({user_id:storageUser,dealer_info:dealerInfo,updated_at:board.publishedAt});if(error)throw error;
  }
  return Response.json({saved:true,version:board.publishedAt});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Could not save the board."},{status:400});}
}
