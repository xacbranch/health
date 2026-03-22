"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CalendarDayEvent, EventCategory } from "@/types";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth } from "@/lib/supabase-data";
import { useStore } from "@/lib/store";

/* ─── Config ─── */
const WAKE_HOUR = 7;
const SLEEP_HOUR = 22.5;
const TOTAL_MINUTES = (SLEEP_HOUR - WAKE_HOUR) * 60; // 930
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const SNAP = 15; // snap to 15-minute grid
const MIN_DURATION = 15;

const CATEGORY_COLORS: Record<string, string> = {
  work: "#FF6A00", training: "#00D0FF", supplement: "#39FF14",
  meal: "#FFB800", routine: "#555555", sleep: "#6B21A8", health_check: "#00D0FF",
};

const STATUS_COLORS: Record<string, string> = {
  done: "#39FF14", skipped: "#FFB800", missed: "#FF1A1A", pending: "#888888", future: "#444444",
};

const EVENT_TO_KEY: Record<string, string> = {
  "se-iron": "iron", "se-hydrate": "hydrate_am", "se-semax": "semax",
  "se-dogwalk-am": "dogwalk_am", "se-weighin": "weighin", "se-d3k2": "d3k2",
  "se-hydrate-pm": "hydrate_pm", "se-preworkout": "preworkout",
  "se-gym": "gym", "se-tennis": "tennis", "se-dogwalk-pm": "dogwalk_pm",
  "se-magnesium": "magnesium",
};

const CATEGORIES: EventCategory[] = ["work", "training", "supplement", "meal", "routine", "health_check"];

/* ─── Helpers ─── */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const clamped = Math.max(WAKE_HOUR * 60, Math.min(m, SLEEP_HOUR * 60));
  const h = Math.floor(clamped / 60);
  const min = Math.round(clamped % 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function snapMinutes(m: number): number {
  return Math.round(m / SNAP) * SNAP;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Types ─── */
interface ChecklistRow { key: string; completed: boolean; date: string; }
interface DayData { date: Date; dateStr: string; events: CalendarDayEvent[]; }

interface DragState {
  eventId: string;
  dayStr: string;        // which day row the drag started on
  isTemplate: boolean;   // true if event uses day_of_week (recurring)
  event: CalendarDayEvent; // full event for cloning
  type: "move" | "resize-start" | "resize-end";
  origStartMin: number;
  origEndMin: number;
  startX: number;
  trackWidth: number;
  currentStartMin: number;
  currentEndMin: number;
}

interface QuickAddState {
  dayStr: string;
  startMin: number;
  x: number;
  y: number;
}

/* ─── Component ─── */
export default function WeeklyCalendar({ days }: { days: DayData[] }) {
  const router = useRouter();
  const { updateScheduleEvent, addScheduleEvent } = useStore();
  const [now, setNow] = useState(new Date());
  const [tooltip, setTooltip] = useState<{ event: CalendarDayEvent; x: number; y: number; status?: string } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [quickForm, setQuickForm] = useState({ title: "", category: "routine" as EventCategory, duration: 60 });
  const calRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const todayStr = localDate();

  // Checklist data for status colors
  const [checklistByDate, setChecklistByDate] = useState<Record<string, ChecklistRow[]>>({});
  useEffect(() => {
    async function fetchWeekChecklist() {
      if (days.length === 0) return;
      await ensureAuth();
      const sb = createClient();
      const dates = days.map((d) => localDate(d.date));
      const { data } = await sb.from("daily_checklist").select("key, completed, date").in("date", dates);
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

  // Clock
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowPct = ((nowMinutes - WAKE_HOUR * 60) / TOTAL_MINUTES) * 100;
  const showNowLine = nowPct >= 0 && nowPct <= 100;

  function getEventStatus(ev: CalendarDayEvent, dayStr: string): string {
    const isFutureDay = dayStr > todayStr;
    const isPastDay = dayStr < todayStr;
    const isToday = dayStr === todayStr;

    // Future days are always grey
    if (isFutureDay) return "future";

    // Check if this event has checklist tracking
    const checkKey = EVENT_TO_KEY[ev.id];
    if (checkKey) {
      const dayChecklist = checklistByDate[dayStr] || [];
      const row = dayChecklist.find((c) => c.key === checkKey);
      if (row) return row.completed ? "done" : "skipped";
      // No checklist entry
      if (isPastDay) return "missed";
      if (isToday) {
        const [h, m] = ev.start_time.split(":").map(Number);
        if (h * 60 + m < nowMinutes) return "missed";
      }
      return "pending";
    }

    // Non-tracked events (work, meals, sleep, etc.) — use pending for all
    // They don't have checklist tracking so we can't know if they happened
    return "pending";
  }

  /* ─── Drag handlers ─── */
  const handleDragStart = useCallback((ev: CalendarDayEvent, dayStr: string, type: DragState["type"], e: React.MouseEvent, trackEl: HTMLDivElement, startTime: string, endTime: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = trackEl.getBoundingClientRect();
    const startMin = timeToMinutes(startTime);
    const endMin = endTime ? timeToMinutes(endTime) : startMin + 30;
    setDrag({
      eventId: ev.id, dayStr, event: ev,
      isTemplate: !!(ev.day_of_week && ev.day_of_week.length > 0 && !ev.specific_date),
      type,
      origStartMin: startMin, origEndMin: endMin,
      startX: e.clientX, trackWidth: rect.width,
      currentStartMin: startMin, currentEndMin: endMin,
    });
    setTooltip(null);
  }, []);

  useEffect(() => {
    if (!drag) return;

    function onMouseMove(e: MouseEvent) {
      setDrag((prev) => {
        if (!prev) return null;
        const deltaPx = e.clientX - prev.startX;
        const deltaMin = snapMinutes((deltaPx / prev.trackWidth) * TOTAL_MINUTES);
        const wakeMin = WAKE_HOUR * 60;
        const sleepMin = SLEEP_HOUR * 60;

        if (prev.type === "move") {
          const duration = prev.origEndMin - prev.origStartMin;
          let newStart = snapMinutes(prev.origStartMin + deltaMin);
          newStart = Math.max(wakeMin, Math.min(newStart, sleepMin - duration));
          return { ...prev, currentStartMin: newStart, currentEndMin: newStart + duration };
        } else if (prev.type === "resize-start") {
          let newStart = snapMinutes(prev.origStartMin + deltaMin);
          newStart = Math.max(wakeMin, Math.min(newStart, prev.origEndMin - MIN_DURATION));
          return { ...prev, currentStartMin: newStart };
        } else {
          let newEnd = snapMinutes(prev.origEndMin + deltaMin);
          newEnd = Math.max(prev.origStartMin + MIN_DURATION, Math.min(newEnd, sleepMin));
          return { ...prev, currentEndMin: newEnd };
        }
      });
    }

    function onMouseUp() {
      setDrag((prev) => {
        if (!prev) return null;
        const newStart = minutesToTime(prev.currentStartMin);
        const newEnd = minutesToTime(prev.currentEndMin);
        const changed = newStart !== minutesToTime(prev.origStartMin) || newEnd !== minutesToTime(prev.origEndMin);
        if (!changed) return null;

        if (prev.isTemplate) {
          // Template event (recurring) — create a day-specific override
          // Leave the original template untouched
          const ev = prev.event;
          addScheduleEvent({
            title: ev.title,
            event_type: ev.event_type,
            category: ev.category,
            start_time: newStart,
            end_time: newEnd,
            day_of_week: null,
            specific_date: prev.dayStr,
            color: ev.color,
            icon: ev.icon,
            is_template: false,
            completed: ev.completed,
            notes: ev.notes ? `${ev.notes} (moved)` : "moved from template",
            sort_order: ev.sort_order,
          });
        } else {
          // Already a specific event — just update it
          updateScheduleEvent(prev.eventId, { start_time: newStart, end_time: newEnd });
        }
        return null;
      });
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [drag, updateScheduleEvent, addScheduleEvent]);

  /* ─── Click empty space to add ─── */
  function handleTrackClick(e: React.MouseEvent, dayStr: string, trackEl: HTMLDivElement) {
    // Don't trigger if we just finished a drag or clicked an event
    if (drag) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;

    const rect = trackEl.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const clickMin = snapMinutes(WAKE_HOUR * 60 + xPct * TOTAL_MINUTES);

    const calRect = calRef.current?.getBoundingClientRect();
    setQuickAdd({
      dayStr,
      startMin: clickMin,
      x: e.clientX - (calRect?.left || 0),
      y: e.clientY - (calRect?.top || 0),
    });
    setQuickForm({ title: "", category: "routine", duration: 60 });
  }

  function handleQuickSave() {
    if (!quickAdd || !quickForm.title.trim()) return;
    const startTime = minutesToTime(quickAdd.startMin);
    const endTime = minutesToTime(quickAdd.startMin + quickForm.duration);
    addScheduleEvent({
      title: quickForm.title.toUpperCase(),
      event_type: "block",
      category: quickForm.category,
      start_time: startTime,
      end_time: endTime,
      day_of_week: [new Date(quickAdd.dayStr + "T12:00:00").getDay()],
      specific_date: null,
      color: CATEGORY_COLORS[quickForm.category] || null,
      icon: null,
      is_template: true,
      completed: false,
      notes: null,
      sort_order: 0,
    });
    setQuickAdd(null);
  }

  /* ─── Tooltip ─── */
  function handleHover(ev: CalendarDayEvent, e: React.MouseEvent, status?: string) {
    if (drag) return;
    const rect = calRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ event: ev, x: e.clientX - rect.left, y: e.clientY - rect.top, status });
  }

  return (
    <div className="hud-panel p-2 md:p-3 corner-brackets relative" ref={calRef}>
      <div className="flex items-center justify-between mb-2">
        <div className="eva-label text-[8px]">WEEKLY OPERATIONS</div>
        <div className="text-[7px] tracking-wider text-text-dim">
          {days.length > 0 && (
            <>{format(days[0].date, "MMM d").toUpperCase()} -- {format(days[days.length - 1].date, "MMM d").toUpperCase()}</>
          )}
        </div>
      </div>

      <div className="relative overflow-x-auto" style={{ cursor: drag ? (drag.type === "move" ? "grabbing" : "col-resize") : undefined }}>
        {/* Hour header */}
        <div className="flex" style={{ minWidth: 900 }}>
          <div className="shrink-0 w-14" />
          <div className="flex-1 relative h-4">
            {HOURS.map((h) => {
              const pct = ((h - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
              return (
                <div key={h} className="absolute text-[7px] tabular-nums text-text-dim" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
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
                  <div className={`text-[7px] font-bold tracking-[0.15em] ${isToday ? "text-eva" : isWeekend ? "text-text-dim/50" : "text-text-dim"}`}>{dayName}</div>
                  <div className={`text-[11px] font-black tabular-nums leading-tight ${isToday ? "eva-text" : "text-text"}`}>{dayNum}</div>
                </div>

                {/* Time track */}
                <div
                  ref={(el) => { trackRefs.current[dayStr] = el; }}
                  className={`flex-1 relative ${isToday ? "bg-eva/[0.02]" : ""}`}
                  style={{ height: 44, cursor: drag ? undefined : "crosshair" }}
                  onClick={(e) => {
                    const el = trackRefs.current[dayStr];
                    if (el) handleTrackClick(e, dayStr, el);
                  }}
                >
                  {/* Hour gridlines */}
                  {HOURS.map((h) => {
                    const pct = ((h - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
                    return <div key={h} className="absolute top-0 bottom-0 border-l border-border/20" style={{ left: `${pct}%` }} />;
                  })}

                  {/* Now line */}
                  {isToday && showNowLine && (
                    <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: `${nowPct}%` }}>
                      <div className="w-px h-full bg-danger" style={{ boxShadow: "0 0 6px #FF1A1A80" }} />
                      <div className="absolute -top-[3px] -left-[3px] w-[7px] h-[7px] rounded-full bg-danger" style={{ boxShadow: "0 0 8px #FF1A1A" }} />
                    </div>
                  )}

                  {/* Block events */}
                  {blocks.map((ev) => {
                    const status = getEventStatus(ev, dayStr);
                    const isDragging = drag?.eventId === ev.id && drag?.dayStr === dayStr;
                    const startMin = isDragging ? drag.currentStartMin : timeToMinutes(ev.start_time);
                    const endMin = isDragging ? drag.currentEndMin : (ev.end_time ? timeToMinutes(ev.end_time) : startMin + 30);
                    const wakeMin = WAKE_HOUR * 60;
                    const sleepMin = SLEEP_HOUR * 60;
                    const clampedStart = Math.max(startMin, wakeMin);
                    const clampedEnd = Math.min(endMin, sleepMin);
                    if (clampedEnd <= clampedStart) return null;

                    const leftPct = ((clampedStart - wakeMin) / TOTAL_MINUTES) * 100;
                    const widthPct = ((clampedEnd - clampedStart) / TOTAL_MINUTES) * 100;
                    const defaultColor = ev.color || CATEGORY_COLORS[ev.category] || "#444";
                    const color = STATUS_COLORS[status] || defaultColor;
                    const trackEl = trackRefs.current[dayStr];

                    return (
                      <div key={`${ev.id}-${dayStr}`} data-event className="absolute z-10 group"
                        style={{
                          left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%`, top: 2, height: 24,
                          cursor: isDragging ? "grabbing" : "grab",
                          opacity: isDragging ? 0.85 : 1,
                        }}
                        onMouseDown={(e) => { if (trackEl) handleDragStart(ev, dayStr, "move", e, trackEl, minutesToTime(startMin), minutesToTime(endMin)); }}
                        onMouseEnter={(e) => handleHover(ev, e, status || undefined)}
                        onMouseLeave={() => setTooltip(null)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!drag) router.push(`/schedule/${ev.id}`);
                        }}
                      >
                        {/* Left resize handle */}
                        <div className="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                          onMouseDown={(e) => { e.stopPropagation(); if (trackEl) handleDragStart(ev, dayStr, "resize-start", e, trackEl, minutesToTime(startMin), minutesToTime(endMin)); }} />

                        {/* Bar content */}
                        <div className="h-full rounded-sm overflow-hidden transition-all"
                          style={{
                            background: `${color}18`,
                            borderLeft: `2px solid ${color}`,
                            borderTop: `1px solid ${color}15`,
                            borderBottom: `1px solid ${color}15`,
                            boxShadow: isDragging ? `0 0 12px ${color}40` : undefined,
                          }}>
                          <div className="px-1 py-0.5 truncate">
                            <span className="text-[7px] font-bold tracking-[0.08em]" style={{ color: `${color}CC` }}>
                              {ev.title}
                            </span>
                            {isDragging && (
                              <span className="text-[6px] ml-1" style={{ color: `${color}80` }}>
                                {formatTime(minutesToTime(drag!.currentStartMin))}--{formatTime(minutesToTime(drag!.currentEndMin))}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right resize handle */}
                        <div className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                          onMouseDown={(e) => { e.stopPropagation(); if (trackEl) handleDragStart(ev, dayStr, "resize-end", e, trackEl, minutesToTime(startMin), minutesToTime(endMin)); }} />
                      </div>
                    );
                  })}

                  {/* Point events */}
                  {points.map((ev, idx) => {
                    const status = getEventStatus(ev, dayStr);
                    const startMin = timeToMinutes(ev.start_time);
                    const wakeMin = WAKE_HOUR * 60;
                    const leftPct = ((startMin - wakeMin) / TOTAL_MINUTES) * 100;
                    if (leftPct < 0 || leftPct > 100) return null;
                    const defaultColor = ev.color || CATEGORY_COLORS[ev.category] || "#39FF14";
                    const color = STATUS_COLORS[status] || defaultColor;

                    return (
                      <div key={`${ev.id}-${dayStr}`} data-event className="absolute z-20 cursor-pointer group"
                        style={{ left: `calc(${leftPct}% + ${idx * 10}px)`, bottom: 4, width: 8, height: 8 }}
                        onMouseEnter={(e) => handleHover(ev, e, status || undefined)}
                        onMouseLeave={() => setTooltip(null)}
                        onDoubleClick={(e) => { e.stopPropagation(); router.push(`/schedule/${ev.id}`); }}>
                        <div className="w-[7px] h-[7px] transition-transform group-hover:scale-[1.8]"
                          style={{ background: color, boxShadow: `0 0 5px ${color}80`, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && !drag && <CalTooltip info={tooltip} />}

      {/* Quick Add form */}
      {quickAdd && (
        <div className="absolute z-50" style={{ left: Math.min(quickAdd.x, 600), top: quickAdd.y - 10 }}>
          <div className="p-3 min-w-[200px]" style={{ background: "#0A0A0A", border: "1px solid #FF6A0040", boxShadow: "0 4px 20px rgba(0,0,0,0.8)" }}>
            <div className="text-[8px] font-bold tracking-wider text-eva mb-2">
              ADD EVENT -- {formatTime(minutesToTime(quickAdd.startMin))}
            </div>
            <input
              autoFocus
              className="w-full bg-surface-2 border border-border/40 text-text text-[10px] px-2 py-1.5 mb-2 focus:outline-none focus:border-eva/50 font-mono placeholder:text-text-dim/30"
              placeholder="EVENT TITLE"
              value={quickForm.title}
              onChange={(e) => setQuickForm({ ...quickForm, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuickSave(); if (e.key === "Escape") setQuickAdd(null); }}
            />
            <div className="flex gap-2 mb-2">
              <select
                className="flex-1 bg-surface-2 border border-border/40 text-text text-[9px] px-1 py-1 font-mono focus:outline-none focus:border-eva/50"
                value={quickForm.category}
                onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value as EventCategory })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.toUpperCase()}</option>
                ))}
              </select>
              <select
                className="w-20 bg-surface-2 border border-border/40 text-text text-[9px] px-1 py-1 font-mono focus:outline-none focus:border-eva/50"
                value={quickForm.duration}
                onChange={(e) => setQuickForm({ ...quickForm, duration: Number(e.target.value) })}
              >
                <option value={15}>15m</option>
                <option value={30}>30m</option>
                <option value={45}>45m</option>
                <option value={60}>1h</option>
                <option value={90}>1.5h</option>
                <option value={120}>2h</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setQuickAdd(null)} className="flex-1 px-2 py-1 text-[8px] font-bold tracking-wider text-text-dim border border-border/40 hover:border-border transition-colors">CANCEL</button>
              <button onClick={handleQuickSave} className="flex-1 px-2 py-1 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">ADD</button>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 pt-1 border-t border-border/20">
        <LegendDot color="#39FF14" label="DONE" />
        <LegendDot color="#FFB800" label="SKIPPED" />
        <LegendDot color="#FF1A1A" label="MISSED" />
        <LegendDot color="#888888" label="PENDING" />
        <LegendDot color="#444444" label="UPCOMING" />
        <span className="text-[7px] tracking-wider text-text-dim/40 ml-auto">DRAG TO MOVE -- EDGES TO RESIZE -- CLICK EMPTY TO ADD</span>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function CalTooltip({ info }: { info: { event: CalendarDayEvent; x: number; y: number; status?: string } }) {
  const { event, x, y, status } = info;
  const color = event.color || CATEGORY_COLORS[event.category] || "#444";
  const timeRange = event.event_type === "block" && event.end_time
    ? `${formatTime(event.start_time)} -- ${formatTime(event.end_time)}`
    : formatTime(event.start_time);

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: Math.min(x, 700), top: y - 80 }}>
      <div className="p-2 min-w-[140px]" style={{ background: "#0A0A0A", border: `1px solid ${color}40`, boxShadow: `0 0 20px ${color}15, 0 4px 12px rgba(0,0,0,0.8)` }}>
        <div className="text-[9px] font-black tracking-wider mb-0.5" style={{ color }}>{event.title}</div>
        <div className="text-[8px] text-text-dim mb-1">{timeRange}</div>
        <div className="flex items-center gap-2">
          <span className="text-[7px] font-bold tracking-wider uppercase px-1 py-0.5" style={{ color: `${color}CC`, background: `${color}15`, border: `1px solid ${color}30` }}>{event.category}</span>
          {status && (
            <span className="text-[7px] font-bold tracking-wider" style={{ color: STATUS_COLORS[status] || "#555" }}>{status.toUpperCase()}</span>
          )}
        </div>
        {event.notes && <div className="text-[7px] text-text-dim mt-1 italic">{event.notes}</div>}
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
