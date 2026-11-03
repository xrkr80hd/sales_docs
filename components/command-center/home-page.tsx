"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { cachedResource, loadResource, primeResource } from "@/lib/client-resource-cache";
import { requestJson } from "@/lib/request-json";
import { chicagoDay, normalize, pace, type State } from "@/lib/sales-commander-model";
import { msUntilNextQuote, quoteForWindow } from "@/lib/inspiration-quotes";
import { cachedWhy, loadWhy, type Why } from "@/lib/why-client";
import styles from "./home-page.module.css";

const SLIDE_MS = 7000;

/** Consultant Home: a quote, their why, their album, and the numbers that keep them honest. */
export function HomePage() {
  const { accessToken } = useSession();
  const token = accessToken || "";
  const identity = useWorkspaceIdentity();
  const [quote, setQuote] = useState("");
  const [why, setWhy] = useState<Why | null>(() => cachedWhy(token));
  const [state, setState] = useState<State | null>(() => cachedResource<State>(token, "sales-commander") ?? null);
  const [slide, setSlide] = useState(0);
  const [today] = useState(() => chicagoDay());

  // A new quote every 5 hours, on its own. Picked in the browser to avoid a hydration mismatch.
  const seed = identity?.id || "";
  useEffect(() => {
    let timer = 0;
    const show = () => { setQuote(quoteForWindow(Date.now(), seed)); timer = window.setTimeout(show, msUntilNextQuote()); };
    show();
    return () => window.clearTimeout(timer);
  }, [seed]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    loadWhy(token).then(value => { if (alive) setWhy(value); }).catch(() => { if (alive) setWhy(current => current ?? { why: "", photos: [] }); });
    loadResource(token, "sales-commander", async () => {
      const value = await requestJson<{ commander: unknown; assignedGoal?: number }>("/api/me/sale-commander", { headers: { Authorization: `Bearer ${token}` } });
      primeResource(token, "sales-commander-assigned-goal", typeof value.assignedGoal === "number" ? value.assignedGoal : null);
      return normalize(value.commander);
    }, 300000).then(value => { if (alive) setState(value); }).catch(() => undefined);
    return () => { alive = false; };
  }, [token]);

  const photos = useMemo(() => why?.photos ?? [], [why]);
  useEffect(() => {
    if (photos.length < 2) return;
    // Keeps switching even with Reduce Motion on (phones, Low Power Mode); CSS drops the zoom there.
    const id = window.setInterval(() => setSlide(current => (current + 1) % photos.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [photos.length]);

  const p = useMemo(() => state ? pace(state, today) : null, [state, today]);
  const firstName = (identity?.displayName || "").trim().split(/\s+/)[0] || "";
  const statement = why?.why.trim() || "";
  // One reason per line shows as a list.
  const reasons = statement.split(/\n+/).map(line => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim()).filter(Boolean);

  return <div className={`nxt-house ${styles.page}`}>
    <section className={styles.hero} aria-label="Your why album">
      {photos.length ? photos.map((url, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" aria-hidden="true" className={`${styles.slide} ${index === slide % photos.length ? styles.slideOn : ""}`} loading={index === 0 ? "eager" : "lazy"} />
      )) : <div className={styles.heroEmpty} />}
      <div className={styles.shade} />
      <div className={styles.heroInner}>
        <p className={styles.kicker}>{firstName ? `WELCOME BACK, ${firstName.toUpperCase()}` : "WELCOME BACK"}</p>
        <blockquote className={styles.quote} aria-live="polite">{quote ? <>&ldquo;{quote}&rdquo;</> : " "}</blockquote>
        {!photos.length && why && <Link prefetch={false} href="/consultant-setup" className={styles.addPhotos}>Add the photos that keep you going →</Link>}
      </div>
      {photos.length > 1 && <div className={styles.dots} aria-hidden="true">{photos.map((url, index) => <span key={url} className={index === slide % photos.length ? styles.dotOn : undefined} />)}</div>}
    </section>

    <section className={`nxt-panel ${styles.why}`} aria-labelledby="why-title">
      <h2 id="why-title">Your Why:</h2>
      {reasons.length > 1 ? <ul className={styles.reasons}>{reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : statement ? <p className={styles.statement}>{statement}</p> : <p className={styles.muted}>Write down the reason you show up. <Link prefetch={false} href="/consultant-setup">Add your why in Consultant Set Up</Link>.</p>}
      {statement && <Link prefetch={false} href="/consultant-setup" className={styles.edit}>Edit</Link>}
    </section>

    <section aria-labelledby="numbers-title">
      <h2 id="numbers-title" className={styles.sectionTitle}>Your numbers</h2>
      {p && state ? <div className={styles.numbers}>
        <div className={`nxt-panel ${styles.tile}`}><span>Sold this month</span><strong>{p.mtd.sold}<small> / {state.goal}</small></strong><div className={styles.bar}><i style={{ width: `${Math.min(100, p.mtd.sold / Math.max(1, state.goal) * 100)}%` }} /></div></div>
        <div className={`nxt-panel ${styles.tile}`}><span>Pace</span><strong className={p.mtd.sold >= state.goal || p.behind <= 0.05 ? styles.good : styles.bad}>{p.mtd.sold >= state.goal ? "Goal reached" : p.behind > 0.05 ? `${p.behind.toFixed(1)} behind` : p.behind < -0.05 ? `${Math.abs(p.behind).toFixed(1)} ahead` : "On pace"}</strong><small>About {p.expectedSold.toFixed(1)} expected by now</small></div>
        <div className={`nxt-panel ${styles.tile}`}><span>Selling days left</span><strong>{p.remaining}</strong><small>of {p.total} this month</small></div>
        <div className={`nxt-panel ${styles.tile}`}><span>To finish at {state.goal}</span><strong>{p.mtd.sold >= state.goal ? "Bonus time" : p.perDayNeeded.toFixed(1)}</strong><small>{p.mtd.sold >= state.goal ? "Every sale from here is extra" : "sales a day"}</small></div>
      </div> : <p className={styles.muted} role="status">Loading your numbers…</p>}
      <nav className={styles.shortcuts} aria-label="Go to">
        <Link prefetch={false} href="/dashboard" className={`nxt-panel ${styles.tile} ${styles.shortcut}`}><span>Daily Planner</span><strong>Log today&apos;s numbers</strong><small>Checklist, counters and to-dos →</small></Link>
        <Link prefetch={false} href="/sale-commander" className={`nxt-panel ${styles.tile} ${styles.shortcut}`}><span>Sales Commander</span><strong>Goals &amp; routine</strong><small>Ratios, daily plan and seasonal hours →</small></Link>
      </nav>
    </section>
  </div>;
}
