import { contextBridge, ipcRenderer } from 'electron'
import type { TftGetLpResult } from '../shared/types'

contextBridge.exposeInMainWorld('tftApi', {
  getLp: (riotId: string, platform: string): Promise<TftGetLpResult> =>
    ipcRenderer.invoke('tft:getLp', { riotId, platform })
})
