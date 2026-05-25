"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { WatchlistTabs } from "@/components/WatchlistTabs";
import { KlineChart } from "@/components/KlineChart";
import { MessageTimeline } from "@/components/MessageTimeline";
import {
  API_BASE,
  DEFAULT_INDICATORS,
  fetcher,
  type IndicatorVisibility,
  type WatchlistItem,
} from "@/lib/api";

type Period = "daily" | "weekly" | "monthly";

const LS_TICKER = "stock-dashboard.ticker";
const LS_PERIOD = "stock-dashboard.period";
const LS_VIS = "stock-dashboard.indicators";

export default function Page() {
  const [ticker, setTicker] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("daily");
  const [visibility, setVisibility] = useState<IndicatorVisibility>(DEFAULT_INDICATORS);

  useEffect(() => {
    const t = localStorage.getItem(LS_TICKER);
    const p = localStorage.getItem(LS_PERIOD) as Period | null;
    if (t) setTicker(t);
    if (p === "daily" || p === "weekly" || p === "monthly") setPeriod(p);
    try {
      const v = localStorage.getItem(LS_VIS);
      if (v) {
        const parsed = JSON.parse(v) as Partial<IndicatorVisibility>;
        setVisibility({ ...DEFAULT_INDICATORS, ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (ticker) localStorage.setItem(LS_TICKER, ticker);
  }, [ticker]);
  useEffect(() => {
    localStorage.setItem(LS_PERIOD, period);
  }, [period]);
  useEffect(() => {
    localStorage.setItem(LS_VIS, JSON.stringify(visibility));
  }, [visibility]);

  const toggleVisibility = (key: keyof IndicatorVisibility) =>
    setVisibility((v) => ({ ...v, [key]: !v[key] }));

  const { data: watch } = useSWR<WatchlistItem[]>(
    `${API_BASE}/api/watchlist?days=14&min_mentions=1`,
    fetcher,
    { refreshInterval: 60_000 }
  );
  useEffect(() => {
    if (!ticker && watch && watch.length > 0) {
      setTicker(watch[0].ticker);
    }
  }, [ticker, watch]);

  return (
    <main className="min-h-screen px-4 sm:px-6 py-5">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold tracking-wide">
          <span className="text-(--color-accent)">🍫🍰</span>{" "}
          <span className="text-(--color-text-1)">Stock Watch</span>
          <span className="text-(--color-text-3) ml-2 text-sm font-normal">
            Tim&apos;s Dashboard
          </span>
        </h1>
        <div className="text-xs text-(--color-text-3)">
          {API_BASE.replace(/^https?:\/\//, "")}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-8 rounded-xl border border-(--color-border) bg-(--color-card) p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-(--color-text-1) font-medium">K 線觀測區</h2>
            {ticker && (
              <span className="text-xs text-(--color-text-3)">
                目前：<span className="font-mono text-(--color-text-1)">{ticker}</span>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <WatchlistTabs
              currentTicker={ticker}
              onPickTicker={setTicker}
              period={period}
              onPickPeriod={setPeriod}
              visibility={visibility}
              onToggleVisibility={toggleVisibility}
            />
            <KlineChart ticker={ticker} period={period} visibility={visibility} />
          </div>
        </section>

        <section className="lg:col-span-4 rounded-xl border border-(--color-border) bg-(--color-card) p-4 h-[calc(100vh-7rem)] min-h-[500px]">
          <MessageTimeline onPickTicker={setTicker} />
        </section>
      </div>
    </main>
  );
}
