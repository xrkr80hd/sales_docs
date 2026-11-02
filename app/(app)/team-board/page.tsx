import { ConsultantBoardProvider, ConsultantPace, ConsultantTeamBoard } from "@/components/command-center/consultant-board";
export default function TeamBoardPage() { return <ConsultantBoardProvider><div className="grid gap-5"><ConsultantPace /><ConsultantTeamBoard full /></div></ConsultantBoardProvider>; }
