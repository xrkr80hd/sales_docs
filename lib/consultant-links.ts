export type ConsultantLink = { id: string; name: string; url: string };
export const CDJR_LINKS: ConsultantLink[] = [
  { id: "dealer-connect", name: "Dealer Connect", url: "https://dealerconnect.chrysler.com/" },
  { id: "rapid-recon", name: "Rapid Recon", url: "https://go.rapidrecon.com/" },
  { id: "drive-centric", name: "Drive Centric", url: "https://app.drivecentric.com/" },
];
export function validConsultantUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
