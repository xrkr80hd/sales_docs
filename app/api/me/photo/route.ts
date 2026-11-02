import { getSupabaseServiceClient } from "@/lib/supabase-server";

// Uses existing consultant storage and settings JSON; no schema changes.
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return Response.json({ error: "Sign in to upload your photo." }, { status: 401 });
  try {
    const db = getSupabaseServiceClient();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return Response.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 400 });
    }
    if (file.size > 3 * 1024 * 1024) return Response.json({ error: "Your photo must be 3 MB or smaller." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/png" ? [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)
      : String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
    if (!valid) return Response.json({ error: "That file is not a valid photo." }, { status: 400 });
    const { data: settings, error: settingsError } = await db.from("user_settings").select("consultant_info").eq("user_id", user.id).maybeSingle();
    if (settingsError) throw settingsError;
    const bucket = `consultant-media-${user.id}`;
    const { error: missingBucket } = await db.storage.getBucket(bucket);
    if (missingBucket) {
      const { error } = await db.storage.createBucket(bucket, { public: true, fileSizeLimit: 100 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"] });
      if (error) throw error;
    }
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${user.id}/profile/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from(bucket).upload(path, bytes, { contentType: file.type });
    if (uploadError) throw uploadError;
    const { data: publicData } = db.storage.from(bucket).getPublicUrl(path);
    const profileImageUrl = publicData.publicUrl;
    const consultantInfo = { ...(settings?.consultant_info || {}), profileImageUrl };
    const { error: saveError } = await db.from("user_settings").upsert({ user_id: user.id, consultant_info: consultantInfo, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) throw saveError;
    return Response.json({ profileImageUrl });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Your photo could not be saved. Try again." }, { status: 500 });
  }
}
