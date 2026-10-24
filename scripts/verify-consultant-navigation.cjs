// Synthetic accounts and intercepted APIs only; no production records.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const version = fs.readFileSync('lib/disclosure.ts', 'utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
 try { for (const width of [390,1440]) {
  const context = await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(version => {
   localStorage.setItem('walker-docs-next.auth.session',JSON.stringify({access_token:'synthetic.token.fixture',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test',aud:'authenticated',app_metadata:{},user_metadata:{}}}));
   localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version,acceptedAt:Date.now()}));
   localStorage.setItem('walker.notifications.dismissed','1');
  },version);
  const page = await context.newPage(), errors=[], requests=[];
  page.setDefaultTimeout(15000);
  console.log('Checking navigation at width',width);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const url = new URL(route.request().url()); requests.push(url.pathname+url.search);let body={};
   if(url.pathname==='/api/me')body={id:'fixture-user',email:'fixture@example.test',displayName:'Test admin',role:'admin',workspaceRole:'admin',organizationId:'test-org',mustChangePassword:false};
   else if(url.pathname==='/api/me/sale-commander')body={commander:{},assignedGoal:null};
   else if(url.pathname==='/api/messenger')body={me:'fixture-user',conversations:[],organizations:[],people:[],canDm:true,canCreateOrganization:false};
   else if(url.pathname==='/api/consultant-links')body={links:[{id:'one',name:'Saved test tool',url:'https://example.test'}],version:'v1',organization:{id:'test-org',name:'Test organization'}};
   else if(url.pathname==='/api/deals'||url.pathname==='/api/workspace/queue')body={deals:[]};
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
  await openNav();
  assert.equal(await nav.getByRole('link').first().innerText(),'Sales Commander');
  assert.equal(await nav.getByText('Manager Board',{exact:true}).count(),0);
  assert.equal(await nav.getByText('Administration',{exact:true}).count(),0);
  const group=nav.getByRole('group',{name:'Sales Commander',exact:true});
  await group.getByText('Setup',{exact:true}).click();
  assert(await group.getByRole('link',{name:'Command Center Settings',exact:true}).isVisible());
  await group.getByText('Setup',{exact:true}).click();
  await group.getByText('Command Center',{exact:true}).click();
  await group.getByRole('link',{name:'Saved test tool',exact:true}).waitFor();
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
  await context.close();
 } } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
