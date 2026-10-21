import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  sendCommand: (payload: any) => ipcRenderer.send('engine-cmd', payload),
  setHotkeys: (hotkeys: any) => ipcRenderer.invoke('set-hotkeys', hotkeys),
  getSaves: () => ipcRenderer.invoke('get-saves'),
  saveProfile: (profile: any) => ipcRenderer.invoke('save-profile', profile),
  deleteProfile: (id: string) => ipcRenderer.invoke('delete-profile', id),
  windowControl: (action: string) => ipcRenderer.send('win-ctrl', action),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.send('set-top', flag),
  toggleOverlay: (flag?: boolean) => ipcRenderer.invoke('toggle-overlay', flag),
  setOverlayOpacity: (val: number) => ipcRenderer.send('set-overlay-opacity', val),
  resizeOverlay: (height: number) => ipcRenderer.send('resize-overlay', height),
  setTheme: (theme: string) => ipcRenderer.send('set-theme', theme),
  setNotifications: (enabled: boolean) => ipcRenderer.send('set-notifications', enabled),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  checkForUpdates: (allowBeta?: boolean) => ipcRenderer.invoke('check-updates', allowBeta),
  installUpdate: (downloadUrl: string, assetName: string) => ipcRenderer.invoke('install-update', { downloadUrl, assetName }),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  onEngineEvent: (cb: (data: any) => void) => ipcRenderer.on('engine-event', (_e, data) => cb(data)),
  onHotkeyTriggered: (cb: (target: string) => void) => ipcRenderer.on('hotkey-triggered', (_e, target) => cb(target)),
  onOverlayState: (cb: (visible: boolean) => void) => ipcRenderer.on('overlay-state', (_e, visible) => cb(visible)),
  onThemeChanged: (cb: (theme: string) => void) => ipcRenderer.on('theme-changed', (_e, theme) => cb(theme)),
  onUpdateProgress: (cb: (data: any) => void) => ipcRenderer.on('update-progress', (_e, data) => cb(data)),
  onUpdateAvailable: (cb: (data: any) => void) => ipcRenderer.on('update-available', (_e, data) => cb(data))
})
