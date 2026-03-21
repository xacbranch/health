/**
 * Supabase Edge Function: ingest-health
 * ──────────────────────────────────────
 * Receives Apple Health data from:
 *   1. Health Auto Export app (iOS) — JSON body with metrics array
 *   2. Apple Shortcuts — JSON body with single-day snapshot
 *   3. Manual POST — curl/fetch for testing
 *
 * Auth: Bearer token (INGEST_SECRET env var) — lightweight shared secret.
 *       Not using Supabase JWT since the sender is an iOS app, not a browser.
 *
 * Endpoint: POST https://<project>.supabase.co/functions/v1/ingest-health
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_SECRET = Deno.env.get("INGEST_SECRET") || "health-ingest-2026";
const USER_ID = "efd6fb17-951e-4d8c-a768-ec826ca3ae50"; // Xach

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ─── CORS headers ─── */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ─── Health Auto Export format adapter ─── */
interface HAEMetric {
  name: string;          // e.g. "step_count", "resting_heart_rate"
  units: string;         // e.g. "count", "bpm"
  data: { date: string; qty?: number; value?: number; source?: string }[];
}

interface HAEPayload {
  data: {
    metrics: HAEMetric[];
    workouts?: {
      name: string;
      start: string;
      end: string;
      duration: number;
      activeEnergy?: number;
      distance?: number;
      avgHeartRate?: number;
      maxHeartRate?: number;
      source?: string;
    }[];
  };
}

/* ─── Shortcuts / simple format ─── */
interface SimplePayload {
  date?: string;
  resting_hr?: number;
  hrv?: number;
  steps?: number;
  active_energy?: number;
  sleep_hours?: number;
  vo2_max?: number;
  blood_oxygen?: number;
  respiratory_rate?: number;
  exercise_minutes?: number;
  stand_hours?: number;
  distance_mi?: number;
  flights_climbed?: number;
  weight?: number;
  body_fat_pct?: number;
  heart_rate_samples?: { timestamp: string; bpm: number }[];
  workouts?: {
    activity_type: string;
    start_date: string;
    end_date: string;
    duration_minutes: number;
    total_distance?: number;
    total_energy?: number;
    avg_hr?: number;
    max_hr?: number;
    source?: string;
  }[];
}

/* ─── HAE metric name → our column mapping ─── */
const METRIC_MAP: Record<string, string> = {
  step_count: "steps",
  steps: "steps",
  resting_heart_rate: "resting_hr",
  heart_rate_variability: "hrv",
  active_energy: "active_energy",
  active_energy_burned: "active_energy",
  basal_energy_burned: "basal_energy",
  sleep_analysis: "sleep_hours",
  vo2_max: "vo2_max",
  blood_oxygen: "blood_oxygen",
  oxygen_saturation: "blood_oxygen",
  respiratory_rate: "respiratory_rate",
  walking_heart_rate_average: "walking_hr_avg",
  heart_rate_recovery: "heart_rate_recovery",
  exercise_time: "exercise_minutes",
  apple_exercise_time: "exercise_minutes",
  stand_hours: "stand_hours",
  apple_stand_hour: "stand_hours",
  distance_walking_running: "distance_mi",
  flights_climbed: "flights_climbed",
  time_in_daylight: "daylight_minutes",
  walking_steadiness: "walking_steadiness",
  six_minute_walk_test_distance: "six_min_walk_m",
  wrist_temperature: "wrist_temp_f",
};

/* ─── Process Health Auto Export payload ─── */
async function processHAE(payload: HAEPayload) {
  const dailyMap = new Map<string, Record<string, number | null>>();

  for (const metric of payload.data.metrics) {
    const col = METRIC_MAP[metric.name.toLowerCase()] || METRIC_MAP[metric.name];
    if (!col) continue;

    for (const point of metric.data) {
      const date = point.date?.slice(0, 10);
      if (!date) continue;

      if (!dailyMap.has(date)) dailyMap.set(date, {});
      const day = dailyMap.get(date)!;

      const val = point.qty ?? point.value ?? 0;

      // Accumulative metrics
      if (["steps", "active_energy", "basal_energy", "flights_climbed", "exercise_minutes", "daylight_minutes"].includes(col)) {
        day[col] = (day[col] || 0) + val;
      } else if (col === "blood_oxygen" && val <= 1) {
        day[col] = +(val * 100).toFixed(1); // 0.98 → 98.0
      } else {
        day[col] = +val.toFixed(2);
      }
    }
  }

  // Upsert daily metrics
  const rows = [...dailyMap.entries()].map(([date, metrics]) => ({
    user_id: USER_ID,
    date,
    ...metrics,
  }));

  let metricsResult = { count: 0, error: null as string | null };
  if (rows.length) {
    const { error } = await sb.from("health_metrics").upsert(rows, {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    });
    metricsResult = { count: rows.length, error: error?.message || null };
  }

  // Process workouts
  let workoutsResult = { count: 0, error: null as string | null };
  if (payload.data.workouts?.length) {
    const wkRows = payload.data.workouts.map((w) => ({
      user_id: USER_ID,
      activity_type: w.name,
      start_date: w.start,
      end_date: w.end,
      duration_minutes: +(w.duration / 60).toFixed(1),
      total_energy: w.activeEnergy || null,
      energy_unit: w.activeEnergy ? "Cal" : null,
      total_distance: w.distance || null,
      distance_unit: w.distance ? "mi" : null,
      avg_hr: w.avgHeartRate || null,
      max_hr: w.maxHeartRate || null,
      source: w.source || "Health Auto Export",
    }));
    const { error } = await sb.from("apple_workouts").insert(wkRows);
    workoutsResult = { count: wkRows.length, error: error?.message || null };
  }

  return { metrics: metricsResult, workouts: workoutsResult };
}

/* ─── Process simple/Shortcuts payload ─── */
async function processSimple(payload: SimplePayload) {
  const date = payload.date || new Date().toISOString().slice(0, 10);
  const results: Record<string, unknown> = {};

  // Health metrics upsert
  const metricsRow: Record<string, unknown> = { user_id: USER_ID, date };
  const metricsFields = [
    "resting_hr", "hrv", "steps", "active_energy", "sleep_hours",
    "vo2_max", "blood_oxygen", "respiratory_rate", "exercise_minutes",
    "stand_hours", "distance_mi", "flights_climbed",
  ];
  for (const f of metricsFields) {
    if ((payload as Record<string, unknown>)[f] !== undefined) {
      metricsRow[f] = (payload as Record<string, unknown>)[f];
    }
  }

  if (Object.keys(metricsRow).length > 2) {
    const { error } = await sb.from("health_metrics").upsert([metricsRow], {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    });
    results.metrics = { ok: !error, error: error?.message };
  }

  // Weight
  if (payload.weight) {
    const { error } = await sb.from("weigh_ins").insert([{
      user_id: USER_ID,
      date,
      weight: payload.weight,
      body_fat_pct: payload.body_fat_pct || null,
    }]);
    results.weight = { ok: !error, error: error?.message };
  }

  // Heart rate samples
  if (payload.heart_rate_samples?.length) {
    const hrRows = payload.heart_rate_samples.map((s) => ({
      user_id: USER_ID,
      timestamp: s.timestamp,
      bpm: s.bpm,
      context: null,
      source: "Shortcuts",
    }));
    const { error } = await sb.from("heart_rate_samples").insert(hrRows);
    results.heart_rate = { count: hrRows.length, error: error?.message };
  }

  // Workouts
  if (payload.workouts?.length) {
    const wkRows = payload.workouts.map((w) => ({
      user_id: USER_ID,
      ...w,
      source: w.source || "Shortcuts",
    }));
    const { error } = await sb.from("apple_workouts").insert(wkRows);
    results.workouts = { count: wkRows.length, error: error?.message };
  }

  return results;
}

/* ─── Handler ─── */
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  // Auth check
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (token !== INGEST_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json();

    // Detect format: Health Auto Export sends { data: { metrics: [...] } }
    if (body?.data?.metrics) {
      const result = await processHAE(body as HAEPayload);
      return json({ ok: true, format: "health_auto_export", ...result });
    }

    // Simple/Shortcuts format
    const result = await processSimple(body as SimplePayload);
    return json({ ok: true, format: "simple", date: body.date, ...result });

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
