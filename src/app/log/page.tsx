"use client";

import { useMemo, useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { getAllScheduleEvents } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

/* ─── Category config ─── */
const CAT_COLORS: Record<string, string> = {
  supplement: "#39FF14",
  meal: "#FFB800",
  training: "#00D0FF",
  routine: "#555555",
  health_check: "#FF6A00",
  sleep: "#6B21A8",
  work: "#FF6A00",
};

/* ─── Status icons (no emojis) ─── */
const STATUS_ICON: Record<string, { icon: string; color: string; label: string }> = {
  done:    { icon: "\u25A0", color: "#39FF14", label: "DONE" },     // filled square
  auto:    { icon: "\u25C8", color: "#00D0FF", label: "AUTO" },     // diamond in square
  skipped: { icon: "\u25CB", color: "#FFB800", label: "SKIP" },     // circle
  missed:  { icon: "\u2718", color: "#FF1A1A", label: "MISSED" },   // X
  pending: { icon: "\u25A1", color: "#FF6A00", label: "PENDING" },  // empty square
};

/* ─── Log entry types ─── */
interface LogEntry {
  time: string;
  label: string;
  category: string;
  status: "done" | "missed" | "pending" | "auto" | "skipped";
  detail?: string;
  source?: string;
  checklistKey?: string; // if set, entry is toggleable via daily_checklist
}

/* ─── Supabase checklist row ─── */
interface ChecklistRow {
  key: string;
  label: string;
  completed: boolean;
  completed_at: string | null;
  notes: string | null;
}

/* ─── Schedule event to checklist key mapping ─── */
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

/* ─── Local date helper ─── */
function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LogPage() {
  const meals = useStore((s) => s.meals);
  const appleWorkouts = useStore((s) => s.appleWorkouts);
  const weighIns = useStore((s) => s.weighIns);
  const healthMetrics = useStore((s) => s.healthMetrics);

  const [selectedDate, setSelectedDate] = useState(localDate());
  const [checklistData, setChecklistData] = useState<ChecklistRow[]>([]);

  // Fetch daily_checklist from Supabase for selected date
  useEffect(() => {
    async function fetchChecklist() {
      const sb = createClient();
      const { data } = await sb
        .from("daily_checklist")
        .select("key, label, completed, completed_at, notes")
        .eq("date", selectedDate);
      setChecklistData(data || []);
    }
    fetchChecklist();
  }, [selectedDate]);

  // Get schedule from seed data (schedule_events table is empty)
  const schedule = useMemo(() => getAllScheduleEvents(), []);
  const dayOfWeek = new Date(selectedDate + "T12:00:00").getDay();

  // Build day's log
  const entries = useMemo(() => {
    const log: LogEntry[] = [];
    const now = new Date();
    const isToday = selectedDate === localDate(now);
    const currentMinute = isToday ? now.getHours() * 60 + now.getMinutes() : 24 * 60;

    // 1. Schedule events for this day of week
    const dayEvents = schedule.filter((ev) => {
      if (ev.specific_date) return ev.specific_date === selectedDate;
      if (ev.day_of_week) return ev.day_of_week.includes(dayOfWeek);
      return false;
    });

    for (const ev of dayEvents) {
      // Skip meals from schedule (they show up from meals table)
      if (ev.category === "meal") continue;
      // Skip sleep/work/winddown from log
      if (["sleep", "work"].includes(ev.category) || ev.title === "WIND DOWN") continue;

      const [h, m] = ev.start_time.split(":").map(Number);
      const evMinute = h * 60 + m;
      const isPast = evMinute < currentMinute;

      // Check Supabase daily_checklist for this event
      const checkKey = EVENT_TO_KEY[ev.id];
      const checkRow = checkKey ? checklistData.find((c) => c.key === checkKey) : null;

      let status: LogEntry["status"] = "pending";
      if (checkRow) {
        status = checkRow.completed ? "done" : "skipped";
      } else if (isPast) {
        status = isToday ? "pending" : "missed";
      }

      log.push({
        time: ev.start_time,
        label: ev.title,
        category: ev.category,
        status,
        detail: checkRow?.notes || ev.notes || undefined,
        checklistKey: checkKey || undefined,
      });
    }

    // 2. Apple Watch workouts
    const dayAppleWorkouts = appleWorkouts.filter((w) => w.start_date?.slice(0, 10) === selectedDate);
    for (const w of dayAppleWorkouts) {
      const startTime = w.start_date
        ? new Date(w.start_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Los_Angeles" })
        : "??:??";
      log.push({
        time: startTime,
        label: w.activity_type,
        category: "training",
        status: "auto",
        detail: `${w.duration_minutes?.toFixed(0)}min${w.avg_hr ? ` | avg ${w.avg_hr.toFixed(0)} bpm` : ""}`,
        source: "Apple Watch",
      });
    }

    // 3. Meals
    const dayMeals = meals.filter((m) => m.date === selectedDate);
    for (const m of dayMeals) {
      const time = m.logged_at
        ? new Date(m.logged_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Los_Angeles" })
        : "12:00";
      log.push({
        time,
        label: m.description,
        category: "meal",
        status: "done",
        detail: `${m.calories} cal${m.protein_g ? ` | ${m.protein_g}p` : ""}${m.carbs_g ? ` | ${m.carbs_g}c` : ""}${m.fat_g ? ` | ${m.fat_g}f` : ""}`,
        source: "logged",
      });
    }

    // 4. Weigh-in
    const dayWeighIn = weighIns.find((w) => w.date === selectedDate);
    if (dayWeighIn) {
      log.push({
        time: "08:15",
        label: "WEIGH-IN",
        category: "health_check",
        status: "done",
        detail: `${dayWeighIn.weight} lbs${dayWeighIn.body_fat_pct ? ` | ${dayWeighIn.body_fat_pct}% BF` : ""}`,
      });
    }

    // 5. Daily steps summary
    const dayHM = healthMetrics.find((h) => h.date === selectedDate);
    if (dayHM && dayHM.steps) {
      log.push({
        time: "23:59",
        label: "DAILY ACTIVITY",
        category: "routine",
        status: "auto",
        detail: `${Number(dayHM.steps).toLocaleString()} steps | ${dayHM.distance_mi ? (+dayHM.distance_mi).toFixed(1) + " mi" : ""} | ${dayHM.active_energy || 0} active cal`,
        source: "Apple Watch",
      });
    }

    return log.sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, dayOfWeek, schedule, checklistData, appleWorkouts, meals, weighIns, healthMetrics]);

  // Stats
  const done = entries.filter((e) => e.status === "done" || e.status === "auto").length;
  const missed = entries.filter((e) => e.status === "missed").length;
  const skipped = entries.filter((e) => e.status === "skipped").length;
  const pending = entries.filter((e) => e.status === "pending").length;

  // Toggle checklist item status: pending/missed -> done -> skipped -> pending/missed
  async function toggleStatus(entry: LogEntry) {
    if (!entry.checklistKey) return;
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;

    const nextStatus: Record<string, { completed: boolean } | null> = {
      pending: { completed: true },     // pending -> done
      missed: { completed: true },      // missed -> done
      done: { completed: false },       // done -> skipped
      skipped: null,                    // skipped -> remove (back to missed/pending)
    };

    const next = nextStatus[entry.status];
    if (next === null) {
      // Delete the row to go back to missed/pending
      await sb.from("daily_checklist")
        .delete()
        .eq("user_id", session.user.id)
        .eq("date", selectedDate)
        .eq("key", entry.checklistKey);
    } else if (next) {
      await sb.from("daily_checklist").upsert({
        user_id: session.user.id,
        date: selectedDate,
        key: entry.checklistKey,
        label: entry.label,
        completed: next.completed,
        completed_at: next.completed ? new Date().toISOString() : null,
      }, { onConflict: "user_id,date,key" });
    }

    // Refresh checklist data
    const { data } = await sb
      .from("daily_checklist")
      .select("key, label, completed, completed_at, notes")
      .eq("date", selectedDate);
    setChecklistData(data || []);
  }

  // Date navigation
  const goDay = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(localDate(d));
  };

  const isToday = selectedDate === localDate();
  const dayLabel = isToday ? "TODAY" : format(new Date(selectedDate + "T12:00:00"), "EEEE").toUpperCase();

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            ACTIVITY LOG
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // DAILY RECORD
            </span>
          </h1>
        </div>
      </div>

      {/* Date picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => goDay(-1)} className="px-2 py-1 text-[9px] font-bold text-text-dim hover:text-eva transition-colors">
            PREV
          </button>
          <div className="text-center">
            <div className="text-[8px] tracking-[0.2em] text-text-dim">{dayLabel}</div>
            <div className="text-sm font-black eva-text tabular-nums">{selectedDate}</div>
          </div>
          <button onClick={() => goDay(1)} className="px-2 py-1 text-[9px] font-bold text-text-dim hover:text-eva transition-colors">
            NEXT
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setSelectedDate(localDate())}
            className="px-2 py-1 text-[8px] font-bold tracking-wider text-eva/60 hover:text-eva border border-eva/20 hover:border-eva/40 transition-colors">
            TODAY
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="DONE" value={done} color="#39FF14" />
        <StatBox label="SKIPPED" value={skipped} color="#FFB800" />
        <StatBox label="MISSED" value={missed} color="#FF1A1A" />
        <StatBox label="PENDING" value={pending} color="#FF6A00" />
      </div>

      {/* Completion bar */}
      {entries.length > 0 && (
        <div className="h-1.5 bg-surface-2 overflow-hidden">
          <div className="h-full flex">
            <div className="h-full transition-all" style={{ width: `${(done / entries.length) * 100}%`, background: "#39FF14" }} />
            <div className="h-full transition-all" style={{ width: `${(skipped / entries.length) * 100}%`, background: "#FFB800" }} />
            <div className="h-full transition-all" style={{ width: `${(missed / entries.length) * 100}%`, background: "#FF1A1A" }} />
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="eva-label text-[8px] mb-3">TIMELINE</div>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-[9px] text-text-dim tracking-wider">
            NO ENTRIES FOR THIS DATE
          </div>
        ) : (
          <div className="space-y-px">
            {entries.map((entry, i) => {
              const si = STATUS_ICON[entry.status];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-3 py-2 border-l-2 transition-colors ${entry.checklistKey ? "cursor-pointer hover:brightness-125" : ""}`}
                  style={{ borderColor: `${si.color}60`, background: `${si.color}06` }}
                  onClick={() => entry.checklistKey && toggleStatus(entry)}
                >
                  {/* Time */}
                  <div className="text-[9px] font-bold tabular-nums text-text-dim w-10 shrink-0 pt-0.5">
                    {entry.time}
                  </div>

                  {/* Status icon */}
                  <div className="text-sm shrink-0 pt-0.5 font-bold" style={{ color: si.color }}>
                    {si.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold tracking-wider text-text">
                        {entry.label}
                      </span>
                      <span className="text-[7px] px-1 py-0.5 font-bold tracking-wider"
                        style={{ color: CAT_COLORS[entry.category] || "#555", background: `${CAT_COLORS[entry.category] || "#555"}15` }}>
                        {entry.category.toUpperCase().replace("_", " ")}
                      </span>
                      {entry.source && (
                        <span className="text-[7px] text-text-dim tracking-wider">{entry.source}</span>
                      )}
                    </div>
                    {entry.detail && (
                      <div className="text-[8px] text-text-dim mt-0.5">{entry.detail}</div>
                    )}
                  </div>

                  {/* Status label */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="text-[7px] font-bold tracking-wider" style={{ color: si.color }}>
                      {si.label}
                    </div>
                    {entry.checklistKey && (
                      <div className="text-[6px] text-text-dim/40 tracking-wider">CLICK</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        {Object.entries(STATUS_ICON).map(([key, si]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="text-sm font-bold" style={{ color: si.color }}>{si.icon}</span>
            <span className="text-[7px] tracking-wider text-text-dim">{si.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="hud-panel p-2 text-center">
      <div className="text-[7px] tracking-wider text-text-dim">{label}</div>
      <div className="text-lg font-black tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
