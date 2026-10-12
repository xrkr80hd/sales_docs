import { ManagerBoard } from "@/components/command-center/team-board";
export default async function ManagerBoardPage({searchParams}:{searchParams:Promise<{organization?:string}>}){const query=await searchParams;return <ManagerBoard organization={query.organization}/>;}
