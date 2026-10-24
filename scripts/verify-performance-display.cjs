// Synthetic browser fixtures only. Run against the local test server on port 3100.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='http://127.0.0.1:3100';
const version=fs.readFileSync('lib/disclosure.ts','utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 try {
  const context=await browser.newContext();
  await context.addInitScript(({version})=>{
   if(location.origin!=='http://127.0.0.1:3100')return;
   localStorage.setItem('walker-docs-next.auth.session',JSON.stringify({access_token:'synthetic.token.fixture',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-manager',email:'fixture@example.test',app_metadata:{},user_metadata:{}}}));
   localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version,acceptedAt:Date.now()}));localStorage.setItem('walker.notifications.dismissed','1');
  },{version});
  let count=8,reads=0,writes=0,fail=false;
  const board={newGoal:20,usedGoal:40,newGrossGoal:125000,usedGrossGoal:250000,monthlyGross:375000,yearlyGross:2000000,rows:{},schedule:'PRIVATE SCHEDULE',weeklyUpdate:'PRIVATE MESSAGE',events:[],publishedAt:'2026-10-01T12:00:00.000Z'};
  for(let i=0;i<12;i++)board.rows['p'+i]={objective:12,mtd:4,weeklyGoal:3,avg90:10.5,days:[1,2,3,4,5,6,7],newSold:1,usedSold:2,newGrossActual:1000,usedGrossActual:2000,appointmentsGoal:20,appointmentsSet:5};
  const requests=[],errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  await context.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());requests.push(url.pathname+url.search);let value={},status=200;
   if(url.pathname==='/api/me')value={id:'fixture-manager',email:'fixture@example.test',displayName:'Synthetic Manager',role:'admin',workspaceRole:'sales_manager',organizationId:'A',dealership:'Walker Honda',mustChangePassword:false};
   else if(url.pathname==='/api/workspace/directory')value={organizations:[{id:'A',name:'Walker Honda'},{id:'B',name:'Walker CDJR'}]};
   else if(url.pathname==='/api/messenger')value={conversations:[]};
   else if(url.pathname==='/api/me/settings')value={dealer_info:{},consultant_info:{}};
   else if(url.pathname==='/api/manager-board'){
    if(req.method()==='POST'){writes++;const body=req.postDataJSON();assert.equal(body.month,url.searchParams.get('month'));if(body.action==='save-board')Object.assign(board,body.board);board.publishedAt=new Date(Date.parse(board.publishedAt)+1000).toISOString();value={saved:true};}
    else {reads++;if(fail){status=503;value={error:'Synthetic disconnected board'};}else{const id=url.searchParams.get('organization')||'A';value={organization:{id,name:id==='A'?'Walker Honda':'Walker CDJR'},month:url.searchParams.get('month')||'2026-10',board,roster:Array.from({length:count},(_,i)=>({id:'p'+i,name:i===0?'Alexandria Montgomery-Williamson the Third':'Consultant '+(i+1)})),proposals:{p0:{value:15}},me:'fixture-manager',canManage:url.searchParams.get('view')!=='display',canViewStats:true,grossYtd:24000,version:board.publishedAt};}}
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
  });
  const page=await context.newPage();
  for(const viewport of [{width:1040,height:640},{width:1366,height:768},{width:1440,height:900},{width:1920,height:1080},{width:3840,height:2160},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.goto(base+'/office-display?organization=A&month=2026-09');
   const display=page.getByRole('region',{name:'Performance Display',exact:true});await display.getByRole('heading',{name:'Performance Display',exact:true}).waitFor();
   assert.equal(await display.locator('tbody tr').count(),8);assert.equal(await display.locator('tfoot tr').count(),1);
   assert.equal(await display.getByRole('textbox').count(),0);assert.equal(await display.getByRole('spinbutton').count(),0);
   assert(!/PRIVATE|Yearly|Days Off|Team Schedule|Appts/.test(await display.innerText()));
   assert.equal(await page.getByRole('complementary',{name:'Application navigation'}).count(),0);
   assert.equal(await display.getByRole('region',{name:'Combined monthly performance'}).locator('dd').first().innerText(),'60');
   assert((await display.innerText()).includes('40%')); // 24 / 60, not an average of percentages.
   const dimensions=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
   assert(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));
   if(viewport.width>=1000)assert(dimensions.scrollHeight<=dimensions.height+1,'Unexpected display scroll '+JSON.stringify(dimensions));
   await page.screenshot({path:'/tmp/nextdox-performance-'+viewport.width+'.png'});
   console.log(JSON.stringify({viewport,consultants:8,totals:true,dimensions}));
  }
  assert(!requests.some(url=>url.startsWith('/api/messenger')),'Standalone must not load Messenger');
  assert.equal(writes,0,'Display reads never write records');
  const before=reads;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);assert(reads>before,'Reconnect refreshes data');
  fail=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('alert').filter({hasText:'Synthetic disconnected board'}).waitFor();assert.equal(await page.locator('tbody tr').count(),8);fail=false;
  await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic disconnected board'}).waitFor({state:'hidden'});
  count=12;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===12);assert.equal(await page.getByRole('button',{name:'Next',exact:true}).count(),0);count=8;
  await page.setViewportSize({width:1366,height:768});await page.goto(base+'/manager-board?organization=A&month=2026-09');await page.getByRole('heading',{name:'Manager Board · Setup',exact:true}).waitFor();
  const main=page.getByRole('main');
  for(const name of ['Monthly Objectives','Consultant Performance & Projections','Team Scheduling & Days Off','Yearly Performance','Publishing & Communication'])assert.equal(await main.locator('summary').filter({hasText:name}).count(),1);
  await main.getByRole('spinbutton',{name:'New Goal',exact:true}).fill('25');
  await main.getByRole('button',{name:'Save & publish board',exact:true}).click();await main.getByText('Board saved and published to consultant dashboards.',{exact:true}).waitFor();assert.equal(board.newGoal,25);assert.equal(board.schedule,'PRIVATE SCHEDULE');assert.equal(board.yearlyGross,2000000);assert.equal(writes,1);
  await main.getByRole('link',{name:'Performance Display',exact:true}).click();await page.getByRole('heading',{name:'Performance Display',exact:true}).waitFor();assert(page.url().includes('month=2026-09'));
  const embeddedSize=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));assert(embeddedSize.scrollWidth<=embeddedSize.width+1,JSON.stringify(embeddedSize));assert(embeddedSize.scrollHeight<=embeddedSize.height+1,'Embedded scroll '+JSON.stringify(embeddedSize));
  const popupPromise=context.waitForEvent('page');await main.getByRole('button',{name:'Pop Out Display',exact:true}).click();const popup=await popupPromise;await popup.getByRole('heading',{name:'Performance Display',exact:true}).waitFor();assert(popup.url().includes('organization=A'));assert(popup.url().includes('month=2026-09'));assert.equal(await popup.evaluate(()=>window.opener),null);
  await page.close();assert(!popup.isClosed());const prior=reads;await popup.evaluate(()=>window.dispatchEvent(new Event('focus')));await popup.waitForTimeout(300);assert(reads>prior);assert.equal(await popup.locator('tbody tr').count(),8);assert.equal(writes,1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({setup:'save preserves schedule/yearly/appointments',popout:'context preserved, opener closed, independent refresh passed',overflow:'all 12 consultants rendered',reconnect:'retains stale values, then recovers',writes,errors}));
  await context.close();
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
