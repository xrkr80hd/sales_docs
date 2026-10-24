import { ManagerBoard } from "@/components/command-center/team-board";
export default async function Page({searchParams}:{searchParams:Promise<{organization?:string;month?:string}>}){const query=await searchParams;return <ManagerBoard key={`${query.organization}:${query.month}`} organization={query.organization} month={query.month}/>;}
