import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ReviewCarousel } from "@/components/profile/review-carousel";
import { VehicleCarousel } from "@/components/profile/vehicle-carousel";
import { CopyCardLinkButton } from "@/components/profile/copy-card-link-button";
import { VideoPlaylist } from "@/components/profile/video-playlist";
import { SocialPlatformIcon } from "@/components/profile/social-platform-icon";
import { getPublishedConsultantProfile } from "@/lib/public-consultant-profile";
import styles from "../trav/page.module.css";

export const dynamic = "force-dynamic";
const SITE_URL = "https://nextdocs.xrkr80hd.studio";

function getVideoEmbedUrl(rawUrl: string) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const id = url.pathname === "/watch" ? url.searchParams.get("v") : parts[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "tiktok.com" || host === "m.tiktok.com") {
      const match = url.pathname.match(/\/video\/(\d+)/);
      return match ? `https://www.tiktok.com/player/v1/${match[1]}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

type CardPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vehicle?: string; video?: string }>;
};

export async function generateMetadata({ params, searchParams }: CardPageProps): Promise<Metadata> {
  const { slug } = await params;
  const selected = await searchParams;
  const profile = await getPublishedConsultantProfile(slug);
  if (!profile) return { title: "Consultant profile unavailable" };
  const vehicle = profile.vehicles.find((entry) => entry.secondaryUrl === selected.vehicle || entry.id === selected.vehicle);
  const video = profile.videos.find((entry) => entry.id === selected.video);
  const sharedTitle = vehicle?.title || video?.title || `${profile.identity.displayName} | ${profile.identity.dealership}`;
  const sharedDescription = vehicle?.description || video?.description || profile.content.bio || profile.content.salesQuote || `Contact ${profile.identity.displayName}, a sales consultant at ${profile.identity.dealership} in ${profile.identity.location}.`;
  const cardImage = vehicle?.imageUrl || profile.identity.callingCardImageUrl || profile.identity.profileImageUrl || profile.identity.logoUrl;
  const imageUrl = cardImage ? new URL(cardImage, SITE_URL).toString() : undefined;
  const canonicalUrl = `${SITE_URL}/card/${slug}`;
  const keywords = [
    profile.identity.displayName,
    profile.identity.dealership,
    `${profile.identity.dealership} sales consultant`,
    `car sales consultant ${profile.identity.location}`,
    `new and used vehicles ${profile.identity.location}`,
    "Walker Automotive",
    "vehicle sales Alexandria Louisiana",
  ];
  return {
    title: sharedTitle,
    description: sharedDescription,
    keywords,
    authors: [{ name: profile.identity.displayName, url: canonicalUrl }],
    creator: profile.identity.displayName,
    publisher: profile.identity.dealership,
    category: "Automotive",
    alternates: { canonical: canonicalUrl },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      title: sharedTitle,
      description: sharedDescription,
      type: "profile",
      url: canonicalUrl,
      siteName: "NXTDOCS Consultant Profiles",
      locale: "en_US",
      images: imageUrl ? [{ url: imageUrl, alt: vehicle ? `${vehicle.title} vehicle collage` : `${profile.identity.displayName} business card` }] : undefined,
    },
    twitter: { card: "summary_large_image", title: sharedTitle, description: sharedDescription, images: imageUrl ? [imageUrl] : undefined },
  };
}

export default async function ConsultantCard({ params, searchParams }: CardPageProps) {
  const { slug } = await params;
  const selected = await searchParams;
  const profile = await getPublishedConsultantProfile(slug);
  if (!profile) notFound();

  const vehicles = profile.vehicles.map((entry) => ({
    listingUrl: entry.url,
    verifiedFallback: {
      sourceUrl: entry.url, title: entry.title, imageUrl: entry.imageUrl || null,
      description: entry.description || null, vin: entry.secondaryUrl || null,
      stock: entry.meta?.match(/Stock\s+([^·]+)/i)?.[1]?.trim() || null,
      price: entry.meta?.split("·")[0]?.trim() || null,
      features: [entry.builderData?.form.feature1, entry.builderData?.form.feature2, entry.builderData?.form.feature3].filter((feature): feature is string => Boolean(feature)),
    },
  }));
  const reviews = profile.reviews.map((entry) => ({
    src: entry.imageUrl, alt: `Review from ${entry.title}`, isLong: entry.meta === "long",
  }));
  const videos = profile.videos.map((entry) => ({ ...entry, embedUrl: getVideoEmbedUrl(entry.url) }));
  const canonicalUrl = `${SITE_URL}/card/${slug}`;
  const vehicleListSchema = profile.vehicles.map((vehicleEntry, index) => {
    const [priceLabel = "", stockLabel = ""] = (vehicleEntry.meta || "").split(" · ");
    const price = priceLabel.replace(/[^0-9.]/g, "");
    const stock = stockLabel.replace(/^Stock\s*/i, "").trim();
    const shareUrl = `${canonicalUrl}?vehicle=${encodeURIComponent(vehicleEntry.secondaryUrl || vehicleEntry.id)}`;

    return {
      "@type": "ListItem",
      position: index + 1,
      url: shareUrl,
      item: {
        "@type": "Vehicle",
        name: vehicleEntry.title,
        description: vehicleEntry.description || undefined,
        image: vehicleEntry.imageUrl ? new URL(vehicleEntry.imageUrl, SITE_URL).toString() : undefined,
        vehicleIdentificationNumber: vehicleEntry.secondaryUrl || undefined,
        sku: stock || undefined,
        url: vehicleEntry.url || shareUrl,
        offers: price ? { "@type": "Offer", price, priceCurrency: "USD", url: vehicleEntry.url || shareUrl } : undefined,
      },
    };
  });
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${profile.identity.displayName} — ${profile.identity.dealership}`,
    url: canonicalUrl,
    description: profile.content.bio || profile.content.salesQuote || `Automotive sales consultant at ${profile.identity.dealership}.`,
    mainEntity: {
      "@type": "Person",
      name: profile.identity.displayName,
      jobTitle: profile.identity.jobTitle,
      image: profile.identity.profileImageUrl ? new URL(profile.identity.profileImageUrl, SITE_URL).toString() : undefined,
      telephone: profile.identity.phone || undefined,
      email: profile.identity.email || undefined,
      url: canonicalUrl,
      worksFor: {
        "@type": "Organization",
        name: profile.identity.dealership,
        address: { "@type": "PostalAddress", streetAddress: profile.identity.location },
      },
      knowsAbout: ["New vehicles", "Used vehicles", "Automotive sales", "Vehicle trade-ins"],
      sameAs: profile.socialLinks.map((entry) => entry.url).filter(Boolean),
    },
    hasPart: vehicles.length ? {
      "@type": "ItemList",
      name: `${profile.identity.displayName}'s featured vehicles`,
      itemListElement: vehicleListSchema,
    } : undefined,
  };

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema).replace(/</g, "\\u003c") }}
      />
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
          {profile.identity.callingCardImageUrl && (
            <section className={styles.brandCard}>
              <Image src={profile.identity.callingCardImageUrl} alt="" aria-hidden="true" fill sizes="(max-width: 760px) 100vw, 720px" className={styles.brandCardBackdrop} />
              <Image src={profile.identity.callingCardImageUrl} alt={`${profile.identity.displayName} calling card`} fill sizes="(max-width: 760px) 100vw, 720px" className={styles.brandCardImage} />
            </section>
          )}
          {profile.content.bio && <section className={styles.emptyState}><div><h2>About {profile.identity.displayName}</h2><p>{profile.content.bio}</p></div></section>}
        </div>

        {!!vehicles.length && <VehicleCarousel vehicles={vehicles} initialVehicleVin={selected.vehicle} consultantName={profile.identity.displayName} phone={profile.identity.phone} />}
        {!!reviews.length && <ReviewCarousel reviews={reviews} />}

        {!!profile.soldGallery.length && <section className={styles.mediaSection}><h2>Sold gallery</h2><div className={styles.mediaRail}>{profile.soldGallery.map((entry) => <article key={entry.id}><img src={entry.imageUrl} alt={entry.title} /><strong>{entry.title}</strong><p>{entry.description}</p></article>)}</div></section>}
        {!!videos.length && <VideoPlaylist videos={videos} initialVideoId={selected.video} />}

        <div className={styles.sections}>
          <CopyCardLinkButton label="Copy profile link" className={styles.profileShareButton} />
          <a className={styles.inventoryButton} href={profile.content.inventoryUrl} target="_blank" rel="noopener noreferrer">{profile.content.inventoryButtonLabel}</a>
          {!!profile.socialLinks.length && <nav className={styles.socialLinks} aria-label="Social profiles">{profile.socialLinks.map((entry) => <a key={entry.id} href={entry.url} target="_blank" rel="me noopener noreferrer" aria-label={`Visit ${profile.identity.displayName} on ${entry.title}`} title={entry.title}><SocialPlatformIcon platform={`${entry.title} ${entry.url}`} /></a>)}</nav>}
        </div>
      </div>
    </main>
  );
}
