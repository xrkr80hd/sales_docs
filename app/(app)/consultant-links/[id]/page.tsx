import { LinksWorkspace } from "@/components/consultant-links/links-workspace";
export default async function ConsultantLinkPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <LinksWorkspace selectedId={id}/>;}
