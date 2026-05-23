# XDigest

X（Twitter）上のフォロー対象ユーザーの発言を自動収集し、AI による構造化サマリーを生成するパーソナルツールです。毎朝 08:30 にダイジェストメールを受信できるほか、収集した発言内容に対してチャット形式で深掘り質問することも可能です。

## 機能

- 追跡する X ユーザーの追加・削除・メモ管理
- 期間指定（今日 / 今週 / 今月）によるツイート収集
- AI による構造化サマリーの自動生成
  - 主要トピックと重要な見解
  - 注目すべき情報
  - 強気・弱気銘柄リスト（理由付き）
- 収集内容に対するストリーミング AI チャット
- 毎朝 08:30（Asia/Shanghai）に購読ユーザーのダイジェストをメール配信
- ユーザーごとのメール購読オン/オフ切り替え

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React + Vite + Tailwind CSS + Zustand |
| バックエンド | FastAPI + Python 3.11 |
| データ収集 | twikit（X 非公式クライアント） |
| AI | OpenRouter API（デフォルト: `openrouter/auto`） |
| スケジューラー | APScheduler（asyncio モード） |
| メール送信 | Gmail SMTP（SSL） |

## 必要環境

- Python 3.11 以上
- Node.js 18 以上
- X アカウント（ログイン用）
- OpenRouter API キー
- Gmail アカウント（ダイジェストメール送信用、アプリパスワードが必要）

## セットアップ

### バックエンド

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# .env を編集して必要な環境変数を設定
```

### フロントエンド

```bash
cd frontend
npm install
```

## 環境変数

**`backend/.env`**

```env
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/auto        # 任意の OpenRouter モデルスラッグに変更可能

# Gmail ダイジェスト配信（Google アカウントのアプリパスワードが必要）
GMAIL_USER=your_address@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
DIGEST_TO=recipient@gmail.com
```

> **Gmail アプリパスワードの取得方法**
> Google アカウント → セキュリティ → 2 段階認証 → アプリパスワード → 生成

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:8000
```

## 起動

**バックエンド**（ポート 8000）

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**フロントエンド**（ポート 5173）

```bash
cd frontend
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

## 使い方

1. 左下の「⚙ X アカウントログイン」をクリックし、X の認証情報を入力してログイン（Cookie はローカルに保存）
2. サイドバーの入力欄に追跡したい X ユーザー名を入力して追加
3. ✎ アイコンでユーザーにメモを追加（区別しやすくするため）
4. ✉ アイコンでユーザーごとのダイジェスト購読をオン/オフ
5. ユーザーを選択し、期間（今日 / 今週 / 今月）を選んで「発言を取得」をクリック
6. AI サマリーを確認し、チャット欄から内容について深掘り質問

## プロジェクト構成

```
├── backend/
│   ├── main.py              # FastAPI ルート・スケジューラー
│   ├── scraper.py           # X データ収集（twikit）
│   ├── ai.py                # OpenRouter AI 呼び出し
│   ├── emailer.py           # ダイジェストメール生成・送信
│   ├── twikit_patches.py    # twikit 2.3.x 互換性パッチ
│   └── tests/               # バックエンドユニットテスト
└── frontend/
    └── src/
        ├── store.js          # Zustand グローバルステート
        └── components/       # React コンポーネント
```

## 開発

```bash
# バックエンドテストの実行
cd backend && pytest

# フロントエンド Lint
cd frontend && npm run lint
```
