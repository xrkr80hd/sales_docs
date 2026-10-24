// Synthetic accounts and intercepted APIs only; no production records.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const version = fs.readFileSync('lib/disclosure.ts', 'utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
 try { for (const width of (process.env.NEXTDOX_TEST_WIDTH ? [Number(process.env.NEXTDOX_TEST_WIDTH)] : [390,1024,1336,1440])) {
  const context = await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(version => {
   localStorage.setItem('walker-docs-next.auth.session',JSON.stringify({access_token:'synthetic.token.fixture',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test',aud:'authenticated',app_metadata:{},user_metadata:{}}}));
   localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version,acceptedAt:Date.now()}));
   localStorage.setItem('walker.notifications.dismissed','1');
  },version);
  let floorManagerFixture=false;
  const page = await context.newPage(), errors=[], requests=[];
  page.setDefaultTimeout(15000);
  console.log('Checking navigation at width',width);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const url = new URL(route.request().url()); requests.push(url.pathname+url.search);let body={};
   if(url.pathname==='/api/me')body={id:'fixture-user',email:'fixture@example.test',displayName:'Travis Wilkinson',role:floorManagerFixture?'sales_manager':'admin',workspaceRole:floorManagerFixture?'floor_manager':'admin',organizationId:'test-org',mustChangePassword:false};
   else if(url.pathname==='/api/me/sale-commander')body={commander:{},assignedGoal:null};
   else if(url.pathname==='/api/messenger')body={me:'fixture-user',conversations:[],organizations:[],people:[],canDm:true,canCreateOrganization:false};
   else if(url.pathname==='/api/consultant-links')body={links:[{id:'one',name:'Saved test tool',url:'https://example.test'}],version:'v1',organization:{id:'test-org',name:'Test organization'}};
   else if(url.pathname==='/api/workspace/queue')body={deals:floorManagerFixture?[{id:'fixture-deal',workflow_data:{customerName:'LongCustomerName'.repeat(12),vehicleMake:'LongVehicleMake'.repeat(12)},claimer:{display_name:'AssignedManager'.repeat(12)}}]:[]};
   else if(url.pathname==='/api/deals')body={deals:[]};
   else if(url.pathname==='/api/workspace/directory')body={organizations:[],memberships:[],users:[]};
   else if(url.pathname==='/api/manager-board')body={stores:{},notifications:[],month:'2026-10'};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('https://example.test/**', route => route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"><h1>Synthetic business tool</h1></body></html>'}));
  const main=page.getByRole('main'), nav=page.getByRole('complementary',{name:'Application navigation'});
  async function openNav(){if(width<680)await page.getByRole('button',{name:'Open navigation',exact:true}).click();}
  await page.goto((process.env.NEXTDOX_TEST_URL || 'http://127.0.0.1:3100') + '/dashboard');
  await main.getByRole('heading',{name:'Sales Commander',exact:true}).waitFor().catch(async error=>{console.log((await page.locator('body').innerText()).slice(0,1600),requests,errors);throw error;});
  await main.getByLabel('Monthly sales goal',{exact:true}).waitFor();
  assert(!requests.some(path=>/manager-board|workspace\/directory|api\/deals/.test(path)));
  assert.equal(requests.filter(path=>path==='/api/me/sale-commander').length,1);
  if(width>900){
    const targets=page.locator('dl[aria-label="Daily activity targets"]');
    await targets.waitFor({state:'visible'});
    assert.equal(await targets.locator('dt').allTextContents().then(values=>values.join(',')),'Calls,Convos,Appts,Sales');
    const bounds=await targets.boundingBox(),brand=await page.locator('header img[alt="Walker Automotive"]').boundingBox(),profile=await page.locator('header details').first().boundingBox();
    assert(bounds.x>=brand.x+brand.width && bounds.x+bounds.width<=profile.x);
    assert(await targets.evaluate(el=>el.scrollWidth<=el.clientWidth));
    const cells=await targets.locator(':scope > div').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
    assert(cells.every(cell=>Math.abs(cell.y-cells[0].y)<1),'targets must remain in one horizontal row');
    assert(cells.every(cell=>Math.abs(cell.width-cells[0].width)<1),'targets must divide header space evenly');
    const messenger=await page.getByRole('link',{name:'Open Messenger. No unread messages',exact:true}).boundingBox();
    assert(bounds.x+bounds.width<=messenger.x,'targets must finish before the Messenger icon');

    for(const item of await targets.locator('dd').all())assert(await item.evaluate(el=>el.scrollWidth<=el.clientWidth));
  }

  await openNav();
  assert.equal(await nav.getByRole('link').first().innerText(),'Sales Commander');
  assert.equal(await nav.getByText('Manager Board',{exact:true}).count(),0);
  assert.equal(await nav.getByText('Administration',{exact:true}).count(),0);
  const group=nav.getByRole('group',{name:'Sales Commander',exact:true});
  assert.equal(await group.getByText('Setup',{exact:true}).count(),0);
  await group.getByRole('link',{name:'Consultant Set Up',exact:true}).click();
  await main.getByRole('heading',{name:'Consultant Set Up',exact:true}).waitFor();
  await main.getByRole('button',{name:'Close Consultant Set Up and return to Sales Commander',exact:true}).click();
  await main.getByRole('heading',{name:'Sales Commander',exact:true}).waitFor();
  await openNav();
  await group.getByText('Command Center',{exact:true}).click();
  await group.getByRole('link',{name:'Saved test tool',exact:true}).waitFor();
  assert.equal(await nav.getByRole('link',{name:'Command Center Settings',exact:true}).count(),1);
  await group.getByRole('link',{name:'Saved test tool',exact:true}).click();
  await page.frameLocator('iframe').getByRole('heading',{name:'Synthetic business tool'}).waitFor();
  assert.equal(await main.getByRole('heading').count(),0);
  assert.equal(await main.getByText('WALKER BROWSER',{exact:true}).count(),0);
  const frame=await page.locator('iframe').boundingBox(), header=await page.locator('header').first().boundingBox();
  assert(Math.abs(frame.y-(header.y+header.height))<=1, 'embedded site must start immediately below app header');
  assert(Math.abs(frame.y+frame.height-900)<=1, 'embedded site must fill remaining screen height');
  assert(Math.abs(frame.x+frame.width-width)<=1, 'embedded site must fill workspace width');
  if(width>680){const before=frame.width;await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();assert((await page.locator('iframe').boundingBox()).width>before);await page.getByRole('button',{name:'Expand navigation',exact:true}).click();}
  assert.equal(await page.locator('iframe').count(),1);
  await openNav();
  await nav.getByRole('link',{name:'Start a Deal',exact:true}).click();
  await main.getByRole('heading',{name:'Start a Deal',exact:true}).waitFor();
  assert(await main.getByRole('button',{name:'New Vehicle',exact:true}).isVisible());
  assert(await main.getByRole('button',{name:'Used Vehicle',exact:true}).isVisible());
  await main.getByRole('button',{name:'New Vehicle',exact:true}).click();
  const dealHeader=main.getByRole('region',{name:'Deal header',exact:true});
  await dealHeader.getByRole('heading',{name:'New Vehicle',exact:true}).waitFor();
  assert((await dealHeader.boundingBox()).height<=100);
  assert(await dealHeader.evaluate(el=>el.scrollWidth<=el.clientWidth));
  assert.equal(await dealHeader.getByRole('link').count(),0);
  await openNav();
  assert.equal(await nav.getByRole('link',{name:'Documents',exact:true}).count(),0,'No duplicate document library link during an active deal');
  assert.equal(await nav.getByRole('button',{name:'Deal Documents',exact:true}).count(),1);
  if(width<680)await nav.getByRole('button',{name:'Close navigation',exact:true}).click();

  await openNav();await nav.getByRole('link',{name:'Resume Deal',exact:true}).click();
  await main.getByRole('heading',{name:'Resume Deal',exact:true}).waitFor();
  assert.equal(await main.getByText(/Start a (New )?Deal/).count(),0);
  // Master admin changes workspace using one selector, not a sidebar full of views.
  await page.locator('header details > summary').click();
  await page.getByLabel('Workspace view',{exact:true}).selectOption('district_manager');
  await main.getByRole('heading',{name:'District Manager',exact:true}).waitFor();
  await openNav();assert.equal(await nav.getByRole('link',{name:'Sales Commander',exact:true}).count(),0);
  assert.equal(await nav.getByRole('link',{name:'District Manager',exact:true}).count(),1);
  await nav.getByRole('link',{name:'Messenger',exact:true}).click();
  await page.waitForURL('**/messenger');await openNav();
  assert.equal(await nav.getByRole('link',{name:'Sales Commander',exact:true}).count(),0);
  assert.equal(await nav.getByRole('link',{name:'District Manager',exact:true}).count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,dashboard:'Sales Commander',setup:'nested; closing preserves links',deals:'separate start/resume',roles:'selected workspace only',errors}));
  floorManagerFixture=true;
  await page.goto((process.env.NEXTDOX_TEST_URL || 'http://127.0.0.1:3100') + '/dashboard');
  await main.getByRole('heading',{name:'Sales Commander',exact:true}).waitFor();
  await openNav();
  assert.equal(await nav.getByRole('link',{name:'FM View',exact:true}).count(),1);
  assert.equal(await nav.getByRole('link',{name:'Consultant Set Up',exact:true}).count(),1);
  assert.equal(await nav.getByRole('link',{name:'Start a Deal',exact:true}).count(),1);
  await nav.getByRole('link',{name:'FM View',exact:true}).click();
  await main.getByRole('heading',{name:'Floor Manager',exact:true}).waitFor();
  const reviewQueue=main.getByRole('region',{name:'Deal review queue',exact:true});
  await reviewQueue.getByText('LongCustomerName'.repeat(12),{exact:true}).waitFor();
  assert(await reviewQueue.evaluate(el=>el.scrollWidth<=el.clientWidth),'Queue must contain long names');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Queue must not widen the page');
  assert((await reviewQueue.locator('tbody tr').first().boundingBox()).height<160,'Queue rows stay compact');
  await openNav();
  assert.equal(await nav.getByRole('link',{name:'Sales Commander',exact:true}).count(),1);
  assert.equal(await nav.getByRole('link',{name:'Consultant Set Up',exact:true}).count(),1);
  assert.equal(await nav.getByText('Administration',{exact:true}).count(),0);
  assert.equal(await page.getByLabel('Workspace view',{exact:true}).count(),0);
  assert.equal(await page.locator('header details').count(),0,'No redundant sign-out-only dropdown');
  console.log(JSON.stringify({width,floorManager:'FM View plus full consultant navigation; no workspace dropdown'}));
  await context.close();
 } } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
