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
