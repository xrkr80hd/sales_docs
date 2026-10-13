"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { usePathname } from "next/navigation";
import type { ConsultantLink } from "@/lib/consultant-links";
import { requestLinks } from "./link-data";
export function ConsultantLinksNav({onNavigate}:{onNavigate:()=>void}) {
  const pathname=usePathname();const [links,setLinks]=useState<ConsultantLink[]>([]);
  useEffect(()=>{let active=true;const load=()=>{void requestLinks().then(result=>{if(active)setLinks(result.links);}).catch(()=>{});};load();window.addEventListener("consultant-links-updated",load);window.addEventListener("consultant-profile-updated",load);return()=>{active=false;window.removeEventListener("consultant-links-updated",load);window.removeEventListener("consultant-profile-updated",load);};},[]);
  return <details open={pathname.startsWith("/consultant-links")}><summary>Consultant Links</summary><div style={{display:"grid",paddingLeft:12}}><Link href="/consultant-links" onClick={onNavigate}>All links</Link>{links.map(link=><Link key={link.id} href={`/consultant-links/${link.id}`} onClick={onNavigate}>{link.name}</Link>)}</div></details>;
}
