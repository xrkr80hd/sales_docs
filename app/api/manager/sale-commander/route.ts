import {getSupabaseServiceClient} from "@/lib/supabase-server";
import {organizationBranding} from "@/lib/organization-branding";
function dateInChicago(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
export async function GET(request:Request){
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return Response.json({error:"Sign in required."},{status:401});
 try{
 const db=getSupabaseServiceClient();const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user)return Response.json({error:"Invalid session."},{status:401});
 const [{data:profile,error:profileError},{data:membership,error:memberError}]=await Promise.all([
 db.from("profiles").select("role").eq("id",user.id).single(),
 db.from("organization_memberships").select("organization_id").eq("user_id",user.id).maybeSingle()
 ]);
 if(profileError||memberError)throw profileError||memberError;
 const role=user.app_metadata?.workspace_role;
 const admin=profile?.role==="admin"||user.email?.toLowerCase()==="xrkr80hd@gmail.com";
 const district=admin||role==="district_manager";
 const manager=admin||profile?.role==="sales_manager"||role==="floor_manager"||role==="bdm"||district;
 if(!manager)return Response.json({error:"Manager access required."},{status:403});
 const organizationId=membership?.organization_id||"";
 const url=new URL(request.url),requested=url.searchParams.get("organization")||"";
 if(requested&&!district&&requested!==organizationId)return Response.json({error:"Only district managers can view other dealerships."},{status:403});
 const selected=requested||(!district?organizationId:"");
 const today=dateInChicago();
 const day=url.searchParams.get("date")||today;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return Response.json({error:"Invalid date."},{status:400});
 const branding=await organizationBranding(db);
 const {data:organizations,error:orgErr}=await db.from("organizations").select("id,name").order("name");
 if(orgErr)throw orgErr;
 const allowed=(organizations||[]).filter(o=>!branding[o.id]?.deletedAt&&(district||o.id===organizationId));
 if(selected&&!allowed.some(o=>o.id===selected))return Response.json({error:"Organization unavailable."},{status:403});
 let query=db.from("organization_memberships").select("user_id,organization_id,profiles!organization_memberships_user_id_fkey(display_name,role)");
 if(selected)query=query.eq("organization_id",selected);
 else if(!district)query=query.eq("organization_id",organizationId);
 const {data:members,error:membersErr}=await query;
 if(membersErr)throw membersErr;
 const roster=(members||[]).filter(m=>(m.profiles as unknown as {role?:string})?.role==="user");
 const ids=roster.map(r=>r.user_id);
 const {data:settings,error:settingsErr}=ids.length?await db.from("user_settings").select("user_id,consultant_info,updated_at").in("user_id",ids):{data:[],error:null};
 if(settingsErr)throw settingsErr;
 const lookup=new Map((settings||[]).map(r=>[r.user_id,r]));
 const entries=roster.map(m=>{
 const row=lookup.get(m.user_id),commander=(row?.consultant_info as Record<string,any>|null)?.saleCommander||{};
 const todayCounts=commander.days?.[day]||{};
 const month=day.slice(0,7);
 const monthly=Object.entries(commander.days||{}).filter(([key])=>key.startsWith(month)).reduce((total,[,counts])=>{const c=counts as Record<string,number>;for(const key of ["calls","talks","appts","shows","sold"])total[key]+=(Number(c?.[key])||0);return total;},{calls:0,talks:0,appts:0,shows:0,sold:0});
 const organization=allowed.find(o=>o.id===m.organization_id);
 return {userId:m.user_id,name:(m.profiles as unknown as {display_name?:string})?.display_name||"Consultant",organizationId:m.organization_id,organization:organization?.name||"",goal:Number(commander.goal)||5,workdays:Number(commander.rates?.workdays)||22,today:Object.fromEntries(["calls","talks","appts","shows","sold"].map(k=>[k,Number(todayCounts[k])||0])),monthly,updatedAt:row?.updated_at||null};
 });
 return Response.json({date:day,entries,organizations:allowed,scope:district?"district":"organization",organizationId:selected},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Unable to load Sales Commander statistics."},{status:500});}
}
