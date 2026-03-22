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
        console.log("✅ Store hydrated from Supabase");
      } else {
        set({ hydrated: true, dataSource: "seed" });
        console.log("⚠️ Using seed data (Supabase auth failed)");
      }
    } catch (err) {
      console.error("Hydration error:", err);
      set({ hydrated: true, dataSource: "seed" });
    }
  },

  /* ── Body Measurements CRUD ── */
  addBodyMeasurement: (m) =>
    set((s) => ({ bodyMeasurements: [...s.bodyMeasurements, { ...m, id: uid("bm") }] })),
  updateBodyMeasurement: (id, m) =>
    set((s) => ({ bodyMeasurements: s.bodyMeasurements.map((x) => (x.id === id ? { ...x, ...m } : x)) })),
  deleteBodyMeasurement: (id) =>
    set((s) => ({ bodyMeasurements: s.bodyMeasurements.filter((x) => x.id !== id) })),

  /* ── Weigh-ins CRUD ── */
  addWeighIn: (w) =>
    set((s) => ({ weighIns: [...s.weighIns, { ...w, id: uid("w") }] })),
  updateWeighIn: (id, w) =>
    set((s) => ({ weighIns: s.weighIns.map((x) => (x.id === id ? { ...x, ...w } : x)) })),
  deleteWeighIn: (id) =>
    set((s) => ({ weighIns: s.weighIns.filter((x) => x.id !== id) })),

  /* ── Goals CRUD ── */
  addGoal: (g) =>
    set((s) => ({ goals: [...s.goals, { ...g, id: uid("g") }] })),
  updateGoal: (id, g) =>
    set((s) => ({ goals: s.goals.map((x) => (x.id === id ? { ...x, ...g } : x)) })),
  deleteGoal: (id) =>
    set((s) => ({ goals: s.goals.filter((x) => x.id !== id) })),

  /* ── Supplements CRUD ── */
  addSupplement: (sup) =>
    set((s) => ({ supplements: [...s.supplements, { ...sup, id: uid("s") }] })),
  updateSupplement: (id, sup) =>
    set((s) => ({ supplements: s.supplements.map((x) => (x.id === id ? { ...x, ...sup } : x)) })),
  deleteSupplement: (id) =>
    set((s) => ({ supplements: s.supplements.filter((x) => x.id !== id) })),

  /* ── Workouts CRUD ── */
  addWorkout: (w) =>
    set((s) => ({
      workouts: [
        ...s.workouts,
        {
          ...w,
          id: uid("wk"),
          exercises: (w.exercises || []).map((ex) => ({ ...ex, id: uid("ex") })),
        },
      ],
    })),
  updateWorkout: (id, w) =>
    set((s) => ({ workouts: s.workouts.map((x) => (x.id === id ? { ...x, ...w } : x)) })),
  deleteWorkout: (id) =>
    set((s) => ({ workouts: s.workouts.filter((x) => x.id !== id) })),
  addExercise: (workoutId, ex) =>
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: [...wk.exercises, { ...ex, id: uid("ex") }] }
          : wk,
      ),
    })),
  updateExercise: (workoutId, exerciseId, ex) =>
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? {
              ...wk,
              exercises: wk.exercises.map((e) =>
                e.id === exerciseId ? { ...e, ...ex } : e,
              ),
            }
          : wk,
      ),
    })),
  deleteExercise: (workoutId, exerciseId) =>
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? { ...wk, exercises: wk.exercises.filter((e) => e.id !== exerciseId) }
          : wk,
      ),
    })),
  toggleExercise: (workoutId, exerciseId) =>
    set((s) => ({
      workouts: s.workouts.map((wk) =>
        wk.id === workoutId
          ? {
              ...wk,
              exercises: wk.exercises.map((e) =>
                e.id === exerciseId ? { ...e, completed: !e.completed } : e,
              ),
            }
          : wk,
      ),
    })),

  /* ── Health Metrics CRUD ── */
  addHealthMetric: (m) =>
    set((s) => ({ healthMetrics: [...s.healthMetrics, m] })),
  updateHealthMetric: (date, m) =>
    set((s) => ({
      healthMetrics: s.healthMetrics.map((x) =>
        x.date === date ? { ...x, ...m } : x,
      ),
    })),
  deleteHealthMetric: (date) =>
    set((s) => ({ healthMetrics: s.healthMetrics.filter((x) => x.date !== date) })),

  /* ── Bloodwork CRUD ── */
  addBloodworkPanel: (p) =>
    set((s) => ({
      bloodwork: [...s.bloodwork, { ...p, id: uid("bp"), markers: p.markers || [] }],
    })),
  updateBloodworkPanel: (id, p) =>
    set((s) => ({
      bloodwork: s.bloodwork.map((x) => (x.id === id ? { ...x, ...p } : x)),
    })),
  deleteBloodworkPanel: (id) =>
    set((s) => ({ bloodwork: s.bloodwork.filter((x) => x.id !== id) })),
  addBloodworkMarker: (panelId, m) =>
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId ? { ...p, markers: [...p.markers, m] } : p,
      ),
    })),
  updateBloodworkMarker: (panelId, markerName, m) =>
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId
          ? {
              ...p,
              markers: p.markers.map((mk) =>
                mk.name === markerName ? { ...mk, ...m } : mk,
              ),
            }
          : p,
      ),
    })),
  deleteBloodworkMarker: (panelId, markerName) =>
    set((s) => ({
      bloodwork: s.bloodwork.map((p) =>
        p.id === panelId
          ? { ...p, markers: p.markers.filter((mk) => mk.name !== markerName) }
          : p,
      ),
    })),

  /* ── Checklist CRUD ── */
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

  /* ── Schedule Events CRUD ── */
  addScheduleEvent: (e) =>
    set((s) => ({
      scheduleEvents: [...s.scheduleEvents, { ...e, id: uid("se") }],
    })),
  updateScheduleEvent: (id, e) =>
    set((s) => ({
      scheduleEvents: s.scheduleEvents.map((x) =>
        x.id === id ? { ...x, ...e } : x,
      ),
    })),
  deleteScheduleEvent: (id) =>
    set((s) => ({
      scheduleEvents: s.scheduleEvents.filter((x) => x.id !== id),
    })),
}));
