export type ConsultantLink = { id: string; name: string; url: string };
// Kept as an explicit legacy resource list; never automatically installed.
export const CDJR_LINKS: ConsultantLink[] = [
  { id: "dealer-connect", name: "Dealer Connect", url: "https://dealerconnect.chrysler.com/" },
  { id: "rapid-recon", name: "Rapid Recon", url: "https://go.rapidrecon.com/" },
  { id: "drive-centric", name: "Drive Centric", url: "https://app.drivecentric.com/" },
];
export function normalizedConsultantUrl(value: string): string | null {
  try { const trimmed=value.trim();const candidate=/^[a-z][a-z\d+.-]*:/i.test(trimmed)?trimmed:`https://${trimmed.replace(/^\/\//,"")}`;if(!trimmed||/\s/.test(trimmed))return null;const url=new URL(candidate);return ["https:","http:"].includes(url.protocol)&&!url.username&&!url.password&&!/[\u0000-\u001f\u007f]/.test(value)?url.href:null; } catch { return null; }
}
export function validConsultantUrl(value: string) { return normalizedConsultantUrl(value)!==null; }
export function validateConsultantLinks(value: unknown): ConsultantLink[] {
  if(!Array.isArray(value)||value.length>20)throw new Error("Use up to 20 links.");
  const links=value.map(item=>{
    if(!item||typeof item!=="object")throw new Error("Every link needs a name and valid HTTP or HTTPS URL.");
    const name=typeof item.name==="string"?item.name.trim():"",url=typeof item.url==="string"?normalizedConsultantUrl(item.url):null;
    if(!name||name.length>60||!url||url.length>2048||typeof item.id!=="string"||!/^[-a-zA-Z0-9]{1,80}$/.test(item.id))throw new Error("Use a link name up to 60 characters and a valid HTTP or HTTPS URL without credentials.");
    return {id:item.id,name,url};
  });
  if(new Set(links.map(link=>link.id)).size!==links.length||new Set(links.map(link=>link.url)).size!==links.length)throw new Error("This link is already saved. Edit the existing entry instead.");
  return links;
}
export function moveConsultantLink(links: ConsultantLink[], id: string, target: string) {
  const from=links.findIndex(link=>link.id===id),to=links.findIndex(link=>link.id===target);
  if(from<0||to<0||from===to)return links;
  const next=[...links];next.splice(to,0,next.splice(from,1)[0]);return next;
}
