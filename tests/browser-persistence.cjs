const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>deps[name],Date,Map,Set,Object,JSON,URL,console,...globals});return exports;}
function storage(){const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),key:i=>[...values.keys()][i]||null,get length(){return values.size;},values};}
test('Stay signed in skips the idle cutoff only when explicitly enabled',()=>{
 const localStorage=storage(),api=load('lib/browser-activity.ts',{}, {localStorage});
 api.recordBrowserActivity('A',true,1000);assert(api.browserSessionExpired('A',1000+api.BROWSER_IDLE_MS));
 api.setStaySignedIn(true);assert.equal(api.browserSessionExpired('A',1000+10*api.BROWSER_IDLE_MS),false);
 api.setStaySignedIn(false);assert(api.browserSessionExpired('A',1000+api.BROWSER_IDLE_MS));
});
test('saved shortcuts restore by user and organization; invalid cache never creates unsafe links',()=>{
 const sessionStorage=storage(),links=load('lib/consultant-links.ts');
 const api=load('lib/consultant-links-cache.ts',{'@/lib/consultant-links':links},{window:{sessionStorage}});
 const value={links:[{id:'one',name:'One',url:'https://example.test/'}],organization:{id:'A',name:'A'},version:'v1'};
 api.writeLinksCache('user:A',value);assert.equal(api.readLinksCache('user:A').value.links[0].name,'One');assert.equal(api.readLinksCache('user:B'),null);
 const key=[...sessionStorage.values.keys()][0],raw=JSON.parse(sessionStorage.getItem(key));raw.value.links[0].url='javascript:alert(1)';sessionStorage.setItem(key,JSON.stringify(raw));assert.equal(api.readLinksCache('user:A'),null);
 api.clearLinksCache();assert.equal(sessionStorage.length,0);
});
test('message cache writes are deferred, bounded across accounts, and logout prevents delayed resurrection',()=>{
 const localStorage=storage(),sessionStorage=storage(),timers=new Map();let ticket=0;
 localStorage.setItem('walker.auth.stay-signed-in.v1','1');
 const api=load('lib/messenger-cache.ts',{}, {window:{localStorage,sessionStorage},setTimeout:fn=>{timers.set(++ticket,fn);return ticket;},clearTimeout:id=>timers.delete(id)});
 const message=id=>({id,sender_id:'a',body:'x'.repeat(4000),created_at:'2026-10-24'});
 for(let room=0;room<20;room++)api.cacheMessengerMessages('A',String(room),Array.from({length:50},(_,i)=>message(i)));
 assert.equal(localStorage.length,1,'no disk writes during message updates');
 for(const fn of timers.values())fn();timers.clear();
 assert([...localStorage.values].filter(([key])=>key.startsWith('nextdocs.messenger')).reduce((sum,[,value])=>sum+value.length*2,0)<=api.MESSENGER_CACHE_BYTES);
 assert.equal(api.readMessengerCache('B'),null);
 api.cacheMessengerMessages('A','new',[message(1)]);api.clearMessengerCache();for(const fn of timers.values())fn();
 assert.equal(api.readMessengerCache('A'),null);assert(![...localStorage.values.keys()].some(key=>key.startsWith('nextdocs.messenger')));
});
test('successful cached saves cannot be overwritten by an older pending read',async()=>{
 const api=load('lib/client-resource-cache.ts',{}, {Promise});let finish;
 const pending=api.loadResource('A','card',()=>new Promise(resolve=>finish=resolve));await Promise.resolve();api.primeResource('A','card',{name:'Saved'});finish({name:'Old'});await pending;
 assert.equal(api.cachedResource('A','card').name,'Saved');assert.equal(api.cachedResource('B','card'),undefined);
});
