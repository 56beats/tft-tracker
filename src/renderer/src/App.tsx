import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack
} from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { LpHistoryPointDto, TftGetLpResult, TftLeagueEntryDto, TftLpPayload } from '../../shared/types'

const REGIONS = [
  { value: 'jp1', label: '日本 (JP1)' },
  { value: 'kr', label: '韓国 (KR)' },
  { value: 'na1', label: '北米 (NA1)' },
  { value: 'euw1', label: '西欧 (EUW1)' },
  { value: 'eun1', label: '東欧 (EUN1)' },
  { value: 'br1', label: 'ブラジル (BR1)' },
  { value: 'la1', label: 'LAN (LA1)' },
  { value: 'la2', label: 'LAS (LA2)' },
  { value: 'oc1', label: 'オセアニア (OC1)' },
  { value: 'tr1', label: 'トルコ (TR1)' },
  { value: 'ru', label: 'ロシア (RU)' },
  { value: 'sg2', label: 'SEA (SG2)' },
  { value: 'tw2', label: '台湾 (TW2)' },
  { value: 'vn2', label: 'ベトナム (VN2)' }
] as const

function formatTier(entry: TftLeagueEntryDto) {
  return `${entry.tier} ${entry.rank} — ${entry.leaguePoints} LP`
}

type ChartRow = LpHistoryPointDto & { idx: number; tick: string }

function buildChartRows(points: LpHistoryPointDto[]): ChartRow[] {
  return points.map((p, idx) => ({
    ...p,
    idx,
    tick: new Date(p.at).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }))
}

function LpChartTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: Array<{ payload: ChartRow }>
}) {
  if (!active || !payload?.[0]) return null
  const p = payload[0].payload
  return (
    <Box bg="gray.700" borderWidth="1px" borderColor="whiteAlpha.300" borderRadius="md" px={3} py={2} fontSize="sm">
      <Text color="gray.300">{new Date(p.at).toLocaleString('ja-JP')}</Text>
      <Text fontWeight="medium">
        {p.tier} {p.rank} — {p.lp} LP
      </Text>
    </Box>
  )
}

function DashboardPanel({ data }: { data: TftLpPayload }) {
  const chartData = buildChartRows(data.currentSetLpHistory)
  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <Text fontSize="sm" color="gray.400">
          {data.gameName}#{data.tagLine}
        </Text>
        {data.currentSetNumber != null && (
          <Text fontSize="xs" color="gray.500" mt={1}>
            検出中のセット（直近マッチ基準）: Set {data.currentSetNumber}
          </Text>
        )}
        {data.entry ? (
          <Text fontSize="lg" fontWeight="medium" mt={2}>
            現在（API）: {formatTier(data.entry)}
          </Text>
        ) : (
          <Text fontSize="sm" color="gray.400" mt={2}>
            ランク戦の記録がありません（アンランク）。
          </Text>
        )}
      </Box>

      <Divider borderColor="whiteAlpha.300" />

      <Box>
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          セット別 LP（この PC で記録した履歴）
        </Text>
        <Text fontSize="xs" color="gray.500" mb={3}>
          Riot API は過去セット終了時の LP を公開していません。取得のたびにスナップショットを端末に保存し、表とグラフに反映します。
        </Text>
        {data.setSummaries.length === 0 ? (
          <Text fontSize="sm" color="gray.500">
            まだ記録がありません。ランクがある状態で「LP を取得」を押すと、現在のセットの記録が始まります。
          </Text>
        ) : (
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th color="gray.400">セット</Th>
                  <Th color="gray.400">ティア</Th>
                  <Th color="gray.400" isNumeric>
                    LP
                  </Th>
                  <Th color="gray.400" isNumeric>
                    W/L
                  </Th>
                  <Th color="gray.400">最終記録</Th>
                </Tr>
              </Thead>
              <Tbody>
                {data.setSummaries.map((row) => (
                  <Tr key={row.setKey}>
                    <Td>
                      {row.setNumber != null ? `Set ${row.setNumber}` : 'セット不明'}
                      {row.isCurrentSet ? (
                        <Badge ml={2} colorScheme="blue" fontSize="0.65em">
                          現在
                        </Badge>
                      ) : null}
                    </Td>
                    <Td>
                      {row.tier} {row.rank}
                    </Td>
                    <Td isNumeric>{row.leaguePoints}</Td>
                    <Td isNumeric fontSize="sm" color="gray.400">
                      {row.wins != null && row.losses != null ? `${row.wins} / ${row.losses}` : '—'}
                    </Td>
                    <Td fontSize="xs" color="gray.500">
                      {new Date(row.lastRecordedAt).toLocaleString('ja-JP')}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Divider borderColor="whiteAlpha.300" />

      <Box>
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          今セットの LP 推移
        </Text>
        {data.currentSetNumber != null ? (
          <Text fontSize="xs" color="gray.500" mb={2}>
            Set {data.currentSetNumber} の記録（縦軸は API の leaguePoints。昇段・降段でリセットされます）
          </Text>
        ) : (
          <Text fontSize="xs" color="gray.500" mb={2}>
            直近マッチからセット番号を取得できませんでした。記録は「セット不明」バケットに入ります。
          </Text>
        )}
        {data.currentSetLpHistory.length < 2 ? (
          <Text fontSize="sm" color="gray.500">
            データが 2 点以上になると折れ線グラフが表示されます。日を分けて再度取得するか、ランクが動いてから試してください。
          </Text>
        ) : (
          <Box h="260px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                <XAxis
                  dataKey="idx"
                  tickFormatter={(v) => chartData[typeof v === 'number' ? v : Number(v)]?.tick ?? ''}
                  stroke="#a0aec0"
                  fontSize={11}
                />
                <YAxis stroke="#a0aec0" fontSize={11} width={40} domain={['auto', 'auto']} />
                <Tooltip content={<LpChartTooltip />} />
                <Line type="monotone" dataKey="lp" stroke="#63b3ed" strokeWidth={2} dot={{ r: 3, fill: '#63b3ed' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Box>
    </VStack>
  )
}

export default function App() {
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState('jp1')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TftGetLpResult | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!window.tftApi) {
      setResult({ ok: false, error: 'Electron のみで利用できます。' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await window.tftApi.getLp(riotId, platform)
      setResult(res)
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box as="main" minH="100vh" p={6}>
      <VStack align="stretch" spacing={5} maxW="900px" mx="auto">
        <Heading size="md" fontWeight="semibold">
          TFT ランク LP
        </Heading>

        <Box as="form" onSubmit={onSubmit}>
          <VStack align="stretch" spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Riot ID</FormLabel>
              <Input
                size="sm"
                placeholder="ゲーム名#タグ"
                value={riotId}
                onChange={(e) => setRiotId(e.target.value)}
                autoComplete="off"
              />
            </FormControl>

            <FormControl>
              <FormLabel fontSize="sm">リージョン</FormLabel>
              <Select size="sm" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            <Button type="submit" colorScheme="blue" size="sm" isLoading={loading}>
              LP を取得
            </Button>
          </VStack>
        </Box>

        {result && (
          <Box borderWidth="1px" borderRadius="md" p={4} bg="whiteAlpha.50">
            {result.ok ? (
              <DashboardPanel data={result.data} />
            ) : (
              <Text fontSize="sm" color="red.300">
                {result.error}
              </Text>
            )}
          </Box>
        )}

        <Text fontSize="xs" color="gray.500">
          開発用: プロジェクト直下の .env に RIOT_API_KEY= を設定してください。
        </Text>
      </VStack>
    </Box>
  )
}
