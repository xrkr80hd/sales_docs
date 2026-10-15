"use client";
import styles from "./brand-splash.module.css";

export function BrandSplash({ checkingCredentials = false }: { checkingCredentials?: boolean }) {
  return (
    <div className={styles.splash} role="status" aria-live="polite" aria-label={checkingCredentials ? "Checking credentials" : "Opening NXTDOX"}>
      <picture className={styles.artwork}>
        <source media="(max-width: 767px)" srcSet="/branding/nxtdox-mobile-splash.png" />
        <img src="/branding/nxtdox-desktop-splash.png" alt="NXTDOX by EBEN" />
      </picture>
      <div className={styles.loadingTrack} aria-hidden="true"><span /></div>
    </div>
  );
}
