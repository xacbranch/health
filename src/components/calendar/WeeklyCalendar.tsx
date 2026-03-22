"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDayEvent } from "@/types";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";

/* ─── Config ─── */
const WAKE_HOUR = 7;
const SLEEP_HOUR = 22.5;
const TOTAL_MINUTES = (SLEEP_HOUR - WAKE_HOUR) * 60;
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const CATEGORY_COLORS: Record<string, string> = {
  work: "#FF6A00",
  training: "#00D0FF",
  supplement: "#39FF14",
  meal: "#FFB800",
  routine: "#555555",
  sleep: "#6B21A8",
  health_check: "#00D0FF",
};

/* ─── Status colors ─── */
const STATUS_COLORS = {
  done: "#39FF14",    // green
  skipped: "#FFB800", // yellow
  missed: "#FF1A1A",  // red
  pending: null,      // use default category color
};

/* ─── Event ID to checklist key mapping ─── */
const EVENT_TO_KEY: Record<string, string> = {
  "se-iron": "iron",
  "se-hydrate": "hydrate_am",
  "se-semax": "semax",
  "se-dogwalk-am": "dogwalk_am",
  "se-weighin": "weighin",
  "se-d3k2": "d3k2",
  "se-hydrate-pm": "hydrate_pm",
  "se-preworkout": "preworkout",
  "se-gym": "gym",
  "se-tennis": "tennis",
  "se-dogwalk-pm": "dogwalk_pm",
};

interface ChecklistRow {
  key: string;
  completed: boolean;
  date: string;
}

interface DayData {
  date: Date;
  dateStr: string;
  events: CalendarDayEvent[];
}

function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WeeklyCalendar({ days }: { days: DayData[] }) {
  const [now, setNow] = useState(new Date());
  const [tooltip, setTooltip] = useState<{
    event: CalendarDayEvent;
    x: number;
    y: number;
    status?: string;
  } | null>(null);
  const calRef = useRef<HTMLDivElement>(null);
  const todayStr = localDate();

  // Fetch checklist data for the whole week
  const [checklistByDate, setChecklistByDate] = useState<Record<string, ChecklistRow[]>>({});

  useEffect(() => {
    async function fetchWeekChecklist() {
      if (days.length === 0) return;
      const sb = createClient();
      const dates = days.map((d) => localDate(d.date));
      const { data } = await sb
        .from("daily_checklist")
        .select("key, completed, date")
        .in("date", dates);
      if (!data) return;
      const grouped: Record<string, ChecklistRow[]> = {};
      for (const row of data) {
        if (!grouped[row.date]) grouped[row.date] = [];
        grouped[row.date].push(row);
      }
      setChecklistByDate(grouped);
    }
    fetchWeekChecklist();
  }, [days]);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPct = ((nowMinutes - WAKE_HOUR * 60) / TOTAL_MINUTES) * 100;
  const showNowLine = nowPct >= 0 && nowPct <= 100;

  function getEventStatus(ev: CalendarDayEvent, dayStr: string): string | null {
    const checkKey = EVENT_TO_KEY[ev.id];
    if (!checkKey) return null;
    const dayChecklist = checklistByDate[dayStr] || [];
    const row = dayChecklist.find((c) => c.key === checkKey);
    if (!row) {
      // Check if event is in the past
      const dayDate = new Date(dayStr + "T12:00:00");
      const isToday = dayStr === todayStr;
      const isPastDay = dayDate < new Date(todayStr + "T00:00:00");
      if (isPastDay) return "missed";
      if (isToday) {
        const [h, m] = ev.start_time.split(":").map(Number);
        const evMin = h * 60 + m;
        if (evMin < nowMinutes) return "missed";
      }
      return null; // pending/future
    }
    return row.completed ? "done" : "skipped";
  }

  function handleHover(ev: CalendarDayEvent, e: React.MouseEvent, status?: string) {
    const rect = calRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ event: ev, x: e.clientX - rect.left, y: e.clientY - rect.top, status });
  }

  return (
    <div className="hud-panel p-2 md:p-3 corner-brackets" ref={calRef}>
      <div className="flex items-center justify-between mb-2">
        <div className="eva-label text-[8px]">WEEKLY OPERATIONS</div>
        <div className="text-[7px] tracking-wider text-text-dim">
          {days.length > 0 && (
            <>
              {format(days[0].date, "MMM d").toUpperCase()}
              {" -- "}
              {format(days[days.length - 1].date, "MMM d").toUpperCase()}
            </>
          )}
        </div>
      </div>

      <div className="relative overflow-x-auto">
        {/* Hour header */}
        <div className="flex" style={{ minWidth: 900 }}>
          <div className="shrink-0 w-14" />
          <div className="flex-1 relative h-4">
            {HOURS.map((h) => {
              const pct = ((h - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
              return (
                <div key={h} className="absolute text-[7px] tabular-nums text-text-dim"
                  style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                  {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day rows */}
        <div style={{ minWidth: 900 }}>
          {days.map((day) => {
            const dayStr = localDate(day.date);
            const isToday = dayStr === todayStr;
            const dayName = format(day.date, "EEE").toUpperCase();
            const dayNum = format(day.date, "d");
            const dow = day.date.getDay();
            const isWeekend = dow === 0 || dow === 6;

            const blocks = day.events.filter((ev) => ev.event_type === "block");
            const points = day.events.filter((ev) => ev.event_type === "point");

            return (
              <div key={dayStr} className={`flex border-t ${isToday ? "border-eva/30" : "border-border/40"}`}>
                {/* Day label */}
                <div className={`shrink-0 w-14 py-1.5 pr-2 text-right ${isToday ? "bg-eva/[0.04]" : ""}`}>
                  <div className={`text-[7px] font-bold tracking-[0.15em] ${
                    isToday ? "text-eva" : isWeekend ? "text-text-dim/50" : "text-text-dim"
                  }`}>{dayName}</div>
                  <div className={`text-[11px] font-black tabular-nums leading-tight ${
                    isToday ? "eva-text" : "text-text"
                  }`}>{dayNum}</div>
                </div>

                {/* Time track */}
                <div className={`flex-1 relative ${isToday ? "bg-eva/[0.02]" : ""}`} style={{ height: 44 }}>
                  {/* Hour gridlines */}
                  {HOURS.map((h) => {
                    const pct = ((h - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
                    return <div key={h} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${pct}%` }} />;
                  })}

                  {/* Now line */}
                  {isToday && showNowLine && (
                    <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: `${nowPct}%` }}>
                      <div className="w-px h-full bg-danger" style={{ boxShadow: "0 0 6px #FF1A1A80" }} />
                      <div className="absolute -top-[3px] -left-[3px] w-[7px] h-[7px] rounded-full bg-danger"
                        style={{ boxShadow: "0 0 8px #FF1A1A" }} />
                    </div>
                  )}

                  {/* Block events */}
                  {blocks.map((ev) => {
                    const status = getEventStatus(ev, dayStr);
                    return (
                      <BlockBar key={ev.id} event={ev} status={status}
                        onHover={(e) => handleHover(ev, e, status || undefined)}
                        onLeave={() => setTooltip(null)} />
                    );
                  })}

                  {/* Point events */}
                  {points.map((ev, idx) => {
                    const status = getEventStatus(ev, dayStr);
                    return (
                      <PointMarker key={ev.id} event={ev} index={idx} status={status}
                        onHover={(e) => handleHover(ev, e, status || undefined)}
                        onLeave={() => setTooltip(null)} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <CalTooltip info={tooltip} />}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-1 border-t border-border/20">
        <LegendDot color={STATUS_COLORS.done} label="DONE" />
        <LegendDot color={STATUS_COLORS.skipped} label="SKIPPED" />
        <LegendDot color={STATUS_COLORS.missed} label="MISSED" />
      </div>
    </div>
  );
}

/* ─── Block Event Bar ─── */
function BlockBar({ event, status, onHover, onLeave }: {
  event: CalendarDayEvent; status: string | null;
  onHover: (e: React.MouseEvent) => void; onLeave: () => void;
}) {
  const router = useRouter();
  const startMin = timeToMinutes(event.start_time);
  const endMin = event.end_time ? timeToMinutes(event.end_time) : startMin + 30;
  const wakeMin = WAKE_HOUR * 60;
  const sleepMin = SLEEP_HOUR * 60;

  const clampedStart = Math.max(startMin, wakeMin);
  const clampedEnd = Math.min(endMin, sleepMin);
  if (clampedEnd <= clampedStart) return null;

  const leftPct = ((clampedStart - wakeMin) / TOTAL_MINUTES) * 100;
  const widthPct = ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100;

  // Color based on status
  const defaultColor = event.color || CATEGORY_COLORS[event.category] || "#444";
  const color = status ? (STATUS_COLORS[status as keyof typeof STATUS_COLORS] || defaultColor) : defaultColor;

  return (
    <div className="absolute z-10 cursor-pointer group"
      style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%`, top: 2, height: 24 }}
      onMouseEnter={onHover} onMouseLeave={onLeave}
      onClick={() => router.push(`/schedule/${event.id}`)}>
      <div className="h-full rounded-sm overflow-hidden transition-all group-hover:brightness-125"
        style={{
          background: `${color}18`,
          borderLeft: `2px solid ${color}`,
          borderTop: `1px solid ${color}15`,
          borderBottom: `1px solid ${color}15`,
        }}>
        <div className="px-1 py-0.5 truncate">
          <span className="text-[7px] font-bold tracking-[0.08em]" style={{ color: `${color}CC` }}>
            {event.title}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Point Event Marker ─── */
function PointMarker({ event, index, status, onHover, onLeave }: {
  event: CalendarDayEvent; index: number; status: string | null;
  onHover: (e: React.MouseEvent) => void; onLeave: () => void;
}) {
  const router = useRouter();
  const startMin = timeToMinutes(event.start_time);
  const wakeMin = WAKE_HOUR * 60;
  const leftPct = ((startMin - wakeMin) / TOTAL_MINUTES) * 100;
  if (leftPct < 0 || leftPct > 100) return null;

  const defaultColor = event.color || CATEGORY_COLORS[event.category] || "#39FF14";
  const color = status ? (STATUS_COLORS[status as keyof typeof STATUS_COLORS] || defaultColor) : defaultColor;
  const offsetPx = index * 10;

  return (
    <div className="absolute z-20 cursor-pointer group"
      style={{ left: `calc(${leftPct}% + ${offsetPx}px)`, bottom: 4, width: 8, height: 8 }}
      onMouseEnter={onHover} onMouseLeave={onLeave}
      onClick={() => router.push(`/schedule/${event.id}`)}>
      <div className="w-[7px] h-[7px] transition-transform group-hover:scale-[1.8]"
        style={{
          background: color,
          boxShadow: `0 0 5px ${color}80`,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }} />
    </div>
  );
}

/* ─── Tooltip ─── */
function CalTooltip({ info }: { info: { event: CalendarDayEvent; x: number; y: number; status?: string } }) {
  const { event, x, y, status } = info;
  const color = event.color || CATEGORY_COLORS[event.category] || "#444";
  const timeRange = event.event_type === "block" && event.end_time
    ? `${formatTime(event.start_time)} -- ${formatTime(event.end_time)}`
    : formatTime(event.start_time);

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: Math.min(x, 700), top: y - 80 }}>
      <div className="p-2 min-w-[140px]"
        style={{ background: "#0A0A0A", border: `1px solid ${color}40`, boxShadow: `0 0 20px ${color}15, 0 4px 12px rgba(0,0,0,0.8)` }}>
        <div className="text-[9px] font-black tracking-wider mb-0.5" style={{ color }}>
          {event.title}
        </div>
        <div className="text-[8px] text-text-dim mb-1">{timeRange}</div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold tracking-wider uppercase px-1 py-0.5"
            style={{ color: `${color}CC`, background: `${color}15`, border: `1px solid ${color}30` }}>
            {event.category}
          </span>
          {status && (
            <span className="text-[7px] font-bold tracking-wider"
              style={{ color: STATUS_COLORS[status as keyof typeof STATUS_COLORS] || "#555" }}>
              {status.toUpperCase()}
            </span>
          )}
        </div>
        {event.notes && (
          <div className="text-[7px] text-text-dim mt-1 italic">{event.notes}</div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
      <span className="text-[7px] tracking-wider text-text-dim">{label}</span>
    </div>
  );
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
