"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Payload = any;
async function call(path: string, init?: RequestInit) {
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  const res = await fetch(path, { ...init, headers: { authorization: `Bearer ${data.session?.access_token ?? ""}`, "content-type": "application/json", ...init?.headers } });
  const json = await res.json(); if (!res.ok) throw new Error(json.error || "Request failed"); return json;
}
export function MessengerScreen() {
  const [data, setData] = useState<Payload>(null); const [selected, setSelected] = useState(""); const [text, setText] = useState(""); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const d = await call("/api/messenger"); setData(d); setSelected((s) => s || d.conversations?.[0]?.id || ""); } catch (e) { setError(e instanceof Error ? e.message : "Could not load messenger"); } }, []);
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [load]);
  const messages = useMemo(() => (data?.messages ?? []).filter((m:any) => m.conversation_id === selected), [data, selected]);
  async function send(e: FormEvent) { e.preventDefault(); if (!text.trim() || !selected) return; try { await call("/api/messenger", { method:"POST", body:JSON.stringify({ action:"send", conversationId:selected, body:text }) }); setText(""); await load(); } catch(e){ setError(e instanceof Error ? e.message : "Could not send"); } }
  async function dm(userId:string) { try { const d=await call("/api/messenger",{method:"POST",body:JSON.stringify({action:"start-dm",userId})}); setSelected(d.conversationId); await load(); } catch(e){setError(e instanceof Error?e.message:"Could not start DM");} }
  if (!data) return <div className="border border-white/10 bg-[#151517] p-6 text-white">Loading NXTDox Messenger…</div>;
  const org = data.membership?.organizations?.name;
  if (!data.membership?.chat_enabled) return <section className="border border-white/10 bg-[#151517] p-6 text-white"><h1 className="text-2xl font-black">NXTDox Messenger</h1><p className="mt-3 text-white/60">Your administrator has not enabled messenger access yet.</p></section>;
  return <section className="overflow-hidden border border-white/10 bg-[#111113] text-white shadow-2xl">
    <header className="border-b border-white/10 px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[.22em] text-red-500">{org}</p><h1 className="text-2xl font-black">NXTDox Messenger</h1></header>
    {error && <p className="bg-red-950 px-4 py-2 text-sm">{error}</p>}
    <div className="grid min-h-[65vh] md:grid-cols-[280px_1fr]">
      <aside className="border-b border-white/10 p-3 md:border-b-0 md:border-r">
        <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Conversations</p>
        <div className="flex gap-2 overflow-x-auto md:block">{(data.conversations??[]).map((c:any)=><button key={c.id} onClick={()=>setSelected(c.id)} className={`mb-2 min-w-40 border px-3 py-3 text-left text-sm font-bold md:w-full ${selected===c.id?"border-red-600 bg-red-600":"border-white/10 bg-white/5"}`}>{c.kind==="organization"?c.title:"Direct message"}</button>)}</div>
        {data.membership.can_dm && <details className="mt-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wider">New direct message</summary><div className="mt-2 grid gap-1">{(data.people??[]).filter((p:any)=>p.user_id!==data.me).map((p:any)=><button key={p.user_id} onClick={()=>dm(p.user_id)} className="border border-white/10 px-3 py-2 text-left text-sm">{p.profiles?.display_name||"Team member"}</button>)}</div></details>}
      </aside>
      <div className="flex min-h-[430px] flex-col"><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.length?messages.map((m:any)=><div key={m.id} className={`max-w-[85%] ${m.sender_id===data.me?"ml-auto":""}`}><p className="mb-1 text-[10px] font-bold text-white/40">{m.profiles?.display_name||"NXTDox user"}</p><div className={`px-4 py-3 text-sm ${m.sender_id===data.me?"bg-red-600":"bg-white/10"}`}>{m.body}</div></div>):<p className="text-center text-sm text-white/35">Choose a conversation and send the first message.</p>}</div>
        <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><input value={text} onChange={e=>setText(e.target.value)} maxLength={4000} placeholder="Write a message…" className="min-w-0 flex-1 border border-white/15 bg-black px-3 text-sm outline-none focus:border-red-600"/><button className="h-11 bg-red-600 px-5 text-xs font-black uppercase tracking-wider">Send</button></form>
      </div>
    </div>
  </section>;
}
