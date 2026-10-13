"use client";
import Image from "next/image";
import { defaultOrganizationIcon,organizationThemeKey } from "@/lib/organization-theme";
export function OrganizationBadge({name,iconUrl,className="",hidden=false}:{name:string;iconUrl?:string;className?:string;hidden?:boolean}){
 if(hidden)return null;
 return <span data-brand={iconUrl?"custom":organizationThemeKey(name)} className={`organization-badge ${className}`} title={name}><Image src={iconUrl||defaultOrganizationIcon(name)} alt={`${name} organization`} width={24} height={24} unoptimized={Boolean(iconUrl)}/></span>;
}
