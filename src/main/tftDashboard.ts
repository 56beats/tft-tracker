import type { LpHistoryPointDto, SetLpSummaryDto, TftLeagueEntryDto, TftLpPayload } from '../shared/types'
import {
  appendSnapshotToStore,
  getSetSnapshots,
  listSetKeysForPlayer,
  loadHistoryFile,
  playerStorageKey,
  saveHistoryFile,
  setStorageKey,
  sortSetKeysDesc,
  type LpSnapshot
} from './lpHistoryStore'
import { fetchLatestTftSetNumber, fetchTftRankedLp } from './riot'

function buildChartPoints(snaps: LpSnapshot[], live: TftLeagueEntryDto | null): LpHistoryPointDto[] {
  const out: LpHistoryPointDto[] = snaps.map((s) => ({
    at: s.at,
    lp: s.lp,
    tier: s.tier,
    rank: s.rank
  }))
  if (!live) return out
  const last = out[out.length - 1]
  if (
    !last ||
    last.lp !== live.leaguePoints ||
    last.tier !== live.tier ||
    last.rank !== live.rank
  ) {
    out.push({
      at: new Date().toISOString(),
      lp: live.leaguePoints,
      tier: live.tier,
      rank: live.rank
    })
  }
  return out
}

export async function buildTftLpDashboard(
  riotId: string,
  platform: string,
  apiKey: string
): Promise<TftLpPayload> {
  const base = await fetchTftRankedLp(riotId, platform, apiKey)
  const plat = platform.toLowerCase()
  const playerKey = playerStorageKey(plat, base.puuid)
  const setNumber = await fetchLatestTftSetNumber(base.puuid, plat, apiKey)
  const activeSetKey = setStorageKey(setNumber)

  let file = await loadHistoryFile()

  if (base.entry) {
    const snap: LpSnapshot = {
      at: new Date().toISOString(),
      lp: base.entry.leaguePoints,
      tier: base.entry.tier,
      rank: base.entry.rank,
      wins: base.entry.wins ?? null,
      losses: base.entry.losses ?? null
    }
    file = appendSnapshotToStore(file, playerKey, activeSetKey, snap)
    await saveHistoryFile(file)
  }

  const keys = sortSetKeysDesc(listSetKeysForPlayer(file, playerKey)).filter(
    (key) => getSetSnapshots(file, playerKey, key).length > 0
  )
  const setSummaries: SetLpSummaryDto[] = keys.map((key) => {
    const snaps = getSetSnapshots(file, playerKey, key)
    const last = snaps[snaps.length - 1]
    if (!last) {
      throw new Error('snapshot missing')
    }
    const parsed = key === 'unknown' ? NaN : parseInt(key, 10)
    const setNum = Number.isNaN(parsed) ? null : parsed
    const isCurrentSet = key === activeSetKey
    let tier = last.tier
    let rank = last.rank
    let lp = last.lp
    let wins = last.wins
    let losses = last.losses
    if (isCurrentSet && base.entry) {
      tier = base.entry.tier
      rank = base.entry.rank
      lp = base.entry.leaguePoints
      wins = base.entry.wins ?? wins
      losses = base.entry.losses ?? losses
    }
    return {
      setKey: key,
      setNumber: setNum,
      tier,
      rank,
      leaguePoints: lp,
      wins,
      losses,
      lastRecordedAt: last.at,
      isCurrentSet
    }
  })

  const chartSnaps = getSetSnapshots(file, playerKey, activeSetKey)
  const currentSetLpHistory = buildChartPoints(chartSnaps, base.entry)

  return {
    gameName: base.gameName,
    tagLine: base.tagLine,
    puuid: base.puuid,
    platform: plat,
    entry: base.entry,
    currentSetNumber: setNumber,
    setSummaries,
    currentSetLpHistory
  }
}
