"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./review-carousel.module.css";

export type ReviewImage = {
  src: string;
  alt: string;
  isLong?: boolean;
};

export function ReviewCarousel({ reviews }: { reviews: ReviewImage[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const lastTapRef = useRef(0);
  const [expanded, setExpanded] = useState<ReviewImage | null>(null);
  const [needsExpansion, setNeedsExpansion] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (reviews.length < 2) return;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail || pausedRef.current || expanded) return;
      const card = rail.firstElementChild as HTMLElement | null;
      if (!card) return;
      const step = card.offsetWidth + 14;
      const end = rail.scrollWidth - rail.clientWidth - 4;
      rail.scrollTo({
        left: rail.scrollLeft >= end ? 0 : rail.scrollLeft + step,
        behavior: "smooth",
      });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [expanded, reviews.length]);

  const handleTap = (review: ReviewImage) => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) setExpanded(review);
    lastTapRef.current = now;
  };

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.heading}>
        <p>Five-star experiences</p>
        <h2 id="reviews-heading">Check out my reviews!</h2>
      </div>

      {reviews.length === 0 ? (
        <div className={styles.empty}>Review screenshots are ready to be added.</div>
      ) : (
        <div
          ref={railRef}
          className={styles.rail}
          onPointerDown={() => { pausedRef.current = true; }}
          onPointerUp={() => { pausedRef.current = false; }}
          onPointerCancel={() => { pausedRef.current = false; }}
          aria-label="Customer review screenshots"
        >
          {reviews.map((review) => (
            <article
              key={review.src}
              className={styles.card}
              tabIndex={0}
              role="button"
              aria-label={`${review.alt}. Double-tap to expand.`}
              onClick={() => handleTap(review)}
              onDoubleClick={() => setExpanded(review)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setExpanded(review);
              }}
            >
              <Image
                src={review.src}
                alt={review.alt}
                fill
                sizes="(max-width: 720px) 86vw, 560px"
                className={styles.image}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  const isTallerThanFrame = image.naturalWidth / image.naturalHeight < 1536 / 890;
                  if (!isTallerThanFrame) return;
                  setNeedsExpansion((current) => {
                    if (current.has(review.src)) return current;
                    const updated = new Set(current);
                    updated.add(review.src);
                    return updated;
                  });
                }}
              />
              {(review.isLong || needsExpansion.has(review.src)) && (
                <span className={styles.readMore}>Double-tap to read more</span>
              )}
            </article>
          ))}
        </div>
      )}

      {expanded && (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-label={expanded.alt}>
          <button className={styles.close} type="button" onClick={() => setExpanded(null)} aria-label="Close review">
            ×
          </button>
          <div className={styles.fullImage}>
            <Image src={expanded.src} alt={expanded.alt} fill sizes="96vw" className={styles.image} />
          </div>
        </div>
      )}
    </section>
  );
}
