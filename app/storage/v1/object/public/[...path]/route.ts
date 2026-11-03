import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { safeObjectPath } from "@/lib/storage/server";

// Serves media from disk at the same URL shape Supabase Storage used.
// Range requests are supported so videos stream and seek on phones.
export const runtime = "nodejs";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".svg": "image/svg+xml", ".pdf": "application/pdf" };

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const [bucket, ...rest] = (await params).path.map(decodeURIComponent);
  const full = bucket ? safeObjectPath(bucket, rest.join("/")) : null;
  if (!full) return new Response("Not found", { status: 404 });
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(full).toLowerCase()] || "application/octet-stream";
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    // Uploaded files get new names on change, so they can be cached for a long time.
    "Cache-Control": "public, max-age=31536000, immutable",
    "Last-Modified": info.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  };
  if (type === "image/svg+xml") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'";
  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : info.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : info.size - 1;
    start = Math.max(0, start); end = Math.min(end, info.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } });
  }
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(stream, { status: 200, headers: { ...headers, "Content-Length": String(info.size) } });
}

export const HEAD = GET;
