// Native web views preserve Chromium's opener, POST body, cookies and window.close semantics.
const crypto = require('node:crypto');
const path=require('node:path');
function safeUrl(value, blank = false) {
  if (blank && value === 'about:blank') return true;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
const securePreferences = { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false };
class PopupHost {
  constructor({ window, BrowserView, notify = () => {} }) { this.window=window;this.View=BrowserView;this.attached=new Set();this.notify=notify;this.views=[];this.bounds={x:0,y:0,width:0,height:0};this.partition='';this.pendingDialog=null;this.nextDialog=0; }
  send() { this.notify({ depth:this.views.length, url:this.views.at(-1)?.webContents.getURL()||'',dialog:this.pendingDialog?.public||null }); }
  setBounds(rect) {
    const [width,height]=this.window.getContentSize();
    if(!rect||![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite))throw Error('Invalid browser bounds');
    const x=Math.max(0,Math.min(width,Math.round(rect.x))),y=Math.max(0,Math.min(height,Math.round(rect.y)));
    this.bounds={x,y,width:Math.max(0,Math.min(width-x,Math.round(rect.width))),height:Math.max(0,Math.min(height-y,Math.round(rect.height)))};
    const top=this.views.at(-1);if(top){top.setBounds(this.bounds);this.show(top,!this.pendingDialog&&this.bounds.width>0&&this.bounds.height>0);}
  }
  show(view,visible){
    if(!this.attached.has(view)){this.window.addBrowserView(view);this.attached.add(view);}
    view.setBounds(visible?this.bounds:{x:this.bounds.x,y:this.bounds.y,width:0,height:0});
  }
  adopt(options={}) {
    // Never inherit a remote preload or Node access from window.open features.
    const view=new this.View(options.webPreferences ? options : {webPreferences:{...securePreferences,preload:path.join(__dirname,"dialogs-preload.cjs"),partition:this.partition,backgroundThrottling:true}});
    if(this.views.length)this.show(this.views.at(-1),false);
    this.views.push(view);this.show(view,true);view.setBounds(this.bounds);
    const wc=view.webContents;
    wc.setWindowOpenHandler(details=>{
      if(!safeUrl(details.url,true)||this.views.length>=16)return {action:'deny'};
      return {action:'allow',createWindow:childOptions=>this.adopt(childOptions).webContents};
    });
    const restrict=(event,url)=>{if(!safeUrl(url,true))event.preventDefault();};
    wc.on('will-navigate',restrict);wc.on('will-redirect',restrict);
    wc.on('did-navigate',()=>this.send());wc.on('did-navigate-in-page',()=>this.send());
    wc.on('destroyed',()=>this.remove(view));
    wc.on('did-fail-load',(_event,code,description)=>{if(code!==-3)this.notify({depth:this.views.length,error:description});});
    this.send();return view;
  }
  open(url,accountId) {
    if(!safeUrl(url)||typeof accountId!=='string'||!accountId||accountId.length>200)throw Error('Invalid tool');
    this.close();this.partition='persist:walker-tools-'+crypto.createHash('sha256').update(accountId).digest('hex');
    const root=this.adopt();void root.webContents.loadURL(url).catch(error=>this.notify({depth:this.views.length,error:error.message}));
  }
  remove(view) {
    const index=this.views.indexOf(view);if(index<0)return;
    // Closing an opener also closes all its descendant popups.
    const removed=this.views.splice(index);
    if(removed.some(item=>item.webContents===this.pendingDialog?.wc))this.pendingDialog=null;
    for(const item of removed){this.window.removeBrowserView(item);this.attached.delete(item);if(!item.webContents.isDestroyed())item.webContents.close();}
    const top=this.views.at(-1);if(top){top.setBounds(this.bounds);this.show(top,true);top.webContents.focus();}this.send();
  }
  requestDialog(wc,input,respond){
    if(!this.views.some(view=>view.webContents===wc)||this.pendingDialog||!['alert','confirm','prompt'].includes(input?.type)){respond(false);return;}
    this.pendingDialog={wc,respond,public:{id:String(++this.nextDialog),type:input.type,message:String(input.message||'').slice(0,10000),defaultPrompt:String(input.defaultPrompt||'').slice(0,10000),origin:wc.getURL()}};
    this.show(this.views.at(-1),false);this.send();
  }
  async answerDialog(id,accept,promptText='') {
    const current=this.pendingDialog;
    if(!current||current.public.id!==id||typeof accept!=='boolean'||typeof promptText!=='string'||promptText.length>10000)throw Error('Invalid confirmation');
    this.pendingDialog=null;
    current.respond(current.public.type==='prompt'?(accept?promptText:null):accept);
    this.setBounds(this.bounds);this.send();
  }
  back() { if(this.views.length>1)this.views.at(-1).webContents.close(); }
  close() { if(this.views.length)this.remove(this.views[0]); }
}
module.exports={PopupHost,safeUrl,securePreferences};
