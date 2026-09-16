# DJ Track Recommender

BPM と Camelot キーから「次に掛ける曲」を提案する、DJ 向けの楽曲管理アプリ。

| | |
|---|---|
| フレームワーク | Next.js 15（App Router） |
| 言語 | TypeScript |
| DB | PostgreSQL 16 |
| ORM | Prisma 6 |
| スタイル | Tailwind CSS 4 |
| 実行環境 | Docker / Docker Compose |

## 機能

- **楽曲登録** — タイトル / アーティスト / BPM / Camelot キー / エナジー / ジャンル / 曲尺 / レーベル / メモ。一覧からの編集・削除にも対応。
- **BPM 管理** — ピッチフェーダーの許容幅（既定 ±8%）を考慮したテンポ適合判定。ハーフタイム / ダブルタイム（例: 128 ↔ 64、174）も候補に含めます。
- **Camelot 管理** — 24 キーすべてを扱い、一般的な調表記（Am / C など）を併記。インタラクティブな Camelot ホイールでライブラリのキー分布を確認できます。
- **次曲推薦** — テンポ・ハーモニック適合・エナジー遷移を重み付き合成してスコア化（0–100）。推薦理由も表示します。
- **セットリストビルダー** — 1 曲目を選び、推薦を辿って流れを構築。繋ぎごとのピッチ差・キー関係・エナジー変化を確認でき、テキストで書き出せます。
- **Docker 対応** — 開発用（ホットリロード）と本番用（standalone ビルド）の 2 構成。

## セットアップ

### 前提

現在この PC には **Node.js も Docker もインストールされていません**。どちらか一方を入れてください。

- Docker だけで動かす（Node 不要・推奨） → [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- ローカルの Node で動かす → [Node.js 20 以上](https://nodejs.org/) と PostgreSQL 14 以上

### A. Docker で起動する（推奨）

```bash
docker compose up --build
```

初回は自動で以下が行われます。

1. PostgreSQL 16 を起動
2. `prisma generate` → `prisma migrate deploy` でスキーマ適用
3. サンプル 28 曲を投入（`SEED_ON_START=true`）
4. Next.js 開発サーバーを起動

→ http://localhost:3000

停止と後片付け:

```bash
docker compose down
```

```bash
docker compose down -v
```

（`-v` を付けると DB のデータも削除されます）

### B. ローカルの Node で起動する

PostgreSQL を用意し、`.env` の `DATABASE_URL` を自分の環境に合わせてから:

```bash
npm install
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

### 本番相当で動かす

```bash
docker compose -f docker-compose.prod.yml up --build
```

`.env` で `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` を上書きできます。本番で使う場合は必ずパスワードを変更してください。

## 推薦ロジック

`src/lib/recommend.ts` が 3 つのスコアを重み付き合成します（既定の重み: テンポ 0.45 / キー 0.40 / エナジー 0.15）。

### テンポ（`src/lib/bpm.ts`）

倍率 1x / 2x / 0.5x のそれぞれで、現在の曲に合わせるのに必要なピッチ調整量を計算し、最良のものを採用します。

- ピッチ差 1% 以内 → 100 点
- 許容幅（既定 ±8%）に近づくほど減点し、超えると 0 点
- ハーフ / ダブルタイムを使った場合は 0.85 倍

### キー（`src/lib/camelot.ts`）

Camelot Wheel 上の関係で判定します。

| 関係 | 例（8A から） | スコア |
|---|---|---|
| 完全一致 | 8A | 100 |
| エナジーアップ (+1) | 9A | 95 |
| エナジーダウン (−1) | 7A | 93 |
| 平行調 (A↔B) | 8B | 90 |
| エナジーブースト (+2) | 10A | 72 |
| ダイアゴナル (+1 転調) | 9B | 66 |
| ダイアゴナル (−1 転調) | 7B | 62 |
| それ以外 | — | 0 |

### エナジー

次曲のエナジーは「維持 〜 +1」が理想。そこから離れるほど減点します。

## API

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/tracks` | 一覧。`?q=` で検索、`?genre=` で絞り込み |
| `POST` | `/api/tracks` | 楽曲登録 |
| `GET` | `/api/tracks/:id` | 1 曲取得 |
| `PATCH` | `/api/tracks/:id` | 更新 |
| `DELETE` | `/api/tracks/:id` | 削除 |
| `GET` | `/api/tracks/:id/recommendations` | 次曲推薦 |

推薦 API のクエリ:

| パラメータ | 既定値 | 説明 |
|---|---|---|
| `limit` | 10 | 件数（1–50） |
| `maxPitchPercent` | 8 | 許容ピッチ幅 % |
| `allowHalfDouble` | true | ハーフ / ダブルタイムを許可 |
| `keyCompatibleOnly` | false | キー適合する曲のみ |
| `minScore` | 30 | 下限スコア |
| `genre` | — | ジャンル絞り込み |
| `excludeIds` | — | 除外する ID（カンマ区切り） |
| `weightBpm` / `weightKey` / `weightEnergy` | — | 重みの上書き（0–1） |

例:

```bash
curl "http://localhost:3000/api/tracks/<id>/recommendations?limit=5&keyCompatibleOnly=true"
```

## ディレクトリ構成

```
prisma/
  schema.prisma          Track モデル
  migrations/            初期マイグレーション
  seed.ts                サンプル 28 曲
src/
  app/
    page.tsx             ライブラリ（一覧・検索・統計）
    tracks/new/          楽曲登録
    tracks/[id]/         楽曲詳細＋次曲推薦
    tracks/[id]/edit/    編集
    setlist/             セットリストビルダー
    camelot/             Camelot ホイール
    api/tracks/          REST API
  components/            UI コンポーネント
  hooks/                 推薦取得フック
  lib/
    camelot.ts           Camelot Wheel ロジック
    bpm.ts               テンポ適合
    recommend.ts         推薦エンジン（純粋関数）
    validation.ts        zod スキーマ
    prisma.ts            Prisma クライアント
docker/
  migrate.sh             起動時のスキーマ適用 / シード
```

## 補足

- `src/generated/prisma` は `prisma generate` で生成されます（Git 管理外）。初回は `npm install` の postinstall で自動生成されます。
- 日本語を含むパス（`デスクトップ`、`DJアプリ`）に置いたまま Docker のバインドマウントを使うと、環境によっては認識されないことがあります。その場合はプロジェクトを `C:\dev\dj-app` のような ASCII のパスに移動してください。
- 推薦は候補全件を走査する実装です。数千曲規模までは問題ありませんが、それ以上になる場合は BPM 帯での事前絞り込みを入れてください。
