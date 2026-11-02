import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, rm, stat, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exec } from "@/lib/db/pool";
import { appUrl } from "@/lib/auth/server";

/*
 * Media files on the server's disk, replacing Supabase Storage. Files live in
 * MEDIA_ROOT/<bucket>/<path> and are served at
 * <APP_URL>/storage/v1/object/public/<bucket>/<path> — the same URL shape
 * Supabase used, so stored links only need their host changed.
 */
export const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(/*turbopackIgnore: true*/ os.homedir(), "nextdox_media");
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
const PUBLIC_PREFIX = "/storage/v1/object/public/";

type StorageError = { message: string; statusCode?: string };
type StorageResult<T = any> = Promise<{ data: T; error: StorageError | null }>;
const err = (message: string, statusCode = "400"): StorageError => ({ message, statusCode });

/** Rejects anything that could escape the media folder. */
export function safeObjectPath(bucket: string, objectPath: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,190}$/.test(bucket)) return null;
  if (!objectPath || objectPath.length > 512 || objectPath.includes("\\") || objectPath.includes("\0")) return null;
  const parts = objectPath.split("/");
  if (parts.some(p => !p || p === "." || p === "..")) return null;
  const full = path.resolve(/*turbopackIgnore: true*/ MEDIA_ROOT, bucket, ...parts);
  return full.startsWith(path.resolve(/*turbopackIgnore: true*/ MEDIA_ROOT) + path.sep) ? full : null;
}

export function publicUrlFor(bucket: string, objectPath: string) {
  return `${appUrl()}${PUBLIC_PREFIX}${bucket}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
}

function secret() {
  const value = process.env.APP_SECRET;
  if (!value || value.length < 32) throw new Error("APP_SECRET must be set (32+ characters).");
  return value;
}
function sign(bucket: string, objectPath: string, expires: number) {
  return createHmac("sha256", secret()).update(`${bucket}\n${objectPath}\n${expires}`).digest("base64url");
}
export function createUploadToken(bucket: string, objectPath: string, ttlSeconds = 2 * 3600) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expires}.${sign(bucket, objectPath, expires)}`;
}
export function verifyUploadToken(bucket: string, objectPath: string, token: string) {
  const [expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!signature || !Number.isFinite(expires) || expires < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(bucket, objectPath, expires)), given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function writeObject(bucket: string, objectPath: string, bytes: Buffer, contentType: string, options: { upsert?: boolean; userId?: string | null } = {}) {
  const full = safeObjectPath(bucket, objectPath);
  if (!full) return err("Invalid file path.");
  if (bytes.length > MAX_UPLOAD_BYTES) return err("The file is larger than 100 MB.", "413");
  if (!options.upsert) {
    const exists = await stat(full).then(() => true, () => false);
    if (exists) return err("The resource already exists", "409");
  }
  await mkdir(path.dirname(full), { recursive: true });
  // Write to a temporary name first so a half-written file is never served.
  const temporary = `${full}.${randomUUID()}.part`;
  await writeFile(temporary, bytes);
  await rename(temporary, full);
  await exec(`INSERT INTO media_files (id, user_id, bucket, path, content_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE content_type = VALUES(content_type), size_bytes = VALUES(size_bytes)`,
    [randomUUID(), options.userId ?? null, bucket, objectPath, contentType || "application/octet-stream", bytes.length]).catch(() => undefined);
  return null;
}

/** Same method names the app called on supabase.storage. */
export const storage = {
  async getBucket(bucket: string): StorageResult { return /^[a-z0-9][a-z0-9-]{0,190}$/.test(bucket) ? { data: { id: bucket, name: bucket, public: true }, error: null } : { data: null, error: err("Bucket not found", "404") }; },
  async createBucket(bucket: string, _options?: Record<string, unknown>): StorageResult { await mkdir(path.join(/*turbopackIgnore: true*/ MEDIA_ROOT, bucket), { recursive: true }); return { data: { name: bucket }, error: null }; },
  from(bucket: string) {
    return {
      async upload(objectPath: string, body: Buffer | ArrayBuffer | Blob | Uint8Array, options: { contentType?: string; upsert?: boolean } = {}): StorageResult {
        const bytes = body instanceof Blob ? Buffer.from(await body.arrayBuffer()) : Buffer.from(body as ArrayBuffer);
        const contentType = options.contentType || (body instanceof Blob ? body.type : "application/octet-stream");
        const owner = objectPath.match(/^([0-9a-f-]{36})\//i)?.[1] || null;
        const failed = await writeObject(bucket, objectPath, bytes, contentType, { upsert: options.upsert, userId: owner });
        return failed ? { data: null, error: failed } : { data: { path: objectPath, fullPath: `${bucket}/${objectPath}` }, error: null };
      },
      getPublicUrl(objectPath: string) { return { data: { publicUrl: publicUrlFor(bucket, objectPath) } }; },
      async createSignedUploadUrl(objectPath: string): StorageResult<{ signedUrl: string; path: string; token: string } | null> {
        if (!safeObjectPath(bucket, objectPath)) return { data: null, error: err("Invalid file path.") };
        const token = createUploadToken(bucket, objectPath);
        return { data: { signedUrl: `${appUrl()}/api/storage/upload?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(objectPath)}&token=${encodeURIComponent(token)}`, path: objectPath, token }, error: null };
      },
      async remove(paths: string[]): StorageResult<{ name: string }[]> {
        const removed: { name: string }[] = [];
        for (const objectPath of paths) {
          const full = safeObjectPath(bucket, objectPath);
          if (!full) continue;
          await rm(full, { force: true });
          await exec("DELETE FROM media_files WHERE bucket = ? AND path = ?", [bucket, objectPath]).catch(() => undefined);
          removed.push({ name: objectPath });
        }
        return { data: removed, error: null };
      },
    };
  },
};
