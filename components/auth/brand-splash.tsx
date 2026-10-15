"use client";
import styles from "./brand-splash.module.css";

export function BrandSplash({checkingCredentials=false}:{checkingCredentials?:boolean}) {
 return <div className={styles.splash} role="status" aria-live="polite" aria-label={checkingCredentials?"Checking credentials":"Opening NXTDOX"}>
   <div className={styles.ambient} aria-hidden="true"><i/><i/><i/><i/></div>
   <div className={styles.brand}>
     <div className={styles.symbol} aria-hidden="true"><span/><span/><span/></div>
     <div className={styles.wordmark}>NXT<span>DOX</span></div>
     <div className={styles.byline}>by EBEN</div>
     <div className={styles.track} aria-hidden="true"><span/></div>
   </div>
 </div>;
}
