import type { Payload, Message } from "@/components/messenger/organization-messenger";
const PREFIX='nextdocs.messenger.v1:';
export const MESSENGER_CACHE_BYTES=2*1024*1024;
function storage(){return window.localStorage.getItem("walker.auth.stay-signed-in.v1")==="1"?window.localStorage:window.sessionStorage;}
type Snapshot={at:number;directory:Payload|null;rooms:Record<string,Message[]>};
export function readMessengerCache(scope:string):Snapshot|null {
 if(typeof window==='undefined'||!scope)return null;
 if(hot.has(scope))return hot.get(scope)!;
 try{const data=JSON.parse(storage().getItem(PREFIX+scope)||'null') as Snapshot|null;
  if(!data||!Number.isFinite(data.at)||data.at>Date.now())return null;
  if(data.directory&&(!Array.isArray(data.directory.conversations)||!Array.isArray(data.directory.people)||!Array.isArray(data.directory.organizations)))return null;
  if(!data.rooms||typeof data.rooms!=='object')return null;
  return data;
 }catch{return null;}
}
export function cacheMessengerDirectory(scope:string,directory:Payload){
 if(typeof window==='undefined'||!scope)return;
 const prior=readMessengerCache(scope);
 // Drop cached rooms immediately when a server-verified directory revokes access.
 const allowed=new Set(directory.conversations.map(room=>room.id));
 const rooms=Object.fromEntries(Object.entries(prior?.rooms||{}).filter(([id])=>allowed.has(id)));
 write(scope,{at:Date.now(),directory,rooms});
}
export function cacheMessengerMessages(scope:string,id:string,messages:Message[]){
 if(typeof window==='undefined'||!scope)return;
 const prior=readMessengerCache(scope);const rooms={...(prior?.rooms||{})};delete rooms[id];rooms[id]=messages.slice(-50);
 while(Object.keys(rooms).length>20)delete rooms[Object.keys(rooms)[0]];
 write(scope,{at:Date.now(),directory:prior?.directory||null,rooms});
}
const hot=new Map<string,Snapshot>();
const queued=new Map<string,ReturnType<typeof setTimeout>>();
function write(scope:string,snapshot:Snapshot){
 hot.set(scope,snapshot);
 if(queued.has(scope))return;
 queued.set(scope,setTimeout(()=>{
  queued.delete(scope);
  const save=()=>{
   if(hot.get(scope)!==snapshot){const latest=hot.get(scope);if(latest)persist(scope,latest);}else persist(scope,snapshot);
  };
  if('requestIdleCallback' in window)window.requestIdleCallback(save,{timeout:3000});else save();
 },500));
}
function persist(scope:string,snapshot:Snapshot){
 if(!hot.has(scope))return; // Logout cancels delayed writes.
 try{
  let encoded=JSON.stringify(snapshot);
  while(encoded.length*2>MESSENGER_CACHE_BYTES&&Object.keys(snapshot.rooms).length){
   delete snapshot.rooms[Object.keys(snapshot.rooms)[0]];
   encoded=JSON.stringify(snapshot);
  }
  if(encoded.length*2>MESSENGER_CACHE_BYTES)return;
  const store=storage();
  store.setItem(PREFIX+scope,encoded);
  const entries=[];for(let i=0;i<store.length;i++){const key=store.key(i);if(key?.startsWith(PREFIX)){const raw=store.getItem(key)||'';let at=0;try{at=JSON.parse(raw).at||0;}catch{}entries.push({key,size:raw.length*2,at});}}
  let total=entries.reduce((sum,item)=>sum+item.size,0);
  for(const item of entries.sort((a,b)=>a.at-b.at)){if(total<=MESSENGER_CACHE_BYTES)break;store.removeItem(item.key);total-=item.size;}
 }catch{/* The in-memory view remains usable if optional disk storage is full. */}
}
export function clearMessengerCache(scope?:string){
 if(scope){hot.delete(scope);const timer=queued.get(scope);if(timer)clearTimeout(timer);queued.delete(scope);}else{hot.clear();for(const timer of queued.values())clearTimeout(timer);queued.clear();}
 if(typeof window==='undefined')return;
 try{for(const store of [window.sessionStorage,window.localStorage]){if(scope){store.removeItem(PREFIX+scope);continue;}for(let i=store.length-1;i>=0;i--){const key=store.key(i);if(key?.startsWith(PREFIX))store.removeItem(key);}}}catch{}
}
