"use client";

import { useEffect, useState } from "react";
import styles from "../../app/card/trav/page.module.css";

type VehiclePreview = {
  sourceUrl: string;
  title: string;
  imageUrl: string | null;
  description: string | null;
  vin: string | null;
  stock: string | null;
  price: string | null;
};

export function VehiclePreviewCard({ listingUrl }: { listingUrl: string }) {
  const [vehicle, setVehicle] = useState<VehiclePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/profile/vehicle-preview?url=${encodeURIComponent(listingUrl)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Vehicle import failed.");
        return result as VehiclePreview;
      })
      .then(setVehicle)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });

    return () => controller.abort();
  }, [listingUrl]);

  if (error) {
    return (
      <article className={styles.vehicleCard}>
        <div className={styles.vehicleImportState}>
          <span>07</span>
          <div><strong>Vehicle preview unavailable</strong><p>{error}</p></div>
        </div>
        <a className={styles.listingFallback} href={listingUrl} target="_blank" rel="noopener noreferrer">
          Open the Walker listing
        </a>
      </article>
    );
  }

  if (!vehicle) {
    return (
      <article className={styles.vehicleCard} aria-busy="true">
        <div className={styles.vehicleImportState}>
          <span>07</span>
          <div><strong>Importing Walker listing</strong><p>Reading the real vehicle information…</p></div>
        </div>
      </article>
    );
  }

  return (
    <article className={styles.vehicleCard}>
      <a className={styles.vehicleMedia} href={vehicle.sourceUrl} target="_blank" rel="noopener noreferrer">
        <span>07</span>
        {vehicle.imageUrl ? (
          <img src={vehicle.imageUrl} alt={vehicle.title} />
        ) : (
          <p>The listing did not provide a preview image.</p>
        )}
      </a>
      <div className={styles.vehicleBody}>
        <p className={styles.vehicleLabel}>Featured vehicle</p>
        <h2>{vehicle.title}</h2>
        {vehicle.price && <p className={styles.vehiclePrice}>{vehicle.price}</p>}

        <details className={styles.vehicleDetails}>
          <summary>Vehicle info</summary>
          <dl className={styles.vehicleFacts}>
            {vehicle.stock && <div><dt>Stock</dt><dd>{vehicle.stock}</dd></div>}
            {vehicle.vin && <div><dt>VIN</dt><dd>{vehicle.vin}</dd></div>}
          </dl>
          {vehicle.description && <p className={styles.vehicleDescription}>{vehicle.description}</p>}
        </details>

        <div className={styles.vehicleActions}>
          <a href="tel:+13187877887">Call</a>
          <a href="sms:+13187877887">Text</a>
          <a href={vehicle.sourceUrl} target="_blank" rel="noopener noreferrer">Walker listing</a>
        </div>
        <p className={styles.priceNote}>Availability and pricing must be confirmed on the live dealer listing.</p>
      </div>
    </article>
  );
}
