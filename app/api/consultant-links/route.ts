import { organizationBranding } from "@/lib/organization-branding";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { validateConsultantLinks, validConsultantUrl, type ConsultantLink } from "@/lib/consultant-links";
type LinkSet={links:ConsultantLink[];updatedAt:string};
function record(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
async function context(request:Request){
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return Response.json({error:"Sign in required."},{status:401});
 const db=getSupabaseServiceClient({signal:AbortSignal.any([request.signal,AbortSignal.timeout(10000)])});
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return Response.json({error:error&&(!error.status||error.status>=500)?"Account verification is temporarily unavailable.":"Invalid session."},{status:error&&(!error.status||error.status>=500)?503:401});
 const [{data:profile,error:profileError},{data:member,error:memberError}]=await Promise.all([db.from("profiles").select("role").eq("id",user.id).single(),db.from("organization_memberships").select("organization_id").eq("user_id",user.id).maybeSingle()]);
 if(profileError||memberError)throw Error("Access lookup failed");
 if(!profile)return Response.json({error:"Workspace access required."},{status:403});
 if(!member?.organization_id)return Response.json({error:"Assign this account to an organization first."},{status:403});
 const {data:organization,error:orgError}=await db.from("organizations").select("id,name").eq("id",member.organization_id).single();
 if(orgError||!organization||(await organizationBranding(db))[organization.id]?.deletedAt)return Response.json({error:"Organization unavailable."},{status:403});
 return {db,user,organization};
}
export async function GET(request:Request){
 try{
  const ctx=await context(request);if(ctx instanceof Response)return ctx;
  const {data:own,error}=await ctx.db.from("user_settings").select("linkSets:dealer_info->consultantLinksByOrganization").eq("user_id",ctx.user.id).maybeSingle();
  if(error)throw error;
  const saved=record(own?.linkSets)[ctx.organization.id] as LinkSet|undefined;
  const links=Array.isArray(saved?.links)?saved.links.slice(0,20).filter(link=>link&&typeof link.id==="string"&&typeof link.name==="string"&&typeof link.url==="string"&&validConsultantUrl(link.url)):[];
  return Response.json({links,organization:ctx.organization,version:saved?.updatedAt||""},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Could not load your Command Center links. Please retry."},{status:503});}
}
export async function PUT(request:Request){
 try{
  const ctx=await context(request);if(ctx instanceof Response)return ctx;
  const body=await request.json().catch(()=>null);
  let links:ConsultantLink[];try{links=validateConsultantLinks(body?.links);}catch(error){return Response.json({error:error instanceof Error?error.message:"Invalid links."},{status:400});}
  if(typeof body.version!=="string")return Response.json({error:"Reload links before saving."},{status:409});
  if(body.organizationId!==ctx.organization.id)return Response.json({error:"Your organization changed. Reload links before saving."},{status:409});
  const {db,user,organization}=ctx;
  const {data:settings,error:readError}=await db.from("user_settings").select("dealer_info,updated_at").eq("user_id",user.id).maybeSingle();
  if(readError)throw readError;
  const dealer=record(settings?.dealer_info),sets=record(dealer.consultantLinksByOrganization),saved=record(sets[organization.id]);
  if((saved.updatedAt||"")!==body.version)return Response.json({error:"Links changed in another tab. Reload links before saving."},{status:409});
  const version=new Date(Math.max(Date.now(),(Date.parse(String(saved.updatedAt||""))||0)+1,(Date.parse(settings?.updated_at||"")||0)+1)).toISOString();
  const update={dealer_info:{...dealer,consultantLinksByOrganization:{...sets,[organization.id]:{links,updatedAt:version}}},updated_at:version};
  if(settings){
   const {data:rows,error}=await db.from("user_settings").update(update).eq("user_id",user.id).eq("updated_at",settings.updated_at).select("user_id");
   if(error)throw error;if(!rows?.length)return Response.json({error:"Your settings changed elsewhere. Reload links and try again."},{status:409});
  }else{
   const {error}=await db.from("user_settings").insert({user_id:user.id,...update});if(error)return Response.json({error:"Could not create links; reload before retrying."},{status:409});
  }
  return Response.json({links,organization,version},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Could not save links. Reload to check saved state before retrying."},{status:503});}
}
