"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import { useStore } from "@/lib/store";
import type { CalendarDayEvent, ScheduleEvent } from "@/types";
import { TimeScaleSelector, type TimeScale } from "@/components/ui/TimeScaleSelector";
import { InsightButton } from "@/components/ui/InsightButton";
import { useTimeScale } from "@/hooks/useTimeScale";
import { autoDownsample } from "@/lib/downsample";

/* ─── Telemetry ticker ─── */
const TICKER_ITEMS = [
  "SYS.INTEGRITY:OK", "PROTOCOL.ACTIVE:7", "RETATRUTIDE:ACTIVE",
  "TESAMORELIN:ACTIVE", "SEMAX:QUEUED", "VIT.D:TRACKING",
  "LDL:MONITOR", "IRON:SUPPLEMENTING", "BF%:TRENDING.DOWN",
  "WEIGHT:TRENDING.DOWN", "MAGI.CONSENSUS:UNANIMOUS",
];

export default function Dashboard() {
  const goals = useStore((s) => s.goals);
  const supplements = useStore((s) => s.supplements);
  const workouts = useStore((s) => s.workouts);
  const checklist = useStore((s) => s.checklist);
  const toggleChecklistItem = useStore((s) => s.toggleChecklist);
  const scheduleEvents = useStore((s) => s.scheduleEvents);

  // Build week schedule reactively from store
  const weekSchedule = useMemo(() => {
    function localDateStr(d: Date) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const days: { date: Date; dateStr: string; events: CalendarDayEvent[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = localDateStr(d);
      const dow = d.getDay();

      // Find specific-date overrides for this day
      const specificEvents = scheduleEvents.filter((ev) => ev.specific_date === dateStr);
      const specificTitles = new Set(specificEvents.map((ev) => ev.title));

      // Find recurring template events for this day of week, excluding overridden ones
      const templateEvents = scheduleEvents.filter((ev) => {
        if (ev.specific_date) return false;
        if (!ev.day_of_week?.includes(dow)) return false;
        // If there's a specific override with the same title, skip the template
        if (specificTitles.has(ev.title)) return false;
        return true;
      });

      const combined = [...specificEvents, ...templateEvents]
        .map((ev) => ({ ...ev, resolved_date: dateStr }))
        .sort((a, b) => {
          const at = a.start_time.replace(":", "");
          const bt = b.start_time.replace(":", "");
          if (at !== bt) return at.localeCompare(bt);
          return a.sort_order - b.sort_order;
        });

      days.push({ date: d, dateStr, events: combined });
    }
    return days;
  }, [scheduleEvents]);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Time-scale aware data
  const { scale, setScale, data, loading, scaleLabel, customRange, setCustomRange } = useTimeScale("7D");
  const weighIns = data.weighIns;
  const healthMetrics = data.healthMetrics;

  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  function toggleChecklist(key: string) {
    toggleChecklistItem(key);
  }

  const latest = weighIns[weighIns.length - 1];
  const prev = weighIns[weighIns.length - 2];
  const weekHealth = healthMetrics.slice(-7);
  const avgHR = weekHealth.length
    ? Math.round(weekHealth.reduce((a, b) => a + b.resting_hr, 0) / weekHealth.length)
    : 0;
  const avgHRV = weekHealth.length
    ? Math.round(weekHealth.reduce((a, b) => a + b.hrv, 0) / weekHealth.length)
    : 0;
  const avgSleep = weekHealth.length
    ? (weekHealth.reduce((a, b) => a + b.sleep_hours, 0) / weekHealth.length).toFixed(1)
    : "0";
  const todayHealth = weekHealth[weekHealth.length - 1];
  const todaySteps = todayHealth?.steps ?? 0;
  const activeEnergy = todayHealth?.active_energy ?? 0;

  const rawWeightData = weighIns.map((w) => ({
    date: w.date,
    weight: w.weight,
  }));
  const chartData = autoDownsample(rawWeightData, ["weight"]).map((d) => ({
    ...d,
    dateLabel: d.date.slice(scale === "ALL" || scale === "1Y" ? 0 : 5),
  }));

  const completedChecks = checklist.filter((c) => c.completed).length;
  const todayWorkout = workouts.find(
    (w) => w.date === new Date().toISOString().split("T")[0],
  );
  const activeProtocols = supplements.filter((s) => s.active).length;

  const now = new Date();
  const timeStr = mounted ? format(now, "HH:mm:ss") : "--:--:--";
  const dateStr = mounted
    ? format(now, "EEEE, MMMM d, yyyy").toUpperCase()
    : "";

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3 relative">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[8px] font-bold tracking-[0.25em] text-text-dim mb-0.5">
            {dateStr}
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            COMMAND CENTER
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // MAGI INTERFACE
            </span>
          </h1>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[7px] tracking-[0.25em] text-text-dim">
            LOCAL.TIME
          </div>
          <div
            className="text-xl font-bold tabular-nums eva-text"
            style={{ letterSpacing: "0.05em" }}
          >
            {timeStr}
          </div>
          <div className="text-[7px] tracking-[0.15em] text-neon/40 mt-0.5">
            FRAME {mounted ? String(tick).padStart(6, "0") : "000000"}
          </div>
        </div>
      </div>

      {/* ═══ TICKER ═══ */}
      <div className="telemetry-scroll h-5 flex items-center border-y border-eva/10 bg-eva/[0.02]">
        <span className="text-[8px] font-bold tracking-[0.15em] text-eva/40 whitespace-nowrap">
          {TICKER_ITEMS.map((item, i) => (
            <span key={i}>
              <span className="text-eva/20 mx-3">◆</span>
              <span className={i % 3 === 0 ? "text-neon/40" : "text-eva/40"}>
                {item}
              </span>
            </span>
          ))}
          {TICKER_ITEMS.map((item, i) => (
            <span key={`dup-${i}`}>
              <span className="text-eva/20 mx-3">◆</span>
              <span className={i % 3 === 0 ? "text-neon/40" : "text-eva/40"}>
                {item}
              </span>
            </span>
          ))}
        </span>
      </div>

      {/* ═══ WEEKLY CALENDAR ═══ */}
      <WeeklyCalendar days={weekSchedule} />

      {/* ═══ VITAL READOUTS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <VitalPanel
          code="V-01"
          label="MASS"
          value={`${latest?.weight ?? "---"}`}
          unit="LBS"
          delta={
            latest && prev
              ? +(latest.weight - prev.weight).toFixed(1)
              : null
          }
          color="neon"
        />
        <VitalPanel
          code="V-02"
          label="REST.HR"
          value={`${avgHR}`}
          unit="BPM"
          delta={null}
          color="cyan"
          sub={`${todayHealth?.resting_hr ?? "--"} TODAY`}
        />
        <VitalPanel
          code="V-03"
          label="HRV"
          value={`${avgHRV}`}
          unit="MS"
          delta={null}
          color="eva"
          sub={`${todayHealth?.hrv ?? "--"} TODAY`}
        />
        <VitalPanel
          code="V-04"
          label="SLEEP"
          value={avgSleep}
          unit="HRS"
          delta={null}
          color="neon"
          sub={`${todayHealth?.sleep_hours ?? "--"} LAST`}
        />
      </div>

      {/* ═══ TELEMETRY + PROTOCOL ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Weight chart */}
        <div className="lg:col-span-8 hud-panel p-3 corner-brackets min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="eva-label text-[8px]">▎ TELEMETRY — MASS</div>
            </div>
            <div className="flex items-center gap-2">
              <InsightButton
                metric="weight"
                data={chartData}
                timeScale={scaleLabel}
                context="Goal: 185 lbs"
              />
              <div className="flex items-baseline gap-1">
                <span className="data-readout text-xl">
                  {latest?.weight ?? "---"}
                </span>
                <span className="text-[8px] text-text-dim">LBS</span>
                <span className="text-[8px] text-text-dim mx-1">|</span>
                <span className="text-[8px] text-eva/60">TGT 185</span>
              </div>
            </div>
          </div>
          <div className="mb-3">
            <TimeScaleSelector
              active={scale}
              onChange={(s) => setScale(s as TimeScale)}
              loading={loading}
              customRange={customRange}
              onCustomRange={setCustomRange}
            />
          </div>
          <div className="h-40 md:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="neonGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#39FF14" stopOpacity={0.2} />
                    <stop
                      offset="100%"
                      stopColor="#39FF14"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dateLabel"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#333",
                    fontSize: 8,
                    fontFamily: "Monument Mono",
                  }}
                  interval={Math.max(0, Math.floor(chartData.length / 10))}
                />
                <YAxis
                  domain={["dataMin - 2", "dataMax + 2"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#333",
                    fontSize: 8,
                    fontFamily: "Monument Mono",
                  }}
                  width={35}
                />
                <ReferenceLine
                  y={185}
                  stroke="#FF6A0030"
                  strokeDasharray="3 3"
                />
                <Tooltip
                  contentStyle={{
                    background: "#0A0A0A",
                    border: "1px solid #FF6A0030",
                    borderRadius: "0px",
                    fontFamily: "Monument Mono",
                    fontSize: "10px",
                    color: "#39FF14",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#39FF14"
                  strokeWidth={1.5}
                  fill="url(#neonGrad)"
                  dot={false}
                  activeDot={{
                    r: 3,
                    fill: "#39FF14",
                    stroke: "#39FF14",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <div className="text-[7px] tracking-wider text-text-dim">
              Δ{scaleLabel}:{" "}
              <span className="text-neon/70">
                {chartData.length >= 2
                  ? (
                      chartData[chartData.length - 1].weight -
                      chartData[0].weight
                    ).toFixed(1)
                  : "--"}
              </span>{" "}
              LBS
            </div>
            <div className="text-[7px] tracking-wider text-text-dim">
              TO.TARGET:{" "}
              <span className="text-eva/70">
                {latest ? (latest.weight - 185).toFixed(1) : "--"}
              </span>{" "}
              LBS
            </div>
            <div className="text-[7px] tracking-wider text-text-dim">
              POINTS: <span className="text-cyan/70">{chartData.length}</span>
            </div>
          </div>
        </div>

        {/* Morning Protocol */}
        <div className="lg:col-span-4 hud-panel-eva p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="eva-label text-[8px]">▎ MORNING PROTOCOL</div>
            <div className="data-readout text-lg">
              {completedChecks}
              <span className="text-text-dim text-[10px]">
                /{checklist.length}
              </span>
            </div>
          </div>
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(completedChecks / checklist.length) * 100}%`,
                background:
                  completedChecks === checklist.length
                    ? "#39FF14"
                    : "linear-gradient(90deg, #FF6A00, #FF8C00)",
                boxShadow: `0 0 10px ${completedChecks === checklist.length ? "#39FF1440" : "#FF6A0040"}`,
              }}
            />
          </div>
          <div className="space-y-1">
            {checklist.map((item, idx) => (
              <button
                key={item.key}
                onClick={() => toggleChecklist(item.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 transition-all duration-100 text-left border-l-2 ${
                  item.completed
                    ? "border-neon/60 bg-neon/[0.04]"
                    : "border-transparent hover:border-eva/30 hover:bg-eva/[0.03]"
                }`}
              >
                <div
                  className={`w-3 h-3 flex items-center justify-center shrink-0 transition-all text-[8px] font-black ${
                    item.completed ? "text-neon" : "text-text-dim"
                  }`}
                >
                  {item.completed ? "■" : "□"}
                </div>
                <span className="text-[8px] font-bold tracking-wider text-text-dim mr-1">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-[9px] font-bold tracking-[0.1em] ${
                    item.completed ? "text-neon/70" : "text-text"
                  }`}
                >
                  {item.label}
                </span>
                {item.completed && (
                  <span className="ml-auto text-[7px] text-neon/40 tracking-wider">
                    DONE
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM ROW ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Today's Mission */}
        <div className="hud-panel p-3 corner-brackets">
          <div className="flex items-center justify-between mb-2">
            <div className="eva-label text-[8px]">▎ TODAY&apos;S MISSION</div>
            {todayWorkout && (
              <div className="text-[7px] tracking-wider text-cyan/50">
                {todayWorkout.duration_minutes}MIN
              </div>
            )}
          </div>
          {todayWorkout ? (
            <>
              <div className="text-sm font-black text-text-bright mb-0.5">
                {todayWorkout.name}
              </div>
              <div className="text-[8px] text-text-dim tracking-wider mb-2">
                {todayWorkout.exercises.length} EXERCISES · TYPE:
                {todayWorkout.type.toUpperCase()}
              </div>
              <div className="space-y-px">
                {todayWorkout.exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-2 py-1.5 bg-surface/80 border-l border-border hover:border-eva/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] text-text-dim tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] text-text font-bold tracking-wider">
                        {ex.name}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold tabular-nums cyan-text">
                      {ex.sets}×{ex.reps}
                      {ex.weight && (
                        <span className="text-text-dim ml-1">
                          @{ex.weight}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 py-4">
              <div className="status-dot bg-cyan" />
              <span className="text-[9px] text-cyan/60 tracking-wider">
                REST DAY — RECOVERY ACTIVE
              </span>
            </div>
          )}
        </div>

        {/* Objectives Status */}
        <div className="hud-panel p-3 corner-brackets">
          <div className="flex items-center justify-between mb-2">
            <div className="eva-label text-[8px]">▎ OBJECTIVE STATUS</div>
            <div className="text-[7px] tracking-wider text-text-dim">
              {goals.filter((g) => g.trend === "improving").length}
              <span className="text-neon/50">▲</span>{" "}
              {goals.filter((g) => g.trend === "declining").length}
              <span className="text-danger/50">▼</span>
            </div>
          </div>
          <div className="space-y-2">
            {goals.slice(0, 6).map((g) => {
              const pct =
                g.direction === "down"
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((210 - g.current) / (210 - g.target)) * 100,
                      ),
                    )
                  : Math.min(
                      100,
                      Math.max(0, (g.current / g.target) * 100),
                    );
              const barColor =
                g.trend === "improving"
                  ? "#39FF14"
                  : g.trend === "declining"
                    ? "#FF1A1A"
                    : "#FF6A00";
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[7px] ${
                          g.trend === "improving"
                            ? "text-neon/50"
                            : g.trend === "declining"
                              ? "text-danger/50"
                              : "text-eva/50"
                        }`}
                      >
                        {g.trend === "improving"
                          ? "▲"
                          : g.trend === "declining"
                            ? "▼"
                            : "◆"}
                      </span>
                      <span className="text-[9px] text-text font-bold tracking-wider">
                        {g.name}
                      </span>
                    </div>
                    <span className="text-[8px] text-text-dim tabular-nums">
                      {g.current}
                      <span className="text-text-dim/50 mx-0.5">→</span>
                      {g.target}
                    </span>
                  </div>
                  <div className="h-1 bg-surface-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: barColor,
                        boxShadow: `0 0 6px ${barColor}40`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity + Protocols */}
        <div className="hud-panel p-3 corner-brackets">
          <div className="eva-label text-[8px] mb-2">▎ ACTIVITY FEED</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <DataBlock
              code="A-01"
              label="STEPS"
              value={todaySteps.toLocaleString()}
              pct={Math.min(100, (todaySteps / 10000) * 100)}
              color="#00D0FF"
            />
            <DataBlock
              code="A-02"
              label="ACTIVE.CAL"
              value={String(activeEnergy)}
              pct={Math.min(100, (activeEnergy / 600) * 100)}
              color="#FF6A00"
            />
          </div>
          <div className="h-px bg-border mb-3" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-[8px] tracking-wider text-text-dim">
              ACTIVE PROTOCOLS
            </div>
            <div className="data-readout text-lg">{activeProtocols}</div>
          </div>
          <div className="space-y-1">
            {supplements
              .filter((s) => s.active)
              .slice(0, 4)
              .map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="status-dot bg-neon" />
                    <span className="text-[8px] font-bold tracking-wider text-text">
                      {s.name}
                    </span>
                  </div>
                  <span className="text-[7px] tracking-wider text-text-dim uppercase">
                    {s.route}
                  </span>
                </div>
              ))}
            {activeProtocols > 4 && (
              <div className="text-[7px] text-eva/40 tracking-wider">
                +{activeProtocols - 4} MORE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="flex items-center justify-between py-2 px-1 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="status-dot bg-neon" />
          <span className="text-[7px] tracking-[0.2em] text-neon/50">
            ALL SYSTEMS NOMINAL
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[7px] tracking-wider text-text-dim">
            MAGI.CONSENSUS:{" "}
            <span className="text-eva/60">UNANIMOUS</span>
          </span>
          <span className="text-[7px] tracking-wider text-text-dim">
            NERV.SEC: <span className="text-neon/50">CLEAR</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function VitalPanel({
  code,
  label,
  value,
  unit,
  delta,
  color,
  sub,
}: {
  code: string;
  label: string;
  value: string;
  unit: string;
  delta: number | null;
  color: "neon" | "cyan" | "eva";
  sub?: string;
}) {
  const textClass =
    color === "neon"
      ? "neon-text"
      : color === "cyan"
        ? "cyan-text"
        : "eva-text";
  const borderColor =
    color === "neon"
      ? "border-neon/15"
      : color === "cyan"
        ? "border-cyan/15"
        : "border-eva/15";

  return (
    <div
      className={`hud-panel p-2.5 md:p-3 border ${borderColor} corner-brackets`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="eva-label text-[7px]">{label}</span>
        <span className="text-[7px] text-text-dim tabular-nums">{code}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-xl md:text-2xl font-black tabular-nums ${textClass}`}
          style={{ letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        <span className="text-[8px] text-text-dim">{unit}</span>
      </div>
      {delta !== null && (
        <div
          className={`text-[8px] mt-0.5 font-bold ${
            delta < 0
              ? "text-neon/60"
              : delta > 0
                ? "text-warning/60"
                : "text-text-dim"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {delta} FROM PREV
        </div>
      )}
      {sub && delta === null && (
        <div className="text-[8px] mt-0.5 text-text-dim">{sub}</div>
      )}
    </div>
  );
}

function DataBlock({
  code,
  label,
  value,
  pct,
  color,
}: {
  code: string;
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[7px] tracking-wider text-text-dim">
          {label}
        </span>
        <span className="text-[6px] tabular-nums text-text-dim">{code}</span>
      </div>
      <div
        className="text-lg font-black tabular-nums"
        style={{ color, textShadow: `0 0 10px ${color}40` }}
      >
        {value}
      </div>
      <div className="h-1 bg-surface-2 overflow-hidden mt-1">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 8px ${color}30`,
          }}
        />
      </div>
    </div>
  );
}
