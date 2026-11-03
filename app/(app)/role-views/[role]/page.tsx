import { RoleView } from "@/components/command-center/role-view";
export default async function RoleViewPage({ params }: { params: Promise<{ role: string }> }) { const { role } = await params; return <RoleView role={role} />; }
