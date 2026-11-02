// Coalesce simultaneous identical reads only. Nothing is cached after settlement;
// include authorization/options so accounts and organization scopes never share data.
const pendingReads = new Map<string, Promise<unknown>>();
export function requestJson<T = Record<string, unknown>>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  if ((init.method || "GET").toUpperCase() !== "GET" || init.signal) return performJsonRequest<T>(path, init, timeoutMs);
  const headers = new Headers(init.headers);
  const key = JSON.stringify([path, [...headers.entries()].sort(), init.credentials, timeoutMs]);
  const pending = pendingReads.get(key);
  if (pending) return pending as Promise<T>;
  const request = performJsonRequest<T>(path, init, timeoutMs).finally(() => { pendingReads.delete(key); });
  pendingReads.set(key, request);
  return request;
}

/** Bound both the network request and body decoding; never retry a mutation implicitly. */
async function performJsonRequest<T = Record<string, unknown>>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(path, { ...init, signal: controller.signal, cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const message = typeof body?.error === "string" ? body.error : `Request failed (${response.status}). Please retry.`;
          throw new Error(message);
        }
        if (!body || typeof body !== "object") throw new Error("The server returned an invalid response. Please retry.");
        return body as T;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(init.method && init.method !== "GET" ? "Saving took too long. Reload to check whether it saved before trying again." : "The server took too long to respond. Please retry."));
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Bound APIs such as session restoration that do not accept an AbortSignal. */
export async function withDeadline<T>(operation: PromiseLike<T>, message: string, timeoutMs = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
