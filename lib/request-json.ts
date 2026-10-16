/** Bound both the network request and body decoding; never retry a mutation implicitly. */
export async function requestJson<T = Record<string, unknown>>(path: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
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
