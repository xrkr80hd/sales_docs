import { PerformanceDisplay } from "@/components/command-center/performance-display";
export default async function Page({searchParams}:{searchParams:Promise<{organization?:string;month?:string}>}){const query=await searchParams;return <PerformanceDisplay key={`${query.organization}:${query.month}`} organization={query.organization} month={query.month}/>;}
