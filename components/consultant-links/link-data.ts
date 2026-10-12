import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
export async function requestLinks(organization = "", links?: unknown) {
  const {data}=await getSupabaseBrowserClient().auth.getSession();
  const response=await fetch(`/api/consultant-links${organization?`?organization=${encodeURIComponent(organization)}`:""}`,{method:links?"PUT":"GET",headers:{Authorization:`Bearer ${data.session?.access_token || ""}`,"Content-Type":"application/json"},...(links?{body:JSON.stringify({links})}:{}),cache:"no-store"});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"Could not load links.");return result;
}
