import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/ingest
 * ────────────────
 * Receives health data from Health Auto Export (iOS app).
 *
 * Health Auto Export sends:
 *   { data: { metrics: [...], workouts: [...] } }
 *
 * Also accepts simple flat JSON for manual/curl testing.
 *
 * Auth: Bearer token via INGEST_SECRET env var.
 */

const INGEST_SECRET = process.env.INGEST_SECRET || "health-ingest-2026";
const USER_ID = "efd6fb17-951e-4d8c-a768-ec826ca3ae50";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

/* ─── Health Auto Export metric name → our DB column ─── */
const METRIC_MAP: Record<string, string> = {
  // Exact names from Health Auto Export
  "active_energy": "active_energy",
  "apple_exercise_time": "exercise_minutes",
  "apple_stand_time": "stand_hours",
  "basal_energy_burned": "basal_energy",
  "blood_oxygen": "blood_oxygen",
  "cycling_distance": "distance_mi",
  "distance_walking_running": "distance_mi",
  "environmental_audio_exposure": null as unknown as string,
  "flights_climbed": "flights_climbed",
  "headphone_audio_exposure": null as unknown as string,
  "heart_rate": "hr_samples",          // special: granular samples
  "heart_rate_variability": "hrv",
  "resting_heart_rate": "resting_hr",
  "respiratory_rate": "respiratory_rate",
  "sleep_analysis": "sleep",           // special: sleep sessions
  "step_count": "steps",
  "vo2max": "vo2_max",
  "walking_heart_rate_average": "walking_hr_avg",
  "heart_rate_recovery_one_minute": "heart_rate_recovery",
  "time_in_daylight": "daylight_minutes",
  "walking_steadiness": "walking_steadiness",
  "six_minute_walk_test_distance": "six_min_walk_m",
  "apple_sleeping_wrist_temperature": "wrist_temp_f",
  "body_mass": "weight",               // special: weigh-ins
  "body_fat_percentage": "body_fat",    // special: with weigh-ins
  "oxygen_saturation": "blood_oxygen",
};

/* ─── Accumulative metrics (sum all samples in a day) ─── */
const SUM_METRICS = new Set([
  "steps", "active_energy", "basal_energy", "flights_climbed",
  "exercise_minutes", "daylight_minutes", "distance_mi",
]);

/* ─── Process Health Auto Export payload ─── */
interface HAEDataPoint {
  date: string;
  qty?: number;
  value?: number;
  Avg?: number;
  Min?: number;
  Max?: number;
  source?: string;
  // Sleep fields
  asleep?: number;
  core?: number;
  deep?: number;
  rem?: number;
  inBed?: number;
  sleepStart?: string;
  sleepEnd?: string;
  // Sleep unaggregated
  startDate?: string;
  endDate?: string;
}

interface HAEMetric {
  name: string;
  units?: string;
  data: HAEDataPoint[];
}

interface HAEWorkout {
  id?: string;
  name: string;
  start: string;
  end: string;
  duration: number; // seconds
  distance?: number;
  activeEnergyBurned?: number;
  activeEnergy?: number;
  heartRateData?: { Avg?: number; Max?: number; Min?: number }[];
  avgHeartRate?: number;
  maxHeartRate?: number;
  source?: string;
}

async function processHAE(body: { data: { metrics?: HAEMetric[]; workouts?: HAEWorkout[] } }) {
  const sb = getSupabase();
  const results: Record<string, unknown> = {};

  // ── Aggregate daily metrics ──
  const dailyMap = new Map<string, Record<string, number | null>>();
  const hrSamples: { timestamp: string; bpm: number; source: string }[] = [];
  const sleepRows: { start_date: string; end_date: string; stage: string; source: string }[] = [];
  const weighIns: { date: string; weight: number; body_fat_pct: number | null; source: string }[] = [];

  for (const metric of body.data.metrics || []) {
    const key = metric.name?.toLowerCase().replace(/\s+/g, "_");
    const col = METRIC_MAP[key];

    if (!col || col === (null as unknown as string)) continue;

    for (const point of metric.data) {
      const date = (point.date || point.startDate || "").slice(0, 10);
      if (!date) continue;

      const val = point.qty ?? point.value ?? point.Avg ?? 0;

      // Heart rate → granular samples
      if (col === "hr_samples") {
        hrSamples.push({
          timestamp: point.date || point.startDate || "",
          bpm: Math.round(point.Avg ?? point.qty ?? val),
          source: point.source || "Health Auto Export",
        });
        continue;
      }

      // Sleep → sessions
      if (col === "sleep") {
        // Aggregated sleep format (has asleep/core/deep/rem)
        if (point.asleep !== undefined || point.core !== undefined) {
          if (!dailyMap.has(date)) dailyMap.set(date, {});
          const day = dailyMap.get(date)!;
          const totalSleep = (point.core || 0) + (point.deep || 0) + (point.rem || 0) + (point.asleep || 0);
          day.sleep_hours = +(totalSleep / 3600).toFixed(1); // seconds → hours
        }
        // Unaggregated sleep format (individual stages)
        if (point.startDate && point.endDate) {
          const stageValue = point.value as unknown as string;
          let stage = "asleep";
          if (typeof stageValue === "string") {
            if (stageValue.includes("InBed")) stage = "inBed";
            else if (stageValue.includes("Awake")) stage = "awake";
            else if (stageValue.includes("Core")) stage = "core";
            else if (stageValue.includes("Deep")) stage = "deep";
            else if (stageValue.includes("REM")) stage = "rem";
          }
          sleepRows.push({
            start_date: point.startDate,
            end_date: point.endDate,
            stage,
            source: point.source || "Health Auto Export",
          });
        }
        continue;
      }

      // Weight → weigh_ins table
      if (col === "weight") {
        weighIns.push({ date, weight: +val, body_fat_pct: null, source: "health_auto_export" });
        continue;
      }
      if (col === "body_fat") {
        // Try to attach to existing weigh-in for same date
        const existing = weighIns.find((w) => w.date === date);
        if (existing) existing.body_fat_pct = +(val * 100).toFixed(1);
        continue;
      }

      // Standard metrics → daily aggregate
      if (!dailyMap.has(date)) dailyMap.set(date, {});
      const day = dailyMap.get(date)!;

      let processed = +val;
      // Blood oxygen: 0.98 → 98.0
      if (col === "blood_oxygen" && processed <= 1) processed = +(processed * 100).toFixed(1);
      // Walking steadiness: 0.85 → 85.0
      if (col === "walking_steadiness" && processed <= 1) processed = +(processed * 100).toFixed(1);
      // Stand time minutes → hours
      if (col === "stand_hours" && processed > 24) processed = +(processed / 60).toFixed(0);
      // Wrist temp: degC → degF if needed
      if (col === "wrist_temp_f" && metric.units === "degC") processed = +(processed * 9 / 5 + 32).toFixed(2);

      if (SUM_METRICS.has(col)) {
        day[col] = (day[col] || 0) + Math.round(processed);
      } else {
        day[col] = +processed.toFixed(2);
      }
    }
  }

  // Upsert daily health metrics
  const metricsRows = [...dailyMap.entries()].map(([date, metrics]) => ({
    user_id: USER_ID,
    date,
    source: "health_auto_export",
    ...metrics,
  }));
  if (metricsRows.length) {
    const { error } = await sb.from("health_metrics").upsert(metricsRows, {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    });
    results.metrics = error ? { error: error.message } : { days: metricsRows.length };
  }

  // Insert heart rate samples (skip dups via ON CONFLICT)
  if (hrSamples.length) {
    const rows = hrSamples.map((s) => ({ user_id: USER_ID, ...s, context: null }));
    const { error } = await sb.from("heart_rate_samples").upsert(rows, {
      onConflict: "user_id,timestamp,bpm",
      ignoreDuplicates: true,
    });
    results.heart_rate = error ? { error: error.message } : { count: rows.length };
  }

  // Insert sleep sessions (skip dups)
  if (sleepRows.length) {
    const rows = sleepRows.map((s) => ({ user_id: USER_ID, ...s }));
    const { error } = await sb.from("sleep_sessions").upsert(rows, {
      onConflict: "user_id,start_date,end_date,stage",
      ignoreDuplicates: true,
    });
    results.sleep = error ? { error: error.message } : { count: rows.length };
  }

  // Insert weigh-ins
  if (weighIns.length) {
    const rows = weighIns.map((w) => ({ user_id: USER_ID, ...w }));
    const { error } = await sb.from("weigh_ins").upsert(rows, { onConflict: "user_id,date", ignoreDuplicates: true });
    results.weight = error ? { error: error.message } : { count: rows.length };
  }

  // ── Workouts ──
  if (body.data.workouts?.length) {
    const rows = body.data.workouts.map((w) => ({
      user_id: USER_ID,
      activity_type: w.name || "Unknown",
      start_date: w.start,
      end_date: w.end,
      duration_minutes: w.duration ? +(w.duration / 60).toFixed(1) : null,
      total_distance: w.distance || null,
      distance_unit: w.distance ? "mi" : null,
      total_energy: w.activeEnergyBurned || w.activeEnergy || null,
      energy_unit: (w.activeEnergyBurned || w.activeEnergy) ? "Cal" : null,
      avg_hr: w.avgHeartRate || w.heartRateData?.[0]?.Avg || null,
      max_hr: w.maxHeartRate || w.heartRateData?.[0]?.Max || null,
      source: w.source || "Health Auto Export",
    }));
    const { error } = await sb.from("apple_workouts").upsert(rows, {
      onConflict: "user_id,activity_type,start_date",
      ignoreDuplicates: true,
    });
    results.workouts = error ? { error: error.message } : { count: rows.length };
  }

  return results;
}

/* ─── Simple flat JSON (for curl/testing) ─── */
async function processSimple(body: Record<string, unknown>) {
  const sb = getSupabase();
  const date = (body.date as string) || new Date().toISOString().slice(0, 10);
  const results: Record<string, unknown> = { date };

  const metricsFields = [
    "resting_hr", "hrv", "steps", "active_energy", "sleep_hours",
    "vo2_max", "blood_oxygen", "respiratory_rate", "exercise_minutes",
    "stand_hours", "distance_mi", "flights_climbed", "basal_energy",
    "daylight_minutes", "walking_hr_avg", "heart_rate_recovery",
    "wrist_temp_f", "walking_steadiness", "six_min_walk_m",
  ];
  const metricsRow: Record<string, unknown> = { user_id: USER_ID, date, source: body.source || "manual" };
  let hasMetrics = false;
  for (const f of metricsFields) {
    if (body[f] !== undefined && body[f] !== null) {
      metricsRow[f] = body[f];
      hasMetrics = true;
    }
  }
  if (hasMetrics) {
    const { error } = await sb.from("health_metrics").upsert([metricsRow], {
      onConflict: "user_id,date",
      ignoreDuplicates: false,
    });
    results.metrics = error ? { error: error.message } : { ok: true };
  }

  if (body.weight) {
    const { error } = await sb.from("weigh_ins").insert([{
      user_id: USER_ID, date,
      weight: body.weight,
      body_fat_pct: body.body_fat_pct ?? null,
      source: body.source || "manual",
    }]);
    results.weight = error ? { error: error.message } : { ok: true };
  }

  return results;
}

/* ─── Handler ─── */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (token !== INGEST_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Health Auto Export format: { data: { metrics: [...], workouts: [...] } }
    if (body?.data?.metrics || body?.data?.workouts) {
      const result = await processHAE(body);
      return NextResponse.json({ ok: true, format: "health_auto_export", ...result });
    }

    // Simple flat JSON
    const result = await processSimple(body);
    return NextResponse.json({ ok: true, format: "simple", ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "health-ingest", format: "Health Auto Export or flat JSON" });
}
