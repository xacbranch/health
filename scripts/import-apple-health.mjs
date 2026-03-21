#!/usr/bin/env node
/**
 * Apple Health XML → Supabase importer
 * ─────────────────────────────────────
 * Streams the giant export.xml line-by-line, extracts records by regex,
 * aggregates daily metrics, and batch-inserts into Supabase.
 *
 * Usage:
 *   node scripts/import-apple-health.mjs /path/to/export.xml
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

/* ─── Config ─── */
const SUPABASE_URL = "https://htfapeuyebowmtpavgjq.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const USER_ID = process.env.SUPABASE_USER_ID; // UUID of the target user
const BATCH_SIZE = 500;

const xmlPath = process.argv[2] || "/tmp/health_export/apple_health_export/export.xml";

if (!SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Set SUPABASE_SERVICE_KEY env var (use service_role key, not anon)");
  console.error("  Find it at: https://supabase.com/dashboard → Settings → API → service_role");
  process.exit(1);
}
if (!USER_ID) {
  console.error("ERROR: Set SUPABASE_USER_ID env var (UUID of the user to import data for)");
  console.error("  Create a user first, then grab their UUID from auth.users");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ─── Attribute parser ─── */
function parseAttrs(line) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

/* ─── Date helpers ─── */
function toDate(str) {
  // "2024-01-15 08:30:00 -0700" → ISO
  if (!str) return null;
  return str.replace(" ", "T").replace(/ ([+-]\d{4})/, "$1");
}
function dateOnly(str) {
  if (!str) return null;
  return str.slice(0, 10);
}

/* ─── Accumulators ─── */
// daily metrics keyed by date
const dailyMetrics = new Map();
function getDay(date) {
  const d = dateOnly(date);
  if (!d) return null;
  if (!dailyMetrics.has(d)) {
    dailyMetrics.set(d, {
      date: d,
      resting_hr: null,
      hrv: null,
      sleep_hours: null,
      steps: 0,
      active_energy: 0,
      vo2_max: null,
      respiratory_rate: null,
      blood_oxygen: null,
      wrist_temp_f: null,
      heart_rate_recovery: null,
      walking_hr_avg: null,
      exercise_minutes: null,
      stand_hours: null,
      distance_mi: 0,
      flights_climbed: 0,
      basal_energy: 0,
      daylight_minutes: null,
      walking_steadiness: null,
      six_min_walk_m: null,
    });
  }
  return dailyMetrics.get(d);
}

const activitySummaries = [];
const heartRateSamples = [];
const appleWorkouts = [];
const sleepSessions = [];

// Track current workout for nested WorkoutStatistics
let currentWorkout = null;

/* ─── Type mapping for records ─── */
const RECORD_HANDLERS = {
  HKQuantityTypeIdentifierRestingHeartRate: (day, v) => { day.resting_hr = +v; },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: (day, v) => { day.hrv = Math.round(+v); },
  HKQuantityTypeIdentifierStepCount: (day, v) => { day.steps += Math.round(+v); },
  HKQuantityTypeIdentifierActiveEnergyBurned: (day, v) => { day.active_energy += Math.round(+v); },
  HKQuantityTypeIdentifierBasalEnergyBurned: (day, v) => { day.basal_energy += Math.round(+v); },
  HKQuantityTypeIdentifierDistanceWalkingRunning: (day, v) => { day.distance_mi += +v; },
  HKQuantityTypeIdentifierFlightsClimbed: (day, v) => { day.flights_climbed += Math.round(+v); },
  HKQuantityTypeIdentifierVO2Max: (day, v) => { day.vo2_max = +v; },
  HKQuantityTypeIdentifierRespiratoryRate: (day, v) => { day.respiratory_rate = +v; },
  HKQuantityTypeIdentifierOxygenSaturation: (day, v) => { day.blood_oxygen = +(v * 100).toFixed(1); },
  HKQuantityTypeIdentifierAppleWalkingSteadiness: (day, v) => { day.walking_steadiness = +(v * 100).toFixed(1); },
  HKQuantityTypeIdentifierSixMinuteWalkTestDistance: (day, v) => { day.six_min_walk_m = +v; },
  HKQuantityTypeIdentifierAppleExerciseTime: (day, v) => {
    day.exercise_minutes = (day.exercise_minutes || 0) + Math.round(+v);
  },
  HKQuantityTypeIdentifierAppleStandTime: (day, v) => {
    // stand time in minutes; convert to hours for stand_hours
    day.stand_hours = Math.round(((day.stand_hours || 0) * 60 + +v) / 60);
  },
  HKQuantityTypeIdentifierWalkingHeartRateAverage: (day, v) => { day.walking_hr_avg = +v; },
  HKQuantityTypeIdentifierHeartRateRecoveryOneMinute: (day, v) => { day.heart_rate_recovery = +v; },
  HKQuantityTypeIdentifierEnvironmentalAudioExposure: null, // skip
  HKQuantityTypeIdentifierHeadphoneAudioExposure: null, // skip
};

// Wrist temperature - Apple uses different type identifiers
const WRIST_TEMP_TYPES = [
  "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
  "HKQuantityTypeIdentifierWristTemperature",
];

/* ─── Heart rate handler (granular samples) ─── */
function handleHeartRate(attrs) {
  heartRateSamples.push({
    timestamp: toDate(attrs.startDate),
    bpm: +attrs.value,
    context: null, // could infer from metadata
    source: attrs.sourceName || null,
  });
}

/* ─── Sleep handler ─── */
const SLEEP_VALUE_MAP = {
  HKCategoryValueSleepAnalysisInBed: "inBed",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleep: "asleep",
  HKCategoryValueSleepAnalysisAwake: "awake",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
};

function handleSleep(attrs) {
  const stage = SLEEP_VALUE_MAP[attrs.value];
  if (!stage) return;
  sleepSessions.push({
    start_date: toDate(attrs.startDate),
    end_date: toDate(attrs.endDate),
    stage,
    source: attrs.sourceName || null,
  });

  // Also aggregate total sleep hours per day for health_metrics
  if (stage !== "inBed" && stage !== "awake") {
    const d = dateOnly(attrs.startDate);
    const day = getDay(attrs.startDate);
    if (day) {
      const start = new Date(toDate(attrs.startDate));
      const end = new Date(toDate(attrs.endDate));
      const hours = (end - start) / 3600000;
      day.sleep_hours = (day.sleep_hours || 0) + hours;
    }
  }
}

/* ─── Daylight / time in daylight ─── */
RECORD_HANDLERS["HKQuantityTypeIdentifierTimeInDaylight"] = (day, v) => {
  day.daylight_minutes = (day.daylight_minutes || 0) + Math.round(+v);
};

/* ─── Main scan ─── */
async function scan() {
  console.log(`📂 Reading: ${xmlPath}`);
  const rl = createInterface({
    input: createReadStream(xmlPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let recordCount = 0;
  let workoutCount = 0;
  let activityCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 200000 === 0) {
      process.stdout.write(`  …scanned ${(lineCount / 1000).toFixed(0)}k lines\r`);
    }

    const trimmed = line.trimStart();

    // ── Record elements ──
    if (trimmed.startsWith("<Record ")) {
      const attrs = parseAttrs(trimmed);
      const type = attrs.type;
      recordCount++;

      // Heart rate → granular samples
      if (type === "HKQuantityTypeIdentifierHeartRate") {
        handleHeartRate(attrs);
        continue;
      }

      // Sleep analysis
      if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
        handleSleep(attrs);
        continue;
      }

      // Wrist temperature
      if (WRIST_TEMP_TYPES.includes(type)) {
        const day = getDay(attrs.startDate);
        if (day) {
          // Apple reports in degC for sleeping wrist temp as deviation, or in degC
          let tempF = +attrs.value;
          if (attrs.unit === "degC") tempF = tempF * 9 / 5 + 32;
          // Sleeping wrist temp is a deviation from baseline — store raw
          day.wrist_temp_f = +tempF.toFixed(2);
        }
        continue;
      }

      // Standard record handlers
      const handler = RECORD_HANDLERS[type];
      if (handler) {
        const day = getDay(attrs.startDate);
        if (day) handler(day, attrs.value);
      }
      continue;
    }

    // ── Workout elements ──
    if (trimmed.startsWith("<Workout ")) {
      const attrs = parseAttrs(trimmed);
      workoutCount++;
      currentWorkout = {
        activity_type: (attrs.workoutActivityType || "").replace("HKWorkoutActivityType", ""),
        start_date: toDate(attrs.startDate),
        end_date: toDate(attrs.endDate),
        duration_minutes: attrs.duration ? +parseFloat(attrs.duration).toFixed(1) : null,
        total_distance: attrs.totalDistance ? +parseFloat(attrs.totalDistance).toFixed(2) : null,
        distance_unit: attrs.totalDistanceUnit || null,
        total_energy: attrs.totalEnergyBurned ? +parseFloat(attrs.totalEnergyBurned).toFixed(1) : null,
        energy_unit: attrs.totalEnergyBurnedUnit || null,
        avg_hr: null,
        max_hr: null,
        source: attrs.sourceName || null,
      };
      appleWorkouts.push(currentWorkout);
      continue;
    }

    // ── WorkoutStatistics (child of Workout) ──
    if (trimmed.startsWith("<WorkoutStatistics ") && currentWorkout) {
      const attrs = parseAttrs(trimmed);
      if (attrs.type === "HKQuantityTypeIdentifierHeartRate") {
        if (attrs.average) currentWorkout.avg_hr = +parseFloat(attrs.average).toFixed(1);
        if (attrs.maximum) currentWorkout.max_hr = +parseFloat(attrs.maximum).toFixed(1);
      }
      continue;
    }

    // ── End of workout ──
    if (trimmed.startsWith("</Workout>")) {
      currentWorkout = null;
      continue;
    }

    // ── ActivitySummary elements ──
    if (trimmed.startsWith("<ActivitySummary ")) {
      const attrs = parseAttrs(trimmed);
      activityCount++;
      activitySummaries.push({
        date: attrs.dateComponents,
        active_energy_burned: +attrs.activeEnergyBurned || 0,
        active_energy_goal: +attrs.activeEnergyBurnedGoal || 0,
        exercise_minutes: +attrs.appleExerciseTime || 0,
        exercise_goal: +attrs.appleExerciseTimeGoal || 0,
        stand_hours: +attrs.appleStandHours || 0,
        stand_goal: +attrs.appleStandHoursGoal || 0,
      });
      continue;
    }
  }

  console.log(`\n✅ Scan complete: ${(lineCount/1000).toFixed(0)}k lines`);
  console.log(`   Records: ${recordCount}`);
  console.log(`   Daily metrics: ${dailyMetrics.size} days`);
  console.log(`   Heart rate samples: ${heartRateSamples.length}`);
  console.log(`   Activity summaries: ${activitySummaries.length}`);
  console.log(`   Workouts: ${workoutCount}`);
  console.log(`   Sleep sessions: ${sleepSessions.length}`);
}

/* ─── Batch upsert helper ─── */
async function batchUpsert(table, rows, options = {}) {
  if (!rows.length) return console.log(`   ⏭  ${table}: 0 rows, skipped`);
  const { onConflict } = options;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const query = onConflict
      ? sb.from(table).upsert(batch, { onConflict, ignoreDuplicates: true })
      : sb.from(table).insert(batch);
    const { error } = await query;
    if (error) {
      console.error(`   ❌ ${table} batch ${i}: ${error.message}`);
      // Log first row for debugging
      if (i === 0) console.error("   Sample row:", JSON.stringify(batch[0]).slice(0, 200));
    } else {
      inserted += batch.length;
    }
    if ((i / BATCH_SIZE) % 20 === 0 && i > 0) {
      process.stdout.write(`   …${table}: ${inserted}/${rows.length}\r`);
    }
  }
  console.log(`   ✅ ${table}: ${inserted} rows`);
}

/* ─── Main ─── */
async function main() {
  console.log("🏥 Apple Health → Supabase Import");
  console.log("══════════════════════════════════\n");

  await scan();

  console.log("\n📤 Uploading to Supabase...\n");

  // Stamp every row with user_id
  const stamp = (rows) => rows.map((r) => ({ ...r, user_id: USER_ID }));

  // 1. Health metrics (daily aggregates) — upsert on date
  const metricsRows = [...dailyMetrics.values()].map((d) => ({
    ...d,
    user_id: USER_ID,
    sleep_hours: d.sleep_hours ? +d.sleep_hours.toFixed(1) : null,
    distance_mi: d.distance_mi ? +d.distance_mi.toFixed(2) : null,
  }));
  await batchUpsert("health_metrics", metricsRows, { onConflict: "user_id,date" });

  // 2. Activity summaries
  await batchUpsert("activity_summaries", stamp(activitySummaries), { onConflict: "user_id,date" });

  // 3. Apple workouts
  await batchUpsert("apple_workouts", stamp(appleWorkouts));

  // 4. Sleep sessions
  await batchUpsert("sleep_sessions", stamp(sleepSessions));

  // 5. Heart rate samples (largest table — may take a while)
  console.log(`   ⏳ Heart rate: ${heartRateSamples.length} samples (this may take a minute)...`);
  await batchUpsert("heart_rate_samples", stamp(heartRateSamples));

  console.log("\n🎉 Import complete!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
