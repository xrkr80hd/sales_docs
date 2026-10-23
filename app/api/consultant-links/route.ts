import { organizationBranding } from "@/lib/organization-branding";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { CDJR_LINKS, validConsultantUrl, type ConsultantLink } from "@/lib/consultant-links";
type LinkSet = { links: ConsultantLink[]; updatedAt: string };
function record(value: unknown): Record<string,unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}; }
async function context(request:Request) {
  const token=(request.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
  if(!token) return Response.json({error:"Sign in required."},{status:401});
  const db=getSupabaseServiceClient();
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return Response.json({error:"Invalid session."},{status:401});
  const [{data:profile},{data:member}]=await Promise.all([db.from("profiles").select("role").eq("id",user.id).single(),db.from("organization_memberships").select("organization_id").eq("user_id",user.id).maybeSingle()]);
  const admin=profile?.role==="admin"||user.email?.toLowerCase()==="xrkr80hd@gmail.com";
  const requested=new URL(request.url).searchParams.get("organization");
  const organizationId=admin&&requested?requested:member?.organization_id;
  if(!organizationId)return Response.json({error:"Assign this account to an organization first."},{status:400});
  const {data:organization,error:orgError}=await db.from("organizations").select("id,name").eq("id",organizationId).single();
  if(orgError||!organization||(await organizationBranding(db))[organizationId]?.deletedAt)return Response.json({error:"Organization not found."},{status:404});
  return {db,user,admin,organization};
}
export async function GET(request:Request) {
  try {
    const ctx=await context(request);if(ctx instanceof Response)return ctx;
    const {db,user,admin,organization}=ctx;
    const [{data:own,error:ownError},{data:shared,error:sharedError}]=await Promise.all([
      db.from("user_settings").select("linkSets:dealer_info->consultantLinksByOrganization").eq("user_id",user.id).maybeSingle(),
      db.from("user_settings").select("linkSets:dealer_info->consultantLinksByOrganization,profiles!inner(role)").eq("profiles.role","admin"),
    ]);
    if(ownError||sharedError)return Response.json({error:(ownError||sharedError)?.message},{status:500});
    const ownSet=record(own?.linkSets)[organization.id] as LinkSet | undefined;
    const sets=(shared||[]).map(row=>record(row.linkSets)[organization.id] as LinkSet|undefined).filter((set):set is LinkSet=>Boolean(set&&Array.isArray(set.links))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const selected=admin?sets[0]||ownSet:ownSet||sets[0];
    const links=selected?.links || (/cdjr|chrysler|dodge|jeep|ram\b/i.test(organization.name)?CDJR_LINKS:[]);
    return Response.json({links,organization,shared:admin || !ownSet},{headers:{"Cache-Control":"private, no-store"}});
  }catch{return Response.json({error:"Could not load consultant links."},{status:500});}
}
export async function PUT(request:Request) {
  try {
    const ctx=await context(request);if(ctx instanceof Response)return ctx;
    const body=await request.json().catch(()=>null);
    if(!Array.isArray(body?.links)||body.links.length>20)return Response.json({error:"Use up to 20 links."},{status:400});
    const links:ConsultantLink[]=body.links.map((item:unknown)=>{const value=record(item);return {id:typeof value.id==="string"?value.id:"",name:typeof value.name==="string"?value.name.trim():"",url:typeof value.url==="string"?value.url.trim():""};});
    if(links.some(link=>!link.name||link.name.length>60||!validConsultantUrl(link.url)||!/^[-a-zA-Z0-9]{1,80}$/.test(link.id))||new Set(links.map(link=>link.id)).size!==links.length)return Response.json({error:"Every link needs a unique ID, name, and a valid HTTPS address."},{status:400});
    const {db,user,organization}=ctx;
    const {data:settings,error:readError}=await db.from("user_settings").select("dealer_info").eq("user_id",user.id).maybeSingle();
    if(readError)return Response.json({error:readError.message},{status:500});
    const dealerInfo=record(settings?.dealer_info);
    const next={...dealerInfo,consultantLinksByOrganization:{...record(dealerInfo.consultantLinksByOrganization),[organization.id]:{links,updatedAt:new Date().toISOString()}}};
    const {error}=await db.from("user_settings").upsert({user_id:user.id,dealer_info:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    return error?Response.json({error:error.message},{status:500}):Response.json({saved:true,links,organization});
  }catch{return Response.json({error:"Could not save consultant links."},{status:500});}
}
