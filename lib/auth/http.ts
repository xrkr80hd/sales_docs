import "server-only";

export const bearer = (request: Request) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

// Small in-memory limiter for login and reset requests (Supabase rate-limited these too).
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return recent.length > limit;
}

export const noStore = { "Cache-Control": "no-store" };
