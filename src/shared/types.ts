export type TftLeagueEntryDto = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

export type TftLpPayload = {
  gameName: string
  tagLine: string
  puuid: string
  entry: TftLeagueEntryDto | null
}

export type TftGetLpResult =
  | { ok: true; data: TftLpPayload }
  | { ok: false; error: string }
