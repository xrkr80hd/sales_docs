import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { brandingOwner,organizationBranding } from "@/lib/organization-branding";
import { ORGANIZATION_THEMES } from "@/lib/organization-theme";
export async function GET(request:Request){const auth=await requireAdmin(request);if(auth instanceof Response)return auth;try{return Response.json({branding:await organizationBranding(getSupabaseServiceClient())},{headers:{"Cache-Control":"private, no-store"}});}catch{return Response.json({error:"Could not load organization branding."},{status:500});}}
export async function POST(request:Request){
 const auth=await requireAdmin(request);if(auth instanceof Response)return auth;
 try{
  const db=getSupabaseServiceClient();const form=await request.formData();const organizationId=String(form.get("organizationId")||"");const theme=String(form.get("theme")||"");
  const {data:org}=await db.from("organizations").select("id").eq("id",organizationId).maybeSingle();if(!org)return Response.json({error:"Choose an existing organization."},{status:400});
  if(theme&&!Object.hasOwn(ORGANIZATION_THEMES,theme))return Response.json({error:"Choose a valid color scheme."},{status:400});
  if((await organizationBranding(db))[organizationId]?.deletedAt)return Response.json({error:"Organization was deleted."},{status:404});
  const removeIcon=form.get("removeIcon")==="1";
  const addressFields=["street","city","state","zip"] as const;
  const address=Object.fromEntries(addressFields.map(field=>[field,String(form.get(field)||"").trim()])) as {street:string;city:string;state:string;zip:string};
  if(addressFields.some(field=>address[field].length>160))return Response.json({error:"Address fields must be 160 characters or fewer."},{status:400});
  const ownerId=await brandingOwner(db);let iconUrl:string|undefined;const file=form.get("file");
  if(file instanceof File&&file.size){
   if(!["image/png","image/webp"].includes(file.type)||file.size>3*1024*1024)return Response.json({error:"Use a transparent PNG or WebP up to 3 MB. Recommended: 512 × 512."},{status:400});
   const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==="image/png"?[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v):String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
   if(!valid)return Response.json({error:"Invalid image file."},{status:400});
   const bucket=`consultant-media-${ownerId}`;const {error:missing}=await db.storage.getBucket(bucket);
   if(missing){const {error}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:100*1024*1024,allowedMimeTypes:["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]});if(error)throw error;}
   const path=`${ownerId}/organizations/${organizationId}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;const {error}=await db.storage.from(bucket).upload(path,bytes,{contentType:file.type});if(error)throw error;iconUrl=db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  // Read after uploading and compare-and-set: branding never replaces board/contact data.
  const {data:settings,error}=await db.from("user_settings").select("dealer_info,updated_at").eq("user_id",ownerId).maybeSingle();if(error)throw error;
  const dealer=settings?.dealer_info||{};const branding=dealer.organizationBranding||{};const value={...branding[organizationId],...(removeIcon?{iconUrl:"",hideIcon:true}:{}),...(iconUrl?{iconUrl,hideIcon:false}:{}),...(form.has("theme")?{theme}:{}),...(form.has("street")?{address}:{})};
  const update={dealer_info:{...dealer,organizationBranding:{...branding,[organizationId]:value}},updated_at:new Date().toISOString()};
  if(settings){const {data:saved,error}=await db.from("user_settings").update(update).eq("user_id",ownerId).eq("updated_at",settings.updated_at).select("user_id");if(error)throw error;if(!saved?.length)return Response.json({error:"Organization data changed. Try saving again."},{status:409});}
  else {const {error}=await db.from("user_settings").insert({user_id:ownerId,...update});if(error)throw error;}
  return Response.json({branding:value});
 }catch{return Response.json({error:"Organization branding could not be saved."},{status:500});}
}
