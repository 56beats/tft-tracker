/** Platform (e.g. na1) → Account-API routing cluster */
const PLATFORM_TO_ROUTING: Record<string, string> = {
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  oc1: 'americas',
  eun1: 'europe',
  euw1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  jp1: 'asia',
  kr: 'asia',
  sg2: 'sea',
  tw2: 'sea',
  vn2: 'sea'
}

type TftLeagueEntry = {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

function parseRiotId(riotId: string): { gameName: string; tagLine: string } {
  const trimmed = riotId.trim()
  const hash = trimmed.lastIndexOf('#')
  if (hash <= 0 || hash === trimmed.length - 1) {
    throw new Error('Riot ID は「ゲーム名#タグ」の形式で入力してください（例: Player#TAG）')
  }
  return {
    gameName: trimmed.slice(0, hash).trim(),
    tagLine: trimmed.slice(hash + 1).trim()
  }
}

async function riotFetch<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-Riot-Token': apiKey }
  })
  const text = await res.text()
  if (!res.ok) {
    let detail = text
    try {
      const j = JSON.parse(text) as { status?: { message?: string } }
      if (j?.status?.message) detail = j.status.message
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return JSON.parse(text) as T
}

export async function fetchTftRankedLp(
  riotId: string,
  platform: string,
  apiKey: string
): Promise<{
  gameName: string
  tagLine: string
  puuid: string
  entry: TftLeagueEntry | null
}> {
  if (!apiKey) {
    throw new Error('RIOT_API_KEY が設定されていません。プロジェクト直下の .env に設定してください。')
  }

  const plat = platform.toLowerCase()
  const routing = PLATFORM_TO_ROUTING[plat]
  if (!routing) {
    throw new Error(`未対応のリージョンです: ${platform}`)
  }

  const { gameName, tagLine } = parseRiotId(riotId)

  const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  const account = await riotFetch<{ puuid: string; gameName: string; tagLine: string }>(
    accountUrl,
    apiKey
  )

  // /tft/league/v1/entries/by-puuid/{puuid} は entries/{tier}/{division} とパスが衝突する。
  // 正しいのは /tft/league/v1/by-puuid/{puuid}（entries セグメントなし）。
  const leagueUrl = `https://${plat}.api.riotgames.com/tft/league/v1/by-puuid/${encodeURIComponent(account.puuid)}`
  const entries = await riotFetch<TftLeagueEntry[]>(leagueUrl, apiKey)

  const ranked = entries.find((e) => e.queueType === 'RANKED_TFT') ?? null

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    puuid: account.puuid,
    entry: ranked
  }
}
