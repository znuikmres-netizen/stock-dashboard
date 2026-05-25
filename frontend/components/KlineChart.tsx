"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import useSWR from "swr";
import {
  API_BASE,
  fetcher,
  type KlineResponse,
  type IndicatorVisibility,
} from "@/lib/api";

type Props = {
  ticker: string | null;
  period: "daily" | "weekly" | "monthly";
  visibility: IndicatorVisibility;
};

type Tooltip = {
  dateLabel: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  pct: number; // 漲跌幅 vs 前一根 close
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  bollUpper: number | null;
  bollMid: number | null;
  bollLower: number | null;
  k: number | null;
  d: number | null;
  dif: number | null;
  dea: number | null;
  macd: number | null;
};

const MA_COLORS = {
  ma5: "#F472B6",  // 粉紅
  ma10: "#FBBF24", // 黃
  ma20: "#A78BFA", // 紫
  ma60: "#06B6D4", // 青（保留但前端不畫）
} as const;

const BOLL_COLOR = "#94A3B8"; // 灰藍

function fmtDate(ts: number, period: string): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (period === "monthly") return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}

function fmtVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + " 億";
  if (v >= 1e4) return (v / 1e4).toFixed(1) + " 萬";
  return v.toFixed(0);
}

export function KlineChart({ ticker, period, visibility }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma5Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma10Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bollUpRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bollLowRef = useRef<ISeriesApi<"Line"> | null>(null);
  const kSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const difSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const deaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // 把目前資料 + 時間索引塞 ref，crosshair 才能在 closure 外查得到
  const dataRef = useRef<KlineResponse | null>(null);
  const idxRef = useRef<Map<number, number>>(new Map());
  const pinnedRef = useRef(false);

  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [pinned, setPinned] = useState(false);

  const url = ticker
    ? `${API_BASE}/api/kline/${encodeURIComponent(ticker)}?period=${period}`
    : null;
  const { data, error, isLoading } = useSWR<KlineResponse>(url, fetcher, {
    refreshInterval: 5 * 60_000,
  });

  // build chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "#151A23" },
        textColor: "#9CA3AF",
        fontFamily: "ui-sans-serif, system-ui",
        panes: { separatorColor: "#1F2630", separatorHoverColor: "#2A3340" },
      },
      grid: {
        vertLines: { color: "#1F2630" },
        horzLines: { color: "#1F2630" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#9CA3AF", style: LineStyle.Dashed, labelBackgroundColor: "#1F2630" },
        horzLine: { color: "#9CA3AF", style: LineStyle.Dashed, labelBackgroundColor: "#1F2630" },
      },
      rightPriceScale: { borderColor: "#1F2630" },
      timeScale: {
        borderColor: "#1F2630",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 0,
        minBarSpacing: 0.5,
        barSpacing: 8,
      },
    });

    // pane 0: candles + volume overlay（右側不顯示最新值標籤）
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#FF4D4F",
      downColor: "#22C55E",
      borderUpColor: "#FF4D4F",
      borderDownColor: "#22C55E",
      wickUpColor: "#FF4D4F",
      wickDownColor: "#22C55E",
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#1F2630",
      priceLineVisible: false,
      lastValueVisible: false,
    }, 0);
    volume.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
    });

    // pane 0: MA5/MA10/MA20 + Bollinger（疊在 K 線上，無 title 標籤）
    const ma5 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma5,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);
    const ma10 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma10,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);
    const ma20 = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);
    const bollUp = chart.addSeries(LineSeries, {
      color: BOLL_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);
    const bollMid = chart.addSeries(LineSeries, {
      color: BOLL_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);
    const bollLow = chart.addSeries(LineSeries, {
      color: BOLL_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }, 0);

    // pane 1: KD（無標籤）
    const kSeries = chart.addSeries(LineSeries, {
      color: "#F5A524",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);
    const dSeries = chart.addSeries(LineSeries, {
      color: "#60A5FA",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);

    // pane 2: MACD（無標籤）
    const difSeries = chart.addSeries(LineSeries, {
      color: "#F5A524",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 2);
    const deaSeries = chart.addSeries(LineSeries, {
      color: "#60A5FA",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    }, 2);
    const macdHist = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    }, 2);

    // pane heights: candles 2x, KD 1x, MACD 1x
    try {
      chart.panes()[0]?.setStretchFactor(2);
      chart.panes()[1]?.setStretchFactor(1);
      chart.panes()[2]?.setStretchFactor(1);
    } catch (_e) {
      // older versions may not support; ignore
    }

    const buildTooltip = (t: number): Tooltip | null => {
      if (!dataRef.current) return null;
      const idx = idxRef.current.get(t);
      if (idx == null) return null;
      const d = dataRef.current;
      const bar = d.data[idx];
      const prev = idx > 0 ? d.data[idx - 1] : null;
      const pct = prev && prev.c ? ((bar.c - prev.c) / prev.c) * 100 : 0;
      const kd = d.indicators.kd[idx];
      const m = d.indicators.macd[idx];
      const ma5 = d.indicators.ma5?.[idx];
      const ma10 = d.indicators.ma10?.[idx];
      const ma20 = d.indicators.ma20?.[idx];
      const boll = d.indicators.boll?.[idx];
      return {
        dateLabel: fmtDate(bar.t, d.period),
        o: bar.o,
        h: bar.h,
        l: bar.l,
        c: bar.c,
        v: bar.v,
        pct,
        ma5: ma5?.ma ?? null,
        ma10: ma10?.ma ?? null,
        ma20: ma20?.ma ?? null,
        bollUpper: boll?.upper ?? null,
        bollMid: boll?.mid ?? null,
        bollLower: boll?.lower ?? null,
        k: kd?.k ?? null,
        d: kd?.d ?? null,
        dif: m?.dif ?? null,
        dea: m?.dea ?? null,
        macd: m?.macd ?? null,
      };
    };

    const handleCrosshair = (param: MouseEventParams) => {
      if (pinnedRef.current) return; // 釘住時，hover 不更新
      const t = param.time as unknown as number | undefined;
      if (!t || !param.point) {
        setTooltip(null);
        return;
      }
      setTooltip(buildTooltip(t));
    };

    const handleClick = (param: MouseEventParams) => {
      const t = param.time as unknown as number | undefined;
      if (!t) return;
      const tip = buildTooltip(t);
      if (!tip) return;
      // 已釘住同一根 → 取消釘；否則釘到新位置
      if (pinnedRef.current && tooltip?.dateLabel === tip.dateLabel) {
        pinnedRef.current = false;
        setPinned(false);
      } else {
        pinnedRef.current = true;
        setPinned(true);
        setTooltip(tip);
      }
    };

    chart.subscribeCrosshairMove(handleCrosshair);
    chart.subscribeClick(handleClick);

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    ma5Ref.current = ma5;
    ma10Ref.current = ma10;
    ma20Ref.current = ma20;
    bollUpRef.current = bollUp;
    bollMidRef.current = bollMid;
    bollLowRef.current = bollLow;
    kSeriesRef.current = kSeries;
    dSeriesRef.current = dSeries;
    difSeriesRef.current = difSeries;
    deaSeriesRef.current = deaSeries;
    macdHistRef.current = macdHist;

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      chart.unsubscribeClick(handleClick);
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // 切股票或週期時，自動取消釘住
  useEffect(() => {
    pinnedRef.current = false;
    setPinned(false);
    setTooltip(null);
  }, [ticker, period]);

  // 指標 visibility 切換
  useEffect(() => {
    ma5Ref.current?.applyOptions({ visible: visibility.ma5 });
    ma10Ref.current?.applyOptions({ visible: visibility.ma10 });
    ma20Ref.current?.applyOptions({ visible: visibility.ma20 });
    bollUpRef.current?.applyOptions({ visible: visibility.boll });
    bollMidRef.current?.applyOptions({ visible: visibility.boll });
    bollLowRef.current?.applyOptions({ visible: visibility.boll });
  }, [visibility]);

  // push data
  useEffect(() => {
    if (!data || !candleRef.current || !volumeRef.current) return;

    const idx = new Map<number, number>();
    data.data.forEach((p, i) => idx.set(p.t, i));
    idxRef.current = idx;
    dataRef.current = data;

    candleRef.current.setData(
      data.data.map((p) => ({
        time: p.t as Time,
        open: p.o,
        high: p.h,
        low: p.l,
        close: p.c,
      }))
    );
    volumeRef.current.setData(
      data.data.map((p) => ({
        time: p.t as Time,
        value: p.v,
        color: p.c >= p.o ? "rgba(255,77,79,0.45)" : "rgba(34,197,94,0.45)",
      }))
    );

    const maToLine = (arr: { t: number; ma: number | null }[] | undefined) =>
      (arr ?? [])
        .filter((p) => p.ma != null)
        .map((p) => ({ time: p.t as Time, value: p.ma! }));
    ma5Ref.current?.setData(maToLine(data.indicators.ma5));
    ma10Ref.current?.setData(maToLine(data.indicators.ma10));
    ma20Ref.current?.setData(maToLine(data.indicators.ma20));

    const bollPicker = (key: "upper" | "mid" | "lower") =>
      (data.indicators.boll ?? [])
        .filter((p) => p[key] != null)
        .map((p) => ({ time: p.t as Time, value: p[key]! }));
    bollUpRef.current?.setData(bollPicker("upper"));
    bollMidRef.current?.setData(bollPicker("mid"));
    bollLowRef.current?.setData(bollPicker("lower"));

    kSeriesRef.current?.setData(
      data.indicators.kd
        .filter((p) => p.k != null)
        .map((p) => ({ time: p.t as Time, value: p.k! }))
    );
    dSeriesRef.current?.setData(
      data.indicators.kd
        .filter((p) => p.d != null)
        .map((p) => ({ time: p.t as Time, value: p.d! }))
    );

    difSeriesRef.current?.setData(
      data.indicators.macd
        .filter((p) => p.dif != null)
        .map((p) => ({ time: p.t as Time, value: p.dif! }))
    );
    deaSeriesRef.current?.setData(
      data.indicators.macd
        .filter((p) => p.dea != null)
        .map((p) => ({ time: p.t as Time, value: p.dea! }))
    );
    macdHistRef.current?.setData(
      data.indicators.macd
        .filter((p) => p.macd != null)
        .map((p) => ({
          time: p.t as Time,
          value: p.macd!,
          color: p.macd! >= 0 ? "rgba(255,77,79,0.6)" : "rgba(34,197,94,0.6)",
        }))
    );

    // 預設顯示「最近一段」而不是全部 → candle 比較粗，看得清楚
    // 使用者可以再用滾輪 / 拖拉縮放，但有 fixLeftEdge/fixRightEdge 擋著不會越界
    const total = data.data.length;
    if (total > 0) {
      const defaultVisible =
        data.period === "monthly"
          ? Math.min(total, 24)
          : data.period === "weekly"
          ? Math.min(total, 40)
          : Math.min(total, 90); // daily: 約 4 個月
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: total - defaultVisible,
        to: total - 1,
      });
    }
  }, [data]);

  const sourceTag = useMemo(() => (data ? `資料來源：${data.source}` : ""), [data]);

  return (
    <div className="relative h-[640px] w-full rounded-md border border-(--color-border) overflow-hidden">
      {!ticker && (
        <div className="absolute inset-0 grid place-items-center text-(--color-text-3) text-sm z-10">
          請從上方挑一支股票
        </div>
      )}
      {ticker && isLoading && (
        <div className="absolute inset-0 grid place-items-center text-(--color-text-3) text-sm z-10">
          載入 {ticker} 中…
        </div>
      )}
      {ticker && error && (
        <div className="absolute inset-0 grid place-items-center text-(--color-up) text-sm z-10">
          {ticker} K 線載入失敗
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />

      {data && (
        <div className="absolute right-2 top-2 text-[11px] text-(--color-text-3) bg-(--color-card)/80 px-2 py-0.5 rounded">
          {sourceTag}
        </div>
      )}

      {tooltip && (
        <div
          className={[
            "absolute left-2 top-2 z-20 text-[11px] leading-relaxed bg-(--color-bg)/90 rounded-md px-2.5 py-2 min-w-[200px] backdrop-blur-sm",
            pinned
              ? "border border-(--color-accent) shadow-[0_0_0_1px_var(--color-accent)]"
              : "border border-(--color-border)",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-(--color-text-1) font-mono flex items-center gap-1.5">
              {pinned && <span className="text-(--color-accent) text-[10px]">📌</span>}
              {tooltip.dateLabel}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={
                  tooltip.pct >= 0 ? "text-(--color-up)" : "text-(--color-down)"
                }
              >
                {tooltip.pct >= 0 ? "+" : ""}
                {tooltip.pct.toFixed(2)}%
              </span>
              {pinned && (
                <button
                  onClick={() => {
                    pinnedRef.current = false;
                    setPinned(false);
                    setTooltip(null);
                  }}
                  className="text-(--color-text-3) hover:text-(--color-text-1) leading-none"
                  title="取消釘住"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 text-(--color-text-2)">
            <span>開 <span className="text-(--color-text-1) font-mono">{tooltip.o}</span></span>
            <span>高 <span className="text-(--color-text-1) font-mono">{tooltip.h}</span></span>
            <span>低 <span className="text-(--color-text-1) font-mono">{tooltip.l}</span></span>
            <span>收 <span className="text-(--color-text-1) font-mono">{tooltip.c}</span></span>
          </div>
          <div className="mt-1 text-(--color-text-2)">
            量 <span className="text-(--color-text-1) font-mono">{fmtVol(tooltip.v)}</span>
          </div>
          {(visibility.ma5 || visibility.ma10 || visibility.ma20) && (
            <div className="mt-1.5 pt-1.5 border-t border-(--color-border) grid grid-cols-3 gap-x-2 text-(--color-text-2)">
              {visibility.ma5 && (
                <span>
                  MA5{" "}
                  <span className="font-mono" style={{ color: MA_COLORS.ma5 }}>
                    {tooltip.ma5?.toFixed(2) ?? "—"}
                  </span>
                </span>
              )}
              {visibility.ma10 && (
                <span>
                  MA10{" "}
                  <span className="font-mono" style={{ color: MA_COLORS.ma10 }}>
                    {tooltip.ma10?.toFixed(2) ?? "—"}
                  </span>
                </span>
              )}
              {visibility.ma20 && (
                <span>
                  MA20{" "}
                  <span className="font-mono" style={{ color: MA_COLORS.ma20 }}>
                    {tooltip.ma20?.toFixed(2) ?? "—"}
                  </span>
                </span>
              )}
            </div>
          )}
          {visibility.boll && (
            <div className="mt-1 grid grid-cols-3 gap-x-2 text-(--color-text-2)">
              <span>
                BOLL上{" "}
                <span className="font-mono" style={{ color: BOLL_COLOR }}>
                  {tooltip.bollUpper?.toFixed(2) ?? "—"}
                </span>
              </span>
              <span>
                BOLL中{" "}
                <span className="font-mono" style={{ color: BOLL_COLOR }}>
                  {tooltip.bollMid?.toFixed(2) ?? "—"}
                </span>
              </span>
              <span>
                BOLL下{" "}
                <span className="font-mono" style={{ color: BOLL_COLOR }}>
                  {tooltip.bollLower?.toFixed(2) ?? "—"}
                </span>
              </span>
            </div>
          )}
          {(tooltip.k != null || tooltip.d != null) && (
            <div className="mt-1.5 pt-1.5 border-t border-(--color-border) grid grid-cols-2 gap-x-3 text-(--color-text-2)">
              <span>K <span className="text-(--color-accent) font-mono">{tooltip.k?.toFixed(2) ?? "—"}</span></span>
              <span>D <span className="text-[#60A5FA] font-mono">{tooltip.d?.toFixed(2) ?? "—"}</span></span>
            </div>
          )}
          {(tooltip.dif != null || tooltip.dea != null || tooltip.macd != null) && (
            <div className="mt-1 grid grid-cols-3 gap-x-2 text-(--color-text-2)">
              <span>DIF <span className="text-(--color-accent) font-mono">{tooltip.dif?.toFixed(3) ?? "—"}</span></span>
              <span>DEA <span className="text-[#60A5FA] font-mono">{tooltip.dea?.toFixed(3) ?? "—"}</span></span>
              <span>
                MACD{" "}
                <span
                  className={
                    (tooltip.macd ?? 0) >= 0 ? "text-(--color-up) font-mono" : "text-(--color-down) font-mono"
                  }
                >
                  {tooltip.macd?.toFixed(3) ?? "—"}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
