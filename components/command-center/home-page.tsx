"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { useSession } from "@/components/auth/supabase-session-gate";
import { useWorkspaceIdentity } from "./workspace-context";
import { cachedResource, loadResource, primeResource } from "@/lib/client-resource-cache";
import { requestJson } from "@/lib/request-json";
import { chicagoDay, normalize, pace, type State } from "@/lib/sales-commander-model";
import { randomQuote } from "@/lib/inspiration-quotes";
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

  // Picked in the browser so every visit gets a fresh one.
  useEffect(() => { setQuote(randomQuote()); }, []);

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
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setSlide(current => (current + 1) % photos.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [photos.length]);

  const p = useMemo(() => state ? pace(state, today) : null, [state, today]);
  const firstName = (identity?.displayName || "").trim().split(/\s+/)[0] || "";
  const statement = why?.why.trim() || "";

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
        <button type="button" className={styles.shuffle} onClick={() => setQuote(current => randomQuote(current))}><Shuffle size={15} />New quote</button>
        {!photos.length && why && <Link prefetch={false} href="/consultant-setup" className={styles.addPhotos}>Add the photos that keep you going →</Link>}
      </div>
      {photos.length > 1 && <div className={styles.dots} aria-hidden="true">{photos.map((url, index) => <span key={url} className={index === slide % photos.length ? styles.dotOn : undefined} />)}</div>}
    </section>

    <section className={`nxt-panel ${styles.why}`} aria-labelledby="why-title">
      <h2 id="why-title">Your Why:</h2>
      {statement ? <p className={styles.statement}>{statement}</p> : <p className={styles.muted}>Write down the reason you show up. <Link prefetch={false} href="/consultant-setup">Add your why in Consultant Set Up</Link>.</p>}
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
      <div className={styles.actions}>
        <Link prefetch={false} href="/dashboard" className="nxt-btn-primary">Open Today</Link>
        <Link prefetch={false} href="/sale-commander" className="nxt-btn">Goals &amp; routine</Link>
      </div>
    </section>
  </div>;
}
