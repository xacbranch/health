"use client";

/**
 * Supabase data fetching layer
 * Fetches real data from Supabase tables for the dashboard.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  WeighIn, Goal, Supplement, WorkoutSession,
  HealthMetrics, BloodworkPanel,
  ChecklistItem, ScheduleEvent, BodyMeasurement,
  ActivitySummary, AppleWorkout, SleepSession, Meal,
} from "@/types";

const sb = createClient();

/* ─── Types ─── */
export interface DateRange {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

/* ─── Auth ─── */
export async function ensureAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session.user;

  const { data, error } = await sb.auth.signInWithPassword({
    email: "xach@healthos.app",
    password: "temppass123!",
  });
  if (error) {
    console.warn("Supabase auth failed, falling back to seed data:", error.message);
    return null;
  }
  return data.user;
}

/* ─── Helper: apply date range to query ─── */
function applyRange(
  query: ReturnType<ReturnType<typeof sb.from>["select"]>,
  range: DateRange | undefined,
  dateCol = "date",
  defaultLimit = 90,
) {
  if (range?.from) query = query.gte(dateCol, range.from);
  if (range?.to) query = query.lte(dateCol, range.to);
  if (!range?.from && !range?.to) query = query.limit(defaultLimit);
  return query;
}

/* ─── Fetchers ─── */

export async function fetchHealthMetrics(range?: DateRange): Promise<HealthMetrics[]> {
  let query = sb.from("health_metrics").select("*").order("date", { ascending: true });
  query = applyRange(query, range, "date", 90);
  const { data, error } = await query;
  if (error) { console.error("health_metrics:", error.message); return []; }
  return data || [];
}

export async function fetchWeighIns(range?: DateRange): Promise<WeighIn[]> {
  let query = sb.from("weigh_ins").select("*").order("date", { ascending: true });
  query = applyRange(query, range, "date", 100);
  const { data, error } = await query;
  if (error) { console.error("weigh_ins:", error.message); return []; }
  return data || [];
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await sb.from("goals").select("*");
  if (error) { console.error("goals:", error.message); return []; }
  return data || [];
}

export async function fetchSupplements(): Promise<Supplement[]> {
  const { data, error } = await sb.from("supplements").select("*");
  if (error) { console.error("supplements:", error.message); return []; }
  return data || [];
}

export async function fetchWorkouts(range?: DateRange): Promise<WorkoutSession[]> {
  let query = sb.from("workout_sessions").select("*, exercises(*)").order("date", { ascending: true });
  query = applyRange(query, range, "date", 30);
  const { data, error } = await query;
  if (error) { console.error("workout_sessions:", error.message); return []; }
  return data || [];
}

export async function fetchBloodwork(): Promise<BloodworkPanel[]> {
  const { data, error } = await sb
    .from("bloodwork_panels")
    .select("*, markers:bloodwork_markers(*)")
    .order("date", { ascending: false });
  if (error) { console.error("bloodwork_panels:", error.message); return []; }
  return data || [];
}

export async function fetchChecklist(): Promise<ChecklistItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb.from("daily_checklist").select("*").eq("date", today);
  if (error) { console.error("daily_checklist:", error.message); return []; }
  return data || [];
}

export async function fetchScheduleEvents(): Promise<ScheduleEvent[]> {
  const { data, error } = await sb.from("schedule_events").select("*");
  if (error) { console.error("schedule_events:", error.message); return []; }
  return data || [];
}

export async function fetchBodyMeasurements(range?: DateRange): Promise<BodyMeasurement[]> {
  let query = sb.from("body_measurements").select("*").order("date", { ascending: true });
  query = applyRange(query, range, "date", 200);
  const { data, error } = await query;
  if (error) { console.error("body_measurements:", error.message); return []; }
  return data || [];
}

export async function fetchActivitySummaries(range?: DateRange): Promise<ActivitySummary[]> {
  let query = sb.from("activity_summaries").select("*").order("date", { ascending: true });
  query = applyRange(query, range, "date", 90);
  const { data, error } = await query;
  if (error) { console.error("activity_summaries:", error.message); return []; }
  return data || [];
}

export async function fetchAppleWorkouts(range?: DateRange): Promise<AppleWorkout[]> {
  let query = sb.from("apple_workouts").select("*").order("start_date", { ascending: true });
  query = applyRange(query, range, "start_date", 100);
  const { data, error } = await query;
  if (error) { console.error("apple_workouts:", error.message); return []; }
  return data || [];
}

export async function fetchSleepSessions(range?: DateRange): Promise<SleepSession[]> {
  let query = sb.from("sleep_sessions").select("*").order("start_date", { ascending: true });
  query = applyRange(query, range, "start_date", 2000);
  const { data, error } = await query;
  if (error) { console.error("sleep_sessions:", error.message); return []; }
  return data || [];
}

export async function fetchMeals(range?: DateRange): Promise<Meal[]> {
  let query = sb.from("meals").select("*").order("date", { ascending: true });
  query = applyRange(query, range, "date", 100);
  const { data, error } = await query;
  if (error) { console.error("meals:", error.message); return []; }
  return data || [];
}

/* ─── Hydrate all (default — backward compat) ─── */
export async function fetchAll() {
  const user = await ensureAuth();
  if (!user) return null;

  const [
    healthMetrics, weighIns, goals, supplements,
    workouts, bloodwork, checklist, scheduleEvents,
    bodyMeasurements, activitySummaries, appleWorkouts, sleepSessions, meals,
  ] = await Promise.all([
    fetchHealthMetrics(), fetchWeighIns(), fetchGoals(), fetchSupplements(),
    fetchWorkouts(), fetchBloodwork(), fetchChecklist(), fetchScheduleEvents(),
    fetchBodyMeasurements(), fetchActivitySummaries(), fetchAppleWorkouts(),
    fetchSleepSessions(), fetchMeals(),
  ]);

  return {
    healthMetrics, weighIns, goals, supplements,
    workouts, bloodwork, checklist, scheduleEvents,
    bodyMeasurements, activitySummaries, appleWorkouts, sleepSessions, meals,
  };
}

/* ─── Fetch by date range ─── */
export async function fetchByRange(from: string, to: string) {
  const user = await ensureAuth();
  if (!user) return null;

  const range = { from, to };
  const [
    healthMetrics, weighIns, activitySummaries,
    appleWorkouts, sleepSessions, bodyMeasurements, meals,
  ] = await Promise.all([
    fetchHealthMetrics(range),
    fetchWeighIns(range),
    fetchActivitySummaries(range),
    fetchAppleWorkouts(range),
    fetchSleepSessions(range),
    fetchBodyMeasurements(range),
    fetchMeals(range),
  ]);

  return { healthMetrics, weighIns, activitySummaries, appleWorkouts, sleepSessions, bodyMeasurements, meals };
}
