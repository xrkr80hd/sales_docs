/** Bound Supabase HTTP work itself, including response decoding. No retries here. */
export function createSupabaseFetch(options: {
  timeoutMs?: number;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
} = {}): typeof fetch {
  return async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    const controller = new AbortController();
    const signals = [options.signal, init?.signal, input instanceof Request ? input.signal : undefined]
      .filter((signal): signal is AbortSignal => Boolean(signal));
    const cancel = () => controller.abort();
    for (const signal of signals) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", cancel, { once: true });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectCancelled: (error: Error) => void = () => {};
    const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
    const aborted = () => rejectCancelled(new Error("Data service request interrupted. Please retry."));
    controller.signal.addEventListener("abort", aborted, { once: true });
    try {
      if (controller.signal.aborted) throw new Error("Data service request interrupted. Please retry.");
      return await Promise.race([
        (async () => {
          const response = await (options.fetcher ?? fetch)(input, { ...init, signal: controller.signal });
          // SDK JSON decoding happens after fetch resolves. Keep the deadline alive
          // until the JSON body arrives, rather than releasing it at the headers.
          if ([204, 205, 304].includes(response.status) || init?.method?.toUpperCase() === "HEAD" || !response.headers.get("content-type")?.includes("json")) return response;
          const body = await response.arrayBuffer();
          const headers = new Headers(response.headers);
          headers.delete("content-encoding");
          headers.delete("content-length");
          return new Response(body, { status: response.status, statusText: response.statusText, headers });
        })(),
        cancelled,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error("Data service did not respond in time. Please retry."));
            controller.abort();
          // Preserve time for profile/card media uploads; auth and Data API
          // traffic use the shorter deadline needed by interactive screens.
          }, options.timeoutMs ?? (path.startsWith("/storage/v1/") ? 60000 : 8000));
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      controller.signal.removeEventListener("abort", aborted);
      for (const signal of signals) signal.removeEventListener("abort", cancel);
    }
  };
}
