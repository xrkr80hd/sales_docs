// Only synchronous website dialogs are bridged; remote pages receive no Node or file APIs.
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('walkerWebsiteDialog',{
 alert:message=>ipcRenderer.sendSync('walker:website-dialog',{type:'alert',message:String(message)}),
 confirm:message=>ipcRenderer.sendSync('walker:website-dialog',{type:'confirm',message:String(message)}),
 prompt:(message,value)=>ipcRenderer.sendSync('walker:website-dialog',{type:'prompt',message:String(message),defaultPrompt:String(value??'')}),
});
contextBridge.executeInMainWorld({func:()=>{
 window.alert=message=>{window.walkerWebsiteDialog.alert(message);};
 window.confirm=message=>window.walkerWebsiteDialog.confirm(message);
 window.prompt=(message,value)=>window.walkerWebsiteDialog.prompt(message,value);
}});
