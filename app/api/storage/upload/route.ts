import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { exec } from "@/lib/db/pool";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, safeObjectPath, verifyUploadToken } from "@/lib/storage/server";

// Direct browser uploads using a short-lived signed token from createSignedUploadUrl
// (replaces Supabase's uploadToSignedUrl). The body streams to disk, so large
// videos never sit in memory.
export const runtime = "nodejs";

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket") || "", objectPath = url.searchParams.get("path") || "", token = url.searchParams.get("token") || "";
  if (!verifyUploadToken(bucket, objectPath, token)) return Response.json({ error: "This upload link expired. Try again." }, { status: 403 });
  const full = safeObjectPath(bucket, objectPath);
  if (!full) return Response.json({ error: "Invalid file path." }, { status: 400 });
  const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return Response.json({ error: "Upload a JPG, PNG, WebP, GIF, MP4, WebM or MOV file." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > MAX_UPLOAD_BYTES) return Response.json({ error: "The file is larger than 100 MB." }, { status: 413 });
  if (await stat(full).then(() => true, () => false)) return Response.json({ error: "The resource already exists" }, { status: 409 });
  if (!request.body) return Response.json({ error: "No file received." }, { status: 400 });

  await mkdir(path.dirname(full), { recursive: true });
  const temporary = `${full}.${randomUUID()}.part`;
  const out = createWriteStream(temporary);
  let size = 0;
  try {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) throw new Error("too_large");
      if (!out.write(value)) await new Promise(resolve => out.once("drain", resolve));
    }
    await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => error ? reject(error) : resolve()));
    await rename(temporary, full);
  } catch (error) {
    out.destroy();
    await rm(temporary, { force: true });
    if (error instanceof Error && error.message === "too_large") return Response.json({ error: "The file is larger than 100 MB." }, { status: 413 });
    return Response.json({ error: "The upload was interrupted. Try again." }, { status: 500 });
  }
  const owner = objectPath.match(/^([0-9a-f-]{36})\//i)?.[1] || null;
  await exec(`INSERT INTO media_files (id, user_id, bucket, path, content_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE content_type = VALUES(content_type), size_bytes = VALUES(size_bytes)`,
    [randomUUID(), owner, bucket, objectPath, contentType, size]).catch(() => undefined);
  return Response.json({ Key: `${bucket}/${objectPath}`, path: objectPath });
}
