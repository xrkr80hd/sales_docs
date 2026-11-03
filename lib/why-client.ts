"use client";
import { requestJson } from "@/lib/request-json";
import { cachedResource, primeResource } from "@/lib/client-resource-cache";

/** The consultant's "why" statement and photo album (see /api/me/why). */
export type Why = { why: string; photos: string[] };
const KEY = "consultant-why";

export function cachedWhy(token: string) { return cachedResource<Why>(token, KEY) ?? null; }

function remember(token: string, value: Why) { primeResource(token, KEY, value); return value; }
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function loadWhy(token: string) {
  return remember(token, await requestJson<Why>("/api/me/why", { headers: auth(token) }));
}
export async function saveWhy(token: string, why: string) {
  return remember(token, await requestJson<Why>("/api/me/why", { method: "PUT", headers: { ...auth(token), "Content-Type": "application/json" }, body: JSON.stringify({ why }) }));
}
export async function addWhyPhoto(token: string, file: File) {
  const form = new FormData(); form.set("file", file);
  return remember(token, await requestJson<Why>("/api/me/why", { method: "POST", headers: auth(token), body: form }, 60000));
}
export async function removeWhyPhoto(token: string, url: string) {
  return remember(token, await requestJson<Why>(`/api/me/why?url=${encodeURIComponent(url)}`, { method: "DELETE", headers: auth(token) }));
}
