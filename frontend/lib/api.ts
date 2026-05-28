export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8765";

export type Stock = {
  ticker: string;
  name: string | null;
  view: string | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
};

export type Message = {
  id: number;
  source: string;
  source_type: string;
  title: string | null;
  url: string | null;
  published_at: string;
  market_view: string | null;
  bullets: string[];
  stocks: Stock[];
};

export type WatchlistItem = {
  ticker: string;
  name: string | null;
  mention_count: number;
  last_mention_at: string;
  last_view: string | null;
};

export type KlinePoint = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type KDPoint = {
  t: number;
  k: number | null;
  d: number | null;
};

export type MACDPoint = {
  t: number;
  dif: number | null;
  dea: number | null;
  macd: number | null;
};

export type MAPoint = {
  t: number;
  ma: number | null;
};

export type BollingerPoint = {
  t: number;
  upper: number | null;
  mid: number | null;
  lower: number | null;
};

export type KlineResponse = {
  ticker: string;
  period: "daily" | "weekly" | "monthly";
  source: "finmind" | "yfinance" | "cache";
  fetched_at: string;
  data: KlinePoint[];
  indicators: {
    kd: KDPoint[];
    macd: MACDPoint[];
    ma5: MAPoint[];
    ma10: MAPoint[];
    ma20: MAPoint[];
    ma60: MAPoint[];
    boll: BollingerPoint[];
  };
};

export type IndicatorVisibility = {
  ma5: boolean;
  ma10: boolean;
  ma20: boolean;
  boll: boolean;
};

export const DEFAULT_INDICATORS: IndicatorVisibility = {
  ma5: true,
  ma10: true,
  ma20: true,
  boll: false,
};

export const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

export function taipeiDayKey(ts: string | number | Date) {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
}

// 從訊息列表抓出指定台北日期當天被提到的股票，彙整成觀測清單格式。
// messages 已依 published_at 由新到舊排序，所以每檔第一次出現即為最新提及。
export function todayStocksFromMessages(
  messages: Message[] | undefined,
  dayKey: string
): WatchlistItem[] {
  if (!messages) return [];
  const map = new Map<string, WatchlistItem>();
  for (const m of messages) {
    if (taipeiDayKey(m.published_at) !== dayKey) continue;
    for (const s of m.stocks) {
      const hit = map.get(s.ticker);
      if (hit) {
        hit.mention_count += 1;
      } else {
        map.set(s.ticker, {
          ticker: s.ticker,
          name: s.name,
          mention_count: 1,
          last_mention_at: m.published_at,
          last_view: s.view,
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.mention_count - a.mention_count ||
      +new Date(b.last_mention_at) - +new Date(a.last_mention_at)
  );
}
