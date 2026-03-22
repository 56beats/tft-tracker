export type TftLeagueEntryDto = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins?: number
  losses?: number
}

export type LpHistoryPointDto = {
  at: string
  lp: number
  tier: string
  rank: string
}

export type SetLpSummaryDto = {
  setKey: string
  setNumber: number | null
  tier: string
  rank: string
  leaguePoints: number
  wins: number | null
  losses: number | null
  lastRecordedAt: string
  isCurrentSet: boolean
}

export type TftLpPayload = {
  gameName: string
  tagLine: string
  puuid: string
  platform: string
  entry: TftLeagueEntryDto | null
  currentSetNumber: number | null
  setSummaries: SetLpSummaryDto[]
  currentSetLpHistory: LpHistoryPointDto[]
}

export type TftGetLpResult =
  | { ok: true; data: TftLpPayload }
  | { ok: false; error: string }
