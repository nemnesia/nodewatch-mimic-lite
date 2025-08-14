# NodeWatch Mimic Lite

<img src="./public/icon.png" alt="NodeWatch Mimic Lite ロゴ" width="320" />

NodeWatchを模倣した、最小構成のNode.jsアプリです。  
対応しているエンドポイントは以下の通りです。

- `/api/symbol/height`
- `/api/symbol/nodes/peer`

## 現在提供中

### メインネット

- https://nwmimic.nemnesia.com/api/symbol/height
- https://nwmimic.nemnesia.com/api/symbol/nodes/peer

### テストネット

- https://nwmimic.nemnesia.com/testnet/api/symbol/height
- https://nwmimic.nemnesia.com/testnet/api/symbol/nodes/peer

## shoestringから利用する場合

コンフィグファイル（例: shoestring.ini）の `[services]` セクションに設定します。

```ini
[services]

nodewatch = https://nwmimic.nemnesia.com
```

## サーバーのインストール方法

### 必要要件

- Node.js 22.x
- Yarn 4.x

### セットアップ

```bash
yarn install
# または
npm install
```

環境変数を設定します。

```bash
cp .env.mainnet .env
```

#### クローラー

cronで定期的（例：10分ごと）に`scripts/crawler.sh`が実行されるように設定してください。

```bash
crontab -e
```

```cron
*/10 * * * * /usr/bin/sh /path/to/nodewatch-mimic-lite/scripts/crawler.sh
```

voltaなどを使用している場合は、環境変数の設定が必要です。

```cron
*/10 * * * * PATH=$HOME/.volta/bin:$PATH /usr/bin/sh /path/to/nodewatch-mimic-lite/scripts/crawler.sh
```

初回はデータが存在しないため、クローラーを手動で起動しておくことをおすすめします。

```bash
scripts/crawler.sh
```

### 起動方法

```bash
yarn start:web
# または
npm run start:web
```

デフォルトでは `http://localhost:3000` で起動します。

### 停止方法

```bash
yarn stop:web
# または
npm run stop:web
```

### 起動確認

```bash
yarn status:web
# または
npm run status:web
```

##

## ライセンス

Apache-2.0 license
