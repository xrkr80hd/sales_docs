import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { GET as salesQueue } from "@/app/api/sm-queue/route";
import { GET as financeQueue } from "@/app/api/fni-queue/route";
// Organization filtering for the new role views; original information routes remain untouched.
export async function GET(request:Request){
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return Response.json({error:"Sign in required."},{status:401});
 try{
  const db=getSupabaseServiceClient();const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user)return Response.json({error:"Invalid session."},{status:401});
  const [{data:profile},{data:member}]=await Promise.all([db.from("profiles").select("role").eq("id",user.id).single(),db.from("organization_memberships").select("organization_id").eq("user_id",user.id).maybeSingle()]);
  const admin=profile?.role==="admin"||user.email?.toLowerCase()==="xrkr80hd@gmail.com";
  const url=new URL(request.url);const type=url.searchParams.get("type");
  if(type!=="sm"&&type!=="fni")return Response.json({error:"Choose a queue type."},{status:400});
  const organizationId=admin&&url.searchParams.get("organization")?url.searchParams.get("organization"):member?.organization_id;
  if(!organizationId&&!admin)return Response.json({error:"Organization assignment required."},{status:403});
  const response=await(type==="fni"?financeQueue(request):salesQueue(request));if(!response.ok)return response;
  const payload=await response.json();
  if(!organizationId)return Response.json(payload);
  const {data:members,error:membersError}=await db.from("organization_memberships").select("user_id").eq("organization_id",organizationId);if(membersError)throw membersError;
  const ids=new Set((members||[]).map(member=>member.user_id));
  return Response.json({deals:(payload.deals||[]).filter((deal:{user_id:string})=>ids.has(deal.user_id))},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Could not load this organization's queue."},{status:500});}
}
