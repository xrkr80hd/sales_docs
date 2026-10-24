// Synthetic UI fixtures only: no production users, customer records, or writes.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.NEXTDOX_TEST_URL||'http://127.0.0.1:3104';
const version=fs.readFileSync('lib/disclosure.ts','utf8').match(/DISCLOSURE_VERSION = "([^"]+)"/)[1];
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.NEXTDOX_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});try{for(const width of [390,1336]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(version=>{if(!localStorage.getItem('fixture-seeded')){localStorage.setItem('walker-docs-next.auth.session',JSON.stringify({access_token:'synthetic.token.fixture',refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'fixture-user',email:'fixture@example.test',aud:'authenticated',app_metadata:{},user_metadata:{}}}));localStorage.setItem('fixture-seeded','1');}localStorage.setItem('walker.disclosure.accepted',JSON.stringify({version,acceptedAt:Date.now()}));localStorage.setItem('walker.notifications.dismissed','1');},version);
 let puts=0,gets=0,failSave=true,links=[],linkVersion='one';let saveAuthorization='';
 await context.route('**/api/**',async route=>{const req=route.request(),url=new URL(req.url());let value={};let status=200;
 if(url.pathname==='/api/me')value={id:'fixture-user',email:'fixture@example.test',displayName:'Synthetic consultant',role:'user',workspaceRole:'user',organizationId:'org',dealership:'Walker Honda',mustChangePassword:false};
 else if(url.pathname==='/api/me/sale-commander'){if(req.method()==='PUT'){puts++;saveAuthorization=req.headers().authorization;if(failSave){status=503;value={error:'Synthetic interrupted connection'};}else value={commander:req.postDataJSON()};}else{gets++;value={commander:{goal:12},assignedGoal:null};}}
 else if(url.pathname==='/api/consultant-links'){if(req.method()==='PUT'){const input=req.postDataJSON();links=input.links;linkVersion='two';}value={links,version:linkVersion,organization:{id:'org',name:'Walker Honda'}};}
 else if(url.pathname==='/api/me/settings')value={dealer_info:{dealershipName:'Walker Honda'},consultant_info:{name:'Synthetic Consultant'},updated_at:'one'};
 else if(url.pathname==='/api/deals'){if(req.method()==='POST')value={id:'fixture-deal'};else value={deals:[]};}
 else if(url.pathname==='/api/me/business-card')value={permitted:true,isAdmin:false,card:{slug:'synthetic',publishedAt:null,draft:{identity:{displayName:'Synthetic'},content:{},contact:{},vehicles:[],reviews:[],soldGallery:[],videos:[],socialLinks:[]}}};
 else if(url.pathname==='/api/messenger')value={conversations:[],people:[],organizations:[],me:'fixture-user'};
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 });
 const main=page.getByRole('main').first(),nav=page.getByRole('complementary',{name:'Application navigation'});
 async function openNav(){if(width<680&&await page.getByRole('button',{name:'Open navigation',exact:true}).getAttribute('aria-expanded')!=='true')await page.getByRole('button',{name:'Open navigation',exact:true}).click();}
 await page.goto(base+'/dashboard');await main.getByLabel('Monthly sales goal',{exact:true}).waitFor();
 await openNav();await nav.getByRole('button',{name:'Quick Tour',exact:true}).click();
 const tour=page.getByRole('dialog',{name:'Consultant quick tour',exact:true});await tour.waitFor();
 const titles=['Sales Commander','Consultant Set Up','Command Center','Start a Deal','Resume Deal','Customer Information','Consultant Tools','Messenger'];
 for(let i=0;i<titles.length;i++){
  await tour.getByRole('heading',{name:titles[i],exact:true}).waitFor();assert.equal(await tour.getByText(`${i+1} of 8`,{exact:true}).count(),1);
  await page.waitForTimeout(60);
  const card=await tour.locator('section').boundingBox(),spot=await tour.locator('[aria-hidden="true"]').boundingBox();
  assert(card.x>=0&&card.x+card.width<=width&&card.y>=0&&card.y+card.height<=900,'Tour stays within viewport');
  assert(spot&&spot.y>=0&&spot.y+spot.height<=900,'Highlighted control stays visible');
  if(width<680)assert(card.y>=spot.y+spot.height||card.y+card.height<=spot.y,'Tour must not cover highlighted control');
  if(i===1){await tour.getByRole('button',{name:'Back',exact:true}).click();await tour.getByRole('heading',{name:titles[0],exact:true}).waitFor();await tour.getByRole('button',{name:'Next',exact:true}).click();}
  if(i===3)await page.screenshot({path:`/tmp/nextdox-tour-${width}.png`});
  await tour.getByRole('button',{name:i===7?'Done':'Next',exact:true}).click();
 }
 await tour.waitFor({state:'hidden'});assert(page.url().endsWith('/dashboard'));assert.equal(puts,0,'Tour never saves or edits activity');
 await nav.getByRole('button',{name:'Quick Tour',exact:true}).click();await tour.waitFor();await page.keyboard.press('Escape');await tour.waitFor({state:'hidden'});
 await nav.getByRole('button',{name:'Quick Tour',exact:true}).click();await tour.waitFor();await tour.getByRole('button',{name:'Skip tour',exact:true}).click();await tour.waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({width,tour:'eight steps, Back, Next, Done, Skip, Escape, restart, visible controls',writes:puts,errors}));await context.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
