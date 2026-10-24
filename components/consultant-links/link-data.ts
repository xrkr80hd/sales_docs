import type { ConsultantLink } from "@/lib/consultant-links";
import { requestJson } from "@/lib/request-json";
export type LinkCollection={links:ConsultantLink[];organization:{id:string;name:string};version:string};
export function requestLinks(token:string,save?:{links:ConsultantLink[];version:string;organizationId:string}){
 return requestJson<LinkCollection>("/api/consultant-links",{method:save?"PUT":"GET",headers:{Authorization:`Bearer ${token}`,...(save?{"Content-Type":"application/json"}:{})},...(save?{body:JSON.stringify(save)}:{})});
}
