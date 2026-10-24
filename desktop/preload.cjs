const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('walkerBrowser', {
  open: (url, accountId) => ipcRenderer.invoke('walker:open',{url,accountId}),
  bounds: rect => ipcRenderer.invoke('walker:bounds',rect),
  answerDialog: (id,accept,promptText) => ipcRenderer.invoke('walker:dialog',{id,accept,promptText}),
  back: () => ipcRenderer.invoke('walker:back'),
  close: () => ipcRenderer.invoke('walker:close'),
  onState: listener => {const receive=(_event,value)=>listener(value);ipcRenderer.on('walker:state',receive);return()=>ipcRenderer.removeListener('walker:state',receive);},
});
