// Synthetic browser regression: no production credentials or records.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
const fs=require('node:fs');
const disclosureVersion=fs.readFileSync('lib/disclosure.ts','utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];
const base=process.env.NEXTDOX_TEST_URL||'http://127.0.0.1:3100';
const session=()=>({access_token:'synthetic.token.fixture',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test',aud:'authenticated',app_metadata:{},user_metadata:{}}});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});try{
for(const role of ['admin','user']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(({session,disclosureVersion})=>{if(!localStorage.getItem('walker.auth.test-seeded')){localStorage.setItem('walker-docs-next.auth.session',JSON.stringify(session));localStorage.setItem('walker.auth.test-seeded','1');}localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version:disclosureVersion,acceptedAt:Date.now()}));localStorage.setItem('walker.notifications.dismissed','1');},{session:session(),disclosureVersion});
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());requests.push(url.pathname+url.search);await new Promise(resolve=>setTimeout(resolve,100));let value={};
 if(url.pathname==='/api/me')value={id:'fixture-user',email:'fixture@example.test',displayName:'Fixture employee',role,workspaceRole:role,organizationId:'fixture-org',dealership:'Walker Honda',mustChangePassword:false,profileImageUrl:'',organizationIconUrl:''};
 else if(url.pathname==='/api/consultant-links')value={links:[],organization:{id:'fixture-org',name:'Walker Honda'}};
 else if(url.pathname==='/api/me/settings')value={dealer_info:{},consultant_info:{}};
 else if(url.pathname==='/api/deals')value={deals:[]};
 else if(url.pathname==='/api/manager-board'&&url.searchParams.has('district'))value={stores:{},notifications:[],month:'2026-10'};
 else if(url.pathname==='/api/manager-board')value={organization:{id:'fixture-org',name:'Walker Honda'},month:'2026-10',board:{newGoal:12,usedGoal:12,rows:{'fixture-user':{objective:12,mtd:2,days:[]}},schedule:'',weeklyUpdate:'',publishedAt:'version'},roster:[{id:'fixture-user',name:'Fixture employee'}],proposals:{},me:'fixture-user',canManage:false,canViewStats:false,version:'version'};
 else if(url.pathname==='/api/messenger')value={conversations:[]};
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 const start=Date.now();await page.goto(base+'/dashboard');await page.getByRole('heading',{name:'Start a Deal',exact:true}).waitFor();const visibleMs=Date.now()-start;await page.waitForTimeout(3200);
 const startup=[...requests];if(process.env.NEXTDOX_STARTUP_CAPTURE_ONLY==='1'){console.log(JSON.stringify({role,startupRequests:startup,initialVisibleMs:visibleMs,pageErrors:errors}));await context.close();continue;}assert.equal(startup.filter(x=>x==='/api/manager-board?view=consultant').length,1);assert(startup.includes('/api/deals?summary=1'));
 for(const path of startup)assert(!/district=|\/api\/workspace|\/api\/admin|\/api\/me\/settings|\/api\/consultant-links|\/api\/me\/business-card|\/api\/me\/sale-commander/.test(path),path);
 const boardCalls=requests.filter(x=>x.startsWith('/api/manager-board')).length;
 await page.getByRole('link',{name:'Training',exact:true}).first().click();await page.getByRole('link',{name:'NXTDOX home',exact:true}).click();await page.getByRole('heading',{name:'Start a Deal',exact:true}).waitFor();await page.waitForTimeout(500);
 assert.equal(requests.filter(x=>x.startsWith('/api/manager-board')).length,boardCalls,'fresh memory board reused on return');
 const appearanceCalls=requests.filter(x=>x==='/api/me').length;await page.reload();await page.getByRole('heading',{name:'Start a Deal',exact:true}).waitFor();await page.waitForTimeout(1700);assert.equal(requests.filter(x=>x==='/api/me').length,appearanceCalls,'appearance reused across reload');
 await page.evaluate(()=>localStorage.setItem('walker.auth.activity.v1',JSON.stringify({userId:'fixture-user',lastActiveAt:Date.now()-8*3600000-1000})));
 const beforeExpiry=requests.length;await page.reload();await page.getByRole('heading',{name:'Sign In',exact:true}).waitFor();assert(!requests.slice(beforeExpiry).includes('/api/me?access=1'));
 assert.equal(await page.evaluate(()=>localStorage.getItem('walker-docs-next.auth.session')),null);
 await page.route('**/auth/v1/token?grant_type=password',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(session())}));
 await page.goto(base+'/manager-board');await page.getByPlaceholder('name@company.com').fill('fixture@example.test');await page.getByRole('textbox',{name:'Password',exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:'Start a Deal',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({role,startupRequests:startup,initialVisibleMs:visibleMs,returnBoardRequests:0,appearanceReloadRequests:0,idle8h:'expired before protected requests',login:'consultant dashboard',pageErrors:errors}));await context.close();
}
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
