"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  createDefaultConsultant,
  createDefaultDealer,
  fetchServerSettings,
  loadConsultant,
  loadDealer,
  saveConsultant,
  saveDealer,
  saveServerSettings,
  type ConsultantInfo,
  type DealerInfo,
} from "@/lib/dealer-consultant";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-browser";

export function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const [dealer, setDealer] = useState<DealerInfo>(() => loadDealer());
  const [consultant, setConsultant] = useState<ConsultantInfo>(() => loadConsultant());
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ dealer: false, consultant: false });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  // Load settings from server on mount (server is source of truth)
  useEffect(() => {
    fetchServerSettings().then((server) => {
      if (server) {
        setDealer(server.dealer);
        setConsultant(server.consultant);
        // Update local cache
        saveDealer(server.dealer);
        saveConsultant(server.consultant);
      }
    });
  }, []);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.role === "admin" || data.user.email?.toLowerCase() === "xrkr80hd@gmail.com") {
            setIsAdmin(true);
          }
        });
    });
  }, []);

  function toggleSection(key: string) {
    setOpenSections((current) => ({ ...current, [key]: !current[key] }));
  }

  function updateDealer(field: keyof DealerInfo, value: string) {
    setDealer((current) => ({ ...current, [field]: value }));
  }

  function updateConsultant(field: keyof ConsultantInfo, value: string) {
    setConsultant((current) => ({ ...current, [field]: value }));
  }

  function saveDealerNow() {
    saveDealer(dealer);
    setSaving(true);
    saveServerSettings(dealer, consultant).then((ok) => {
      setSaving(false);
      setStatus(ok ? "Dealership saved to your account." : "Saved locally (server sync failed).");
    });
  }

  function clearDealerNow() {
    const blank = createDefaultDealer();
    setDealer(blank);
    saveDealer(blank);
    setStatus("Dealership cleared.");
  }

  function deleteDealerNow() {
    const blank = createDefaultDealer();
    setDealer(blank);
    if (typeof window !== "undefined") localStorage.removeItem("walker.dealer.v1");
    setStatus("Dealership deleted.");
  }

  function saveConsultantNow() {
    saveConsultant(consultant);
    setSaving(true);
    saveServerSettings(dealer, consultant).then((ok) => {
      setSaving(false);
      setStatus(ok ? "Salesperson saved to your account." : "Saved locally (server sync failed).");
    });
  }

  function clearConsultantNow() {
    const blank = createDefaultConsultant();
    setConsultant(blank);
    saveConsultant(blank);
    setStatus("Salesperson cleared.");
  }

  function deleteConsultantNow() {
    const blank = createDefaultConsultant();
    setConsultant(blank);
    if (typeof window !== "undefined") localStorage.removeItem("walker.consultant.v1");
    setStatus("Salesperson deleted.");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="button"
        tabIndex={-1}
        aria-label="Close settings"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white text-[#111113] shadow-2xl sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--accent)] bg-[url('/bg-drawer-9x16.jpg')] bg-cover bg-top px-5 py-4 print:bg-none">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center text-white/80 transition hover:text-white"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {status && (
          <div className="border-b border-[var(--border)] bg-green-50 px-5 py-2 text-sm font-bold text-green-800">
            ✓ {status}
          </div>
        )}

        <div className="grid gap-6 p-5 text-[#111113] sm:p-6">
          {/* ── Dealership ── */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection("dealer")}
              className="flex w-full items-center justify-between pb-3 text-left"
            >
              <div>
                <h3 className="text-lg font-bold text-[#111113]">Dealership</h3>
                <p className="text-sm text-neutral-600">{dealer.dealershipName || "Not set"}</p>
              </div>
              <span className={`text-lg text-neutral-600 transition-transform ${openSections.dealer ? "rotate-180" : ""}`}>▾</span>
            </button>
            {openSections.dealer && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-4 text-sm leading-6 text-neutral-600">
                  Synced to your account. Available on any device.
                </p>
                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Dealership Name</span>
                    <input type="text" value={dealer.dealershipName} onChange={(e) => updateDealer("dealershipName", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Street Address</span>
                    <input type="text" value={dealer.street} onChange={(e) => updateDealer("street", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">City</span>
                      <input type="text" value={dealer.city} onChange={(e) => updateDealer("city", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">State</span>
                      <input type="text" value={dealer.state} onChange={(e) => updateDealer("state", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">ZIP</span>
                      <input type="text" value={dealer.zip} onChange={(e) => updateDealer("zip", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                    </label>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={saveDealerNow} disabled={saving} className="inline-flex min-h-10 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={clearDealerNow} className="inline-flex min-h-10 items-center justify-center border border-[#111113] bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-[#111113]">Clear</button>
                  <button type="button" onClick={deleteDealerNow} className="inline-flex min-h-10 items-center justify-center border border-[var(--accent)] bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Delete</button>
                </div>
              </div>
            )}
          </section>

          {/* ── Salesperson ── */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection("consultant")}
              className="flex w-full items-center justify-between pb-3 text-left"
            >
              <div>
                <h3 className="text-lg font-bold text-[#111113]">Consultant Information</h3>
                <p className="text-sm text-neutral-600">{consultant.name || "Not set"}</p>
              </div>
              <span className={`text-lg text-neutral-600 transition-transform ${openSections.consultant ? "rotate-180" : ""}`}>▾</span>
            </button>
            {openSections.consultant && (
              <div className="border-t border-[var(--border)] pt-4">
                <p className="mb-4 text-sm leading-6 text-neutral-600">
                  Enter this once. It populates your business card, contact buttons, vehicle collages, and NXTDOCS forms on every device.
                </p>
                <div className="grid gap-4">
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Name</span>
                    <input type="text" value={consultant.name} onChange={(e) => updateConsultant("name", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Salesperson #</span>
                    <input type="text" value={consultant.salespersonNumber} onChange={(e) => updateConsultant("salespersonNumber", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Public Phone Number</span>
                    <input type="tel" value={consultant.phone} onChange={(e) => updateConsultant("phone", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-700">Public Contact Email</span>
                    <input type="email" value={consultant.email} onChange={(e) => updateConsultant("email", e.currentTarget.value)} className="min-h-12 border border-neutral-300 bg-white px-4 text-base !text-black caret-black [-webkit-text-fill-color:#000] [color-scheme:light] outline-none transition focus:border-[var(--accent)]" />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={saveConsultantNow} disabled={saving} className="inline-flex min-h-10 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-bold uppercase tracking-[0.08em] text-white disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={clearConsultantNow} className="inline-flex min-h-10 items-center justify-center border border-[#111113] bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-[#111113]">Clear</button>
                  <button type="button" onClick={deleteConsultantNow} className="inline-flex min-h-10 items-center justify-center border border-[var(--accent)] bg-white px-4 text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent)]">Delete</button>
                </div>
              </div>
            )}
          </section>

          {/* ── Team Management (Admin Only) ── */}
          {isAdmin && (
            <section>
              <Link
                href="/admin"
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:opacity-90"
              >
                Go To Team Management
              </Link>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
