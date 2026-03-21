"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";
import { TimeScaleSelector, type TimeScale } from "@/components/ui/TimeScaleSelector";
import { InsightButton } from "@/components/ui/InsightButton";
import { useTimeScale } from "@/hooks/useTimeScale";
import { autoDownsample } from "@/lib/downsample";
import type { HealthMetrics } from "@/types";

/* ─── Chart config ─── */
interface MetricChart {
  key: string;
  label: string;
  code: string;
  field: keyof HealthMetrics;
  color: string;
  unit: string;
  refLine?: { y: number; label: string };
  domainPad?: number;
  /** Use weighIns instead of healthMetrics */
  useWeighIns?: boolean;
}

const METRICS: MetricChart[] = [
  {
    key: "weight",
    label: "BODY MASS",
    code: "T-01",
    field: "steps", // placeholder — uses weighIns
    color: "#39FF14",
    unit: "LBS",
    refLine: { y: 185, label: "GOAL 185" },
    domainPad: 5,
    useWeighIns: true,
  },
  {
    key: "resting_hr",
    label: "RESTING HEART RATE",
    code: "T-02",
    field: "resting_hr",
    color: "#00D0FF",
    unit: "BPM",
    domainPad: 5,
  },
  {
    key: "hrv",
    label: "HEART RATE VARIABILITY",
    code: "T-03",
    field: "hrv",
    color: "#FF6A00",
    unit: "MS",
    domainPad: 10,
  },
  {
    key: "sleep_hours",
    label: "SLEEP DURATION",
    code: "T-04",
    field: "sleep_hours",
    color: "#6B21A8",
    unit: "HRS",
    domainPad: 1,
  },
  {
    key: "steps",
    label: "DAILY STEPS",
    code: "T-05",
    field: "steps",
    color: "#00D0FF",
    unit: "STEPS",
    domainPad: 1000,
  },
  {
    key: "vo2_max",
    label: "VO2 MAX",
    code: "T-06",
    field: "vo2_max",
    color: "#FF6A00",
    unit: "ML/KG/MIN",
    domainPad: 2,
  },
];

const HEALTH_NUMERIC_KEYS: (keyof HealthMetrics)[] = [
  "resting_hr", "hrv", "sleep_hours", "steps", "active_energy",
  "vo2_max", "respiratory_rate", "blood_oxygen", "exercise_minutes",
  "distance_mi", "flights_climbed", "basal_energy",
];

const AXIS_STYLE = {
  fill: "#333", fontSize: 8, fontFamily: "Monument Mono",
};

export default function TrendsPage() {
  const {
    scale, setScale, data, loading, scaleLabel,
    customRange, setCustomRange,
  } = useTimeScale("1Y");

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            TREND ANALYSIS
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // HISTORICAL DATA
            </span>
          </h1>
        </div>
      </div>

      {/* Global time scale */}
      <div className="flex items-center justify-between">
        <TimeScaleSelector
          active={scale}
          onChange={(s) => setScale(s as TimeScale)}
          loading={loading}
          customRange={customRange}
          onCustomRange={setCustomRange}
        />
        <div className="text-[7px] tracking-wider text-text-dim">
          WINDOW: <span className="text-eva/60">{scaleLabel}</span>
        </div>
      </div>

      {/* Metric charts */}
      {METRICS.map((m) => {
        const isWeight = m.useWeighIns;
        const rawData = isWeight
          ? data.weighIns.map((w) => ({ date: w.date, value: w.weight }))
          : data.healthMetrics
              .filter((h) => h[m.field] != null && h[m.field] !== 0)
              .map((h) => ({ date: h.date, value: h[m.field] as number }));

        // Downsample if needed
        const chartData = autoDownsample(
          rawData as (typeof rawData[0] & { date: string })[],
          ["value"] as (keyof (typeof rawData)[0])[],
        ).map((d) => ({
          ...d,
          dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
        }));

        const latest = chartData[chartData.length - 1]?.value;
        const first = chartData[0]?.value;
        const delta = latest && first ? +(latest - first).toFixed(1) : null;

        return (
          <div key={m.key} className="hud-panel p-3 corner-brackets">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="eva-label text-[8px]">▎ {m.label}</div>
                <div className="text-[7px] tracking-wider text-text-dim">{m.code}</div>
              </div>
              <div className="flex items-center gap-3">
                <InsightButton
                  metric={m.key}
                  data={chartData}
                  timeScale={scaleLabel}
                  context={m.refLine ? `Goal: ${m.refLine.label}` : undefined}
                />
                <div className="flex items-baseline gap-1">
                  <span className="data-readout text-lg">{latest ?? "---"}</span>
                  <span className="text-[8px] text-text-dim">{m.unit}</span>
                  {delta !== null && (
                    <>
                      <span className="text-[8px] text-text-dim mx-1">|</span>
                      <span
                        className={`text-[8px] font-bold ${
                          delta < 0 ? "text-neon/60" : delta > 0 ? "text-warning/60" : "text-text-dim"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="h-44 md:h-52">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={m.color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="dateLabel"
                      axisLine={false}
                      tickLine={false}
                      tick={AXIS_STYLE}
                      interval={Math.max(0, Math.floor(chartData.length / 12))}
                    />
                    <YAxis
                      domain={[
                        (min: number) => Math.floor(min - (m.domainPad || 2)),
                        (max: number) => Math.ceil(max + (m.domainPad || 2)),
                      ]}
                      axisLine={false}
                      tickLine={false}
                      tick={AXIS_STYLE}
                      width={45}
                    />
                    {m.refLine && (
                      <ReferenceLine
                        y={m.refLine.y}
                        stroke={`${m.color}30`}
                        strokeDasharray="3 3"
                        label={{
                          value: m.refLine.label,
                          position: "right",
                          fill: `${m.color}60`,
                          fontSize: 8,
                        }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        background: "#0A0A0A",
                        border: `1px solid ${m.color}30`,
                        borderRadius: "0px",
                        fontFamily: "Monument Mono",
                        fontSize: "10px",
                        color: m.color,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={m.color}
                      strokeWidth={1.5}
                      fill={`url(#grad-${m.key})`}
                      dot={false}
                      connectNulls
                      activeDot={{ r: 3, fill: m.color, strokeWidth: 2 }}
                      animationDuration={chartData.length > 200 ? 0 : 800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
                  NO DATA FOR SELECTED RANGE
                </div>
              )}
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <div className="text-[7px] tracking-wider text-text-dim">
                POINTS: <span className="text-eva/60">{chartData.length}</span>
              </div>
              <div className="text-[7px] tracking-wider text-text-dim">
                RANGE: <span className="text-text/50">{chartData[0]?.date || "--"}</span>
                <span className="text-text-dim/30 mx-1">→</span>
                <span className="text-text/50">{chartData[chartData.length - 1]?.date || "--"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
