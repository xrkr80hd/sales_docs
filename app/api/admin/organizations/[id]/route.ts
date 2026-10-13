import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { organizationBranding,updateOrganizationBranding } from "@/lib/organization-branding";
type Context={params:Promise<{id:string}>};
export async function PATCH(request:Request,context:Context){
 const auth=await requireAdmin(request);if(auth instanceof Response)return auth;
 try{
  const {id}=await context.params;const db=getSupabaseServiceClient();const {data:org}=await db.from("organizations").select("id,name").eq("id",id).maybeSingle();if(!org||(await organizationBranding(db))[id]?.deletedAt)return Response.json({error:"Organization not found."},{status:404});
  const body=await request.json();const name=typeof body.name==="string"?body.name.trim():"";if(!name||name.length>120)return Response.json({error:"Use an organization name between 1 and 120 characters."},{status:400});
  if(org.name.trim().toLowerCase()==="walker automotive"&&name.toLowerCase()!=="walker automotive")return Response.json({error:"Walker Automotive is the fallback organization and keeps its name."},{status:400});
  const {data:saved,error}=await db.from("organizations").update({name}).eq("id",id).select("id,name,slug").single();if(error)throw error;return Response.json({organization:saved});
 }catch{return Response.json({error:"Could not update the organization."},{status:500});}
}
export async function DELETE(request:Request,context:Context){
 const auth=await requireAdmin(request);if(auth instanceof Response)return auth;
 try{
  const {id}=await context.params;const db=getSupabaseServiceClient();const {data:org}=await db.from("organizations").select("id,name").eq("id",id).maybeSingle();if(!org)return Response.json({error:"Organization not found."},{status:404});
  if(org.name.trim().toLowerCase()==="walker automotive")return Response.json({error:"Walker Automotive is the fallback organization and cannot be deleted."},{status:400});
  const branding=await organizationBranding(db);const {data:all,error:orgError}=await db.from("organizations").select("id,name");if(orgError)throw orgError;
  let fallback=all?.find(item=>item.name.trim().toLowerCase()==="walker automotive"&&!branding[item.id]?.deletedAt);
  if(!fallback){const {data,error}=await db.from("organizations").insert({name:"Walker Automotive",slug:"walker-automotive"}).select("id,name").single();if(error)throw error;fallback=data;}
  if(!fallback)throw new Error("Fallback organization unavailable.");
  // Logical deletion preserves conversations/boards; a physical delete would
  // cascade through existing messenger foreign keys and destroy history.
  await updateOrganizationBranding(db,id,{deletedAt:new Date().toISOString(),fallbackOrganizationId:fallback.id});
  const {data:moved,error}=await db.from("organization_memberships").update({organization_id:fallback.id,assigned_by:auth.userId,updated_at:new Date().toISOString()}).eq("organization_id",id).select("user_id");
  if(error){await updateOrganizationBranding(db,id,{deletedAt:"",fallbackOrganizationId:""});throw error;}
  return Response.json({deleted:true,movedUsers:moved?.length||0,fallbackOrganization:fallback,historyPreserved:true});
 }catch{return Response.json({error:"Could not delete the organization. Existing account and history records have been preserved."},{status:500});}
}
