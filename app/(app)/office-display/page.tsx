import { ManagerBoard } from "@/components/command-center/team-board";
export default async function OfficeDisplayPage({searchParams}:{searchParams:Promise<{organization?:string}>}){const query=await searchParams;return <ManagerBoard office organization={query.organization}/>;}
