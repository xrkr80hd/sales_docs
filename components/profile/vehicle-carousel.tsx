"use client";

import { useState } from "react";
import { VehiclePreviewCard, type VehiclePreviewCardProps } from "./vehicle-preview-card";
import styles from "../../app/card/trav/page.module.css";

type VehicleCarouselProps = {
  vehicles: VehiclePreviewCardProps[];
};

export function VehicleCarousel({ vehicles }: VehicleCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVehicle = vehicles[activeIndex] ?? vehicles[0];

  const shareVehicle = () => {
    const vin = activeVehicle.verifiedFallback?.vin;
    const cardUrl = new URL(window.location.href);
    if (vin) cardUrl.searchParams.set("vehicle", vin);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cardUrl.toString())}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer,width=720,height=640");
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
          <button type="button" onClick={shareVehicle}>Share on Facebook</button>
        </div>
        <div className={styles.vehicleDockContact}>
          <a href="tel:+13187877887">Call</a>
          <a href="sms:+13187877887">Text</a>
        </div>
      </div>
    </section>
  );
}
