import { appendSnapshotToStore, ensurePlayer, setStorageKey, type LpHistoryFile } from './lpHistoryStore'
import { riotFetch } from './riot'

/** 2025-12-01 00:00:00 UTC 以降の試合を対象 */
export const BACKFILL_SINCE_MS = Date.UTC(2025, 11, 1, 0, 0, 0, 0)

/** 1 回の同期で詳細を取る試合の上限（開発キーのレート制限対策） */
const MAX_MATCH_DETAIL_FETCHES = 120

/** メインランク TFT（Riot の queue 定数。変更される場合あり） */
const TFT_RANKED_QUEUE_IDS = new Set([1100])

export type MatchBackfillStats = {
  matchesFetched: number
  rankedMatchesInRange: number
  placementPointsStored: number
  lpPointsMergedFromMatches: number
  note: string | null
}

function normalizeGameDatetimeMs(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  return raw < 1e12 ? raw * 1000 : raw
}

function deepFindLeagueLike(obj: unknown, depth = 0): { lp: number; tier: string; rank: string } | null {
  if (depth > 5 || obj == null) return null
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const o = obj as Record<string, unknown>
    const lpRaw = o.leaguePoints ?? o.league_points ?? o.ratedRating ?? o.rated_rating
    if (typeof lpRaw === 'number' && Number.isFinite(lpRaw)) {
      const tier = o.tier ?? o.ratedTier ?? o.rated_tier
      const rank = o.rank ?? o.ratedRank ?? o.rated_rank ?? o.division
      const tierS = typeof tier === 'string' ? tier : tier != null ? String(tier) : 'UNKNOWN'
      const rankS = typeof rank === 'string' ? rank : rank != null ? String(rank) : 'I'
      return { lp: lpRaw, tier: tierS, rank: rankS }
    }
    for (const v of Object.values(o)) {
      const f = deepFindLeagueLike(v, depth + 1)
      if (f) return f
    }
  }
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const f = deepFindLeagueLike(v, depth + 1)
      if (f) return f
    }
  }
  return null
}

type TftMatchJson = {
  metadata?: { match_id?: string }
  info?: {
    game_datetime?: number
    queue_id?: number
    tft_set_number?: number
    participants?: Array<Record<string, unknown>>
  }
}

/**
 * 試合一覧を取得し、2025-12-01 以降のランク戦をバックフィルする。
 * 公式 ParticipantDto に LP は無いことが多く、placement のみ蓄積される。
 */
const SYNC_COOLDOWN_MS = 10 * 60 * 1000

export async function syncMatchesSinceDec2025(
  puuid: string,
  platform: string,
  apiKey: string,
  data: LpHistoryFile,
  playerKey: string
): Promise<MatchBackfillStats> {
  const plat = platform.toLowerCase()
  const player = ensurePlayer(data, playerKey)

  if (player.lastMatchSyncAt) {
    const elapsed = Date.now() - new Date(player.lastMatchSyncAt).getTime()
    if (elapsed >= 0 && elapsed < SYNC_COOLDOWN_MS) {
      return {
        matchesFetched: 0,
        rankedMatchesInRange: 0,
        placementPointsStored: 0,
        lpPointsMergedFromMatches: 0,
        note: `直近の試合同期から ${Math.round(SYNC_COOLDOWN_MS / 60000)} 分以内のためスキップしました。`
      }
    }
  }

  const sinceSec = Math.floor(BACKFILL_SINCE_MS / 1000)

  let start = 0
  const count = 100
  let matchesFetched = 0
  let rankedInRange = 0
  let placementAdded = 0
  let lpMerged = 0

  while (matchesFetched < MAX_MATCH_DETAIL_FETCHES) {
    const withTime = `https://${plat}.api.riotgames.com/tft/match/v1/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}&startTime=${sinceSec}`
    const plain = `https://${plat}.api.riotgames.com/tft/match/v1/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}`

    let ids: string[]
    try {
      ids = await riotFetch<string[]>(withTime, apiKey)
    } catch {
      ids = await riotFetch<string[]>(plain, apiKey)
    }
    if (!ids.length) break

    let minTmsInPage = Infinity

    for (const matchId of ids) {
      if (matchesFetched >= MAX_MATCH_DETAIL_FETCHES) break

      let match: TftMatchJson
      try {
        match = await riotFetch<TftMatchJson>(
          `https://${plat}.api.riotgames.com/tft/match/v1/matches/${encodeURIComponent(matchId)}`,
          apiKey
        )
      } catch {
        matchesFetched += 1
        continue
      }
      matchesFetched += 1

      const info = match.info
      if (!info?.game_datetime || info.queue_id == null) continue

      const tMs = normalizeGameDatetimeMs(info.game_datetime)
      minTmsInPage = Math.min(minTmsInPage, tMs)

      if (tMs < BACKFILL_SINCE_MS) continue

      if (!TFT_RANKED_QUEUE_IDS.has(info.queue_id)) continue

      rankedInRange += 1
      const atIso = new Date(tMs).toISOString()
      const setNum = typeof info.tft_set_number === 'number' ? info.tft_set_number : null
      const metaId = match.metadata?.match_id ?? matchId

      const self = info.participants?.find((p) => (p as { puuid?: string }).puuid === puuid) as
        | Record<string, unknown>
        | undefined
      const placementRaw = self?.placement
      const placement = typeof placementRaw === 'number' ? placementRaw : null
      if (placement != null) {
        const list = player.rankedPlacements!
        if (!list.some((r) => r.matchId === metaId)) {
          list.push({
            at: atIso,
            placement,
            setNumber: setNum,
            matchId: metaId,
            queueId: info.queue_id
          })
          placementAdded += 1
        }
        list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      }

      const leagueGuess = self ? deepFindLeagueLike(self) : null
      if (leagueGuess) {
        const setKey = setStorageKey(setNum)
        const before = player.sets[setKey]?.snapshots?.length ?? 0
        appendSnapshotToStore(data, playerKey, setKey, {
          at: atIso,
          lp: leagueGuess.lp,
          tier: leagueGuess.tier,
          rank: leagueGuess.rank,
          wins: null,
          losses: null
        })
        const after = player.sets[setKey]?.snapshots?.length ?? 0
        if (after > before) lpMerged += 1
      }
    }

    if (minTmsInPage < BACKFILL_SINCE_MS) break
    if (ids.length < count) break
    start += count
    if (start > 5000) break
  }

  let note: string | null =
    lpMerged === 0
      ? 'TFT Match API の参加者データに LP は通常含まれません。過去の真の LP は試合からは復元できず、ランク戦の順位（placement）を試合時刻で保存しました。'
      : null

  player.lastMatchSyncAt = new Date().toISOString()

  return {
    matchesFetched,
    rankedMatchesInRange,
    placementPointsStored: placementAdded,
    lpPointsMergedFromMatches: lpMerged,
    note
  }
}
