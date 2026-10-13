import Image from "next/image";
import styles from "./software-logo.module.css";

export function SoftwareLogo() {
  return <span className={styles.logo}>
    <Image src="/branding/nxtdox-eben-brand.png" alt="NXTDOX by EBEN" width={1448} height={1086} priority className={styles.artwork} />
  </span>;
}
