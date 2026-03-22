import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Text,
  VStack
} from '@chakra-ui/react'
import { useState, type FormEvent } from 'react'
import type { TftGetLpResult, TftLeagueEntryDto } from '../../shared/types'

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
      <VStack align="stretch" spacing={5} maxW="md" mx="auto">
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
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" color="gray.400">
                  {result.data.gameName}#{result.data.tagLine}
                </Text>
                {result.data.entry ? (
                  <Text fontSize="lg" fontWeight="medium">
                    {formatTier(result.data.entry)}
                  </Text>
                ) : (
                  <Text fontSize="sm" color="gray.400">
                    ランク戦の記録がありません（アンランク）。
                  </Text>
                )}
              </VStack>
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
