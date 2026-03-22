import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

export type LpSnapshot = {
  at: string
  lp: number
  tier: string
  rank: string
  wins: number | null
  losses: number | null
}

type SetBucket = { snapshots: LpSnapshot[] }

export type RankedPlacementRow = {
  at: string
  placement: number
  setNumber: number | null
  matchId: string
  queueId: number
}

/** v2: sets のほか、試合由来の placement 履歴を保持 */
export type PlayerHistory = {
  sets: Record<string, SetBucket>
  rankedPlacements?: RankedPlacementRow[]
  /** 直近の試合バックフィル完了時刻（短時間での API 浪費を防ぐ） */
  lastMatchSyncAt?: string
}

export type LpHistoryFile = {
  v: 2
  players: Record<string, PlayerHistory>
}

function storePath(): string {
  return join(app.getPath('userData'), 'tft-lp-history.json')
}

type LegacyV1 = { v: 1; players: Record<string, Record<string, SetBucket>> }

function migrate(raw: unknown): LpHistoryFile {
  if (raw && typeof raw === 'object') {
    const o = raw as { v?: number; players?: unknown }
    if (o.v === 2 && o.players && typeof o.players === 'object') {
      return raw as LpHistoryFile
    }
    if (o.v === 1 && o.players && typeof o.players === 'object') {
      const p1 = o.players as LegacyV1['players']
      const players: Record<string, PlayerHistory> = {}
      for (const [pk, sets] of Object.entries(p1)) {
        players[pk] = { sets: { ...sets }, rankedPlacements: [] }
      }
      return { v: 2, players }
    }
  }
  return { v: 2, players: {} }
}

export async function loadHistoryFile(): Promise<LpHistoryFile> {
  const path = storePath()
  try {
    const raw = await readFile(path, 'utf-8')
    return migrate(JSON.parse(raw))
  } catch {
    return { v: 2, players: {} }
  }
}

export async function saveHistoryFile(data: LpHistoryFile): Promise<void> {
  const path = storePath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

export function playerStorageKey(platform: string, puuid: string): string {
  return `${platform.toLowerCase()}:${puuid}`
}

export function setStorageKey(setNumber: number | null): string {
  return setNumber != null ? String(setNumber) : 'unknown'
}

export function ensurePlayer(data: LpHistoryFile, playerKey: string): PlayerHistory {
  if (!data.players[playerKey]) {
    data.players[playerKey] = { sets: {}, rankedPlacements: [] }
  }
  const p = data.players[playerKey]
  if (!p.rankedPlacements) p.rankedPlacements = []
  return p
}

export function shouldAppendSnapshot(prev: LpSnapshot | undefined, next: LpSnapshot): boolean {
  if (!prev) return true
  if (prev.lp !== next.lp || prev.tier !== next.tier || prev.rank !== next.rank) return true
  const dt = new Date(next.at).getTime() - new Date(prev.at).getTime()
  return dt >= 10 * 60 * 1000
}

export function appendSnapshotToStore(
  data: LpHistoryFile,
  playerKey: string,
  setKey: string,
  snap: LpSnapshot
): LpHistoryFile {
  const player = ensurePlayer(data, playerKey)
  if (!player.sets[setKey]) player.sets[setKey] = { snapshots: [] }
  const list = player.sets[setKey].snapshots
  const last = list[list.length - 1]
  if (shouldAppendSnapshot(last, snap)) {
    list.push(snap)
  }
  return data
}

export function getSetSnapshots(
  data: LpHistoryFile,
  playerKey: string,
  setKey: string
): LpSnapshot[] {
  return data.players[playerKey]?.sets?.[setKey]?.snapshots ?? []
}

export function listSetKeysForPlayer(data: LpHistoryFile, playerKey: string): string[] {
  const sets = data.players[playerKey]?.sets
  if (!sets) return []
  return Object.keys(sets)
}

export function sortSetKeysDesc(keys: string[]): string[] {
  const rank = (k: string): number => {
    if (k === 'unknown') return Number.NEGATIVE_INFINITY
    const n = parseInt(k, 10)
    return Number.isNaN(n) ? Number.NEGATIVE_INFINITY : n
  }
  return [...keys].sort((a, b) => rank(b) - rank(a))
}

export function getPlacementsForPlayer(data: LpHistoryFile, playerKey: string): RankedPlacementRow[] {
  return data.players[playerKey]?.rankedPlacements ?? []
}
