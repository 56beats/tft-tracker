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

export type LpHistoryFile = {
  v: 1
  players: Record<string, Record<string, SetBucket>>
}

function storePath(): string {
  return join(app.getPath('userData'), 'tft-lp-history.json')
}

export async function loadHistoryFile(): Promise<LpHistoryFile> {
  const path = storePath()
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as LpHistoryFile
    if (parsed?.v === 1 && parsed.players && typeof parsed.players === 'object') {
      return parsed
    }
  } catch {
    /* 新規 */
  }
  return { v: 1, players: {} }
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
  if (!data.players[playerKey]) data.players[playerKey] = {}
  if (!data.players[playerKey][setKey]) data.players[playerKey][setKey] = { snapshots: [] }
  const list = data.players[playerKey][setKey].snapshots
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
  return data.players[playerKey]?.[setKey]?.snapshots ?? []
}

export function listSetKeysForPlayer(data: LpHistoryFile, playerKey: string): string[] {
  const sets = data.players[playerKey]
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
