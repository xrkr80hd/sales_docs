// Real Electron/Chromium integration test; synthetic local websites only.
const {app,BrowserWindow,BrowserView,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {PopupHost}=require('./popup-host.cjs');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'walker-native-test-')));
const wait=async fn=>{const until=Date.now()+10000;while(!fn()){if(Date.now()>until)throw Error('Timed out waiting for native browser');await new Promise(r=>setTimeout(r,25));}};
let window,host;const servers=[];
app.whenReady().then(async()=>{
 try{
  const serve=()=>new Promise(resolve=>{const server=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{res.setHeader('Content-Type','text/html');res.end(`<html><body><h1>${req.url}</h1><p id="body">${body}</p><script>window.received='';addEventListener('message',e=>window.received=e.data);</script></body></html>`);});});server.listen(0,'127.0.0.1',()=>{servers.push(server);resolve('http://127.0.0.1:'+server.address().port);});});
  const rootUrl=await serve(),otherUrl=await serve();
  window=new BrowserWindow({show:true,width:1440,height:960,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
  await window.loadURL(rootUrl+"/shell");
  console.log("NATIVE_TEST creating root");
  host=new PopupHost({window,BrowserView});ipcMain.on('walker:website-dialog',(event,input)=>host.requestDialog(event.sender,input,value=>{event.returnValue=value;}));host.setBounds({x:250,y:94,width:1190,height:866});host.open(rootUrl+'/root','synthetic-A');
  await wait(()=>host.views[0]?.webContents.getURL().endsWith('/root')&&!host.views[0].webContents.isLoading());
  console.log("NATIVE_TEST root loaded");
  const root=host.views[0].webContents;
  await root.executeJavaScript(`document.cookie='fixture=yes';window.open('${otherUrl}/login?return=exact','login');0`,true);
  await wait(()=>host.views.length===2&&host.views[1].webContents.getURL().includes('/login?return=exact')&&!host.views[1].webContents.isLoading());
  console.log("NATIVE_TEST popup loaded");
  let child=host.views[1].webContents;
  assert.equal(BrowserWindow.getAllWindows().length,1);
  assert.equal(await child.executeJavaScript('Boolean(window.opener)'),true);
  assert.equal(await child.executeJavaScript('document.cookie.includes("fixture=yes")'),true);
  await child.executeJavaScript(`window.opener.postMessage('login-success','*')`);
  await wait(async()=>true);assert.equal(await root.executeJavaScript('window.received'),'login-success');
  const confirmation=child.executeJavaScript('window.confirm("Send synthetic text message?")',true);
  await wait(()=>Boolean(host.pendingDialog));assert.equal(host.pendingDialog.public.type,'confirm');
  await host.answerDialog(host.pendingDialog.public.id,true);assert.equal(await confirmation,true);
  const prompt=child.executeJavaScript('window.prompt("Enter confirmation","default")',true);
  await wait(()=>Boolean(host.pendingDialog));await host.answerDialog(host.pendingDialog.public.id,true,'synthetic-response');assert.equal(await prompt,'synthetic-response');
  await child.executeJavaScript(`window.open('${otherUrl}/nested','nested');0`,true);
  await wait(()=>host.views.length===3&&!host.views[2].webContents.isLoading());host.back();await wait(()=>host.views.length===2);
  await child.executeJavaScript('window.close()');await wait(()=>host.views.length===1);
  await root.executeJavaScript(`const f=document.createElement('form');f.method='POST';f.target='_blank';f.action='${otherUrl}/post-login';const i=document.createElement('input');i.name='code';i.value='synthetic-123';f.append(i);document.body.append(f);f.submit();`,true);
  await wait(()=>host.views.length===2&&host.views[1].webContents.getURL().endsWith('/post-login')&&!host.views[1].webContents.isLoading());
  assert.equal(await host.views[1].webContents.executeJavaScript('document.querySelector("#body").textContent'),'code=synthetic-123');
  assert.deepEqual(host.views[1].getBounds(),{x:250,y:94,width:1190,height:866});
  assert.equal(await host.views[1].webContents.executeJavaScript('typeof require'),'undefined');
  host.open(rootUrl+'/different','synthetic-B');await wait(()=>host.views.length===1&&!host.views[0].webContents.isLoading());
  assert.equal(await host.views[0].webContents.executeJavaScript('document.cookie.includes("fixture=yes")'),false);
  console.log('PASS: exact popup URL, one app window, opener messaging, shared cookies, confirm/prompt, nested popup return, POST body, view bounds, Node isolation, account isolation');
 }catch(error){console.error(error);process.exitCode=1;}
 finally{host?.close();window?.destroy();for(const server of servers)server.close();app.quit();}
});
