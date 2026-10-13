import {getSupabaseServiceClient} from "@/lib/supabase-server";
function token(req:Request){return (req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();}
async function actor(req:Request){const db=getSupabaseServiceClient();const value=token(req);if(!value)return null;const {data:{user},error}=await db.auth.getUser(value);return user&&!error?{db,user}:null;}
export async function GET(req:Request){try{const a=await actor(req);if(!a)return Response.json({error:"Sign in required."},{status:401});const {data,error}=await a.db.from("user_settings").select("consultant_info").eq("user_id",a.user.id).maybeSingle();if(error)throw error;return Response.json({commander:data?.consultant_info?.saleCommander||null},{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"Unable to load your activity data."},{status:500});}}
export async function PUT(req:Request){try{const a=await actor(req);if(!a)return Response.json({error:"Sign in required."},{status:401});const commander=await req.json();if(!commander||typeof commander!=="object"||Array.isArray(commander)||JSON.stringify(commander).length>150000)return Response.json({error:"Invalid activity data."},{status:400});
const {data,error}=await a.db.from("user_settings").select("dealer_info,consultant_info,updated_at").eq("user_id",a.user.id).maybeSingle();if(error)throw error;
const existing=data?.consultant_info&&typeof data.consultant_info==="object"?data.consultant_info:{};
const update={consultant_info:{...existing,saleCommander:commander},updated_at:new Date().toISOString()};
if(data){const {data:rows,error:saveError}=await a.db.from("user_settings").update(update).eq("user_id",a.user.id).eq("updated_at",data.updated_at).select("user_id");if(saveError)throw saveError;if(!rows?.length)return Response.json({error:"Your activity changed elsewhere. Reload before saving."},{status:409});}
else{const {error:saveError}=await a.db.from("user_settings").insert({user_id:a.user.id,dealer_info:{},...update});if(saveError)throw saveError;}
return Response.json({commander},{headers:{"Cache-Control":"private, no-store"}});
}catch{return Response.json({error:"Could not save your Sale Commander progress."},{status:500});}}
