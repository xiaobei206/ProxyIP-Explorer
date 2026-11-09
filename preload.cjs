'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proxyApp', {
  loadCatalog: () => ipcRenderer.invoke('catalog:load'),
  refreshCatalog: () => ipcRenderer.invoke('catalog:refresh'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: url => ipcRenderer.invoke('app:openExternal', url),
  startProbe: payload => ipcRenderer.invoke('probe:start', payload),
  stopProbe: () => ipcRenderer.invoke('probe:stop'),
  onProbeResult: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:result', listener);
    return () => ipcRenderer.removeListener('probe:result', listener);
  },
  onProbeProgress: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:progress', listener);
    return () => ipcRenderer.removeListener('probe:progress', listener);
  },
  onProbeCycle: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:cycle', listener);
    return () => ipcRenderer.removeListener('probe:cycle', listener);
  },
  onProbeWaiting: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:waiting', listener);
    return () => ipcRenderer.removeListener('probe:waiting', listener);
  },
  onProbeStopped: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:stopped', listener);
    return () => ipcRenderer.removeListener('probe:stopped', listener);
  },
  onProbeError: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('probe:error', listener);
    return () => ipcRenderer.removeListener('probe:error', listener);
  }
});
