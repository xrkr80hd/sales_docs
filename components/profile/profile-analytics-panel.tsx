"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

type AnalyticsData = {
  summary?: Record<string, number>;
  videos?: Array<{ id: string; title: string; views: number }>;
};

const labels: Record<string, string> = {
  card_view: "Card views",
  video_view: "Video views",
  vehicle_view: "Vehicle views",
  call_click: "Call taps",
  text_click: "Text taps",
  email_click: "Email taps",
  listing_click: "Listing taps",
};

export function ProfileAnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [message, setMessage] = useState("Loading private analytics…");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage("Analytics become available when connected.");
      return;
    }
    void getSupabaseBrowserClient().auth.getSession().then(async ({ data: sessionData }) => {
      const token = sessionData.session?.access_token;
      if (!token) {
        setMessage("Sign in to view analytics.");
        return;
      }
      const response = await fetch("/api/analytics", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) {
        setMessage("Analytics are being prepared.");
        return;
      }
      setData(result);
      setMessage("");
    }).catch(() => setMessage("Analytics are being prepared."));
  }, []);

  return (
    <details className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#171719] text-white">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black [&::-webkit-details-marker]:hidden">
        <span>Private analytics</span>
        <span className="text-xs font-semibold text-white/45">Only visible after login</span>
      </summary>
      <div className="border-t border-white/10 p-4">
        {message && <p className="text-sm text-white/55">{message}</p>}
        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(labels).map(([key, label]) => (
                <div key={key} className="rounded-xl border border-white/10 bg-white/[.04] p-3">
                  <strong className="block text-xl">{data.summary?.[key] || 0}</strong>
                  <span className="text-xs text-white/55">{label}</span>
                </div>
              ))}
            </div>
            {!!data.videos?.length && (
              <div className="mt-4">
                <h2 className="mb-2 text-sm font-black">Views by video</h2>
                <div className="grid gap-2">
                  {data.videos.map((video) => (
                    <div key={video.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.04] px-3 py-2 text-sm">
                      <span className="truncate">{video.title || "Untitled video"}</span>
                      <strong>{video.views}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
