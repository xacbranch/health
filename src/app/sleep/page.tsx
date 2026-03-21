"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine, Legend,
} from "recharts";
import { TimeScaleSelector, type TimeScale } from "@/components/ui/TimeScaleSelector";
import { InsightButton } from "@/components/ui/InsightButton";
import { useTimeScale } from "@/hooks/useTimeScale";
import { autoDownsample } from "@/lib/downsample";
import type { SleepSession } from "@/types";

/* ─── Colors ─── */
const STAGE_COLORS = {
  deep: "#6B21A8",
  core: "#4338CA",
  rem: "#00D0FF",
  awake: "#FF1A1A",
  asleep: "#4338CA",
  inBed: "#222222",
};

const AXIS_STYLE = { fill: "#333", fontSize: 8, fontFamily: "Monument Mono" };

/* ─── Aggregate sleep sessions into nightly summaries ─── */
interface NightSummary {
  date: string;
  totalSleep: number; // hours (deep+core+rem+asleep, excl inBed/awake)
  inBed: number;      // hours
  deep: number;       // hours
  core: number;
  rem: number;
  awake: number;
  asleep: number;     // unspecified asleep
  bedTime: string;    // HH:MM
  wakeTime: string;   // HH:MM
  efficiency: number; // % (totalSleep / inBed * 100)
}

function aggregateSleepByNight(sessions: SleepSession[]): NightSummary[] {
  const nights = new Map<string, SleepSession[]>();

  for (const s of sessions) {
    // Bucket by the date the person went to bed
    // If start is after 6PM, count it as that night; if before 6PM, count as previous night
    const start = new Date(s.start_date);
    const hour = start.getHours();
    const d = new Date(start);
    if (hour < 18) d.setDate(d.getDate() - 1); // early morning belongs to previous night
    const key = d.toISOString().slice(0, 10);

    if (!nights.has(key)) nights.set(key, []);
    nights.get(key)!.push(s);
  }

  const summaries: NightSummary[] = [];

  for (const [date, segs] of nights) {
    let deep = 0, core = 0, rem = 0, awake = 0, asleep = 0, inBed = 0;
    let earliestStart = Infinity;
    let latestEnd = -Infinity;

    for (const s of segs) {
      const startMs = new Date(s.start_date).getTime();
      const endMs = new Date(s.end_date).getTime();
      const hours = (endMs - startMs) / 3600000;
      if (hours <= 0 || hours > 24) continue; // skip bad data

      if (startMs < earliestStart) earliestStart = startMs;
      if (endMs > latestEnd) latestEnd = endMs;

      switch (s.stage) {
        case "deep": deep += hours; break;
        case "core": core += hours; break;
        case "rem": rem += hours; break;
        case "awake": awake += hours; break;
        case "asleep": asleep += hours; break;
        case "inBed": inBed += hours; break;
      }
    }

    const totalSleep = deep + core + rem + asleep;
    const totalInBed = inBed > 0 ? inBed : totalSleep + awake;
    const efficiency = totalInBed > 0 ? (totalSleep / totalInBed) * 100 : 0;

    const bedDate = earliestStart < Infinity ? new Date(earliestStart) : null;
    const wakeDate = latestEnd > -Infinity ? new Date(latestEnd) : null;

    summaries.push({
      date,
      totalSleep: +totalSleep.toFixed(2),
      inBed: +totalInBed.toFixed(2),
      deep: +deep.toFixed(2),
      core: +core.toFixed(2),
      rem: +rem.toFixed(2),
      awake: +awake.toFixed(2),
      asleep: +asleep.toFixed(2),
      bedTime: bedDate ? bedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
      wakeTime: wakeDate ? wakeDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--",
      efficiency: +efficiency.toFixed(1),
    });
  }

  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Format helpers ─── */
function fmtHrs(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function fmtPct(v: number): string {
  return `${Math.round(v)}%`;
}

/* ─── Page ─── */
export default function SleepPage() {
  const {
    scale, setScale, data, loading, scaleLabel,
    customRange, setCustomRange,
  } = useTimeScale("30D");

  const nights = useMemo(
    () => aggregateSleepByNight(data.sleepSessions),
    [data.sleepSessions],
  );

  const latest = nights[nights.length - 1];
  const hasData = nights.length > 0;

  // Duration chart data
  const durationData = useMemo(() => {
    const raw = nights.map((n) => ({ date: n.date, value: n.totalSleep }));
    return autoDownsample(raw, ["value"]).map((d) => ({
      ...d,
      dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
    }));
  }, [nights, scale]);

  // Stage breakdown chart data
  const stageData = useMemo(() => {
    const raw = nights.map((n) => ({
      date: n.date,
      deep: +(n.deep * 60).toFixed(0),
      core: +(n.core * 60).toFixed(0),
      rem: +(n.rem * 60).toFixed(0),
      awake: +(n.awake * 60).toFixed(0),
    }));
    // For large ranges, sample every Nth night
    if (raw.length > 90) {
      const step = Math.ceil(raw.length / 90);
      return raw.filter((_, i) => i % step === 0).map((d) => ({
        ...d,
        dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
      }));
    }
    return raw.map((d) => ({
      ...d,
      dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
    }));
  }, [nights, scale]);

  // Efficiency chart data
  const efficiencyData = useMemo(() => {
    const raw = nights
      .filter((n) => n.efficiency > 0 && n.efficiency <= 100)
      .map((n) => ({ date: n.date, value: n.efficiency }));
    return autoDownsample(raw, ["value"]).map((d) => ({
      ...d,
      dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
    }));
  }, [nights, scale]);

  // Averages
  const avgs = useMemo(() => {
    if (!nights.length) return null;
    const valid = nights.filter((n) => n.totalSleep > 0);
    if (!valid.length) return null;
    const sum = (fn: (n: NightSummary) => number) => valid.reduce((a, n) => a + fn(n), 0) / valid.length;
    const totalSleepMin = valid.reduce((a, n) => a + n.totalSleep, 0) / valid.length;
    const deepPct = totalSleepMin > 0 ? sum((n) => n.deep) / totalSleepMin * 100 : 0;
    const remPct = totalSleepMin > 0 ? sum((n) => n.rem) / totalSleepMin * 100 : 0;
    return {
      avgDuration: sum((n) => n.totalSleep),
      avgEfficiency: sum((n) => n.efficiency),
      avgDeepPct: deepPct,
      avgRemPct: remPct,
      nights: valid.length,
    };
  }, [nights]);

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            SLEEP ANALYSIS
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // RECOVERY DATA
            </span>
          </h1>
        </div>
      </div>

      {/* ═══ TIME SCALE ═══ */}
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
          {avgs && (
            <span className="ml-2">
              NIGHTS: <span className="text-eva/60">{avgs.nights}</span>
            </span>
          )}
        </div>
      </div>

      {/* ═══ TONIGHT'S SUMMARY ═══ */}
      {latest && (
        <div className="hud-panel p-3 corner-brackets border border-[#6B21A8]/20">
          <div className="flex items-center justify-between mb-3">
            <div className="eva-label text-[8px]">▎ LAST NIGHT — {latest.date}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tabular-nums" style={{ color: "#6B21A8", textShadow: "0 0 12px #6B21A840" }}>
                {fmtHrs(latest.totalSleep)}
              </span>
              <span className="text-[8px] text-text-dim">SLEEP</span>
            </div>
          </div>

          {/* Stage breakdown bar */}
          <div className="h-6 flex rounded-sm overflow-hidden mb-3">
            {latest.deep > 0 && (
              <div
                className="h-full relative group"
                style={{ width: `${(latest.deep / latest.inBed) * 100}%`, background: STAGE_COLORS.deep }}
                title={`Deep: ${fmtHrs(latest.deep)}`}
              />
            )}
            {latest.core > 0 && (
              <div
                className="h-full"
                style={{ width: `${(latest.core / latest.inBed) * 100}%`, background: STAGE_COLORS.core }}
                title={`Core: ${fmtHrs(latest.core)}`}
              />
            )}
            {(latest.asleep > 0 && latest.core === 0 && latest.deep === 0) && (
              <div
                className="h-full"
                style={{ width: `${(latest.asleep / latest.inBed) * 100}%`, background: STAGE_COLORS.asleep }}
                title={`Asleep: ${fmtHrs(latest.asleep)}`}
              />
            )}
            {latest.rem > 0 && (
              <div
                className="h-full"
                style={{ width: `${(latest.rem / latest.inBed) * 100}%`, background: STAGE_COLORS.rem }}
                title={`REM: ${fmtHrs(latest.rem)}`}
              />
            )}
            {latest.awake > 0 && (
              <div
                className="h-full"
                style={{ width: `${(latest.awake / latest.inBed) * 100}%`, background: STAGE_COLORS.awake }}
                title={`Awake: ${fmtHrs(latest.awake)}`}
              />
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <MiniStat label="IN BED" value={fmtHrs(latest.inBed)} />
            <MiniStat label="DEEP" value={fmtHrs(latest.deep)} color={STAGE_COLORS.deep} />
            <MiniStat label="CORE" value={fmtHrs(latest.core)} color={STAGE_COLORS.core} />
            <MiniStat label="REM" value={fmtHrs(latest.rem)} color={STAGE_COLORS.rem} />
            <MiniStat label="EFFICIENCY" value={fmtPct(latest.efficiency)} />
            <MiniStat label="BED / WAKE" value={`${latest.bedTime} / ${latest.wakeTime}`} />
          </div>
        </div>
      )}

      {/* ═══ SLEEP DURATION TREND ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ SLEEP DURATION</div>
            <div className="text-[7px] tracking-wider text-text-dim">S-01</div>
          </div>
          <div className="flex items-center gap-3">
            <InsightButton
              metric="sleep_duration"
              data={durationData}
              timeScale={scaleLabel}
              context="Goal: 7-8 hours. Tracks total sleep excluding awake and inBed time."
            />
            {durationData.length > 0 && (
              <div className="flex items-baseline gap-1">
                <span className="data-readout text-lg">
                  {durationData[durationData.length - 1]?.value.toFixed(1)}
                </span>
                <span className="text-[8px] text-text-dim">HRS</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-44 md:h-52">
          {durationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={durationData}>
                <defs>
                  <linearGradient id="grad-sleep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6B21A8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#6B21A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE}
                  interval={Math.max(0, Math.floor(durationData.length / 12))} />
                <YAxis domain={[0, 12]} axisLine={false} tickLine={false} tick={AXIS_STYLE} width={30} />
                <ReferenceLine y={7} stroke="#6B21A830" strokeDasharray="3 3"
                  label={{ value: "7H", position: "right", fill: "#6B21A860", fontSize: 8 }} />
                <ReferenceLine y={8} stroke="#6B21A830" strokeDasharray="3 3"
                  label={{ value: "8H", position: "right", fill: "#6B21A860", fontSize: 8 }} />
                <Tooltip contentStyle={{
                  background: "#0A0A0A", border: "1px solid #6B21A830",
                  borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#6B21A8",
                }} />
                <Area type="monotone" dataKey="value" stroke="#6B21A8" strokeWidth={1.5}
                  fill="url(#grad-sleep)" dot={false} connectNulls
                  activeDot={{ r: 3, fill: "#6B21A8", strokeWidth: 2 }}
                  animationDuration={durationData.length > 200 ? 0 : 800} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO SLEEP DATA FOR SELECTED RANGE
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
          <div className="text-[7px] tracking-wider text-text-dim">
            POINTS: <span className="text-eva/60">{durationData.length}</span>
          </div>
          {avgs && (
            <div className="text-[7px] tracking-wider text-text-dim">
              AVG: <span style={{ color: "#6B21A8" }}>{avgs.avgDuration.toFixed(1)}</span> HRS
            </div>
          )}
        </div>
      </div>

      {/* ═══ SLEEP STAGES BREAKDOWN ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ STAGE BREAKDOWN</div>
            <div className="text-[7px] tracking-wider text-text-dim">S-02</div>
          </div>
          <InsightButton
            metric="sleep_stages"
            data={stageData}
            timeScale={scaleLabel}
            context="Deep sleep is critical for physical recovery. REM for cognitive. Goal: 20%+ deep, 20%+ REM."
          />
        </div>

        <div className="h-44 md:h-52">
          {stageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE}
                  interval={Math.max(0, Math.floor(stageData.length / 12))} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} width={35}
                  label={{ value: "MIN", angle: -90, position: "insideLeft", fill: "#333", fontSize: 7 }} />
                <Tooltip
                  contentStyle={{
                    background: "#0A0A0A", border: "1px solid #6B21A830",
                    borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#ccc",
                  }}
                  formatter={(val, name) => [`${val} min`, String(name).toUpperCase()]}
                />
                <Bar dataKey="deep" stackId="sleep" fill={STAGE_COLORS.deep} />
                <Bar dataKey="core" stackId="sleep" fill={STAGE_COLORS.core} />
                <Bar dataKey="rem" stackId="sleep" fill={STAGE_COLORS.rem} />
                <Bar dataKey="awake" stackId="sleep" fill={STAGE_COLORS.awake} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO STAGE DATA FOR SELECTED RANGE
            </div>
          )}
        </div>

        {/* Stage legend */}
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
          <StageLegend color={STAGE_COLORS.deep} label="DEEP" />
          <StageLegend color={STAGE_COLORS.core} label="CORE" />
          <StageLegend color={STAGE_COLORS.rem} label="REM" />
          <StageLegend color={STAGE_COLORS.awake} label="AWAKE" />
        </div>
      </div>

      {/* ═══ SLEEP EFFICIENCY ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ SLEEP EFFICIENCY</div>
            <div className="text-[7px] tracking-wider text-text-dim">S-03</div>
          </div>
          <div className="flex items-center gap-3">
            <InsightButton
              metric="sleep_efficiency"
              data={efficiencyData}
              timeScale={scaleLabel}
              context="Sleep efficiency = time asleep / time in bed. 85%+ is good, 90%+ is excellent."
            />
            {avgs && (
              <div className="flex items-baseline gap-1">
                <span className="data-readout text-lg">{avgs.avgEfficiency.toFixed(0)}</span>
                <span className="text-[8px] text-text-dim">%</span>
              </div>
            )}
          </div>
        </div>

        <div className="h-40">
          {efficiencyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={efficiencyData}>
                <defs>
                  <linearGradient id="grad-eff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#39FF14" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#39FF14" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE}
                  interval={Math.max(0, Math.floor(efficiencyData.length / 12))} />
                <YAxis domain={[50, 100]} axisLine={false} tickLine={false} tick={AXIS_STYLE} width={30} />
                <ReferenceLine y={85} stroke="#39FF1430" strokeDasharray="3 3"
                  label={{ value: "85%", position: "right", fill: "#39FF1460", fontSize: 8 }} />
                <Tooltip contentStyle={{
                  background: "#0A0A0A", border: "1px solid #39FF1430",
                  borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#39FF14",
                }} formatter={(val) => [`${Number(val).toFixed(1)}%`, "EFFICIENCY"]} />
                <Area type="monotone" dataKey="value" stroke="#39FF14" strokeWidth={1.5}
                  fill="url(#grad-eff)" dot={false} connectNulls
                  activeDot={{ r: 3, fill: "#39FF14", strokeWidth: 2 }}
                  animationDuration={efficiencyData.length > 200 ? 0 : 800} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO EFFICIENCY DATA
            </div>
          )}
        </div>
      </div>

      {/* ═══ AVERAGES PANEL ═══ */}
      {avgs && (
        <div className="hud-panel p-3 corner-brackets">
          <div className="eva-label text-[8px] mb-3">▎ RANGE AVERAGES — {scaleLabel}</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <AvgStat label="AVG DURATION" value={fmtHrs(avgs.avgDuration)} />
            <AvgStat label="AVG EFFICIENCY" value={fmtPct(avgs.avgEfficiency)} />
            <AvgStat label="DEEP SHARE" value={fmtPct(avgs.avgDeepPct)} color={STAGE_COLORS.deep} />
            <AvgStat label="REM SHARE" value={fmtPct(avgs.avgRemPct)} color={STAGE_COLORS.rem} />
            <AvgStat label="TOTAL NIGHTS" value={String(avgs.nights)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[7px] tracking-[0.2em] text-text-dim mb-0.5">{label}</div>
      <div className="text-[11px] font-bold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}

function AvgStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[7px] tracking-[0.2em] text-text-dim mb-1">{label}</div>
      <div className="text-lg font-black tabular-nums" style={color ? { color, textShadow: `0 0 10px ${color}40` } : { color: "#6B21A8", textShadow: "0 0 10px #6B21A840" }}>
        {value}
      </div>
    </div>
  );
}

function StageLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
      <span className="text-[7px] tracking-wider text-text-dim">{label}</span>
    </div>
  );
}
