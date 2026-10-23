import type { CSSProperties } from "react";
export const ORGANIZATION_THEMES = {
  walker:{label:"Walker / CDJR",accent:"#c41024",mode:"dark"},
  cdjr:{label:"CDJR · red, black, gray",accent:"#c41024",mode:"dark"},
  gmc:{label:"GMC · black, red, chrome",accent:"#e60000",mode:"dark"},
  honda:{label:"Honda · white, red, gray",accent:"#cc0000",mode:"light"},
  toyota:{label:"Toyota · white, Toyota Red",accent:"#eb0a1e",mode:"light"},
  kia:{label:"Kia · white, Midnight Black",accent:"#05141f",mode:"light"},
  mazda:{label:"Mazda · white, black, burgundy",accent:"#910a2d",mode:"light"},
  bmw:{label:"BMW · white, blue, black",accent:"#1c69d4",mode:"light"},
  mercedes:{label:"Mercedes-Benz · black, silver, blue",accent:"#0078d6",mode:"dark"},
} as const;
export type OrganizationThemeKey=keyof typeof ORGANIZATION_THEMES;
export function organizationThemeKey(name=""):OrganizationThemeKey{
  if(/\bbmw\b/i.test(name))return "bmw";
  if(/mercedes|\bbenz\b/i.test(name))return "mercedes";
  for(const key of ["honda","toyota","kia","mazda","gmc"] as const)if(new RegExp(`\\b${key}\\b`,"i").test(name))return key;
  return /cdjr|chrysler|dodge|jeep|\bram\b/i.test(name)?"cdjr":"walker";
}
export function organizationTheme(name="",choice?:string){return ORGANIZATION_THEMES[choice&&Object.hasOwn(ORGANIZATION_THEMES,choice)?choice as OrganizationThemeKey:organizationThemeKey(name)];}
// All organizations currently inherit the single shared screen palette in
// app/globals.css. Keep saved theme choices and logo resolution intact for later
// individual theme work; don't override the CSS variables inline.
export function organizationThemeStyle(_name="",_choice?:string):CSSProperties{
  return {};
}
export function defaultOrganizationIcon(name=""){
 if(/bmw/i.test(name)&&/mercedes|benz/i.test(name))return "/branding/organizations/bmw-mercedes-badge.png";
 const key=organizationThemeKey(name);
 if(key==="walker")return "/branding/walker-automotive.png";
 if(key==="bmw"||key==="mercedes")return "/branding/organizations/bmw-mercedes-badge.png";
 return `/branding/organizations/${key}-badge.png`;
}
