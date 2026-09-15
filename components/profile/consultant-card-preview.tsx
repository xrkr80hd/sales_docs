"use client";

import Image from "next/image";
import type { ConsultantProfileContent } from "@/lib/consultant-profile";
import { ReviewCarousel } from "@/components/profile/review-carousel";
import { VehicleCarousel } from "@/components/profile/vehicle-carousel";
import { VideoPlaylist } from "@/components/profile/video-playlist";
import { SocialPlatformIcon } from "@/components/profile/social-platform-icon";
import cardStyles from "@/app/card/trav/page.module.css";
import styles from "./consultant-card-preview.module.css";

type Props = {
  profile: ConsultantProfileContent;
  slug: string;
};

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

export function ConsultantCardPreview({ profile, slug }: Props) {
  const vehicles = profile.vehicles
    .filter((entry) => Boolean(entry.imageUrl || entry.title))
    .map((entry) => ({
      listingUrl: entry.url,
      verifiedFallback: {
        sourceUrl: entry.url,
        title: entry.title,
        imageUrl: entry.imageUrl || null,
        description: entry.description || null,
        vin: entry.secondaryUrl || null,
        stock: entry.meta?.match(/Stock\s+([^·]+)/i)?.[1]?.trim() || null,
        price: entry.meta?.split("·")[0]?.trim() || null,
        features: [
          entry.builderData?.form.feature1,
          entry.builderData?.form.feature2,
          entry.builderData?.form.feature3,
        ].filter((feature): feature is string => Boolean(feature)),
      },
    }));
  const reviews = profile.reviews
    .filter((entry) => Boolean(entry.imageUrl))
    .map((entry) => ({
      src: entry.imageUrl,
      alt: `Review from ${entry.title || profile.identity.displayName}`,
      isLong: entry.meta === "long",
    }));
  const videos = profile.videos
    .filter((entry) => Boolean(entry.imageUrl || entry.url))
    .map((entry) => ({ ...entry, embedUrl: getVideoEmbedUrl(entry.url) }));

  return (
    <div className={`${cardStyles.page} ${styles.page}`}>
      <div className={`${cardStyles.shell} ${styles.shell}`}>
        <header className={`${cardStyles.hero} ${styles.hero}`}>
          <div className={cardStyles.brandRow}>
            {profile.identity.logoUrl ? (
              <div className={cardStyles.logoSlot}>
                <Image src={profile.identity.logoUrl} alt="Business-card logo" fill sizes="104px" className={cardStyles.logoImage} />
              </div>
            ) : <div className={styles.logoPlaceholder}>Your logo</div>}
            <span className={cardStyles.language}>{profile.identity.languageLabel}</span>
          </div>
          <div className={`${cardStyles.identity} ${styles.identity}`}>
            <div className={`${cardStyles.photoFrame} ${styles.photoFrame}`}>
              {profile.identity.profileImageUrl ? (
                <Image src={profile.identity.profileImageUrl} alt={profile.identity.displayName || "Consultant"} fill sizes="112px" className={cardStyles.photo} />
              ) : (
                <div className={styles.initials}>
                  {profile.identity.displayName.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase() || "YOU"}
                </div>
              )}
            </div>
            <div className={cardStyles.identityCopy}>
              <p className={cardStyles.eyebrow}>{profile.identity.jobTitle}</p>
              <h1 className={styles.name}>{profile.identity.displayName || "Your name"}</h1>
              <p className={cardStyles.location}>{profile.identity.dealership} · {profile.identity.location}</p>
            </div>
          </div>
          {(profile.content.primaryPhrase || profile.content.salesQuote) && (
            <div className={cardStyles.catchphrases}>
              {profile.content.primaryPhrase && <p className={cardStyles.primaryPhrase}>{profile.content.primaryPhrase}</p>}
              {profile.content.salesQuote && <p>{profile.content.salesQuote}</p>}
            </div>
          )}
          <details className={cardStyles.contactAccordion}>
            <summary>Contact</summary>
            <div className={cardStyles.actions}>
              {profile.identity.phone && (
                <>
                  <a className={cardStyles.primaryAction} href={`tel:${profile.identity.phone.replace(/[^\d+]/g, "")}`}>{profile.contact.callLabel || "Call"}</a>
                  <a className={cardStyles.secondaryAction} href={`sms:${profile.identity.phone.replace(/[^\d+]/g, "")}`}>{profile.contact.textLabel || "Text"}</a>
                </>
              )}
              {profile.identity.email && <a className={cardStyles.secondaryAction} href={`mailto:${profile.identity.email}`}>{profile.contact.emailLabel || "Email"}</a>}
              <a className={cardStyles.secondaryAction} href={`/api/card/${slug}/vcard`}>Save Contact</a>
            </div>
          </details>
        </header>

        <div className={cardStyles.profileGrid}>
          {profile.identity.callingCardImageUrl && (
            <section className={cardStyles.brandCard}>
              <Image src={profile.identity.callingCardImageUrl} alt="" aria-hidden="true" fill sizes="390px" className={cardStyles.brandCardBackdrop} />
              <Image src={profile.identity.callingCardImageUrl} alt={`${profile.identity.displayName} calling card`} fill sizes="390px" className={cardStyles.brandCardImage} />
            </section>
          )}
          {profile.content.bio && (
            <section className={cardStyles.emptyState}>
              <div>
                <h2>About {profile.identity.displayName}</h2>
                <p>{profile.content.bio}</p>
              </div>
            </section>
          )}
        </div>

        {!!vehicles.length && <VehicleCarousel vehicles={vehicles} consultantName={profile.identity.displayName} phone={profile.identity.phone} />}
        {!!reviews.length && <ReviewCarousel reviews={reviews} />}

        {!!profile.soldGallery.filter((entry) => entry.imageUrl).length && (
          <section className={cardStyles.mediaSection}>
            <h2>Sold gallery</h2>
            <div className={cardStyles.mediaRail}>
              {profile.soldGallery.filter((entry) => entry.imageUrl).map((entry) => (
                <article key={entry.id}>
                  <div className={cardStyles.mediaImageFrame}>
                    <img className={cardStyles.mediaImageBackdrop} src={entry.imageUrl} alt="" aria-hidden="true" />
                    <img className={cardStyles.mediaImage} src={entry.imageUrl} alt={entry.title} />
                  </div>
                  <strong>{entry.title}</strong>
                  {entry.description && <p>{entry.description}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
        {!!videos.length && <VideoPlaylist videos={videos} consultantSlug={slug} />}

        <div className={cardStyles.sections}>
          <button type="button" className={cardStyles.profileShareButton}>Copy profile link</button>
          {profile.content.inventoryUrl && (
            <a className={cardStyles.inventoryButton} href={profile.content.inventoryUrl}>
              {profile.content.inventoryButtonLabel || "Browse inventory"}
            </a>
          )}
          {!!profile.socialLinks.filter((entry) => entry.url).length && (
            <nav className={cardStyles.socialLinks} aria-label="Social profiles">
              {profile.socialLinks.filter((entry) => entry.url).map((entry) => (
                <a key={entry.id} href={entry.url} aria-label={entry.title} title={entry.title}>
                  <SocialPlatformIcon platform={`${entry.title} ${entry.url}`} />
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
