import Image from "next/image";
import styles from "./page.module.css";

const vehicleUrl =
  "https://www.walkercdjr.net/inventory/new-2026-ram-2500-laramie-4x4-crew-cab-3c6ur5fj8tg367952/";

const wiring = {
  phone: true,
  email: true,
  bio: false,
  socials: false,
  inventory: false,
  featuredVehicle: true,
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
            {wiring.phone && (
              <>
                <a className={styles.primaryAction} href="tel:+13187877887">
                  <span>02</span> Call Trav
                </a>
                <a className={styles.secondaryAction} href="sms:+13187877887">
                  <span>02</span> Text Trav
                </a>
              </>
            )}
            <a className={styles.secondaryAction} href="mailto:trav@xrkr80hd.studio">
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

          {wiring.featuredVehicle && (
            <section className={styles.vehicleCard} aria-labelledby="featured-vehicle">
              <div className={styles.vehicleMedia}>
                <span>07</span>
                <p>Vehicle media has not been imported.</p>
              </div>
              <div className={styles.vehicleBody}>
                <p className={styles.vehicleLabel}>Featured vehicle</p>
                <h2 id="featured-vehicle">New 2026 RAM 2500 Laramie</h2>
                <dl className={styles.vehicleFacts}>
                  <div><dt>Configuration</dt><dd>4×4 Crew Cab</dd></div>
                  <div><dt>Stock</dt><dd>TJ26336</dd></div>
                  <div><dt>VIN</dt><dd>3C6UR5FJ8TG367952</dd></div>
                  <div><dt>Listed price</dt><dd>$67,598</dd></div>
                </dl>
                <div className={styles.vehicleActions}>
                  <a href="tel:+13187877887">Call Trav</a>
                  <a href="sms:+13187877887">Text Trav</a>
                  <a href={vehicleUrl} target="_blank" rel="noopener noreferrer">View Walker listing</a>
                </div>
                <p className={styles.priceNote}>Vehicle availability and pricing must be confirmed on the live dealer listing.</p>
              </div>
            </section>
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
          {!wiring.personalSite && <p><span>12</span> Personal-site link not connected</p>}
          <p className={styles.buildNote}>Real data only. Unwired features remain clearly identified.</p>
        </footer>
      </div>
    </main>
  );
}
