"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { cachedResource, loadResource, primeResource } from "@/lib/client-resource-cache";
import { requestJson, withDeadline } from "@/lib/request-json";
import { publishSalesTargets } from "@/lib/sales-target-reminder";
import { blank, chicagoDay, countKeys, countNames, normalize, pace, type Counts, type DayLog, type State } from "@/lib/sales-commander-model";
import { dateKey, parseDay, planFor, startOfWeek } from "@/lib/routine-schedule";
import styles from "./consultant-home.module.css";

/* The daily checklist from the consultant Daily Planner sheet. */
const disciplines: [string, string][] = [
  ["walk", "“Good Morning” walk through the dealership"],
  ["sold-calls", "Sold customer follow-up · calls"],
  ["sold-mail", "Sold customer follow-up · texts or mail-outs"],
  ["unsold-calls", "Unsold follow-up · calls"],
  ["unsold-mail", "Unsold follow-up · texts or mail-outs"],
  ["training", "Daily personal training"],
  ["product", "20 minutes of product knowledge"],
  ["skills", "20 minutes of selling skills"],
  ["attitude", "20 minutes of attitude & motivation"],
  ["prospect", "Outside prospecting"],
  ["logged", "Logged today's numbers"],
  ["tomorrow", "Wrote next shift's to-dos"],
];
const shortNames: { [K in keyof Counts]: string } = { calls: "Calls", talks: "Conversations", appts: "Appts set", shows: "Appts shown", ups: "Ups", sold: "Sold" };
const emptyLog = (): DayLog => ({ checks: [], todos: [] });
const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Loads the consultant's saved Sales Commander record and saves every change shortly after it happens. */
function useCommanderRecord() {
  const { accessToken } = useSession();
  const identity = useWorkspaceIdentity();
  const accountId = identity?.id;
  const tokenRef = useRef(accessToken); tokenRef.current = accessToken;
  const [state, setState] = useState<State | null>(() => cachedResource<State>(accessToken || "", "sales-commander") ?? null);
  const [assignedGoal, setAssignedGoal] = useState<number | null>(() => cachedResource<number | null>(accessToken || "", "sales-commander-assigned-goal") ?? null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const latest = useRef<State | null>(state);
  const dirty = useRef(false), inFlight = useRef(false), failed = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const token = tokenRef.current || "";
    setLoadError("");
    loadResource(token, "sales-commander", async () => {
      if (!token) throw Error("Sign in to see your day.");
      const value = await requestJson<{ commander: unknown; assignedGoal?: number }>("/api/me/sale-commander", { headers: { Authorization: `Bearer ${token}` } });
      const goal = typeof value.assignedGoal === "number" ? value.assignedGoal : null;
      if (alive) setAssignedGoal(goal);
      primeResource(token, "sales-commander-assigned-goal", goal);
      return normalize(value.commander);
    }, 300000).then(value => {
      if (!alive || dirty.current) return;
      latest.current = value; setState(value); publishSalesTargets(token, value);
    }).catch(error => { if (alive) setLoadError(error instanceof Error ? error.message : "Your saved activity could not load."); });
    return () => { alive = false; };
  }, [attempt]);

  const flush = useCallback(async () => {
    if (inFlight.current || !dirty.current || !latest.current) return;
    inFlight.current = true; dirty.current = false; failed.current = false;
    setStatus("saving"); setSaveError("");
    const body = latest.current;
    try {
      const { data, error } = await withDeadline(getSupabaseBrowserClient().auth.getSession(), "Your connection is taking too long. Your numbers are still here.", 5000);
      if (error || !data.session || (accountId && data.session.user.id !== accountId)) throw Error("Your session ended. Sign in again to save.");
      const value = await requestJson<{ commander: unknown }>("/api/me/sale-commander", { method: "PUT", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!value.commander || typeof value.commander !== "object") throw Error("Save could not be confirmed. Your numbers are still here.");
      setStatus(dirty.current ? "saving" : "saved");
    } catch (error) {
      dirty.current = true; failed.current = true;
      setStatus("error"); setSaveError(error instanceof Error ? error.message : "Not saved yet.");
    } finally {
      inFlight.current = false;
      if (dirty.current && !failed.current) { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void flush(), 400); }
    }
  }, [accountId]);

  const update = useCallback((fn: (s: State) => State) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next; setState(next); dirty.current = true; setStatus("saving");
    // Other pages (Sales Commander) read this cache, so they always open with the newest numbers.
    primeResource(tokenRef.current || "", "sales-commander", next);
    publishSalesTargets(tokenRef.current || "", next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 900);
  }, [flush]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current || inFlight.current) { event.preventDefault(); event.returnValue = ""; } };
    const hidden = () => { if (document.visibilityState === "hidden") { window.clearTimeout(timer.current); void flush(); } };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("visibilitychange", hidden);
      window.clearTimeout(timer.current); void flush();
    };
  }, [flush]);

  const retrySave = useCallback(() => { failed.current = false; void flush(); }, [flush]);
  return { state, assignedGoal, loadError, retryLoad: () => setAttempt(a => a + 1), status, saveError, retrySave, update, displayName: identity?.displayName || "" };
}

function chicagoClock() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h)) return value;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function dayLabel(key: string) { return parseDay(key).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }

export function ConsultantHome() {
  const { state, assignedGoal, loadError, retryLoad, status, saveError, retrySave, update, displayName } = useCommanderRecord();
  const [today, setToday] = useState(() => chicagoDay());
  const [clock, setClock] = useState("");
  const [todoTab, setTodoTab] = useState<"today" | "next">("today");
  const [todoText, setTodoText] = useState("");

  useEffect(() => {
    const tick = () => { setClock(chicagoClock()); setToday(chicagoDay()); };
    tick();
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, []);

  const p = useMemo(() => state ? pace(state, today) : null, [state, today]);
  const plan = useMemo(() => state ? planFor(parseDay(today), state.schedule, state.weekendAnchor, state.earlyDays) : null, [state, today]);
  const nextShift = useMemo(() => {
    if (!state) return null;
    const d = parseDay(today);
    for (let i = 0; i < 10; i++) { d.setDate(d.getDate() + 1); if (planFor(d, state.schedule, state.weekendAnchor, state.earlyDays).kind !== "off") return dateKey(d); }
    return null;
  }, [state, today]);
  const week = useMemo(() => { const start = startOfWeek(parseDay(today)); return Array.from({ length: 6 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return dateKey(d); }); }, [today]);
  const carryOver = useMemo(() => {
    if (!state) return null;
    const dates = Object.keys(state.log).filter(date => date < today).sort().reverse().slice(0, 7);
    for (const date of dates) { const open = state.log[date].todos.filter(t => !t.done); if (open.length) return { date, open }; }
    return null;
  }, [state, today]);

  if (!state || !p || !plan) {
    return <div className={styles.page}>
      {loadError ? <div role="alert" className={styles.card}><p>{loadError}</p><button type="button" className={styles.primary} onClick={retryLoad}>Try again</button></div> : <p role="status" className={styles.muted}>Loading your day…</p>}
    </div>;
  }

  const counts = state.days[today] || blank();
  const log = (date: string) => state.log[date] || emptyLog();
  const todayLog = log(today);
  const items = [...plan.items].sort((a, b) => a.time.localeCompare(b.time));
  const currentIndex = clock ? items.reduce((found, item, i) => item.time <= clock ? i : found, -1) : -1;
  const loggedAny = countKeys.some(k => counts[k] > 0);
  const nextTodos = nextShift ? log(nextShift).todos : [];
  const auto: Record<string, boolean> = { logged: loggedAny, tomorrow: nextTodos.length > 0 };
  const isChecked = (id: string) => todayLog.checks.includes(id) || auto[id] === true;
  const doneDisciplines = disciplines.filter(([id]) => isChecked(id)).length;
  const doneBlocks = items.filter(item => todayLog.checks.includes("r:" + item.id)).length;
  const hour = Number(clock.slice(0, 2));
  const greeting = !clock ? "Welcome" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = displayName.trim().split(/\s+/)[0] || "";
  const goalMet = p.mtd.sold >= state.goal;
  const soldPct = Math.min(100, p.mtd.sold / Math.max(1, state.goal) * 100);
  const expectedPct = Math.min(100, p.expectedSold / Math.max(1, state.goal) * 100);

  const bump = (key: keyof Counts, delta: number) => update(s => {
    const day = s.days[today] || blank();
    return { ...s, days: { ...s.days, [today]: { ...day, [key]: Math.max(0, (day[key] || 0) + delta) } } };
  });
  const setLog = (date: string, fn: (entry: DayLog) => DayLog) => update(s => ({ ...s, log: { ...s.log, [date]: fn(s.log[date] || emptyLog()) } }));
  const toggle = (id: string) => setLog(today, entry => ({ ...entry, checks: entry.checks.includes(id) ? entry.checks.filter(x => x !== id) : [...entry.checks, id] }));
  const todoDate = todoTab === "today" ? today : nextShift;
  const addTodo = () => {
    const text = todoText.trim();
    if (!text || !todoDate) return;
    setLog(todoDate, entry => ({ ...entry, todos: [...entry.todos, { id: crypto.randomUUID(), text: text.slice(0, 200), done: false }].slice(0, 40) }));
    setTodoText("");
  };
  const bringForward = () => {
    if (!carryOver) return;
    const ids = new Set(carryOver.open.map(t => t.id));
    update(s => {
      const from = s.log[carryOver.date] || emptyLog(), to = s.log[today] || emptyLog();
      return { ...s, log: { ...s.log, [carryOver.date]: { ...from, todos: from.todos.filter(t => !ids.has(t.id)) }, [today]: { ...to, todos: [...to.todos, ...carryOver.open].slice(0, 40) } } };
    });
  };
  const shownTodos = todoDate ? log(todoDate).todos : [];

  return <div className={styles.page}>
    <header className={styles.header}>
      <p className={styles.kicker}>{dayLabel(today).toUpperCase()} · {plan.kind === "off" ? "DAY OFF" : plan.kind === "friday" ? "EARLY FINISH" : plan.kind === "long" ? "LATE DAY · 7 HR" : "EARLY DAY · 5 HR"}</p>
      <h1>{greeting}{firstName ? `, ${firstName}` : ""}</h1>
      <p className={styles.saveLine} role="status" aria-live="polite">
        {status === "saving" ? "Saving…" : status === "saved" ? "All changes saved" : status === "error" ? <>{saveError} <button type="button" className={styles.linkButton} onClick={retrySave}>Retry save</button></> : "Changes save automatically"}
      </p>
    </header>

    <section className={`${styles.card} ${styles.pace}`} aria-labelledby="pace-title">
      <div className={styles.paceTop}>
        <h2 id="pace-title"><strong>{p.mtd.sold}</strong> of {state.goal} sold this month</h2>
        {goalMet ? <span className={styles.good}>Goal reached</span> : p.behind > 0.05 ? <span className={styles.bad}>{p.behind.toFixed(1)} behind pace</span> : <span className={styles.good}>{p.behind < -0.05 ? `${Math.abs(p.behind).toFixed(1)} ahead` : "On pace"}</span>}
      </div>
      <div className={styles.bar} role="img" aria-label={`${p.mtd.sold} of ${state.goal} sold; pace says ${p.expectedSold.toFixed(1)} by now`}>
        <span className={styles.fill} style={{ width: `${soldPct}%` }} />
        <span className={styles.marker} style={{ left: `${expectedPct}%` }} />
      </div>
      <p className={styles.muted}>
        {goalMet ? "Every sale from here is a bonus. Keep the routine going." : `${p.remaining} selling ${p.remaining === 1 ? "day" : "days"} left · about ${p.perDayNeeded.toFixed(1)} a day to finish at ${state.goal}.`}
        {" "}{assignedGoal !== null ? "Goal set by your manager." : <Link href="/sale-commander">Change goal or ratios</Link>}
      </p>
    </section>

    {plan.kind === "off" && <section className={styles.card}><h2>Day off</h2><p className={styles.muted}>Rest up.{nextShift ? ` Next shift: ${dayLabel(nextShift)}.` : ""} Anything you log today still counts toward the month.</p></section>}

    <section aria-labelledby="numbers-title">
      <div className={styles.sectionHead}><h2 id="numbers-title">Today&apos;s numbers</h2><span className={styles.muted}>actual / target</span></div>
      <div className={styles.counters}>
        {countKeys.map(k => <div key={k} className={styles.counter}>
          <span className={styles.counterName}>{countNames[k]}</span>
          <span className={styles.counterValue}><strong>{counts[k]}</strong> <small>/ {p.targets[k] || "—"}</small></span>
          <span className={styles.catchUp} style={{ visibility: p.catchUp[k] ? "visible" : "hidden" }}>catch-up target</span>
          <span className={styles.counterButtons}>
            <button type="button" aria-label={`Remove one from ${countNames[k]}`} onClick={() => bump(k, -1)} disabled={counts[k] === 0}>−</button>
            <button type="button" aria-label={`Add one to ${countNames[k]}`} onClick={() => bump(k, 1)}>+</button>
          </span>
        </div>)}
      </div>
    </section>

    {plan.kind !== "off" && <section className={styles.card} aria-labelledby="routine-title">
      <div className={styles.sectionHead}><h2 id="routine-title">Today&apos;s routine</h2><span className={styles.muted}>{doneBlocks}/{items.length} done</span></div>
      {items.length === 0 ? <p className={styles.muted}>No routine saved for today. <Link href="/sale-commander">Build one in Sales Commander</Link>.</p> : <ul className={styles.checklist}>
        {items.map((item, i) => <li key={item.id + i} className={i === currentIndex ? styles.now : undefined}>
          <label><input type="checkbox" checked={todayLog.checks.includes("r:" + item.id)} onChange={() => toggle("r:" + item.id)} /><span className={styles.time}>{formatTime(item.time)}</span><span>{item.name}{i === currentIndex && <em className={styles.nowTag}> · now</em>}</span></label>
        </li>)}
      </ul>}
      <p className={styles.small}><Link href="/sale-commander">Edit times or swap a shift</Link></p>
    </section>}

    <section className={styles.card} aria-labelledby="disciplines-title">
      <div className={styles.sectionHead}><h2 id="disciplines-title">Daily disciplines</h2><span className={styles.muted}>{doneDisciplines}/{disciplines.length}</span></div>
      <ul className={styles.checklist}>
        {disciplines.map(([id, label]) => <li key={id}>
          <label><input type="checkbox" checked={isChecked(id)} disabled={auto[id] === true} onChange={() => toggle(id)} /><span>{label}{auto[id] === true && <em className={styles.autoTag}> · done automatically</em>}</span></label>
        </li>)}
      </ul>
    </section>

    <section className={styles.card} aria-labelledby="todo-title">
      <div className={styles.sectionHead}><h2 id="todo-title">To-dos &amp; appointments</h2></div>
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={todoTab === "today"} onClick={() => setTodoTab("today")}>Today</button>
        <button type="button" role="tab" aria-selected={todoTab === "next"} disabled={!nextShift} onClick={() => setTodoTab("next")}>{nextShift ? `Next shift · ${dayLabel(nextShift)}` : "Next shift"}</button>
      </div>
      {todoTab === "today" && carryOver && <button type="button" className={styles.secondary} onClick={bringForward}>Bring forward {carryOver.open.length} unfinished from {dayLabel(carryOver.date)}</button>}
      <form className={styles.todoForm} onSubmit={event => { event.preventDefault(); addTodo(); }}>
        <input aria-label="New to-do or appointment" value={todoText} maxLength={200} onChange={event => setTodoText(event.target.value)} placeholder="2:30 Ms. Davis · Grand Cherokee test drive" />
        <button type="submit" className={styles.primary} disabled={!todoText.trim()}>Add</button>
      </form>
      {shownTodos.length === 0 ? <p className={styles.muted}>{todoTab === "today" ? "Nothing listed yet. Add today's appointments and callbacks." : "Write tomorrow's plan before you leave. It checks off a daily discipline."}</p> : <ul className={styles.checklist}>
        {shownTodos.map(todo => <li key={todo.id}>
          <label><input type="checkbox" checked={todo.done} onChange={() => todoDate && setLog(todoDate, entry => ({ ...entry, todos: entry.todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t) }))} /><span className={todo.done ? styles.done : undefined}>{todo.text}</span></label>
          <button type="button" className={styles.remove} aria-label={`Delete ${todo.text}`} onClick={() => todoDate && setLog(todoDate, entry => ({ ...entry, todos: entry.todos.filter(t => t.id !== todo.id) }))}>×</button>
        </li>)}
      </ul>}
    </section>

    <section className={styles.card} aria-labelledby="week-title">
      <div className={styles.sectionHead}><h2 id="week-title">This week</h2></div>
      <div className={styles.tableWrap}>
        <table className={styles.week}>
          <thead><tr><th scope="col"><span className={styles.srOnly}>Activity</span></th>{week.map(date => <th key={date} scope="col" className={date === today ? styles.todayCol : undefined}>{weekdayShort[parseDay(date).getDay()]}</th>)}<th scope="col">Week</th><th scope="col">Month</th></tr></thead>
          <tbody>{countKeys.map(k => {
            const values = week.map(date => state.days[date]?.[k] || 0);
            return <tr key={k}><th scope="row">{shortNames[k]}</th>{values.map((v, i) => <td key={week[i]} className={week[i] === today ? styles.todayCol : undefined}>{v || ""}</td>)}<td>{values.reduce((a, b) => a + b, 0)}</td><td>{p.mtd[k]} <small>/ {p.plan.adjusted[k]}</small></td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>

    <nav className={styles.actions} aria-label="Quick actions">
      <Link href="/deal-commander" className={styles.primary}>Start a Deal</Link>
      <Link href="/deals" className={styles.secondary}>Resume Deal</Link>
      <Link href="/sale-commander" className={styles.secondary}>Goals, ratios &amp; routine</Link>
    </nav>
  </div>;
}
