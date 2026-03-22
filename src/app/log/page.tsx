"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { format, subDays } from "date-fns";

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

const CAT_ICONS: Record<string, string> = {
  supplement: "💊",
  meal: "🍽",
  training: "🏋️",
  routine: "🐕",
  health_check: "⚖️",
  sleep: "😴",
  work: "💻",
};

/* ─── Log entry types ─── */
interface LogEntry {
  time: string;       // HH:MM
  label: string;
  category: string;
  status: "done" | "missed" | "pending" | "auto";
  detail?: string;
  source?: string;
}

export default function LogPage() {
  const scheduleEvents = useStore((s) => s.scheduleEvents);
  const checklist = useStore((s) => s.checklist);
  const supplements = useStore((s) => s.supplements);
  const workouts = useStore((s) => s.workouts);
  const healthMetrics = useStore((s) => s.healthMetrics);
  const meals = useStore((s) => s.meals);
  const appleWorkouts = useStore((s) => s.appleWorkouts);
  const weighIns = useStore((s) => s.weighIns);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const dayOfWeek = new Date(selectedDate + "T12:00:00").getDay();

  // Build the day's log from multiple sources
  const entries = useMemo(() => {
    const log: LogEntry[] = [];
    const now = new Date();
    const isToday = selectedDate === format(now, "yyyy-MM-dd");
    const currentMinute = isToday ? now.getHours() * 60 + now.getMinutes() : 24 * 60;

    // 1. Schedule events for this day of week
    const dayEvents = scheduleEvents.filter((ev) => {
      if (ev.specific_date) return ev.specific_date === selectedDate;
      if (ev.day_of_week) return ev.day_of_week.includes(dayOfWeek);
      return false;
    });

    for (const ev of dayEvents) {
      const [h, m] = ev.start_time.split(":").map(Number);
      const evMinute = h * 60 + m;
      const isPast = evMinute < currentMinute;

      // Check if completed in checklist
      const checkMatch = checklist.find((c) =>
        c.label.toUpperCase().includes(ev.title.toUpperCase().slice(0, 6)) ||
        ev.title.toUpperCase().includes(c.label.toUpperCase().slice(0, 6))
      );

      let status: LogEntry["status"] = "pending";
      if (checkMatch?.completed) status = "done";
      else if (isPast && !isToday) status = "missed";
      else if (isPast && isToday) status = "missed";

      log.push({
        time: ev.start_time,
        label: ev.title,
        category: ev.category,
        status,
        detail: ev.notes || undefined,
      });
    }

    // 2. Apple Watch workouts for this date
    const dayAppleWorkouts = appleWorkouts.filter((w) => w.start_date?.slice(0, 10) === selectedDate);
    for (const w of dayAppleWorkouts) {
      const startTime = w.start_date ? new Date(w.start_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "??:??";
      log.push({
        time: startTime,
        label: `${w.activity_type} (Apple Watch)`,
        category: "training",
        status: "auto",
        detail: `${w.duration_minutes?.toFixed(0)}min${w.avg_hr ? ` · avg ${w.avg_hr.toFixed(0)} bpm` : ""}`,
        source: w.source || "Apple Watch",
      });
    }

    // 3. Manual workouts for this date
    const dayWorkouts = workouts.filter((w) => w.date === selectedDate);
    for (const w of dayWorkouts) {
      log.push({
        time: "17:00",
        label: w.name,
        category: "training",
        status: w.completed ? "done" : "missed",
        detail: `${w.exercises.length} exercises · ${w.duration_minutes || "?"}min`,
      });
    }

    // 4. Meals for this date
    const dayMeals = meals.filter((m) => m.date === selectedDate);
    for (const m of dayMeals) {
      const time = m.logged_at ? new Date(m.logged_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "12:00";
      log.push({
        time,
        label: m.description,
        category: "meal",
        status: "done",
        detail: `${m.calories} cal${m.protein_g ? ` · ${m.protein_g}p` : ""}${m.carbs_g ? ` · ${m.carbs_g}c` : ""}${m.fat_g ? ` · ${m.fat_g}f` : ""}`,
        source: "manual",
      });
    }

    // 5. Weigh-in for this date
    const dayWeighIn = weighIns.find((w) => w.date === selectedDate);
    if (dayWeighIn) {
      log.push({
        time: "08:15",
        label: "WEIGH-IN",
        category: "health_check",
        status: "done",
        detail: `${dayWeighIn.weight} lbs${dayWeighIn.body_fat_pct ? ` · ${dayWeighIn.body_fat_pct}% BF` : ""}`,
      });
    }

    // 6. Health metrics (auto-collected vitals)
    const dayHM = healthMetrics.find((h) => h.date === selectedDate);
    if (dayHM) {
      if (dayHM.steps) {
        log.push({
          time: "23:59",
          label: "DAILY STEPS",
          category: "routine",
          status: "auto",
          detail: `${dayHM.steps.toLocaleString()} steps · ${dayHM.distance_mi ? (+dayHM.distance_mi).toFixed(1) + " mi" : ""}`,
          source: "Apple Watch",
        });
      }
    }

    // Sort by time
    return log.sort((a, b) => a.time.localeCompare(b.time));
  }, [selectedDate, dayOfWeek, scheduleEvents, checklist, appleWorkouts, workouts, meals, weighIns, healthMetrics]);

  // Stats
  const done = entries.filter((e) => e.status === "done" || e.status === "auto").length;
  const missed = entries.filter((e) => e.status === "missed").length;
  const pending = entries.filter((e) => e.status === "pending").length;

  // Date navigation
  const goDay = (offset: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const isToday = selectedDate === format(new Date(), "yyyy-MM-dd");
  const dayLabel = isToday ? "TODAY" : format(new Date(selectedDate + "T12:00:00"), "EEEE").toUpperCase();

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* ═══ HEADER ═══ */}
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

      {/* ═══ DATE PICKER ═══ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => goDay(-1)} className="px-2 py-1 text-[9px] font-bold text-text-dim hover:text-eva transition-colors">
            ◄ PREV
          </button>
          <div className="text-center">
            <div className="text-[8px] tracking-[0.2em] text-text-dim">{dayLabel}</div>
            <div className="text-sm font-black eva-text tabular-nums">{selectedDate}</div>
          </div>
          <button onClick={() => goDay(1)} className="px-2 py-1 text-[9px] font-bold text-text-dim hover:text-eva transition-colors">
            NEXT ►
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setSelectedDate(format(new Date(), "yyyy-MM-dd"))}
            className="px-2 py-1 text-[8px] font-bold tracking-wider text-eva/60 hover:text-eva border border-eva/20 hover:border-eva/40 transition-colors">
            TODAY
          </button>
        )}
      </div>

      {/* ═══ SUMMARY BAR ═══ */}
      <div className="grid grid-cols-3 gap-2">
        <div className="hud-panel p-2 text-center">
          <div className="text-[7px] tracking-wider text-text-dim">COMPLETED</div>
          <div className="text-lg font-black text-neon tabular-nums">{done}</div>
        </div>
        <div className="hud-panel p-2 text-center">
          <div className="text-[7px] tracking-wider text-text-dim">MISSED</div>
          <div className="text-lg font-black text-danger tabular-nums">{missed}</div>
        </div>
        <div className="hud-panel p-2 text-center">
          <div className="text-[7px] tracking-wider text-text-dim">PENDING</div>
          <div className="text-lg font-black text-eva tabular-nums">{pending}</div>
        </div>
      </div>

      {/* Completion bar */}
      {entries.length > 0 && (
        <div className="h-1.5 bg-surface-2 overflow-hidden rounded-full">
          <div className="h-full flex">
            <div
              className="h-full transition-all"
              style={{
                width: `${(done / entries.length) * 100}%`,
                background: "#39FF14",
              }}
            />
            <div
              className="h-full transition-all"
              style={{
                width: `${(missed / entries.length) * 100}%`,
                background: "#FF1A1A",
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="eva-label text-[8px] mb-3">▎ TIMELINE</div>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-[9px] text-text-dim tracking-wider">
            NO ENTRIES FOR THIS DATE
          </div>
        ) : (
          <div className="space-y-px">
            {entries.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 px-3 py-2 border-l-2 transition-colors ${
                  entry.status === "done" ? "border-neon/60 bg-neon/[0.03]" :
                  entry.status === "auto" ? "border-cyan/60 bg-cyan/[0.03]" :
                  entry.status === "missed" ? "border-danger/40 bg-danger/[0.03]" :
                  "border-eva/20 bg-eva/[0.02]"
                }`}
              >
                {/* Time */}
                <div className="text-[9px] font-bold tabular-nums text-text-dim w-10 shrink-0 pt-0.5">
                  {entry.time}
                </div>

                {/* Status icon */}
                <div className="text-sm shrink-0 pt-0.5">
                  {entry.status === "done" ? "✅" :
                   entry.status === "auto" ? "⚡" :
                   entry.status === "missed" ? "❌" :
                   "⏳"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider text-text">
                      {entry.label}
                    </span>
                    <span className="text-[7px] px-1 py-0.5 rounded-sm font-bold tracking-wider"
                      style={{
                        color: CAT_COLORS[entry.category] || "#555",
                        background: `${CAT_COLORS[entry.category] || "#555"}15`,
                      }}>
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
                <div className={`text-[7px] font-bold tracking-wider shrink-0 ${
                  entry.status === "done" ? "text-neon/60" :
                  entry.status === "auto" ? "text-cyan/60" :
                  entry.status === "missed" ? "text-danger/50" :
                  "text-eva/40"
                }`}>
                  {entry.status === "done" ? "DONE" :
                   entry.status === "auto" ? "AUTO" :
                   entry.status === "missed" ? "MISSED" :
                   "PENDING"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ LEGEND ═══ */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1">
          <span className="text-sm">✅</span>
          <span className="text-[7px] tracking-wider text-text-dim">COMPLETED</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm">⚡</span>
          <span className="text-[7px] tracking-wider text-text-dim">AUTO (APPLE WATCH)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm">❌</span>
          <span className="text-[7px] tracking-wider text-text-dim">MISSED</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm">⏳</span>
          <span className="text-[7px] tracking-wider text-text-dim">PENDING</span>
        </div>
      </div>
    </div>
  );
}
