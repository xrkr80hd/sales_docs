import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const wiring = {
  phone: false,
  email: true,
  bio: false,
  socials: false,
  inventory: false,
  featuredVehicle: false,
  walkaround: false,
  reviews: false,
  leadForm: false,
  personalSite: false,
};

function EmptyState({ number, title, note }: { number: string; title: string; note: string }) {
  return (
    <section className={styles.emptyState} aria-labelledby={`section-${number}`}>
      <span className={styles.wireNumber}>{number}</span>
      <div>
        <h2 id={`section-${number}`}>{title}</h2>
        <p>{note}</p>
      </div>
    </section>
  );
}

export default function TravCardPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.brandRow}>
            <span className={styles.brand}>Walker Automotive</span>
            <span className={styles.language}>EN · ES</span>
          </div>

          <div className={styles.identity}>
            <div className={styles.photoFrame}>
              <Image
                src="/profiles/trav-walker.jpg"
                alt="Travis Wilkinson at Walker Automotive"
                fill
                priority
                sizes="(max-width: 640px) 132px, 168px"
                className={styles.photo}
              />
              <span className={styles.wireBadge}>01</span>
            </div>
            <div className={styles.identityCopy}>
              <p className={styles.eyebrow}>Sales Consultant</p>
              <h1>Travis Wilkinson</h1>
              <p className={styles.location}>Walker Automotive · Alexandria, Louisiana</p>
            </div>
          </div>

          <div className={styles.actions}>
            {wiring.phone ? null : (
              <button className={styles.disabledAction} disabled>
                <span>02</span> Phone not connected
              </button>
            )}
            <a className={styles.primaryAction} href="mailto:trav@xrkr80hd.studio">
              <span>03</span> Email Trav
            </a>
            <button className={styles.secondaryAction} disabled>
              <span>04</span> Save contact — needs vCard
            </button>
          </div>
        </header>

        <div className={styles.sections}>
          {!wiring.bio && (
            <EmptyState number="05" title="About Trav" note="Bio has not been added yet." />
          )}
          {!wiring.inventory && (
            <EmptyState number="06" title="Browse inventory" note="Walker inventory link has not been connected yet." />
          )}
          {!wiring.featuredVehicle && (
            <EmptyState number="07" title="Featured vehicle" note="No active Deal of the Week or Fresh Trade has been published." />
          )}
          {!wiring.walkaround && (
            <EmptyState number="08" title="Vehicle walk-around" note="No active walk-around video has been published." />
          )}
          {!wiring.reviews && (
            <EmptyState number="09" title="Five-star reviews" note="Review screenshots have not been uploaded." />
          )}
          {!wiring.socials && (
            <EmptyState number="10" title="Follow Trav" note="Social links have not been connected." />
          )}
          {!wiring.leadForm && (
            <EmptyState number="11" title="Ask Trav to contact you" note="The protected contact form still needs backend wiring." />
          )}
        </div>

        <footer className={styles.footer}>
          {!wiring.personalSite ? (
            <p><span>12</span> Personal-site link not connected</p>
          ) : (
            <Link href="https://xrkr80hd.studio">See what else Trav creates</Link>
          )}
          <p className={styles.buildNote}>Real data only. Unwired features remain clearly identified.</p>
        </footer>
      </div>
    </main>
  );
}
