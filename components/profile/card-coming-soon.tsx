import styles from "./card-coming-soon.module.css";

/** Shown at /card/<name> before the consultant publishes their card. */
export function CardComingSoon({ firstName, dealership }: { firstName: string; dealership: string }) {
  const who = firstName || "This consultant";
  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="coming-soon-title">
      <div className={styles.avatar} aria-hidden="true">{firstName ? firstName.charAt(0).toUpperCase() : "★"}</div>
      <p className={styles.kicker}>{dealership.toUpperCase()}</p>
      <h1 id="coming-soon-title">{firstName ? `${who}'s card is almost ready` : "This card is almost ready"}</h1>
      <p className={styles.lead}>{who} is putting the finishing touches on their digital business card. It&apos;ll be live here soon. Thanks for your patience, and check back shortly.</p>
      <p className={styles.small}>In the meantime, you&apos;re always welcome to stop by or call {dealership}.</p>
    </section>
    <p className={styles.footer}>Powered by NXTDOX</p>
  </main>;
}
