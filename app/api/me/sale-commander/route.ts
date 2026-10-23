import {brandingOwner} from "@/lib/organization-branding";
import {getSupabaseServiceClient} from "@/lib/supabase-server";
function currentMonth(){const p=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit"}).formatToParts(new Date());return `${p.find(x=>x.type==="year")?.value}-${p.find(x=>x.type==="month")?.value}`;}
async function managerObjective(db:ReturnType<typeof getSupabaseServiceClient>,userId:string){
 const {data:membership,error:membershipError}=await db.from("organization_memberships").select("organization_id").eq("user_id",userId).maybeSingle();if(membershipError)throw membershipError;if(!membership?.organization_id)return null;
 const ownerId=await brandingOwner(db);
 const key=`${membership.organization_id}:${currentMonth()}`;
 // Project a single assigned objective instead of downloading the entire board store.
 const {data:settings,error}=await db.from("user_settings").select(`objective:dealer_info->managerBoards->"${key}"->rows->"${userId}"->objective`).eq("user_id",ownerId).maybeSingle();
 if(error)throw error;
 const value=settings?.objective;
 return typeof value==="number"&&Number.isFinite(value)&&value>0?value:null;
}
function token(req:Request){return (req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();}
async function actor(req:Request){const db=getSupabaseServiceClient();const value=token(req);if(!value)return null;const {data:{user},error}=await db.auth.getUser(value);return user&&!error?{db,user}:null;}
export async function GET(req:Request){try{const a=await actor(req);if(!a)return Response.json({error:"Sign in required."},{status:401});const [{data,error},objective]=await Promise.all([a.db.from("user_settings").select("commander:consultant_info->saleCommander").eq("user_id",a.user.id).maybeSingle(),managerObjective(a.db,a.user.id)]);if(error)throw error;return Response.json({commander:{...(data?.commander && typeof data.commander === "object" && !Array.isArray(data.commander) ? data.commander : {}),...(objective!==null?{goal:objective}:{})},assignedGoal:objective},{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"Unable to load your activity data."},{status:500});}}
export async function PUT(req:Request){try{const a=await actor(req);if(!a)return Response.json({error:"Sign in required."},{status:401});const commander=await req.json();if(!commander||typeof commander!=="object"||Array.isArray(commander)||JSON.stringify(commander).length>150000)return Response.json({error:"Invalid activity data."},{status:400});
const [{data,error},objective]=await Promise.all([a.db.from("user_settings").select("dealer_info,consultant_info,updated_at").eq("user_id",a.user.id).maybeSingle(),managerObjective(a.db,a.user.id)]);if(error)throw error;
const existing=data?.consultant_info&&typeof data.consultant_info==="object"?data.consultant_info:{};
if(objective!==null)commander.goal=objective;
const update={consultant_info:{...existing,saleCommander:commander},updated_at:new Date().toISOString()};
if(data){const {data:rows,error:saveError}=await a.db.from("user_settings").update(update).eq("user_id",a.user.id).eq("updated_at",data.updated_at).select("user_id");if(saveError)throw saveError;if(!rows?.length)return Response.json({error:"Your activity changed elsewhere. Reload before saving."},{status:409});}
else{const {error:saveError}=await a.db.from("user_settings").insert({user_id:a.user.id,dealer_info:{},...update});if(saveError)throw saveError;}
return Response.json({commander},{headers:{"Cache-Control":"private, no-store"}});
}catch{return Response.json({error:"Could not save your Sale Commander progress."},{status:500});}}
