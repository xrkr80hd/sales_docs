// Sales Commander saving: manual Save button and save-on-exit for every exit path.
// All API traffic is intercepted with synthetic records; no production data.
// Run against a server started with fake Supabase env: NEXTDOX_TEST_URL=http://127.0.0.1:3100 node scripts/verify-sales-commander-save.cjs
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const version=fs.readFileSync('lib/disclosure.ts','utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];
const base=process.env.NEXTDOX_TEST_URL||'http://127.0.0.1:3100';
const session=()=>({access_token:'synthetic.token.fixture',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test',aud:'authenticated',app_metadata:{},user_metadata:{}}});

async function setup(browser,width){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
 const state={commander:{goal:12},puts:[],errors:[]};
 page.on('pageerror',e=>state.errors.push(e.message));
 await context.addInitScript(({session,version})=>{localStorage.setItem('walker-docs-next.auth.session',JSON.stringify(session));localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version,acceptedAt:Date.now()}));localStorage.setItem('walker.notifications.dismissed','1');localStorage.setItem('nextdox.consultant-tour.seen','1');},{session:session(),version});
 await page.routeWebSocket('**/realtime/v1/websocket*',ws=>{ws.onMessage(raw=>{const v=JSON.parse(raw);const m=Array.isArray(v)?{join_ref:v[0],ref:v[1],topic:v[2],event:v[3]}:v;if(m.event==='phx_join'||m.event==='heartbeat')ws.send(JSON.stringify([m.join_ref,m.ref,m.topic,'phx_reply',{status:'ok',response:{}}]));});});
 await context.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url());let value={};
  if(url.pathname==='/api/me')value={id:'fixture-user',email:'fixture@example.test',displayName:'Synthetic Consultant',role:'user',workspaceRole:'user',organizationId:'org',mustChangePassword:false};
  else if(url.pathname==='/api/me/settings')value={dealer_info:{},consultant_info:{name:'Synthetic consultant'}};
  else if(url.pathname==='/api/me/sale-commander'){if(req.method()==='PUT'){state.commander=req.postDataJSON();state.puts.push(state.commander);}value={commander:state.commander,assignedGoal:null};}
  else if(url.pathname==='/api/deals')value={deals:[]};
  await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
 });
 return {context,page,state};
}
const goal=page=>page.getByRole('main').getByRole('spinbutton',{name:'Monthly sales goal',exact:true});
const saveRegion=page=>page.getByRole('region',{name:'Save Sales Commander'});
async function open(page){await page.goto(base+'/sale-commander');await goal(page).waitFor();}
async function setGoal(page,value){await goal(page).fill(String(value));await goal(page).blur();await saveRegion(page).getByText('Unsaved changes',{exact:true}).waitFor();}
async function waitFor(check,label){const end=Date.now()+8000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,100));}assert.fail(label);}

(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const width of [390,1440]){
  // 1. Manual Save button.
  {const {context,page,state}=await setup(browser,width);await open(page);
   const button=saveRegion(page).getByRole('button',{name:'Save',exact:true});
   assert.equal(await button.isDisabled(),true,'Save is disabled with nothing to save');
   await setGoal(page,18);assert.equal(state.puts.length,0,'editing alone does not save');
   await button.click();await saveRegion(page).getByText('All changes saved',{exact:true}).waitFor();
   assert.equal(state.puts.length,1);assert.equal(state.puts[0].goal,18);
   await page.getByText('Sales Commander saved').waitFor();
   assert.deepEqual(state.errors,[]);await context.close();}
  // 2. Browser/phone back button saves.
  {const {context,page,state}=await setup(browser,width);await page.goto(base+'/dashboard');await page.getByRole('main').waitFor();await open(page);
   await setGoal(page,21);await page.goBack();await waitFor(()=>state.puts.some(x=>x.goal===21),'back button saved goal 21');
   await context.close();}
  // 3. Switching apps / locking the phone saves.
  {const {context,page,state}=await setup(browser,width);await open(page);await setGoal(page,22);
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
   await waitFor(()=>state.puts.some(x=>x.goal===22),'hidden page saved goal 22');
   await context.close();}
  // 4. Reloading/closing the tab saves, and the value is there when the page returns.
  {const {context,page,state}=await setup(browser,width);await open(page);await setGoal(page,23);
   await page.reload();await goal(page).waitFor();await waitFor(()=>state.puts.some(x=>x.goal===23),'reload saved goal 23');
   assert.equal(await goal(page).inputValue(),'23');await context.close();}
  // 5. Routine planner Save buttons save to the account right away.
  {const {context,page,state}=await setup(browser,width);await open(page);
   const routine=page.getByRole('button',{name:"Save today's routine",exact:true});await routine.scrollIntoViewIfNeeded();await routine.click();
   await waitFor(()=>state.puts.length===1,'routine save sent');assert.ok(Object.keys(state.puts[0].schedule||{}).length>0,'schedule saved');
   await saveRegion(page).getByText('All changes saved',{exact:true}).waitFor();await context.close();}
  // 6. In-app link: dialog Save & Exit still saves; Discard & Exit does not and says so.
  {const {context,page,state}=await setup(browser,width);await open(page);await setGoal(page,24);
   const dialog=page.getByRole('dialog',{name:'Unsaved Sales Commander changes',exact:true});
   await page.evaluate(()=>{const a=document.createElement('a');a.href='/dashboard';a.textContent='fixture link';a.id='fixture-link';document.querySelector('main').append(a);});
   await page.click('#fixture-link');await dialog.waitFor();await dialog.getByRole('button',{name:'Discard & Exit',exact:true}).click();
   await page.getByText('Changes discarded').waitFor();await page.waitForURL('**/dashboard');assert.equal(state.puts.length,0,'discard sends nothing');
   await open(page);await setGoal(page,25);
   await page.evaluate(()=>{const a=document.createElement('a');a.href='/dashboard';a.textContent='fixture link';a.id='fixture-link';document.querySelector('main').append(a);});
   await page.click('#fixture-link');await dialog.waitFor();await dialog.getByRole('button',{name:'Save & Exit',exact:true}).click();
   await page.waitForURL('**/dashboard');assert.equal(state.puts.length,1);assert.equal(state.puts[0].goal,25);await context.close();}
  console.log(`width ${width}: manual save, back, background, reload, routine save, leave dialog — all saved`);
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1);});
