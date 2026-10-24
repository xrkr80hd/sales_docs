const {app,BrowserWindow,BrowserView,ipcMain}=require('electron');
const path=require('node:path');
const {PopupHost,securePreferences,safeUrl}=require('./popup-host.cjs');
const appUrl=process.env.WALKER_APP_URL||'https://nextdocs.xrkr80hd.studio/dashboard';
if(!safeUrl(appUrl))throw Error('WALKER_APP_URL must be HTTP or HTTPS');
const appOrigin=new URL(appUrl).origin;
let window,host;
function authorized(event){return window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&new URL(event.senderFrame.url).origin===appOrigin;}
app.whenReady().then(()=>{
 window=new BrowserWindow({width:1440,height:960,minWidth:780,minHeight:600,backgroundColor:'#11191d',webPreferences:{...securePreferences,preload:path.join(__dirname,'preload.cjs')}});
 host=new PopupHost({window,BrowserView,notify:value=>{if(!window.isDestroyed())window.webContents.send('walker:state',value);}});
 // Never allow external pages to replace the trusted app shell.
 window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==appOrigin)event.preventDefault();});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 const handle=(channel,fn)=>ipcMain.handle(channel,(event,value)=>{if(!authorized(event))throw Error('Untrusted browser request');return fn(value);});
 ipcMain.on('walker:website-dialog',(event,input)=>host.requestDialog(event.sender,input,value=>{event.returnValue=value;}));
 handle('walker:dialog',({id,accept,promptText})=>host.answerDialog(id,accept,promptText));
 handle('walker:open',({url,accountId})=>host.open(url,accountId));handle('walker:bounds',rect=>host.setBounds(rect));handle('walker:back',()=>host.back());handle('walker:close',()=>host.close());
 window.on('close',()=>host.close());
 void window.loadURL(appUrl);
});
app.on('window-all-closed',()=>app.quit());
