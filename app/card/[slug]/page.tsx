import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ReviewCarousel } from "@/components/profile/review-carousel";
import { VehicleCarousel } from "@/components/profile/vehicle-carousel";
import { getPublishedConsultantProfile } from "@/lib/public-consultant-profile";
import styles from "../trav/page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublishedConsultantProfile(slug);
  if (!profile) return { title: "Consultant profile unavailable" };
  return {
    title: `${profile.identity.displayName} | ${profile.identity.dealership}`,
    description: profile.content.salesQuote || `Contact ${profile.identity.displayName}.`,
  };
}

export default async function ConsultantCard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getPublishedConsultantProfile(slug);
  if (!profile) notFound();

  const vehicles = profile.vehicles.map((entry) => ({
    listingUrl: entry.url,
    verifiedFallback: {
      sourceUrl: entry.url, title: entry.title, imageUrl: entry.imageUrl || null,
      description: entry.description || null, vin: entry.secondaryUrl || null,
      stock: entry.meta?.match(/Stock\s+([^·]+)/i)?.[1]?.trim() || null,
      price: entry.meta?.split("·")[0]?.trim() || null,
    },
  }));
  const reviews = profile.reviews.map((entry) => ({
    src: entry.imageUrl, alt: `Review from ${entry.title}`, isLong: entry.meta === "long",
  }));

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.brandRow}>
            {profile.identity.logoUrl ? (
              <div className={styles.logoSlot}>
                <Image src={profile.identity.logoUrl} alt="Business-card logo" fill priority sizes="170px" className={styles.logoImage} />
              </div>
            ) : <div style={{ minHeight: "36px" }} />}
            <span className={styles.language}>{profile.identity.languageLabel}</span>
          </div>
          <div className={styles.identity}>
            <div className={styles.photoFrame}>
              {profile.identity.profileImageUrl ? (
                <Image src={profile.identity.profileImageUrl} alt={profile.identity.displayName} fill priority sizes="168px" className={styles.photo} />
              ) : (
                <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "#22252a", color: "#be1717", fontSize: "2.5rem", fontWeight: 900 }}>
                  {profile.identity.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "WD"}
                </div>
              )}
            </div>
            <div className={styles.identityCopy}>
              <p className={styles.eyebrow}>{profile.identity.jobTitle}</p>
              <h1>{profile.identity.displayName}</h1>
              <p className={styles.location}>{profile.identity.dealership} · {profile.identity.location}</p>
            </div>
          </div>
          <div className={styles.catchphrases}><p className={styles.primaryPhrase}>{profile.content.primaryPhrase}</p><p>{profile.content.salesQuote}</p></div>
          <details className={styles.contactAccordion}>
            <summary>Contact</summary>
            <div className={styles.actions}>
              {profile.identity.phone && (
                <>
                  <a className={styles.primaryAction} href={`tel:${profile.identity.phone.replace(/[^\d+]/g, "")}`}>Call</a>
                  <a className={styles.secondaryAction} href={`sms:${profile.identity.phone.replace(/[^\d+]/g, "")}`}>Text</a>
                </>
              )}
              {profile.identity.email && (
                <a className={styles.secondaryAction} href={`mailto:${profile.identity.email}`}>Email</a>
              )}
              <a
                className={styles.secondaryAction}
                href={`/api/card/${slug}/vcard`}
                download
                aria-label={`Save ${profile.identity.displayName} to phone contacts`}
              >
                Save Contact
              </a>
            </div>
          </details>
        </header>

        <div className={styles.profileGrid}>
          {profile.identity.callingCardImageUrl && <section className={styles.brandCard}><Image src={profile.identity.callingCardImageUrl} alt={`${profile.identity.displayName} calling card`} fill sizes="300px" className={styles.brandCardImage} /></section>}
          {profile.content.bio && <section className={styles.emptyState}><div><h2>About {profile.identity.displayName}</h2><p>{profile.content.bio}</p></div></section>}
        </div>

        {!!vehicles.length && <VehicleCarousel vehicles={vehicles} />}
        {!!reviews.length && <ReviewCarousel reviews={reviews} />}

        {!!profile.soldGallery.length && <section className={styles.mediaSection}><h2>Sold gallery</h2><div className={styles.mediaRail}>{profile.soldGallery.map((entry) => <article key={entry.id}><img src={entry.imageUrl} alt={entry.title} /><strong>{entry.title}</strong><p>{entry.description}</p></article>)}</div></section>}
        {!!profile.videos.length && <section className={styles.mediaSection}><h2>Videos</h2><div className={styles.mediaRail}>{profile.videos.map((entry) => <article key={entry.id}>{entry.imageUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? <video src={entry.imageUrl} controls preload="metadata" /> : entry.imageUrl ? <img src={entry.imageUrl} alt={entry.title} /> : null}<strong>{entry.title}</strong><p>{entry.description}</p>{entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer">Watch video</a>}</article>)}</div></section>}

        <div className={styles.sections}>
          <a className={styles.inventoryButton} href={profile.content.inventoryUrl} target="_blank" rel="noopener noreferrer">{profile.content.inventoryButtonLabel}</a>
          {!!profile.socialLinks.length && <nav className={styles.socialLinks} aria-label="Social profiles">{profile.socialLinks.map((entry) => <a key={entry.id} href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}</a>)}</nav>}
        </div>
      </div>
    </main>
  );
}
