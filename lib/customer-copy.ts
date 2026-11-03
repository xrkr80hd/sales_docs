import type {WorkflowData} from "@/lib/walker-workflow";
export type CopyField={label:string;value:string};
export type CustomerCopy={buyer:CopyField[];coBuyer:CopyField[]};
export function customerCopyFields(data:Partial<WorkflowData>):CustomerCopy{
 const field=(label:string,value:unknown)=>typeof value==="string"&&value.trim()?[{label,value:value.trim()}]:[];
 return {buyer:[...field("Full Name",data.customerName),...field("Street Address",data.homeAddress),...field("City",data.homeCity),...field("State",data.homeState),...field("ZIP Code",data.homeZip),...field("Phone Number",data.cellPhone),...field("Email Address",data.email),...(data.mailingDifferent?[...field("Mailing Address",data.mailingAddress),...field("Mailing City",data.mailingCity),...field("Mailing State",data.mailingState),...field("Mailing ZIP",data.mailingZip)]:[])],coBuyer:field("Full Name",data.coCustomerName)};
}
type Snapshot={dealId:string|null;data:CustomerCopy|null};
const empty:Snapshot={dealId:null,data:null};let snapshot:Snapshot=empty,revision=0,dataRevision=0;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
export function clearCustomerCopy(dealId:string|null=null){revision++;dataRevision++;snapshot={dealId,data:null};emit();}
export function customerCopyRevision(){return dataRevision;}
export function selectCustomerCopy(id:string){if(snapshot.dealId!==id)clearCustomerCopy(id);else{snapshot={...snapshot};emit();}}
export function customerSelectionRevision(){return revision;}
export function publishCustomerCopy(id:string,data:Partial<WorkflowData>){dataRevision++;snapshot={dealId:id,data:customerCopyFields(data)};emit();}
export function customerCopySnapshot(){return snapshot;}
export function emptyCustomerCopySnapshot(){return empty;}
export function subscribeCustomerCopy(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
