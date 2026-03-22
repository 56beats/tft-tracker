/// <reference types="vite/client" />

import type { TftGetLpResult } from '../../shared/types'

declare global {
  interface Window {
    tftApi: {
      getLp: (riotId: string, platform: string) => Promise<TftGetLpResult>
    }
  }
}

export {}
