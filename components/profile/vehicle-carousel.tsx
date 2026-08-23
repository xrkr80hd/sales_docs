"use client";

import { useEffect, useRef, useState } from "react";
import { VehiclePreviewCard, type VehiclePreviewCardProps } from "./vehicle-preview-card";
import styles from "../../app/card/trav/page.module.css";

type VehicleCarouselProps = {
  vehicles: VehiclePreviewCardProps[];
  initialVehicleVin?: string;
};

export function VehicleCarousel({ vehicles, initialVehicleVin }: VehicleCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(() => {
    const matchedIndex = vehicles.findIndex(({ verifiedFallback }) => verifiedFallback?.vin === initialVehicleVin);
    return matchedIndex >= 0 ? matchedIndex : 0;
  });
  const [copied, setCopied] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const activeVehicle = vehicles[activeIndex] ?? vehicles[0];

  useEffect(() => {
    const rail = railRef.current;
    const card = rail?.children.item(activeIndex) as HTMLElement | null;
    if (!rail || !card || activeIndex === 0) return;
    rail.scrollTo({ left: card.offsetLeft, behavior: "instant" });
  }, []);

  const copyVehicleLink = async () => {
    const vin = activeVehicle.verifiedFallback?.vin;
    const cardUrl = new URL(window.location.href);
    cardUrl.search = "";
    if (vin) cardUrl.searchParams.set("vehicle", vin);
    await navigator.clipboard.writeText(cardUrl.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className={styles.vehicleSection} aria-labelledby="vehicle-section-heading">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.vehicleLabel}>Trav’s picks</p>
          <h2 id="vehicle-section-heading">Vehicles worth a look</h2>
        </div>
        <span>{activeIndex + 1} / {vehicles.length}</span>
      </div>

      <div
        ref={railRef}
        className={styles.vehicleRail}
        onScroll={(event) => {
          const rail = event.currentTarget;
          const firstCard = rail.firstElementChild as HTMLElement | null;
          if (!firstCard) return;
          const step = firstCard.offsetWidth + 14;
          setActiveIndex(Math.min(vehicles.length - 1, Math.max(0, Math.round(rail.scrollLeft / step))));
        }}
      >
        {vehicles.map(({ listingUrl, verifiedFallback }) => (
          <VehiclePreviewCard
            key={listingUrl}
            listingUrl={listingUrl}
            verifiedFallback={verifiedFallback}
          />
        ))}
      </div>

      <div className={styles.vehicleDock}>
        <div className={styles.vehicleDockTop}>
          <a href={activeVehicle.listingUrl} target="_blank" rel="noopener noreferrer">View listing</a>
          <button type="button" onClick={copyVehicleLink}>{copied ? "Link copied!" : "Copy link"}</button>
        </div>
        <div className={styles.vehicleDockContact}>
          <a href="tel:+13187877887">Call</a>
          <a href="sms:+13187877887">Text</a>
        </div>
      </div>
    </section>
  );
}
