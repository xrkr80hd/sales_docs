import { createClient } from "@supabase/supabase-js";
import { normalizeProfileContent, travDefaultContent } from "@/lib/consultant-profile";

export async function getPublishedConsultantProfile(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) return slug === "trav" ? travDefaultContent : null;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase
    .from("consultant_profiles")
    .select("published_content,is_published,published_at")
    .eq("consultant_slug", slug)
    .eq("is_published", true)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!data) return slug === "trav" ? travDefaultContent : null;
  return normalizeProfileContent(data.published_content);
}
