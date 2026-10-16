import { getSupabaseServiceClient } from "@/lib/supabase-server";
export type OrganizationBranding={iconUrl?:string;theme?:string;hideIcon?:boolean;address?:{street:string;city:string;state:string;zip:string};deletedAt?:string;fallbackOrganizationId?:string};
let owner:Promise<string>|undefined;
export async function brandingOwner(db:ReturnType<typeof getSupabaseServiceClient>){
  if(!owner)owner=(async()=>{for(let page=1;page<=50;page++){const {data,error}=await db.auth.admin.listUsers({page,perPage:200});if(error)throw error;const found=data.users.find(user=>user.email?.toLowerCase()==="xrkr80hd@gmail.com");if(found)return found.id;if(data.users.length<200)break;}throw new Error("Master Admin account not found.");})().catch(error=>{owner=undefined;throw error;});
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
export async function organizationBranding(db:ReturnType<typeof getSupabaseServiceClient>){
  const data=await organizationSettings(db);
  return (data?.dealer_info?.organizationBranding||{}) as Record<string,OrganizationBranding>;
}
export async function updateOrganizationBranding(db:ReturnType<typeof getSupabaseServiceClient>,id:string,value:OrganizationBranding){
  const ownerId=await brandingOwner(db);const {data:settings,error}=await db.from("user_settings").select("dealer_info,updated_at").eq("user_id",ownerId).maybeSingle();if(error)throw error;
  const dealer=settings?.dealer_info||{};const branding=dealer.organizationBranding||{};
  const update={dealer_info:{...dealer,organizationBranding:{...branding,[id]:{...branding[id],...value}}},updated_at:new Date().toISOString()};
  if(settings){const {data:saved,error}=await db.from("user_settings").update(update).eq("user_id",ownerId).eq("updated_at",settings.updated_at).select("user_id");if(error)throw error;if(!saved?.length)throw new Error("Organization data changed. Try again.");}
  else {const {error}=await db.from("user_settings").insert({user_id:ownerId,...update});if(error)throw error;}
  settingsRequests.delete(db);
}
