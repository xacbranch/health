"use client";

import { create } from "zustand";
import type {
  WeighIn, Goal, Supplement, WorkoutSession, Exercise,
  HealthMetrics, BloodworkPanel, BloodworkMarker, ChecklistItem,
  ScheduleEvent, BodyMeasurement,
  ActivitySummary, AppleWorkout, SleepSession, Meal,
} from "@/types";
import { getChecklist, getAllScheduleEvents } from "@/lib/data";
import { fetchAll, fetchByRange } from "@/lib/supabase-data";
import { createClient } from "@/lib/supabase/client";

/* ─── Supabase helper (fire-and-forget writes) ─── */
const sb = createClient();

function dbInsert(table: string, row: Record<string, unknown>) {
  sb.from(table).insert(row).then(({ error }) => {
    if (error) console.error(`db insert ${table}:`, error.message);
  });
}
function dbUpdate(table: string, id: string, updates: Record<string, unknown>) {
  sb.from(table).update(updates).eq("id", id).then(({ error }) => {
    if (error) console.error(`db update ${table}:`, error.message);
  });
}
function dbDelete(table: string, id: string) {
  sb.from(table).delete().eq("id", id).then(({ error }) => {
    if (error) console.error(`db delete ${table}:`, error.message);
  });
}

/* ─── ID helper ─── */
let _counter = Date.now();
function uid(prefix = "x"): string {
  return `${prefix}-${(++_counter).toString(36)}`;
}

/* ─── Range cache types ─── */
export interface RangeData {
  healthMetrics: HealthMetrics[];
  weighIns: WeighIn[];
  activitySummaries: ActivitySummary[];
  appleWorkouts: AppleWorkout[];
  sleepSessions: SleepSession[];
  bodyMeasurements: BodyMeasurement[];
  meals: Meal[];
}

interface Store {
  /* ── State ── */
  hydrated: boolean;
  dataSource: "seed" | "supabase";

  /* ── Data ── */
  weighIns: WeighIn[];
  goals: Goal[];
  supplements: Supplement[];
  workouts: WorkoutSession[];
  healthMetrics: HealthMetrics[];
  bloodwork: BloodworkPanel[];
  checklist: ChecklistItem[];
  scheduleEvents: ScheduleEvent[];
  bodyMeasurements: BodyMeasurement[];

  /* ── Apple Health data ── */
  activitySummaries: ActivitySummary[];
  appleWorkouts: AppleWorkout[];
  sleepSessions: SleepSession[];

  /* ── Meals ── */
  meals: Meal[];

  /* ── Range cache ── */
  rangeCache: Record<string, RangeData>;
  rangeFetching: boolean;
  fetchRange: (from: string, to: string) => Promise<RangeData | null>;

  /* ── Hydration ── */
  hydrate: () => Promise<void>;

  /* ── Body Measurements ── */
  addBodyMeasurement: (m: Omit<BodyMeasurement, "id">) => void;
  updateBodyMeasurement: (id: string, m: Partial<Omit<BodyMeasurement, "id">>) => void;
  deleteBodyMeasurement: (id: string) => void;

  /* ── Weigh-ins ── */
  addWeighIn: (w: Omit<WeighIn, "id">) => void;
  updateWeighIn: (id: string, w: Partial<Omit<WeighIn, "id">>) => void;
  deleteWeighIn: (id: string) => void;

  /* ── Goals ── */
  addGoal: (g: Omit<Goal, "id">) => void;
  updateGoal: (id: string, g: Partial<Omit<Goal, "id">>) => void;
  deleteGoal: (id: string) => void;

  /* ── Supplements ── */
  addSupplement: (s: Omit<Supplement, "id">) => void;
  updateSupplement: (id: string, s: Partial<Omit<Supplement, "id">>) => void;
  deleteSupplement: (id: string) => void;

  /* ── Workouts ── */
  addWorkout: (w: Omit<WorkoutSession, "id" | "exercises"> & { exercises?: Omit<Exercise, "id">[] }) => void;
  updateWorkout: (id: string, w: Partial<Omit<WorkoutSession, "id" | "exercises">>) => void;
  deleteWorkout: (id: string) => void;
  addExercise: (workoutId: string, ex: Omit<Exercise, "id">) => void;
  updateExercise: (workoutId: string, exerciseId: string, ex: Partial<Omit<Exercise, "id">>) => void;
  deleteExercise: (workoutId: string, exerciseId: string) => void;
  toggleExercise: (workoutId: string, exerciseId: string) => void;

  /* ── Health Metrics ── */
  addHealthMetric: (m: HealthMetrics) => void;
  updateHealthMetric: (date: string, m: Partial<HealthMetrics>) => void;
  deleteHealthMetric: (date: string) => void;

  /* ── Bloodwork ── */
  addBloodworkPanel: (p: Omit<BloodworkPanel, "id" | "markers"> & { markers?: BloodworkMarker[] }) => void;
  updateBloodworkPanel: (id: string, p: Partial<Omit<BloodworkPanel, "id" | "markers">>) => void;
  deleteBloodworkPanel: (id: string) => void;
  addBloodworkMarker: (panelId: string, m: BloodworkMarker) => void;
  updateBloodworkMarker: (panelId: string, markerName: string, m: Partial<BloodworkMarker>) => void;
  deleteBloodworkMarker: (panelId: string, markerName: string) => void;

  /* ── Checklist ── */
  toggleChecklist: (key: string) => void;
  resetChecklist: () => void;
  addChecklistItem: (item: Omit<ChecklistItem, "completed">) => void;
  deleteChecklistItem: (key: string) => void;

  /* ── Schedule Events ── */
  addScheduleEvent: (e: Omit<ScheduleEvent, "id">) => void;
  updateScheduleEvent: (id: string, e: Partial<Omit<ScheduleEvent, "id">>) => void;
  deleteScheduleEvent: (id: string) => void;

  /* ── Meals ── */
  addMeal: (m: Omit<Meal, "id">) => void;
  updateMeal: (id: string, m: Partial<Omit<Meal, "id">>) => void;
  deleteMeal: (id: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  /* ── State ── */
  hydrated: false,
  dataSource: "seed",

  /* ── Initial data (empty until Supabase hydrates) ── */
  weighIns: [],
  goals: [],
  supplements: [],
  workouts: [],
  healthMetrics: [],
  bloodwork: [],
  checklist: getChecklist(),
  scheduleEvents: getAllScheduleEvents(),
  bodyMeasurements: [],
  activitySummaries: [],
  appleWorkouts: [],
  sleepSessions: [],
  meals: [],

  /* ── Range cache ── */
  rangeCache: {},
  rangeFetching: false,
  fetchRange: async (from, to) => {
    const key = `${from}|${to}`;
    const cached = get().rangeCache[key];
    if (cached) return cached;

    set({ rangeFetching: true });
    try {
      const data = await fetchByRange(from, to);
      if (data) {
        set((s) => ({
          rangeCache: { ...s.rangeCache, [key]: data },
          rangeFetching: false,
        }));
        return data;
      }
      set({ rangeFetching: false });
      return null;
    } catch (err) {
      console.error("fetchRange error:", err);
      set({ rangeFetching: false });
      return null;
    }
  },

  /* ── Hydrate from Supabase ── */
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const data = await fetchAll();
      if (data) {
        set({
          hydrated: true,
          dataSource: "supabase",
          healthMetrics: data.healthMetrics,
          weighIns: data.weighIns,
          goals: data.goals,
          supplements: data.supplements,
          workouts: data.workouts,
          bloodwork: data.bloodwork,
          checklist: data.checklist.length ? data.checklist : get().checklist,
          scheduleEvents: data.scheduleEvents.length ? data.scheduleEvents : get().scheduleEvents,
          bodyMeasurements: data.bodyMeasurements,
          activitySummaries: data.activitySummaries,
          appleWorkouts: data.appleWorkouts,
          sleepSessions: data.sleepSessions,
          meals: data.meals,
        });
        console.log("Store hydrated from Supabase");
      } else {
        set({ hydrated: true, dataSource: "seed" });
        console.log("Using seed data (Supabase auth failed)");
      }
    } catch (err) {
      console.error("Hydration error:", err);
      set({ hydrated: true, dataSource: "seed" });
    }
  },

  /* ══════════════════════════════════════════
     CRUD — each action updates local state
     AND persists to Supabase
     ══════════════════════════════════════════ */

  /* ── Body Measurements ── */
  addBodyMeasurement: (m) => {
    const id = uid("bm");
    const row = { ...m, id };
    set((s) => ({ bodyMeasurements: [...s.bodyMeasurements, row] }));
    dbInsert("body_measurements", { ...m, source: "user" });
  },
  updateBodyMeasurement: (id, m) => {
    set((s) => ({ bodyMeasurements: s.bodyMeasurements.map((x) => (x.id === id ? { ...x, ...m } : x)) }));
    dbUpdate("body_measurements", id, m);
  },
  deleteBodyMeasurement: (id) => {
    set((s) => ({ bodyMeasurements: s.bodyMeasurements.filter((x) => x.id !== id) }));
    dbDelete("body_measurements", id);
  },

  /* ── Weigh-ins ── */
  addWeighIn: (w) => {
    const id = uid("w");
    set((s) => ({ weighIns: [...s.weighIns, { ...w, id }] }));
    dbInsert("weigh_ins", { ...w, source: "user" });
  },
  updateWeighIn: (id, w) => {
    set((s) => ({ weighIns: s.weighIns.map((x) => (x.id === id ? { ...x, ...w } : x)) }));
    dbUpdate("weigh_ins", id, w);
  },
  deleteWeighIn: (id) => {
    set((s) => ({ weighIns: s.weighIns.filter((x) => x.id !== id) }));
    dbDelete("weigh_ins", id);
  },

  /* ── Goals ── */
  addGoal: (g) => {
    const id = uid("g");
    set((s) => ({ goals: [...s.goals, { ...g, id }] }));
    dbInsert("goals", g);
  },
  updateGoal: (id, g) => {
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? { ...x, ...g } : x)) }));
    dbUpdate("goals", id, g);
  },
  deleteGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) }));
    dbDelete("goals", id);
  },

  /* ── Supplements ── */
  addSupplement: (sup) => {
    const id = uid("s");
    set((s) => ({ supplements: [...s.supplements, { ...sup, id }] }));
    dbInsert("supplements", sup);
  },
  updateSupplement: (id, sup) => {
    set((s) => ({ supplements: s.supplements.map((x) => (x.id === id ? { ...x, ...sup } : x)) }));
    dbUpdate("supplements", id, sup);
  },
  deleteSupplement: (id) => {
    set((s) => ({ supplements: s.supplements.filter((x) => x.id !== id) }));
    dbDelete("supplements", id);
  },

  /* ── Workouts ── */
  addWorkout: (w) => {
    const id = uid("wk");
    const exercises = (w.exercises || []).map((ex) => ({ ...ex, id: uid("ex") }));
    const row = { ...w, id, exercises };
    set((s) => ({ workouts: [...s.workouts, row] }));
    // Insert session, then exercises
    const { exercises: _, ...session } = { ...w };
    dbInsert("workout_sessions", { ...session, id });
    for (const ex of exercises) {
      dbInsert("exercises", { ...ex, workout_session_id: id });
    }
  },
  updateWorkout: (id, w) => {
    set((s) => ({ workouts: s.workouts.map((x) => (x.id === id ? { ...x, ...w } : x)) }));
    dbUpdate("workout_sessions", id, w);
  },
  deleteWorkout: (id) => {
    set((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) }));
    // Delete exercises first (cascade might handle this, but be safe)
    sb.from("exercises").delete().eq("workout_session_id", id).then(() => {
      dbDelete("workout_sessions", id);
    });
  },
  addExercise: (workoutId, ex) => {
    const id = uid("ex");
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: [...wk.exercises, { ...ex, id }] }
          : wk,
      ),
    }));
    dbInsert("exercises", { ...ex, id, workout_session_id: workoutId });
  },
  updateExercise: (workoutId, exerciseId, ex) => {
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: wk.exercises.map((e) => e.id === exerciseId ? { ...e, ...ex } : e) }
          : wk,
      ),
    }));
    dbUpdate("exercises", exerciseId, ex);
  },
  deleteExercise: (workoutId, exerciseId) => {
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: wk.exercises.filter((e) => e.id !== exerciseId) }
          : wk,
      ),
    }));
    dbDelete("exercises", exerciseId);
  },
  toggleExercise: (workoutId, exerciseId) => {
    const wk = get().workouts.find((w) => w.id === workoutId);
    const ex = wk?.exercises.find((e) => e.id === exerciseId);
    const newCompleted = !(ex?.completed ?? false);
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: wk.exercises.map((e) => e.id === exerciseId ? { ...e, completed: newCompleted } : e) }
          : wk,
      ),
    }));
    dbUpdate("exercises", exerciseId, { completed: newCompleted });
  },

  /* ── Health Metrics ── */
  addHealthMetric: (m) => {
    set((s) => ({ healthMetrics: [...s.healthMetrics, m] }));
    dbInsert("health_metrics", { ...m, source: "user" });
  },
  updateHealthMetric: (date, m) => {
    set((s) => ({ healthMetrics: s.healthMetrics.map((x) => x.date === date ? { ...x, ...m } : x) }));
    // Update by date since health_metrics keys on (user_id, date)
    sb.from("health_metrics").update(m).eq("date", date).then(({ error }) => {
      if (error) console.error("db update health_metrics:", error.message);
    });
  },
  deleteHealthMetric: (date) => {
    set((s) => ({ healthMetrics: s.healthMetrics.filter((x) => x.date !== date) }));
    sb.from("health_metrics").delete().eq("date", date).then(({ error }) => {
      if (error) console.error("db delete health_metrics:", error.message);
    });
  },

  /* ── Bloodwork ── */
  addBloodworkPanel: (p) => {
    const id = uid("bp");
    const markers = p.markers || [];
    set((s) => ({ bloodwork: [...s.bloodwork, { ...p, id, markers }] }));
    const { markers: _, ...panel } = p;
    dbInsert("bloodwork_panels", { ...panel, id });
    for (const m of markers) {
      dbInsert("bloodwork_markers", { ...m, panel_id: id });
    }
  },
  updateBloodworkPanel: (id, p) => {
    set((s) => ({ bloodwork: s.bloodwork.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
    dbUpdate("bloodwork_panels", id, p);
  },
  deleteBloodworkPanel: (id) => {
    set((s) => ({ bloodwork: s.bloodwork.filter((x) => x.id !== id) }));
    sb.from("bloodwork_markers").delete().eq("panel_id", id).then(() => {
      dbDelete("bloodwork_panels", id);
    });
  },
  addBloodworkMarker: (panelId, m) => {
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId ? { ...p, markers: [...p.markers, m] } : p,
      ),
    }));
    dbInsert("bloodwork_markers", { ...m, panel_id: panelId });
  },
  updateBloodworkMarker: (panelId, markerName, m) => {
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId
          ? { ...p, markers: p.markers.map((mk) => mk.name === markerName ? { ...mk, ...m } : mk) }
          : p,
      ),
    }));
    // Update by composite key (panel_id + name)
    sb.from("bloodwork_markers").update(m).eq("panel_id", panelId).eq("name", markerName).then(({ error }) => {
      if (error) console.error("db update bloodwork_markers:", error.message);
    });
  },
  deleteBloodworkMarker: (panelId, markerName) => {
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId
          ? { ...p, markers: p.markers.filter((mk) => mk.name !== markerName) }
          : p,
      ),
    }));
    sb.from("bloodwork_markers").delete().eq("panel_id", panelId).eq("name", markerName).then(({ error }) => {
      if (error) console.error("db delete bloodwork_markers:", error.message);
    });
  },

  /* ── Checklist ── */
  toggleChecklist: (key) =>
    set((s) => ({
      checklist: s.checklist.map((c) =>
        c.key === key ? { ...c, completed: !c.completed } : c,
      ),
    })),
  resetChecklist: () => set({ checklist: getChecklist() }),
  addChecklistItem: (item) =>
    set((s) => ({
      checklist: [...s.checklist, { ...item, completed: false }],
    })),
  deleteChecklistItem: (key) =>
    set((s) => ({ checklist: s.checklist.filter((c) => c.key !== key) })),

  /* ── Schedule Events ── */
  addScheduleEvent: (e) => {
    const id = uid("se");
    set((s) => ({ scheduleEvents: [...s.scheduleEvents, { ...e, id }] }));
    dbInsert("schedule_events", { ...e, id });
  },
  updateScheduleEvent: (id, e) => {
    set((s) => ({ scheduleEvents: s.scheduleEvents.map((x) => x.id === id ? { ...x, ...e } : x) }));
    dbUpdate("schedule_events", id, e);
  },
  deleteScheduleEvent: (id) => {
    set((s) => ({ scheduleEvents: s.scheduleEvents.filter((x) => x.id !== id) }));
    dbDelete("schedule_events", id);
  },

  /* ── Meals ── */
  addMeal: (m) => {
    const id = uid("ml");
    set((s) => ({ meals: [...s.meals, { ...m, id }] }));
    dbInsert("meals", m);
  },
  updateMeal: (id, m) => {
    set((s) => ({ meals: s.meals.map((x) => (x.id === id ? { ...x, ...m } : x)) }));
    dbUpdate("meals", id, m);
  },
  deleteMeal: (id) => {
    set((s) => ({ meals: s.meals.filter((x) => x.id !== id) }));
    dbDelete("meals", id);
  },
}));
