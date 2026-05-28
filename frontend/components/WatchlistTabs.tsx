"use client";

import {
  type IndicatorVisibility,
  type WatchlistItem,
} from "@/lib/api";

type Props = {
  items: WatchlistItem[];
  isLoading: boolean;
  error: unknown;
  currentTicker: string | null;
  onPickTicker: (ticker: string) => void;
  period: "daily" | "weekly" | "monthly";
  onPickPeriod: (p: "daily" | "weekly" | "monthly") => void;
  visibility: IndicatorVisibility;
  onToggleVisibility: (key: keyof IndicatorVisibility) => void;
};

const PERIODS: { key: "daily" | "weekly" | "monthly"; label: string }[] = [
  { key: "daily", label: "日 K" },
  { key: "weekly", label: "週 K" },
  { key: "monthly", label: "月 K" },
];

const INDICATORS: {
  key: keyof IndicatorVisibility;
  label: string;
  color: string;
}[] = [
  { key: "ma5", label: "MA5", color: "#F472B6" },
  { key: "ma10", label: "MA10", color: "#FBBF24" },
  { key: "ma20", label: "MA20", color: "#A78BFA" },
  { key: "boll", label: "BOLL", color: "#94A3B8" },
];

export function WatchlistTabs({
  items,
  isLoading,
  error,
  currentTicker,
  onPickTicker,
  period,
  onPickPeriod,
  visibility,
  onToggleVisibility,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {isLoading && <span className="text-(--color-text-3) text-sm">載入觀測股…</span>}
        {!!error && <span className="text-(--color-up) text-sm">觀測股載入失敗</span>}
        {!isLoading && items.length === 0 && (
          <span className="text-(--color-text-3) text-sm">今天還沒有被提及的股票</span>
        )}
        {items.map((w) => {
          const active = w.ticker === currentTicker;
          return (
            <button
              key={w.ticker}
              onClick={() => onPickTicker(w.ticker)}
              title={w.last_view ?? undefined}
              className={[
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                active
                  ? "bg-(--color-accent)/15 border-(--color-accent) text-(--color-accent)"
                  : "bg-(--color-card) border-(--color-border) text-(--color-text-1) hover:border-(--color-text-3)",
              ].join(" ")}
            >
              <span className="font-mono">{w.ticker}</span>
              {w.name && <span className="ml-1 text-(--color-text-2)">{w.name}</span>}
              <span className="ml-2 text-xs text-(--color-text-3)">×{w.mention_count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit rounded-md border border-(--color-border) bg-(--color-card) p-0.5">
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                onClick={() => onPickPeriod(p.key)}
                className={[
                  "px-3 py-1 rounded text-xs transition-colors",
                  active
                    ? "bg-(--color-accent) text-black font-medium"
                    : "text-(--color-text-2) hover:text-(--color-text-1)",
                ].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-(--color-border)" aria-hidden />

        <div className="flex flex-wrap items-center gap-2">
          {INDICATORS.map((ind) => {
            const on = visibility[ind.key];
            return (
              <label
                key={ind.key}
                className={[
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer select-none border transition-colors",
                  on
                    ? "border-(--color-border) bg-(--color-card)"
                    : "border-transparent bg-transparent text-(--color-text-3) hover:text-(--color-text-2)",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggleVisibility(ind.key)}
                  className="accent-(--color-accent) w-3 h-3"
                />
                <span
                  className="font-mono"
                  style={{ color: on ? ind.color : undefined }}
                >
                  {ind.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
