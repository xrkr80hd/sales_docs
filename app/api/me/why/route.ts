import { getSupabaseServiceClient } from "@/lib/supabase-server";

/*
 * "Your Why" for the consultant Home page: a short statement plus a photo album.
 * Stored inside user_settings.consultant_info (keys `why` and `whyPhotos`), merged
 * so paperwork fields are never touched.
 *   GET    → { why, photos }
 *   PUT    { why }            → saves the statement
 *   POST   multipart "file"   → adds a photo to the album
 *   DELETE ?url=<photo url>   → removes a photo from the album
 */
export const runtime = "nodejs";

const MAX_WHY = 800;
const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const noStore = { "Cache-Control": "private, no-store" };

type Info = Record<string, unknown>;
const asRecord = (value: unknown): Info => value && typeof value === "object" && !Array.isArray(value) ? value as Info : {};
const photosOf = (info: Info) => Array.isArray(info.whyPhotos) ? info.whyPhotos.filter((url): url is string => typeof url === "string").slice(0, MAX_PHOTOS) : [];
const whyOf = (info: Info) => typeof info.why === "string" ? info.why.slice(0, MAX_WHY) : "";

async function signedIn(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data: { user } } = await db.auth.getUser(token);
  return user ? { db, user } : null;
}

async function readInfo(db: ReturnType<typeof getSupabaseServiceClient>, userId: string) {
  const { data, error } = await db.from("user_settings").select("consultant_info").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return { exists: Boolean(data), info: asRecord(data?.consultant_info) };
}

async function writeInfo(db: ReturnType<typeof getSupabaseServiceClient>, userId: string, exists: boolean, info: Info) {
  const row = { consultant_info: info, updated_at: new Date().toISOString() };
  const { error } = exists
    ? await db.from("user_settings").update(row).eq("user_id", userId)
    : await db.from("user_settings").insert({ user_id: userId, ...row });
  if (error) throw error;
}

const fail = (error: unknown, fallback: string) => Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500, headers: noStore });

export async function GET(request: Request) {
  const auth = await signedIn(request);
  if (!auth) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  try {
    const { info } = await readInfo(auth.db, auth.user.id);
    return Response.json({ why: whyOf(info), photos: photosOf(info) }, { headers: noStore });
  } catch (error) { return fail(error, "Your why could not load."); }
}

export async function PUT(request: Request) {
  const auth = await signedIn(request);
  if (!auth) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  let body: { why?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400, headers: noStore }); }
  const why = typeof body.why === "string" ? body.why.trim().slice(0, MAX_WHY) : "";
  try {
    const { exists, info } = await readInfo(auth.db, auth.user.id);
    await writeInfo(auth.db, auth.user.id, exists, { ...info, why });
    return Response.json({ why, photos: photosOf(info) }, { headers: noStore });
  } catch (error) { return fail(error, "Your why could not be saved."); }
}

export async function POST(request: Request) {
  const auth = await signedIn(request);
  if (!auth) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !TYPES.includes(file.type)) return Response.json({ error: "Choose a JPG, PNG, or WebP photo." }, { status: 400, headers: noStore });
    if (file.size > MAX_BYTES) return Response.json({ error: "Each photo must be 8 MB or smaller." }, { status: 400, headers: noStore });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) return Response.json({ error: "That file is not a valid photo." }, { status: 400, headers: noStore });

    const { db, user } = auth;
    const { exists, info } = await readInfo(db, user.id);
    const photos = photosOf(info);
    if (photos.length >= MAX_PHOTOS) return Response.json({ error: `Your album holds up to ${MAX_PHOTOS} photos. Remove one first.` }, { status: 400, headers: noStore });

    const bucket = `consultant-media-${user.id}`;
    const { error: missing } = await db.storage.getBucket(bucket);
    if (missing) { const { error } = await db.storage.createBucket(bucket, { public: true }); if (error) throw error; }
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${user.id}/why/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from(bucket).upload(path, bytes, { contentType: file.type });
    if (uploadError) throw uploadError;
    const url = db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const next = [...photos, url];
    await writeInfo(db, user.id, exists, { ...info, whyPhotos: next });
    return Response.json({ why: whyOf(info), photos: next }, { headers: noStore });
  } catch (error) { return fail(error, "Your photo could not be saved."); }
}

export async function DELETE(request: Request) {
  const auth = await signedIn(request);
  if (!auth) return Response.json({ error: "Sign in required." }, { status: 401, headers: noStore });
  const url = new URL(request.url).searchParams.get("url") || "";
  try {
    const { db, user } = auth;
    const { exists, info } = await readInfo(db, user.id);
    const photos = photosOf(info);
    if (!photos.includes(url)) return Response.json({ why: whyOf(info), photos }, { headers: noStore });
    const next = photos.filter(photo => photo !== url);
    await writeInfo(db, user.id, exists, { ...info, whyPhotos: next });
    // Only files in this consultant's own album folder are deleted from disk.
    const bucket = `consultant-media-${user.id}`;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const at = url.indexOf(marker);
    if (at >= 0) {
      const path = url.slice(at + marker.length).split("/").map(decodeURIComponent).join("/");
      if (path.startsWith(`${user.id}/why/`)) await db.storage.from(bucket).remove([path]);
    }
    return Response.json({ why: whyOf(info), photos: next }, { headers: noStore });
  } catch (error) { return fail(error, "The photo could not be removed."); }
}
