# TFT LP Tracker

Riot API を使って Teamfight Tactics（TFT）のランク戦 LP を表示する、Windows 向けデスクトップアプリです。

## 機能一覧

新しい機能を追加したときは、**下表に行を足して** README を更新してください。

| 機能 | 説明 | 追加日 |
|------|------|--------|
| Riot ID で LP 表示 | `ゲーム名#タグ` とリージョンを指定して `RANKED_TFT` のティア・段位・LP を取得 | 初版 |
| リージョン選択 | JP / KR / NA / EUW など主要プラットフォームに対応 | 初版 |
| ダーク UI | Chakra UI ベースのシンプルな画面 | 初版 |
| セット別 LP 表 | 「LP を取得」するたびに端末へ保存したスナップショットを、セット（直近マッチの `tft_set_number`）ごとに一覧表示 | 2026-03-22 |
| 今セットの LP グラフ | 上記スナップショットから、現在セットの `leaguePoints` の推移を折れ線で表示（2 点以上で描画） | 2026-03-22 |
| 試合履歴の読取（バックフィル） | TFT Match v1 で **2025-12-01 UTC 以降**の試合 ID をページングし、ランク戦（queue **1100**）を解析 | 2026-03-22 |
| 順位（placement）グラフ | 試合ごとの **1〜8 位**を時系列で表示（LP ではない）。現在セットが分かるときはそのセットに絞り込み | 2026-03-22 |

### データについて（重要）

- **Riot 公式 API には「過去セット終了時の最終 LP」一覧はありません。** そのため、**このアプリが記録した範囲**に限り、セット別の表・LP グラフが意味を持ちます。
- **TFT Match の参加者 JSON（ParticipantDto）には、原則として試合終了時の LP・ティアは含まれません。** したがって **2025年12月以降の真の LP 曲線を試合だけから復元することはできません。** 試合から確実に取れるのは **順位（placement）** や試合時刻などです。
- 実装上、試合オブジェクト内に `leaguePoints` 等が**非公式に含まれる場合**に限り、LP スナップショットへマージを試みます（通常は 0 件のままです）。
- 「LP を取得」時に試合同期を走らせます。**同一サモナーは 10 分以内に再同期しません**（API 節約）。初回は最大 **120 試合**まで詳細取得します（それ以上は次回以降の同期で続きを取る想定ではなく、現状は上限で打ち切り）。
- セット番号は **TFT Match v1 の直近 1 試合** に含まれる `tft_set_number` から推定します。直近がランクマッチでない場合、番号が期待とずれることがあります。
- 履歴ファイル: Electron の **ユーザーデータディレクトリ** に `tft-lp-history.json` として保存されます（**v2** スキーマ。旧 v1 は起動時に自動移行）。OS・ユーザーごとに場所が異なります。

### 予定・検討中（任意）

実装したら上の表へ移動し、ここから削除してください。

- （未記入）

---

## 技術スタック

- **Electron** + **electron-vite**
- **React 18** + **TypeScript**
- **Chakra UI**
- **Recharts**（LP 推移グラフ）
- **Riot Games API**（Account v1、TFT League v1、TFT Match v1）

## 必要なもの

- Node.js（推奨: 最新 LTS）
- [Riot Developer Portal](https://developer.riotgames.com/) で発行した API キー

## セットアップ

```bash
git clone https://github.com/56beats/tft-tracker.git
cd tft-tracker
npm install
copy .env.example .env   # Windows（PowerShell / CMD）
# .env に RIOT_API_KEY= を記入
npm run dev
```

macOS / Linux の場合は `.env` を手元で作成し、`.env.example` を参考に `RIOT_API_KEY` を設定してください。

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `RIOT_API_KEY` | はい | Riot API の `X-Riot-Token`。**リポジトリにコミットしないこと**（`.gitignore` に `.env` を含む） |

## npm スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発モード（Vite + Electron 起動） |
| `npm run build` | `out/` へ本番用ビルド |
| `npm run preview` | ビルド結果のプレビュー |

ビルド後にアプリだけ起動する例（Windows）:

```bash
npx electron .
```

## プロジェクト構成（概要）

```
src/
  main/            # Electron メインプロセス（Riot API・履歴 JSON・IPC）
  main/tftDashboard.ts
  main/lpHistoryStore.ts
  main/matchBackfill.ts
  preload/         # プリロード（renderer への安全な API 公開）
  renderer/      # React + Chakra UI + Recharts
  shared/        # 型定義など共有コード
```

API キーはメインプロセスのみで読み込み、レンダラには渡しません。

## Riot API について

- アカウント解決: `riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`（ルーティングリージョン）
- TFT ランク: `tft/league/v1/by-puuid/{puuid}`（プラットフォームリージョン）
- マッチ ID 一覧: `tft/match/v1/matches/by-puuid/{puuid}/ids`（`startTime` が使える場合は 2025-12-01 以降に絞り込み）
- マッチ詳細（`queue_id` / `tft_set_number` / `participants`）: `tft/match/v1/matches/{matchId}`

レート制限やキーの種類（開発用キーなど）の制約は、[公式ドキュメント](https://developer.riotgames.com/docs/portal) に従ってください。

## ライセンス

MIT（`package.json` に準拠）

---

## メンテナ向け：README の更新ルール

機能追加・仕様変更をマージするときは、次を更新してください。

1. **機能一覧**の表に、新機能の行を追加する（または説明を修正する）。
2. 大きな変更があれば **更新履歴** に 1 行追記する。
3. セットアップや環境変数が変わったら、該当セクションを直す。

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-03-22 | 初版 README 作成 |
| 2026-03-22 | セット別 LP 表・今セット LP グラフ、ローカル履歴保存、README 追記 |
| 2026-03-22 | 2025/12/1 以降の試合バックフィル、順位グラフ、履歴 v2・試合同期のクールダウン |
