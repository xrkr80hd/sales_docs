import { redirect } from "next/navigation";
// Keep existing bookmarks while giving setup one explicit home.
export default async function Page({searchParams}:{searchParams:Promise<{organization?:string;month?:string}>}){const query=await searchParams;const params=new URLSearchParams();if(query.organization)params.set("organization",query.organization);if(query.month)params.set("month",query.month);redirect(`/manager-board/setup${params.size?`?${params}`:""}`);}
