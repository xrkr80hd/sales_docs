export async function messengerRequest(token: string | undefined, path = "/api/messenger", body?: object, timeoutMs = 15000) {
  if (!token) throw new Error("Your session is unavailable. Sign in again.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(path, { method: body ? "POST" : "GET", signal: controller.signal, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
        const result = await response.json();
        if (!response.ok) {const error=new Error(result.error || "Request failed. Please retry.") as Error & {status:number};error.status=response.status;throw error;}
        return result;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Error(body ? "The request timed out. Refresh the conversation before retrying to check whether it completed." : "Messenger took too long to respond. Check your connection and tap Retry.")); controller.abort(); }, timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
