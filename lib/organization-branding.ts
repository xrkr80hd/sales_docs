import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { sql } from "@/lib/db/pool";
export type OrganizationBranding={iconUrl?:string;theme?:string;hideIcon?:boolean;address?:{street:string;city:string;state:string;zip:string};deletedAt?:string;fallbackOrganizationId?:string};
let owner:Promise<string>|undefined;
export async function brandingOwner(db:ReturnType<typeof getSupabaseServiceClient>){
  // One indexed lookup by email (previously paged through every account).
  void db;
  if(!owner)owner=(async()=>{const rows=await sql<{id:string}>("SELECT id FROM app_users WHERE email = ? LIMIT 1",["xrkr80hd@gmail.com"]);if(!rows[0])throw new Error("Master Admin account not found.");return rows[0].id;})().catch(error=>{owner=undefined;throw error;});
  return owner;
}
// Each API request creates its own service client. Reuse one settings read
// within that request; never cache branding/soft-deletion flags across requests.
async function readOrganizationSettings(db:ReturnType<typeof getSupabaseServiceClient>){
  const id=await brandingOwner(db);const {data,error}=await db.from("user_settings").select("user_id,dealer_info,updated_at").eq("user_id",id).maybeSingle();if(error)throw error;
  return data;
}
const settingsRequests=new WeakMap<ReturnType<typeof getSupabaseServiceClient>,ReturnType<typeof readOrganizationSettings>>();
export function organizationSettings(db:ReturnType<typeof getSupabaseServiceClient>){
  let request=settingsRequests.get(db);
  if(!request){request=readOrganizationSettings(db).catch(error=>{settingsRequests.delete(db);throw error;});settingsRequests.set(db,request);}
  return request;
}
async function readOrganizationBranding(db:ReturnType<typeof getSupabaseServiceClient>){
  // Read only branding, never all manager boards and embedded profile content.
  const id=await brandingOwner(db);
  const {data,error}=await db.from("user_settings").select("branding:dealer_info->organizationBranding").eq("user_id",id).maybeSingle();
  if(error)throw error;
  return (data?.branding||{}) as Record<string,OrganizationBranding>;
}
const brandingRequests=new WeakMap<ReturnType<typeof getSupabaseServiceClient>,ReturnType<typeof readOrganizationBranding>>();
export function organizationBranding(db:ReturnType<typeof getSupabaseServiceClient>){
  let request=brandingRequests.get(db);
  if(!request){request=readOrganizationBranding(db).catch(error=>{brandingRequests.delete(db);throw error;});brandingRequests.set(db,request);}
  return request;
}
export async function updateOrganizationBranding(db:ReturnType<typeof getSupabaseServiceClient>,id:string,value:OrganizationBranding){
  const ownerId=await brandingOwner(db);const {data:settings,error}=await db.from("user_settings").select("dealer_info,updated_at").eq("user_id",ownerId).maybeSingle();if(error)throw error;
  const dealer=settings?.dealer_info||{};const branding=dealer.organizationBranding||{};
  const update={dealer_info:{...dealer,organizationBranding:{...branding,[id]:{...branding[id],...value}}},updated_at:new Date().toISOString()};
  if(settings){const {data:saved,error}=await db.from("user_settings").update(update).eq("user_id",ownerId).eq("updated_at",settings.updated_at).select("user_id");if(error)throw error;if(!saved?.length)throw new Error("Organization data changed. Try again.");}
  else {const {error}=await db.from("user_settings").insert({user_id:ownerId,...update});if(error)throw error;}
  settingsRequests.delete(db);
  brandingRequests.delete(db);
}
