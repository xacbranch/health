"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { WorkoutSession, Exercise } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiNumber, MagiSelect } from "@/components/ui/MagiField";

const typeIcons: Record<string, string> = {
  gym: "⬡",
  tennis: "◎",
  recovery: "↻",
  cardio: "♥",
};

export default function WorkoutsPage() {
  const {
    workouts, addWorkout, updateWorkout, deleteWorkout,
    addExercise, updateExercise, deleteExercise, toggleExercise,
    appleWorkouts,
  } = useStore();

  const [sessionModal, setSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(null);
  const [sessionForm, setSessionForm] = useState({ date: "", type: "gym" as WorkoutSession["type"], name: "", duration_minutes: "" as number | "", completed: false });

  const [exModal, setExModal] = useState(false);
  const [exWorkoutId, setExWorkoutId] = useState<string>("");
  const [editingEx, setEditingEx] = useState<Exercise | null>(null);
  const [exForm, setExForm] = useState({ name: "", sets: "" as number | "", reps: "" as number | "", weight: "" as number | "" });

  const [deleteTarget, setDeleteTarget] = useState<{ type: "session"; item: WorkoutSession } | { type: "exercise"; workoutId: string; item: Exercise } | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const todayWorkout = workouts.find((w) => w.date === today);

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const workout = workouts.find((w) => w.date === dateStr);
    const dayAppleWorkouts = appleWorkouts.filter((w) => w.start_date?.slice(0, 10) === dateStr);
    const labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    return { label: labels[i], date: dateStr, workout, dayAppleWorkouts, isToday: dateStr === today };
  });

  const sessionsThisWeek = weekDays.filter((d) => d.workout || d.dayAppleWorkouts.length > 0).length;
  const totalVolume = workouts
    .filter((w) => weekDays.some((d) => d.date === w.date))
    .reduce((sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets * e.reps * (e.weight || 0), 0), 0);

  function openAddSession() {
    setEditingSession(null);
    setSessionForm({ date: today, type: "gym", name: "", duration_minutes: "", completed: false });
    setSessionModal(true);
  }

  function openEditSession(w: WorkoutSession) {
    setEditingSession(w);
    setSessionForm({ date: w.date, type: w.type, name: w.name, duration_minutes: w.duration_minutes ?? "", completed: w.completed });
    setSessionModal(true);
  }

  function handleSaveSession() {
    if (!sessionForm.name.trim()) return;
    const data = {
      date: sessionForm.date,
      type: sessionForm.type,
      name: sessionForm.name,
      duration_minutes: sessionForm.duration_minutes === "" ? null : Number(sessionForm.duration_minutes),
      completed: sessionForm.completed,
    };
    if (editingSession) {
      updateWorkout(editingSession.id, data);
    } else {
      addWorkout({ ...data, exercises: [] });
    }
    setSessionModal(false);
  }

  function openAddEx(workoutId: string) {
    setExWorkoutId(workoutId);
    setEditingEx(null);
    setExForm({ name: "", sets: "", reps: "", weight: "" });
    setExModal(true);
  }

  function openEditEx(workoutId: string, ex: Exercise) {
    setExWorkoutId(workoutId);
    setEditingEx(ex);
    setExForm({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight ?? "" });
    setExModal(true);
  }

  function handleSaveEx() {
    if (!exForm.name.trim()) return;
    const data = {
      name: exForm.name,
      sets: Number(exForm.sets) || 0,
      reps: Number(exForm.reps) || 0,
      weight: exForm.weight === "" ? null : Number(exForm.weight),
      completed: editingEx?.completed ?? false,
    };
    if (editingEx) {
      updateExercise(exWorkoutId, editingEx.id, data);
    } else {
      addExercise(exWorkoutId, data);
    }
    setExModal(false);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "session") {
      deleteWorkout(deleteTarget.item.id);
    } else {
      deleteExercise(deleteTarget.workoutId, deleteTarget.item.id);
    }
    setDeleteTarget(null);
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eva-label mb-1">TRAINING MODULE</div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-bright">
            WORKOUTS
          </h1>
        </div>
        <button
          onClick={openAddSession}
          className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
        >
          + ADD SESSION
        </button>
      </div>

      {/* Today's Workout */}
      <div className="hud-panel p-4 md:p-5 corner-brackets">
        <div className="eva-label mb-3">TODAY&apos;S SESSION</div>
        {todayWorkout ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xl md:text-2xl font-black text-text-bright">
                  {todayWorkout.name.toUpperCase()}
                </div>
                <div className="font-mono text-[10px] text-text-dim tracking-wider mt-1">
                  {todayWorkout.exercises.length} EXERCISES
                  {todayWorkout.duration_minutes
                    ? ` · ${todayWorkout.duration_minutes} MIN`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-[10px] text-text-dim tracking-wider px-3 py-1 border border-border">
                  {typeIcons[todayWorkout.type] ?? "⬡"}{" "}
                  {todayWorkout.type.toUpperCase()}
                </div>
                <button
                  onClick={() => openEditSession(todayWorkout)}
                  className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                >
                  EDIT
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {todayWorkout.exercises.map((ex) => (
                <div
                  key={ex.id}
                  className={`flex items-center justify-between px-3 py-2.5 bg-surface-2 border border-border/40 transition-all group/ex ${
                    ex.completed ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExercise(todayWorkout.id, ex.id)}
                      className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 transition-all ${
                        ex.completed
                          ? "border-positive bg-positive"
                          : "border-surface-3 hover:border-eva/50"
                      }`}
                    >
                      {ex.completed && (
                        <span className="text-black text-[10px] font-black">✓</span>
                      )}
                    </button>
                    <span className="font-mono text-[12px] font-bold text-text">
                      {ex.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-cyan">
                      {ex.sets}×{ex.reps}
                      {ex.weight ? ` @ ${ex.weight}lb` : ""}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover/ex:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditEx(todayWorkout.id, ex)}
                        className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                      >
                        EDIT
                      </button>
                      <span className="text-text-dim/30">|</span>
                      <button
                        onClick={() => setDeleteTarget({ type: "exercise", workoutId: todayWorkout.id, item: ex })}
                        className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => openAddEx(todayWorkout.id)}
                className="w-full py-2 text-[8px] font-bold tracking-wider text-text-dim hover:text-eva border border-dashed border-border/40 hover:border-eva/30 transition-colors"
              >
                + ADD EXERCISE
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">↻</div>
            <div className="font-mono text-xs text-text-dim tracking-wider mb-3">
              REST DAY — RECOVERY ACTIVE
            </div>
            <button
              onClick={openAddSession}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
            >
              + LOG SESSION ANYWAY
            </button>
          </div>
        )}
      </div>

      {/* All Sessions */}
      {workouts.filter((w) => w.date !== today).length > 0 && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="eva-label mb-3">OTHER SESSIONS</div>
          <div className="space-y-2">
            {workouts.filter((w) => w.date !== today).map((w) => (
              <div key={w.id} className="flex items-center justify-between py-2 border-b border-border/20 group/sess">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{typeIcons[w.type] ?? "⬡"}</span>
                  <div>
                    <div className="font-mono text-[11px] font-bold text-text">{w.name}</div>
                    <div className="font-mono text-[9px] text-text-dim">{w.date} · {w.exercises.length} exercises</div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover/sess:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditSession(w)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                  >
                    EDIT
                  </button>
                  <span className="text-text-dim/30">|</span>
                  <button
                    onClick={() => setDeleteTarget({ type: "session", item: w })}
                    className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Overview */}
      <div>
        <div className="eva-label mb-3">WEEKLY OVERVIEW</div>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div
              key={day.date}
              className={`hud-panel p-2 md:p-3 corner-brackets text-center ${
                day.isToday ? "border-eva/30" : ""
              }`}
            >
              <div
                className={`font-mono text-[10px] font-bold tracking-wider mb-2 ${
                  day.isToday ? "text-eva" : "text-text-dim"
                }`}
              >
                {day.label}
              </div>
              {day.workout ? (
                <>
                  <div className="text-lg md:text-xl mb-1">
                    {typeIcons[day.workout.type] ?? "⬡"}
                  </div>
                  <div className="font-mono text-[9px] text-text-dim tracking-wider truncate">
                    {day.workout.type.toUpperCase()}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg md:text-xl mb-1 text-text-dim opacity-30">—</div>
                  <div className="font-mono text-[9px] text-text-dim tracking-wider">REST</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="hud-panel p-3 md:p-4 corner-brackets">
          <div className="font-mono text-[10px] text-text-dim tracking-wider mb-2">
            SESSIONS THIS WEEK
          </div>
          <div className="data-readout text-2xl md:text-3xl">{sessionsThisWeek}</div>
        </div>
        <div className="hud-panel p-3 md:p-4 corner-brackets">
          <div className="font-mono text-[10px] text-text-dim tracking-wider mb-2">
            TOTAL VOLUME
          </div>
          <div className="data-readout text-2xl md:text-3xl">
            {totalVolume > 0 ? totalVolume.toLocaleString() : "—"}
          </div>
          <div className="font-mono text-[9px] text-text-dim mt-1">LBS</div>
        </div>
        <div className="hud-panel p-3 md:p-4 corner-brackets">
          <div className="font-mono text-[10px] text-text-dim tracking-wider mb-2">
            EXERCISES TODAY
          </div>
          <div className="data-readout text-2xl md:text-3xl">
            {todayWorkout?.exercises.filter((e) => e.completed).length ?? 0}
            <span className="text-sm text-text-dim">/{todayWorkout?.exercises.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Apple Watch Workout History */}
      {appleWorkouts.length > 0 && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="eva-label mb-3">APPLE WATCH HISTORY</div>
          <div className="space-y-1">
            {[...appleWorkouts].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 30).map((w) => {
              const dateStr = w.start_date?.slice(0, 10) || "";
              const time = w.start_date
                ? new Date(w.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })
                : "";
              return (
                <div key={w.id || w.start_date} className="flex items-center justify-between py-2 border-b border-border/20">
                  <div className="flex items-center gap-3">
                    <span className="text-[8px] text-cyan/60 tabular-nums w-20">{dateStr}</span>
                    <span className="text-[8px] text-text-dim tabular-nums w-16">{time}</span>
                    <div>
                      <div className="font-mono text-[11px] font-bold text-text">{w.activity_type}</div>
                      <div className="font-mono text-[9px] text-text-dim">
                        {w.duration_minutes ? `${Math.round(w.duration_minutes)}min` : ""}
                        {w.avg_hr ? ` | avg ${Math.round(w.avg_hr)} bpm` : ""}
                        {w.max_hr ? ` | max ${Math.round(w.max_hr)} bpm` : ""}
                        {w.total_energy ? ` | ${Math.round(w.total_energy)} cal` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="text-[7px] tracking-wider text-text-dim/40">{w.source || "Apple Watch"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Modal */}
      <MagiModal
        open={sessionModal}
        onClose={() => setSessionModal(false)}
        title={editingSession ? "EDIT SESSION" : "NEW SESSION"}
      >
        <div className="space-y-3">
          <MagiInput
            label="NAME"
            value={sessionForm.name}
            onChange={(v) => setSessionForm({ ...sessionForm, name: v })}
            placeholder="Push Day, Tennis Practice..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <MagiInput
              label="DATE"
              type="date"
              value={sessionForm.date}
              onChange={(v) => setSessionForm({ ...sessionForm, date: v })}
            />
            <MagiSelect
              label="TYPE"
              value={sessionForm.type}
              onChange={(v) => setSessionForm({ ...sessionForm, type: v as WorkoutSession["type"] })}
              options={[
                { value: "gym", label: "Gym" },
                { value: "tennis", label: "Tennis" },
                { value: "recovery", label: "Recovery" },
                { value: "cardio", label: "Cardio" },
              ]}
            />
          </div>
          <MagiNumber
            label="DURATION (MINUTES)"
            value={sessionForm.duration_minutes}
            onChange={(v) => setSessionForm({ ...sessionForm, duration_minutes: v })}
            min={0}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button
              onClick={() => setSessionModal(false)}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSaveSession}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
            >
              {editingSession ? "UPDATE" : "ADD"} SESSION
            </button>
          </div>
        </div>
      </MagiModal>

      {/* Exercise Modal */}
      <MagiModal
        open={exModal}
        onClose={() => setExModal(false)}
        title={editingEx ? "EDIT EXERCISE" : "ADD EXERCISE"}
      >
        <div className="space-y-3">
          <MagiInput
            label="EXERCISE NAME"
            value={exForm.name}
            onChange={(v) => setExForm({ ...exForm, name: v })}
            placeholder="Bench Press, Squats..."
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <MagiNumber
              label="SETS"
              value={exForm.sets}
              onChange={(v) => setExForm({ ...exForm, sets: v })}
              min={0}
            />
            <MagiNumber
              label="REPS"
              value={exForm.reps}
              onChange={(v) => setExForm({ ...exForm, reps: v })}
              min={0}
            />
            <MagiNumber
              label="WEIGHT (LBS)"
              value={exForm.weight}
              onChange={(v) => setExForm({ ...exForm, weight: v })}
              min={0}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button
              onClick={() => setExModal(false)}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSaveEx}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
            >
              {editingEx ? "UPDATE" : "ADD"} EXERCISE
            </button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Confirm */}
      <MagiConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.type === "session" ? "DELETE SESSION" : "DELETE EXERCISE"}
        message={
          deleteTarget?.type === "session"
            ? `Remove "${deleteTarget.item.name}" session? All exercises will be lost.`
            : `Remove "${deleteTarget?.item.name}" from this workout?`
        }
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
