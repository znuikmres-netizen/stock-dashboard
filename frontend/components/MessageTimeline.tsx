"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { API_BASE, fetcher, type Message } from "@/lib/api";

type Props = {
  onPickTicker: (ticker: string) => void;
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("zh-TW", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Taipei",
  });
}

function sentimentColor(s: string | null) {
  if (s === "bullish") return "text-(--color-up)";
  if (s === "bearish") return "text-(--color-down)";
  return "text-(--color-text-2)";
}

export function MessageTimeline({ onPickTicker }: Props) {
  const { data, error, isLoading } = useSWR<Message[]>(
    `${API_BASE}/api/messages?limit=50`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const sources = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.map((m) => m.source)));
  }, [data]);

  const [filter, setFilter] = useState<string>("all");
  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "all" ? data : data.filter((m) => m.source === filter);
  }, [data, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-(--color-text-1) font-medium">AI 精華摘要</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-(--color-card) border border-(--color-border) rounded px-2 py-1 text-xs text-(--color-text-1)"
        >
          <option value="all">全部來源</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="thin-scroll overflow-y-auto pr-1 flex-1 min-h-0">
        {isLoading && <div className="text-(--color-text-3) text-sm">載入中…</div>}
        {error && <div className="text-(--color-up) text-sm">訊息載入失敗</div>}
        {filtered.length === 0 && !isLoading && (
          <div className="text-(--color-text-3) text-sm">尚無訊息，等 pipeline 推資料進來</div>
        )}

        <ul className="space-y-3">
          {filtered.map((m) => (
            <li
              key={m.id}
              className="border border-(--color-border) bg-(--color-card) rounded-lg p-3"
            >
              <div className="flex items-center justify-between text-xs text-(--color-text-3) mb-1.5">
                <span className="text-(--color-accent) font-medium">{m.source}</span>
                <span>{fmt(m.published_at)}</span>
              </div>
              {m.title && (
                <a
                  href={m.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-(--color-text-1) hover:underline block mb-1.5"
                >
                  {m.title}
                </a>
              )}
              {m.market_view && (
                <p className="text-sm text-(--color-text-2) mb-2 leading-relaxed">
                  {m.market_view}
                </p>
              )}
              {m.bullets?.length > 0 && (
                <ul className="text-xs text-(--color-text-2) space-y-1 mb-2 list-disc list-inside">
                  {m.bullets.slice(0, 4).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
              {m.stocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.stocks.map((s) => (
                    <button
                      key={s.ticker}
                      onClick={() => onPickTicker(s.ticker)}
                      title={s.view ?? undefined}
                      className="text-xs px-1.5 py-0.5 rounded bg-(--color-bg) border border-(--color-border) hover:border-(--color-accent)"
                    >
                      <span className="font-mono">{s.ticker}</span>
                      {s.name && (
                        <span className={`ml-1 ${sentimentColor(s.sentiment)}`}>
                          {s.name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
