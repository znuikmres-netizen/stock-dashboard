# 🍫🍰 Stock Watch Dashboard

把 Telegram 頻道「財富自由起源地」的 AI 摘要 + 台股 K 線觀測串成一個視覺化網頁。

```
本機 Python pipeline (yt-laojian / podcast-jhaohua / ...)
         │  POST /api/ingest (帶 X-API-Key)
         ▼
   ┌──────────────────────────────┐
   │  Railway: FastAPI + Postgres │  (後端 + DB)
   └──────────┬───────────────────┘
              │ REST
              ▼
   ┌──────────────────────────────┐
   │  Vercel: Next.js 16          │  (前端 dashboard)
   └──────────────────────────────┘
```

---

## 專案結構

```
stock-dashboard/
├── backend/             FastAPI + SQLAlchemy + Postgres → 部署到 Railway
├── frontend/            Next.js 16 + Tailwind + Lightweight Charts → 部署到 Vercel
├── pipeline_client/     dashboard_client.py 給本機 pipeline import
└── README.md            （這份）
```

---

## 本機開發

### Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env       # 填上 INGEST_API_KEY、FINMIND_TOKEN
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8765
```

### Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE=http://127.0.0.1:8765
npm run dev -- --port 3001
```

⚠️ **務必用 `http://localhost:3001` 開**，Next 16 dev server 預設擋掉 `127.0.0.1` 的跨來源資源。

---

## 部署到 Railway（後端 + Postgres）

> 一次性設定，之後 push code 到 GitHub 就自動 redeploy。

### 1. 把 code 推上 GitHub
在 `stock-dashboard/` 根目錄：

```bash
cd stock-dashboard
git init
git add .
git commit -m "init stock dashboard"
git branch -M main
git remote add origin https://github.com/<你的帳號>/stock-dashboard.git
git push -u origin main
```

### 2. 在 Railway 開新 project
1. https://railway.app → **New Project → Deploy from GitHub repo** → 選剛剛的 repo
2. Railway 會偵測到 `backend/railway.json` 跟 `requirements.txt`，自動 build
3. **設定 Root Directory**：Settings → Build → Root Directory 填 `backend`（這樣 Railway 才會用 backend 子目錄）

### 3. 加 Postgres
- 在同一個 project：**+ New → Database → Add PostgreSQL**
- Postgres 服務會自動把 `DATABASE_URL` 注入到 backend service 的環境變數

### 4. 設定後端環境變數
Backend service → Variables → 加：

| Key | Value |
|---|---|
| `INGEST_API_KEY` | 一段長隨機字串（例 `openssl rand -hex 32` 產生） |
| `FINMIND_TOKEN` | 從 https://finmindtrade.com 申請的免費 token |
| `CORS_ORIGINS` | 先填 `*`，等前端部署完換成 Vercel 網址 |

`DATABASE_URL` 由 Postgres plugin 自動提供，**不要手動加**。

### 5. 取得後端網址
Settings → Networking → **Generate Domain**，會給你一個 `xxxxx.up.railway.app`。

驗證：`curl https://xxxxx.up.railway.app/health` → `{"status":"ok"}`

---

## 部署到 Vercel（前端）

### 1. 在 Vercel 開新 project
1. https://vercel.com → **Add New → Project → Import GitHub repo** → 選同一個 repo
2. **Root Directory** 改成 `frontend`
3. Framework Preset 應該自動偵測為 Next.js

### 2. 設定前端環境變數
Project Settings → Environment Variables：

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://xxxxx.up.railway.app`（剛剛的 Railway 網址） |

### 3. Deploy
按 Deploy，等 1–2 分鐘。完成後拿到 `your-app.vercel.app`。

### 4. 回 Railway 鎖 CORS
回到 Railway backend service → Variables，把 `CORS_ORIGINS` 從 `*` 改成你的 Vercel 網址：

```
CORS_ORIGINS=https://your-app.vercel.app
```

Backend 會 redeploy。完成後從 Vercel URL 開瀏覽器，前後端就通了。

---

## 把現有 pipeline 接進來

詳見 [`pipeline_client/README.md`](pipeline_client/README.md)。要做的事：

1. 複製 `pipeline_client/dashboard_client.py` 到目標 pipeline 資料夾
2. 在 pipeline 的 launchd plist 或 wrapper 加 `DASHBOARD_URL` + `DASHBOARD_KEY` 環境變數
3. 在 pipeline 程式碼最後一行加 `push_summary(...)`

建議從 **yt-laojian** 開始試接（每週六 22:00 才跑，週末可以對著 log 慢慢驗證）。

---

## 驗證部署成功

跑一次 pipeline 後：

```bash
# 1. 確認資料進到 backend
curl https://xxxxx.up.railway.app/api/messages?limit=5

# 2. 確認 watchlist 聚合到該支股票
curl 'https://xxxxx.up.railway.app/api/watchlist?days=7&min_mentions=1'

# 3. 開 Vercel 網址，60 秒內時間軸出現新卡片
open https://your-app.vercel.app
```

---

## 成本估算

| 服務 | 月費 |
|---|---|
| Railway（FastAPI + Postgres + 流量） | ~$5–10 |
| Vercel（Hobby 方案） | 免費 |
| FinMind | 免費版夠用（個人觀測） |
| **合計** | **約 $5–10/月** |

Railway 免費額度（$5 信用額度）通常剛好夠跑這個用量。

---

## 常見問題

**Q: 部署後前端打不到後端？**
A: 99% 是 CORS。檢查 Railway `CORS_ORIGINS` 是否填了 Vercel 完整網址（含 `https://`）。

**Q: K 線拉不到資料？**
A: 看 Railway logs。FinMind 免費版有額度，匿名模式（沒填 token）更嚴。填 token 應該就 OK。

**Q: pipeline 推了但前端沒出現？**
A: 看 pipeline log 有沒有 `dashboard_client: ingest ...` warning。最常見是 `DASHBOARD_URL` / `DASHBOARD_KEY` 沒設。

**Q: Railway 一直 build 失敗？**
A: 確認 Settings → Root Directory 設成 `backend`，否則 Railway 會在 repo 根找 `requirements.txt` 找不到。
