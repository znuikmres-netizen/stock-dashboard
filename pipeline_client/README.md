# dashboard_client — 推資料到 Dashboard

把你既有的 pipeline（yt-laojian、yt-alansays、podcast-jhaohua、daily-digest…）產出的結構化摘要，多送一份到 Dashboard 後端，前端就會即時出現新卡片。

**不改你原本推 Telegram 的行為。**

---

## 安裝

最簡單的方式：把 `dashboard_client.py` 複製到目標 pipeline 的根目錄（跟 `main.py` 同層）。

```bash
cp ~/Downloads/claude\ test/stock-dashboard/pipeline_client/dashboard_client.py ~/yt-laojian/
```

唯一相依：`requests`，每條 pipeline 通常都有了。如果沒有：

```bash
~/yt-laojian/.venv/bin/pip install requests
```

---

## 設定環境變數

在 pipeline 的 launchd plist 或 shell wrapper 加兩條：

```xml
<key>EnvironmentVariables</key>
<dict>
  <!-- 你既有的 TELEGRAM_BOT_TOKEN 等 ... -->
  <key>DASHBOARD_URL</key>
  <string>https://your-backend.up.railway.app</string>
  <key>DASHBOARD_KEY</key>
  <string>同 Railway INGEST_API_KEY 的值</string>
</dict>
```

或在 `run_xxx.sh` 加：

```bash
export DASHBOARD_URL="https://your-backend.up.railway.app"
export DASHBOARD_KEY="..."
```

---

## 在 pipeline 內呼叫

`push_summary()` 失敗只 log warning，**不會 raise**，所以 Telegram 推送流程不會被擋。

最少版本（接到既有摘要的尾端）：

```python
# 既有 pipeline：影片摘要 → 推 Telegram
from dashboard_client import push_summary

def main():
    video = fetch_latest_video()
    summary = gemini_summarize(video)        # 你既有的步驟，回 JSON
    send_telegram(format_message(summary))   # 既有推送

    # ↓ 新增 2 行：同步推進 Dashboard
    push_summary(
        source="老簡",                         # 或 "艾綸說" / "股癌" / "daily-digest" / ...
        source_type="youtube",                # youtube / podcast / digest
        title=video.title,
        url=video.url,
        published_at=video.published_at,      # datetime 或 ISO 8601 字串
        market_view=summary.get("market_view"),
        bullets=summary.get("bullets", []),
        stocks=summary.get("stocks", []),     # [{"ticker":"2330","name":"台積電","view":"...","sentiment":"bullish"}]
        raw=summary,                          # 原始 JSON 留底
    )
```

### `stocks` 每筆格式

```python
{
    "ticker": "2330",        # 必填
    "name": "台積電",         # 可選但建議填
    "view": "站上季線",       # 對該股票的看法摘要
    "sentiment": "bullish",  # "bullish" | "bearish" | "neutral"，可省略
}
```

---

## 驗證

部署後本機跑一次 pipeline，然後：

1. 後端：`curl https://your-backend.up.railway.app/api/messages?limit=3` 應該看到新訊息
2. 前端：開 Vercel 網址，60 秒內（SWR refresh 間隔）右側時間軸出現新卡片
3. 失敗：看 pipeline log，會有 `dashboard_client: ingest ...` 的 warning

---

## 去重邏輯

Backend 依 `(source, url)` 去重，同一支影片重推不會建第二筆，回應 `{"id": ..., "created": false}`。所以即使 pipeline 重複觸發也安全。
