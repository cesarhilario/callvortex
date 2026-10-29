import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { isAppUrl } from './security'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 540,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1f22',
    title: 'CallVortex',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // sandbox ativado: o renderer fica isolado do Node — se qualquer página
      // externa carregar ou houver XSS, o preload roda sem privilégios
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  // Diagnóstico: se o renderer morrer (tela em branco), registra o motivo no terminal
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone ->', details.reason, '| exitCode:', details.exitCode)
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[main] Falha ao carregar a página:', errorCode, errorDescription)
  })

  // Mensagens do console do renderer aparecem no terminal em dev
  // (Electron 43 usa o objeto de evento como 1º argumento)
  if (!app.isPackaged) {
    win.webContents.on('console-message', (details) => {
      const d = details as unknown as { level?: string | number; message?: string }
      const isError = d.level === 'error' || d.level === 3
      const isWarn = d.level === 'warning' || d.level === 2
      const isDevNoise = typeof d.message === 'string' && d.message.includes('Autofocus processing')
      if (!isError && !isWarn && !isDevNoise) {
        console.log(`[renderer]`, d.message ?? '')
      } else if (isError) {
        console.error(`[renderer]`, d.message ?? '')
      }
    })
  }

  // Bloquear navegação da janela para qualquer site externo
  // (protege o preload e o window.api de páginas não confiáveis)
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })

  // Abrir links externos no navegador padrão — apenas http/https
  win.webContents.setWindowOpenHandler((details) => {
    try {
      const u = new URL(details.url)
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        shell.openExternal(details.url)
      }
    } catch {
      // URL inválida — ignora
    }
    return { action: 'deny' }
  })

  // electron-vite injeta ELECTRON_RENDERER_URL no modo dev
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}
