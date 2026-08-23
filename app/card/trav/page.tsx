import Image from "next/image";
import { ReviewCarousel } from "@/components/profile/review-carousel";
import { VehiclePreviewCard } from "@/components/profile/vehicle-preview-card";
import styles from "./page.module.css";

const featuredVehicles = [
  {
    listingUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-laramie-4x4-crew-cab-3c6ur5fj8tg367952/",
    verifiedFallback: {
      sourceUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-laramie-4x4-crew-cab-3c6ur5fj8tg367952/",
      title: "New 2026 RAM 2500 Laramie 4×4 Crew Cab",
      imageUrl: "https://vehicle-images.carscommerce.inc/e3a2-110005854/3C6UR5FJ8TG367952/64a7e95a66b6ac639f330cf1e34dc9fb.jpg",
      description: "6.4L V8 · 4WD · 8-speed automatic · Black interior",
      vin: "3C6UR5FJ8TG367952",
      stock: "TJ26336",
      price: "$67,598",
    },
  },
  {
    listingUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-1500-big-hornlone-star-4x4-crew-cab-1c6srfft4tn349096/",
    verifiedFallback: {
      sourceUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-1500-big-hornlone-star-4x4-crew-cab-1c6srfft4tn349096/",
      title: "New 2026 RAM 1500 Big Horn/Lone Star 4×4 Crew Cab",
      imageUrl: null,
      description: "Granite Crystal Metallic Clearcoat · Black interior · 4×4 Crew Cab · 5′7″ box",
      vin: "1C6SRFFT4TN349096",
      stock: "TJ26185",
      price: "$53,469",
    },
  },
  {
    listingUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-black-express-4x4-crew-cab-3c6ur5cj9tg367950/",
    verifiedFallback: {
      sourceUrl: "https://www.walkercdjr.net/inventory/new-2026-ram-2500-black-express-4x4-crew-cab-3c6ur5cj9tg367950/",
      title: "New 2026 RAM 2500 Black Express 4×4 Crew Cab",
      imageUrl: null,
      description: "Bright White Clearcoat · Black Express · 4×4 Crew Cab · 6′4″ box",
      vin: "3C6UR5CJ9TG367950",
      stock: "TJ26335",
      price: "$61,795",
    },
  },
];

const reviews = [
  { src: "/reviews/edward-ramer.jpg", alt: "Five-star review from Edward Ramer", isLong: true },
  { src: "/reviews/ciena-thompson.jpg", alt: "Five-star review from Ciena Thompson" },
  { src: "/reviews/sabrina-carter.jpg", alt: "Five-star review from Sabrina Carter", isLong: true },
  { src: "/reviews/elise-leblanc.jpg", alt: "Five-star review from Elise LeBlanc" },
  { src: "/reviews/shonna-longino.jpg", alt: "Five-star review from Shonna Longino" },
  { src: "/reviews/downing-glasscock.jpg", alt: "Five-star review from Downing Glasscock", isLong: true },
  { src: "/reviews/angela-jeffress.jpg", alt: "Five-star review from Angela Jeffress" },
  { src: "/reviews/shane-pappas.jpg", alt: "Five-star review from Shane Pappas" },
  { src: "/reviews/michael-christy.jpg", alt: "Five-star review from Michael Christy" },
  { src: "/reviews/christina-belvin.jpg", alt: "Five-star review from Christina Belvin", isLong: true },
];

const wiring = {
  bio: false,
  socials: false,
  inventory: false,
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

export default function TravisWilkinsonProfile() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.brandRow}>
            <div className={styles.logoSlot} aria-label="Consultant logo slot">
              <span>Logo</span>
              <small>Not uploaded</small>
            </div>
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

          <div className={styles.catchphrases}>
            <p className={styles.primaryPhrase}>#CallTrav</p>
            <p>I have full access to all seven Walker Automotive lots. If this isn’t it, we’ll find what you’re looking for.</p>
          </div>

          <details className={styles.contactAccordion}>
            <summary>Contact</summary>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href="tel:+13187877887">Call</a>
              <a className={styles.secondaryAction} href="sms:+13187877887">Text</a>
              <a className={styles.secondaryAction} href="mailto:twilkinson@walkerautomotive.com">Email</a>
              <button className={styles.secondaryAction} disabled>Save contact — not connected</button>
            </div>
          </details>
        </header>

        <div className={styles.profileGrid}>
          <section className={styles.brandCard} aria-label="Call Trav consultant calling card">
            <Image
              src="/profiles/trav-call-card.jpg"
              alt="Call Trav consultant calling card for Travis Wilkinson"
              fill
              sizes="(max-width: 619px) 100vw, 300px"
              className={styles.brandCardImage}
            />
          </section>

          {!wiring.bio && (
            <EmptyState number="03" title="About Travis Wilkinson" note="Bio has not been added yet." />
          )}
        </div>

        <section className={styles.vehicleSection} aria-labelledby="vehicle-section-heading">
          <div className={styles.sectionHeading}>
            <div><p className={styles.vehicleLabel}>Trav’s picks</p><h2 id="vehicle-section-heading">Vehicles worth a look</h2></div>
            <span>Swipe</span>
          </div>
          <div className={styles.vehicleRail}>
            {featuredVehicles.map(({ listingUrl, verifiedFallback }) => (
              <VehiclePreviewCard
                key={listingUrl}
                listingUrl={listingUrl}
                verifiedFallback={verifiedFallback}
              />
            ))}
          </div>
        </section>

        <ReviewCarousel reviews={reviews} />

        <div className={styles.sections}>
          {!wiring.inventory && (
            <EmptyState number="06" title="Browse all Walker inventory" note="The general inventory destination has not been connected." />
          )}
          {!wiring.walkaround && (
            <EmptyState number="08" title="Vehicle walk-around" note="No active walk-around video has been published." />
          )}
          {!wiring.socials && (
            <EmptyState number="10" title="Follow Travis Wilkinson" note="Social links have not been connected." />
          )}
          {!wiring.leadForm && (
            <EmptyState number="11" title="Ask Travis Wilkinson to contact you" note="The protected contact form still needs backend wiring." />
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
