import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, Notification, screen, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import { checkGitHubUpdates, downloadAndRunInstaller } from './updater'

app.setAppUserModelId('com.sammykunimatsu.inputrix')

const APP_VERSION = app.getVersion() || '1.0.0'
const REPO_URL = 'https://github.com/SammyKunimatsu/Inputrix'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let pyProc: ChildProcess | null = null
let isQuitting = false
let keyStateRunning = false
let mouseStateRunning = false
let trayNoticeShown = false
let currentHotkeys = { keyToggle: 'F6', mouseToggle: 'F7', pickCoord: 'F8', panicStop: 'Escape' }

const userDataDir = app.getPath('userData')
const savesPath = path.join(userDataDir, 'saves.json')
const settingsPath = path.join(userDataDir, 'settings.json')

const resolveAsset = (file: string) => {
  if (app.isPackaged) {
    const resAsset = path.join(process.resourcesPath, 'assets', file)
    if (fs.existsSync(resAsset)) return resAsset
  }
  return path.join(__dirname, '..', '..', 'assets', file)
}

const resolveEngineBinary = (): { cmd: string; args: string[] } => {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, 'engine.exe')
    if (fs.existsSync(exePath)) return { cmd: exePath, args: [] }
    return { cmd: 'python', args: ['-u', path.join(process.resourcesPath, 'engine.py')] }
  }
  const devExe = path.join(__dirname, '..', '..', 'src', 'engine', 'engine.exe')
  if (fs.existsSync(devExe)) return { cmd: devExe, args: [] }
  return { cmd: 'python', args: ['-u', path.join(__dirname, '..', 'engine', 'engine.py')] }
}

const iconIcoPath = resolveAsset('icon.ico')
const iconPngPath = resolveAsset('icon.png')

interface AppSettings {
  theme: 'dark' | 'light'
  notificationsEnabled: boolean
  allowBeta: boolean
  autoCheckUpdates: boolean
}

let appSettings: AppSettings = {
  theme: 'dark',
  notificationsEnabled: true,
  allowBeta: false,
  autoCheckUpdates: true
}

const readSettings = (): AppSettings => {
  try {
    if (!fs.existsSync(settingsPath)) return appSettings
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    appSettings = { ...appSettings, ...parsed }
    return appSettings
  } catch (_e) {
    return appSettings
  }
}

const writeSettings = (next: Partial<AppSettings>): AppSettings => {
  appSettings = { ...appSettings, ...next }
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(appSettings, null, 2), 'utf-8')
  } catch (_e) {}
  return appSettings
}

const readSaves = (): any[] => {
  try {
    if (!fs.existsSync(savesPath)) return []
    return JSON.parse(fs.readFileSync(savesPath, 'utf-8'))
  } catch (_e) {
    return []
  }
}

const writeSaves = (list: any[]) => {
  try {
    fs.writeFileSync(savesPath, JSON.stringify(list, null, 2), 'utf-8')
  } catch (_e) {}
}

const notifyOS = (title: string, body: string) => {
  if (!appSettings.notificationsEnabled || !Notification.isSupported()) return
  try {
    const n = new Notification({ title, body, icon: iconPngPath, silent: true })
    n.show()
  } catch (_e) {}
}

const broadcast = (channel: string, data: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data)
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(channel, data)
}

const startEngine = () => {
  const { cmd, args } = resolveEngineBinary()
  pyProc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  pyProc.on('error', () => {
    const fallbackScript = app.isPackaged ? path.join(process.resourcesPath, 'engine.py') : path.join(__dirname, '..', 'engine', 'engine.py')
    if (cmd !== 'py') pyProc = spawn('py', ['-u', fallbackScript], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  })
  let buffer = ''

  pyProc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)
        if (parsed.event === 'status') {
          if (parsed.mode === 'key' && parsed.running !== keyStateRunning) {
            keyStateRunning = parsed.running
            const countTxt = (parsed.activeIds || []).length
            notifyOS(
              keyStateRunning ? 'Inputrix · Teclado Iniciado' : 'Inputrix · Teclado Parado',
              keyStateRunning ? `${countTxt} tecla(s) ativa(s) em execução.` : `Execução finalizada (${parsed.count || 0} pulsos enviados).`
            )
            updateTrayMenu()
          }
          if (parsed.mode === 'mouse' && parsed.running !== mouseStateRunning) {
            mouseStateRunning = parsed.running
            notifyOS(
              mouseStateRunning ? 'Inputrix · Mouse Iniciado' : 'Inputrix · Mouse Parado',
              mouseStateRunning ? 'Atuador de mouse em execução.' : `Execução finalizada (${parsed.count || 0} cliques enviados).`
            )
            updateTrayMenu()
          }
        }
        broadcast('engine-event', parsed)
      } catch (_err) {}
    }
  })
}

const sendToEngine = (obj: any) => {
  if (pyProc && pyProc.stdin && pyProc.stdin.writable) pyProc.stdin.write(JSON.stringify(obj) + '\n')
}

let lastNotifiedVersion = ''
let hoverMain = false
let hoverOverlay = false

const syncHoverToEngine = () => {
  sendToEngine({ cmd: 'set_hover', over: Boolean(hoverMain || hoverOverlay) })
}

const runSilentUpdateCheck = async () => {
  if (!appSettings.autoCheckUpdates) return
  try {
    const res = await checkGitHubUpdates(APP_VERSION, appSettings.allowBeta)
    if (res.hasUpdate && !res.error && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', res)
      if (res.latestVersion !== lastNotifiedVersion) {
        lastNotifiedVersion = res.latestVersion
        notifyOS('Atualização Disponível · Inputrix', `A versão v${res.latestVersion} está pronta para instalar no aplicativo.`)
      }
    }
  } catch (_e) {}
}

const registerHotkeys = (hk: Partial<typeof currentHotkeys>) => {
  globalShortcut.unregisterAll()
  currentHotkeys = { ...currentHotkeys, ...hk }

  const bindKey = (accel: string, action: string) => {
    if (!accel) return
    try {
      globalShortcut.register(accel, () => {
        if (action === 'pickCoord') sendToEngine({ cmd: 'get_cursor' })
        if (action === 'panicStop') sendToEngine({ cmd: 'stop_all' })
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('hotkey-triggered', action)
      })
    } catch (_e) {}
  }

  bindKey(currentHotkeys.keyToggle, 'keyToggle')
  bindKey(currentHotkeys.mouseToggle, 'mouseToggle')
  bindKey(currentHotkeys.pickCoord, 'pickCoord')
}

const createOverlayWindow = (): BrowserWindow => {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow
  const primary = screen.getPrimaryDisplay().workAreaSize
  overlayWindow = new BrowserWindow({
    width: 280,
    height: 110,
    x: primary.width - 304,
    y: 28,
    minWidth: 240,
    minHeight: 90,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    backgroundColor: '#131217',
    icon: iconIcoPath,
    show: false,
    webPreferences: { preload: path.join(__dirname, '..', 'preload', 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'))
  overlayWindow.webContents.on('did-finish-load', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send('theme-changed', appSettings.theme)
  })
  overlayWindow.on('hide', () => {
    hoverOverlay = false
    syncHoverToEngine()
  })
  overlayWindow.on('closed', () => {
    overlayWindow = null
    hoverOverlay = false
    syncHoverToEngine()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('overlay-state', false)
    updateTrayMenu()
  })
  return overlayWindow
}

const setOverlayVisibility = (visible: boolean): boolean => {
  const win = createOverlayWindow()
  if (visible) {
    win.showInactive()
    win.setAlwaysOnTop(true, 'screen-saver')
  } else {
    win.hide()
  }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('overlay-state', visible)
  updateTrayMenu()
  return visible
}

const updateTrayMenu = () => {
  if (!tray) return
  const overlayVisible = Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible())
  const menu = Menu.buildFromTemplate([
    {
      label: `Abrir Inputrix (v${APP_VERSION})`,
      click: () => {
        if (!mainWindow) return
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: overlayVisible ? 'Ocultar Miniatura (HUD)' : 'Mostrar Miniatura (HUD)',
      click: () => setOverlayVisibility(!overlayVisible)
    },
    { type: 'separator' },
    {
      label: keyStateRunning ? `Parar Teclado (${currentHotkeys.keyToggle})` : `Iniciar Teclado (${currentHotkeys.keyToggle})`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('hotkey-triggered', 'keyToggle')
      }
    },
    {
      label: mouseStateRunning ? `Parar Mouse (${currentHotkeys.mouseToggle})` : `Iniciar Mouse (${currentHotkeys.mouseToggle})`,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('hotkey-triggered', 'mouseToggle')
      }
    },
    {
      label: 'Interromper Tudo Agora',
      click: () => sendToEngine({ cmd: 'stop_all' })
    },
    { type: 'separator' },
    {
      label: 'Repositório no GitHub',
      click: () => shell.openExternal(REPO_URL)
    },
    {
      label: 'Fechar Inputrix',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}

const createTray = () => {
  tray = new Tray(iconIcoPath)
  tray.setToolTip(`Inputrix v${APP_VERSION}`)
  tray.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) mainWindow.focus()
    else mainWindow.show()
  })
  updateTrayMenu()
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 760,
    minWidth: 920,
    minHeight: 660,
    frame: false,
    transparent: false,
    backgroundColor: '#171719',
    icon: iconIcoPath,
    webPreferences: { preload: path.join(__dirname, '..', 'preload', 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  mainWindow.webContents.on('did-finish-load', () => {
    runSilentUpdateCheck()
    setInterval(runSilentUpdateCheck, 30000)
  })

  mainWindow.on('minimize', () => {
    hoverMain = false
    syncHoverToEngine()
  })
  mainWindow.on('hide', () => {
    hoverMain = false
    syncHoverToEngine()
  })
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
      if (!trayNoticeShown) {
        trayNoticeShown = true
        notifyOS('Inputrix em Segundo Plano', 'O aplicativo continua ativo na bandeja do Windows.')
      }
    }
  })
}

app.whenReady().then(() => {
  readSettings()
  startEngine()
  createWindow()
  createTray()
  registerHotkeys(currentHotkeys)
})

ipcMain.on('engine-cmd', (_e, payload) => sendToEngine(payload))
ipcMain.on('set-hover-state', (_e, { source, over }) => {
  if (source === 'main') hoverMain = Boolean(over)
  else if (source === 'overlay') hoverOverlay = Boolean(over)
  syncHoverToEngine()
})
ipcMain.handle('set-hotkeys', (_e, hk) => {
  registerHotkeys(hk)
  updateTrayMenu()
  return currentHotkeys
})

ipcMain.handle('get-app-info', () => ({
  version: APP_VERSION,
  repoUrl: REPO_URL,
  settings: readSettings()
}))

ipcMain.handle('save-settings', (_e, partial) => writeSettings(partial))

ipcMain.handle('check-updates', async (_e, allowBeta?: boolean) => {
  const betaFlag = typeof allowBeta === 'boolean' ? allowBeta : appSettings.allowBeta
  return await checkGitHubUpdates(APP_VERSION, betaFlag)
})

ipcMain.handle('install-update', async (_e, { downloadUrl, assetName }) => {
  return await downloadAndRunInstaller(downloadUrl, assetName, (pct, recMb, totMb) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', { pct, recMb, totMb })
    }
  })
})

ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url)
})

ipcMain.handle('toggle-overlay', (_e, flag) => {
  const cur = Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible())
  const next = typeof flag === 'boolean' ? flag : !cur
  return setOverlayVisibility(next)
})

ipcMain.on('set-overlay-opacity', (_e, val) => {
  const clamped = Math.max(0.25, Math.min(1, Number(val) || 0.95))
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.setOpacity(clamped)
})

ipcMain.on('resize-overlay', (_e, targetHeight) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return
  const b = overlayWindow.getBounds()
  const h = Math.max(92, Math.min(460, Math.round(Number(targetHeight) || 110)))
  if (Math.abs(b.height - h) > 2) overlayWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: h })
})

ipcMain.on('set-theme', (_e, theme) => {
  const nextTheme = theme === 'light' ? 'light' : 'dark'
  writeSettings({ theme: nextTheme })
  broadcast('theme-changed', nextTheme)
})

ipcMain.on('set-notifications', (_e, enabled) => {
  writeSettings({ notificationsEnabled: Boolean(enabled) })
})

ipcMain.handle('get-saves', () => readSaves())
ipcMain.handle('save-profile', (_e, profile) => {
  const list = readSaves()
  const idx = list.findIndex((p: any) => p.id === profile.id || p.name.toLowerCase() === profile.name.toLowerCase())
  if (idx >= 0) list[idx] = profile
  else list.push(profile)
  writeSaves(list)
  return list
})

ipcMain.handle('delete-profile', (_e, id) => {
  const list = readSaves().filter((p: any) => p.id !== id)
  writeSaves(list)
  return list
})

ipcMain.on('set-top', (_e, flag) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(Boolean(flag))
})

ipcMain.on('win-ctrl', (_e, action) => {
  if (!mainWindow) return
  if (action === 'min') mainWindow.minimize()
  else if (action === 'max') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  else if (action === 'close') mainWindow.hide()
  else if (action === 'close-overlay') setOverlayVisibility(false)
})

app.on('before-quit', () => {
  isQuitting = true
  sendToEngine({ cmd: 'quit' })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (pyProc && pyProc.pid) {
    try {
      spawn('taskkill', ['/pid', String(pyProc.pid), '/T', '/F'], { windowsHide: true })
    } catch (_e) {}
    pyProc.kill()
  }
})
