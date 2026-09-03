import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { ConsultantProfileContent, emptyConsultantContent, normalizeProfileContent, travDefaultContent } from "@/lib/consultant-profile";

function bearer(request: NextRequest) { return (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim(); }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "consultant"; }
async function context(request: NextRequest) {
  const db=getSupabaseServiceClient(); const {data:{user},error}=await db.auth.getUser(bearer(request)); if(error||!user)return null;
  const [{data:profile},{data:assignment}]=await Promise.all([db.from("profiles").select("role,display_name,card_enabled").eq("id",user.id).maybeSingle(),db.from("consultant_users").select("consultant_slug,email,display_name,is_enabled").eq("auth_user_id",user.id).maybeSingle()]);
  const isTrav=user.email?.toLowerCase()==="xrkr80hd@gmail.com"; return {db,user,profile,assignment,isTrav,permitted:isTrav||profile?.role==="admin"||Boolean(profile?.card_enabled)||Boolean(assignment?.is_enabled)};
}
export async function GET(request:NextRequest){
  const ctx=await context(request);if(!ctx)return NextResponse.json({error:"Unauthorized"},{status:401});if(!ctx.permitted)return NextResponse.json({error:"Card permission is required.",permitted:false},{status:403});
  const {data:row,error}=await ctx.db.from("consultant_profiles").select("consultant_slug,draft_content,published_content,is_published,published_at").eq("owner_id",ctx.user.id).maybeSingle();if(error)return NextResponse.json({error:error.message},{status:500});
  const displayName=ctx.assignment?.display_name||ctx.profile?.display_name||ctx.user.email?.split("@")[0]||"Consultant",slug=row?.consultant_slug||ctx.assignment?.consultant_slug||(ctx.isTrav?"trav":`${slugify(displayName)}-${ctx.user.id.slice(0,6)}`),fallback=ctx.isTrav?structuredClone(travDefaultContent):emptyConsultantContent({displayName,email:ctx.user.email||""});
  const draft=normalizeProfileContent(row?.draft_content&&Object.keys(row.draft_content).length?row.draft_content:fallback,ctx.isTrav),published=row?.is_published&&row.published_content&&Object.keys(row.published_content).length?normalizeProfileContent(row.published_content,ctx.isTrav):null;
  return NextResponse.json({card:{slug,draft,published,publishedAt:row?.published_at??null},role:ctx.profile?.role??"user",isAdmin:ctx.isTrav||ctx.profile?.role==="admin",permitted:true});
}
export async function PUT(request:NextRequest){
  const ctx=await context(request);if(!ctx)return NextResponse.json({error:"Unauthorized"},{status:401});if(!ctx.permitted)return NextResponse.json({error:"Card permission is required."},{status:403});
  const body=await request.json() as {action?:"draft"|"publish"|"unpublish";draft?:Partial<ConsultantProfileContent>},action=body.action??"draft",draft=normalizeProfileContent(body.draft,ctx.isTrav);draft.reviews=draft.reviews.slice(0,10);draft.videos=draft.videos.slice(0,2);
  const {data:existing}=await ctx.db.from("consultant_profiles").select("consultant_slug,published_content,is_published,published_at").eq("owner_id",ctx.user.id).maybeSingle();
  const displayName=draft.identity.displayName||ctx.assignment?.display_name||ctx.profile?.display_name||"Consultant",slug=existing?.consultant_slug||ctx.assignment?.consultant_slug||(ctx.isTrav?"trav":`${slugify(displayName)}-${ctx.user.id.slice(0,6)}`),now=new Date().toISOString(),isPublished=action==="publish"?true:action==="unpublish"?false:Boolean(existing?.is_published),publishedContent=action==="publish"?draft:action==="unpublish"?{}:(existing?.published_content??{}),publishedAt=action==="publish"?now:action==="unpublish"?null:(existing?.published_at??null);
  const payload={consultant_slug:slug,owner_id:ctx.user.id,display_name:displayName,title:draft.identity.jobTitle||"Sales Consultant",dealership:draft.identity.dealership||"Walker Automotive",location:draft.identity.location||null,phone:draft.identity.phone||null,email:draft.identity.email||null,profile_image_url:draft.identity.profileImageUrl||null,sales_quote:draft.content.salesQuote||null,calling_card_image_url:draft.identity.callingCardImageUrl||null,inventory_url:draft.content.inventoryUrl||null,draft_content:draft,published_content:publishedContent,is_published:isPublished,published_at:publishedAt,updated_at:now};
  const query=existing?ctx.db.from("consultant_profiles").update(payload).eq("owner_id",ctx.user.id).eq("consultant_slug",slug):ctx.db.from("consultant_profiles").insert(payload),{data:saved,error}=await query.select("consultant_slug,is_published,published_at").single();
  if(error||!saved){console.error("[business-card] save failed",{userId:ctx.user.id,slug,action,error:error?.message});return NextResponse.json({error:error?.message||"Your card could not be saved."},{status:500});}
  console.log("[business-card] save complete",{userId:ctx.user.id,slug,action});return NextResponse.json({card:{slug:saved.consultant_slug,draft,published:isPublished?publishedContent:null,publishedAt:saved.published_at}});
}
export async function POST(request:NextRequest){
  const ctx=await context(request);if(!ctx)return NextResponse.json({error:"Unauthorized"},{status:401});if(!ctx.permitted)return NextResponse.json({error:"Card permission is required."},{status:403});
  const form=await request.formData(),file=form.get("file"),category=(form.get("category")?.toString()||"media").toLowerCase().replace(/[^a-z0-9_-]/g,"");if(!(file instanceof File))return NextResponse.json({error:"Choose a file."},{status:400});if(file.size>100*1024*1024)return NextResponse.json({error:"Files must be 100 MB or smaller."},{status:400});
  const bucket=`consultant-media-${ctx.user.id}`,{error:bucketError}=await ctx.db.storage.getBucket(bucket);if(bucketError){const {error}=await ctx.db.storage.createBucket(bucket,{public:true,fileSizeLimit:100*1024*1024,allowedMimeTypes:["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]});if(error)return NextResponse.json({error:error.message},{status:500});}
  const safe=file.name.toLowerCase().replace(/[^a-z0-9.]+/g,"-"),path=`${ctx.user.id}/${category}/${crypto.randomUUID()}-${safe}`,{error}=await ctx.db.storage.from(bucket).upload(path,file,{contentType:file.type});if(error)return NextResponse.json({error:error.message},{status:500});const {data}=ctx.db.storage.from(bucket).getPublicUrl(path);return NextResponse.json({url:data.publicUrl,path});
}
