import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { config } from 'dotenv'
import { buildTftLpDashboard } from './tftDashboard'

config({ path: join(process.cwd(), '.env') })

function getApiKey(): string {
  return process.env.RIOT_API_KEY?.trim() ?? ''
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 880,
    height: 820,
    minWidth: 520,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('tft:getLp', async (_evt, payload: { riotId: string; platform: string }) => {
    try {
      const result = await buildTftLpDashboard(payload.riotId, payload.platform, getApiKey())
      return { ok: true as const, data: result }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: message }
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
