#!/usr/bin/env node
/**
 * Apple Health XML → PostgreSQL direct importer
 * ──────────────────────────────────────────────
 * Streams the giant export.xml line-by-line, extracts records by regex,
 * aggregates daily metrics, and bulk-inserts via psql COPY.
 * Much faster than Supabase REST API for 100k+ rows.
 *
 * Usage:
 *   node scripts/import-apple-health-psql.mjs [/path/to/export.xml]
 */

import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* ─── Config ─── */
const USER_ID = "efd6fb17-951e-4d8c-a768-ec826ca3ae50";
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const CONN = "postgresql://postgres:3Tr%23j%21bsZxrf0xYh@db.htfapeuyebowmtpavgjq.supabase.co:5432/postgres";

const xmlPath = process.argv[2] || "/tmp/health_export/apple_health_export/export.xml";

/* ─── Attribute parser ─── */
function parseAttrs(line) {
  const attrs = {};
  const re = /(\w+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(line)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

/* ─── Date helpers ─── */
function toISO(str) {
  if (!str) return null;
  // "2024-01-15 08:30:00 -0700" → "2024-01-15T08:30:00-07:00"
  const parts = str.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  if (parts) return `${parts[1]}T${parts[2]}${parts[3]}:${parts[4]}`;
  return str.replace(" ", "T");
}
function dateOnly(str) {
  if (!str) return null;
  // Convert to Pacific time to get the correct local date
  // Apple Health exports in device local time, but be explicit
  const iso = toISO(str);
  if (!iso) return str.slice(0, 10);
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
  } catch {
    return str.slice(0, 10);
  }
}

/* ─── Accumulators ─── */
const dailyMetrics = new Map();
function getDay(date) {
  const d = dateOnly(date);
  if (!d) return null;
  if (!dailyMetrics.has(d)) {
    dailyMetrics.set(d, {
      date: d,
      resting_hr: null, hrv: null, sleep_hours: 0,
      steps: 0, active_energy: 0,
      vo2_max: null, respiratory_rate: null, blood_oxygen: null,
      wrist_temp_f: null, heart_rate_recovery: null, walking_hr_avg: null,
      exercise_minutes: 0, stand_hours: null,
      distance_mi: 0, flights_climbed: 0, basal_energy: 0,
      daylight_minutes: 0, walking_steadiness: null, six_min_walk_m: null,
    });
  }
  return dailyMetrics.get(d);
}

const activitySummaries = [];
const heartRateSamples = [];
const appleWorkouts = [];
const sleepSessions = [];

let currentWorkout = null;

/* ─── Sleep value mapping ─── */
const SLEEP_MAP = {
  HKCategoryValueSleepAnalysisInBed: "inBed",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleep: "asleep",
  HKCategoryValueSleepAnalysisAwake: "awake",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
};

/* ─── Scan the XML ─── */
async function scan() {
  console.log(`📂 Scanning: ${xmlPath}`);
  const rl = createInterface({
    input: createReadStream(xmlPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 200000 === 0) process.stdout.write(`  …${(lineCount / 1000)|0}k lines\r`);

    const t = line.trimStart();

    /* ── Records ── */
    if (t.startsWith("<Record ")) {
      const a = parseAttrs(t);
      const type = a.type;
      const val = a.value;
      const day = getDay(a.startDate);

      switch (type) {
        case "HKQuantityTypeIdentifierHeartRate":
          heartRateSamples.push([toISO(a.startDate), +val, null, a.sourceName || ""]);
          break;
        case "HKCategoryTypeIdentifierSleepAnalysis": {
          const stage = SLEEP_MAP[val];
          if (stage) {
            sleepSessions.push([toISO(a.startDate), toISO(a.endDate), stage, a.sourceName || ""]);
            if (stage !== "inBed" && stage !== "awake" && day) {
              const hrs = (new Date(toISO(a.endDate)) - new Date(toISO(a.startDate))) / 3600000;
              day.sleep_hours += hrs;
            }
          }
          break;
        }
        case "HKQuantityTypeIdentifierRestingHeartRate":
          if (day) day.resting_hr = +val; break;
        case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
          if (day) day.hrv = Math.round(+val); break;
        case "HKQuantityTypeIdentifierStepCount":
          if (day) day.steps += Math.round(+val); break;
        case "HKQuantityTypeIdentifierActiveEnergyBurned":
          if (day) day.active_energy += Math.round(+val); break;
        case "HKQuantityTypeIdentifierBasalEnergyBurned":
          if (day) day.basal_energy += Math.round(+val); break;
        case "HKQuantityTypeIdentifierDistanceWalkingRunning":
          if (day) day.distance_mi += +val; break;
        case "HKQuantityTypeIdentifierFlightsClimbed":
          if (day) day.flights_climbed += Math.round(+val); break;
        case "HKQuantityTypeIdentifierVO2Max":
          if (day) day.vo2_max = +val; break;
        case "HKQuantityTypeIdentifierRespiratoryRate":
          if (day) day.respiratory_rate = +val; break;
        case "HKQuantityTypeIdentifierOxygenSaturation":
          if (day) day.blood_oxygen = +(val * 100).toFixed(1); break;
        case "HKQuantityTypeIdentifierAppleWalkingSteadiness":
          if (day) day.walking_steadiness = +(val * 100).toFixed(1); break;
        case "HKQuantityTypeIdentifierSixMinuteWalkTestDistance":
          if (day) day.six_min_walk_m = +val; break;
        case "HKQuantityTypeIdentifierAppleExerciseTime":
          if (day) day.exercise_minutes += Math.round(+val); break;
        case "HKQuantityTypeIdentifierWalkingHeartRateAverage":
          if (day) day.walking_hr_avg = +val; break;
        case "HKQuantityTypeIdentifierHeartRateRecoveryOneMinute":
          if (day) day.heart_rate_recovery = +val; break;
        case "HKQuantityTypeIdentifierTimeInDaylight":
          if (day) day.daylight_minutes += Math.round(+val); break;
        case "HKQuantityTypeIdentifierAppleSleepingWristTemperature":
        case "HKQuantityTypeIdentifierWristTemperature":
          if (day) {
            let f = +val;
            if (a.unit === "degC") f = f * 9 / 5 + 32;
            day.wrist_temp_f = +f.toFixed(2);
          }
          break;
      }
      continue;
    }

    /* ── Workouts ── */
    if (t.startsWith("<Workout ")) {
      const a = parseAttrs(t);
      currentWorkout = {
        type: (a.workoutActivityType || "").replace("HKWorkoutActivityType", ""),
        start: toISO(a.startDate),
        end: toISO(a.endDate),
        dur: a.duration ? +parseFloat(a.duration).toFixed(1) : null,
        dist: a.totalDistance ? +parseFloat(a.totalDistance).toFixed(2) : null,
        distUnit: a.totalDistanceUnit || "",
        energy: a.totalEnergyBurned ? +parseFloat(a.totalEnergyBurned).toFixed(1) : null,
        energyUnit: a.totalEnergyBurnedUnit || "",
        avgHr: null, maxHr: null,
        source: a.sourceName || "",
      };
      appleWorkouts.push(currentWorkout);
      continue;
    }

    if (t.startsWith("<WorkoutStatistics ") && currentWorkout) {
      const a = parseAttrs(t);
      if (a.type === "HKQuantityTypeIdentifierHeartRate") {
        if (a.average) currentWorkout.avgHr = +parseFloat(a.average).toFixed(1);
        if (a.maximum) currentWorkout.maxHr = +parseFloat(a.maximum).toFixed(1);
      }
      continue;
    }

    if (t.startsWith("</Workout>")) { currentWorkout = null; continue; }

    /* ── Activity Summaries ── */
    if (t.startsWith("<ActivitySummary ")) {
      const a = parseAttrs(t);
      activitySummaries.push([
        a.dateComponents,
        +a.activeEnergyBurned || 0, +a.activeEnergyBurnedGoal || 0,
        +a.appleExerciseTime || 0, +a.appleExerciseTimeGoal || 0,
        +a.appleStandHours || 0, +a.appleStandHoursGoal || 0,
      ]);
      continue;
    }
  }

  console.log(`\n✅ Scan complete: ${(lineCount/1000)|0}k lines`);
  console.log(`   Daily metrics: ${dailyMetrics.size} days`);
  console.log(`   HR samples:    ${heartRateSamples.length}`);
  console.log(`   Workouts:      ${appleWorkouts.length}`);
  console.log(`   Sleep sessions: ${sleepSessions.length}`);
  console.log(`   Activity days:  ${activitySummaries.length}`);
}

/* ─── CSV writer + COPY helper ─── */
function esc(v) {
  if (v === null || v === undefined || v === "") return "\\N";
  return String(v).replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n");
}

function writeTSV(filename, rows) {
  const path = join(tmpdir(), filename);
  const content = rows.map((r) => (Array.isArray(r) ? r : Object.values(r)).map(esc).join("\t")).join("\n");
  writeFileSync(path, content + "\n");
  return path;
}

function psqlCopy(table, columns, tsvPath) {
  const colList = columns.join(", ");
  const cmd = `${PSQL} "${CONN}" -c "\\COPY ${table} (${colList}) FROM '${tsvPath}' WITH (FORMAT text)"`;
  try {
    execSync(cmd, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    return true;
  } catch (err) {
    console.error(`   ❌ ${table}: ${err.stderr?.toString().slice(0, 300)}`);
    return false;
  }
}

/* ─── Upload ─── */
async function upload() {
  console.log("\n📤 Uploading to Supabase via COPY...\n");

  // 1. Health metrics
  const hmRows = [...dailyMetrics.values()].map((d) => [
    USER_ID, d.date,
    d.resting_hr, d.hrv, d.sleep_hours ? +d.sleep_hours.toFixed(1) : null,
    d.steps, d.active_energy,
    d.vo2_max, d.respiratory_rate, d.blood_oxygen, d.wrist_temp_f,
    d.heart_rate_recovery, d.walking_hr_avg, d.exercise_minutes, d.stand_hours,
    d.distance_mi ? +d.distance_mi.toFixed(2) : null,
    d.flights_climbed, d.basal_energy, d.daylight_minutes,
    d.walking_steadiness, d.six_min_walk_m,
  ]);
  const hmPath = writeTSV("hm.tsv", hmRows);
  console.log(`   health_metrics: ${hmRows.length} rows...`);
  // Use INSERT via psql for upsert behavior
  const hmSQL = hmRows.map((r) => {
    const vals = r.map((v) => v === null || v === undefined ? "NULL" : typeof v === "string" ? `'${v}'` : v);
    return `INSERT INTO health_metrics (user_id, date, resting_hr, hrv, sleep_hours, steps, active_energy, vo2_max, respiratory_rate, blood_oxygen, wrist_temp_f, heart_rate_recovery, walking_hr_avg, exercise_minutes, stand_hours, distance_mi, flights_climbed, basal_energy, daylight_minutes, walking_steadiness, six_min_walk_m) VALUES (${vals.join(",")}) ON CONFLICT (user_id, date) DO UPDATE SET resting_hr=EXCLUDED.resting_hr, hrv=EXCLUDED.hrv, sleep_hours=EXCLUDED.sleep_hours, steps=EXCLUDED.steps, active_energy=EXCLUDED.active_energy, vo2_max=EXCLUDED.vo2_max, respiratory_rate=EXCLUDED.respiratory_rate, blood_oxygen=EXCLUDED.blood_oxygen, wrist_temp_f=EXCLUDED.wrist_temp_f, heart_rate_recovery=EXCLUDED.heart_rate_recovery, walking_hr_avg=EXCLUDED.walking_hr_avg, exercise_minutes=EXCLUDED.exercise_minutes, stand_hours=EXCLUDED.stand_hours, distance_mi=EXCLUDED.distance_mi, flights_climbed=EXCLUDED.flights_climbed, basal_energy=EXCLUDED.basal_energy, daylight_minutes=EXCLUDED.daylight_minutes, walking_steadiness=EXCLUDED.walking_steadiness, six_min_walk_m=EXCLUDED.six_min_walk_m;`;
  }).join("\n");
  const hmSqlPath = join(tmpdir(), "hm.sql");
  writeFileSync(hmSqlPath, hmSQL);
  try {
    execSync(`${PSQL} "${CONN}" -f "${hmSqlPath}"`, { stdio: "pipe", maxBuffer: 100 * 1024 * 1024 });
    console.log(`   ✅ health_metrics: ${hmRows.length} rows upserted`);
  } catch (err) {
    console.error(`   ❌ health_metrics: ${err.stderr?.toString().slice(0, 300)}`);
  }

  // 2. Activity summaries (upsert)
  const asSqlPath = join(tmpdir(), "as.sql");
  const asSQL = activitySummaries.map((r) =>
    `INSERT INTO activity_summaries (user_id, date, active_energy_burned, active_energy_goal, exercise_minutes, exercise_goal, stand_hours, stand_goal) VALUES ('${USER_ID}', '${r[0]}', ${r[1]}, ${r[2]}, ${r[3]}, ${r[4]}, ${r[5]}, ${r[6]}) ON CONFLICT (user_id, date) DO NOTHING;`
  ).join("\n");
  writeFileSync(asSqlPath, asSQL);
  console.log(`   activity_summaries: ${activitySummaries.length} rows...`);
  try {
    execSync(`${PSQL} "${CONN}" -f "${asSqlPath}"`, { stdio: "pipe", maxBuffer: 50 * 1024 * 1024 });
    console.log(`   ✅ activity_summaries: ${activitySummaries.length} rows`);
  } catch (err) {
    console.error(`   ❌ activity_summaries: ${err.stderr?.toString().slice(0, 300)}`);
  }

  // 3. Apple workouts (COPY)
  const wkRows = appleWorkouts.map((w) => [
    USER_ID, w.type, w.start, w.end, w.dur, w.dist, w.distUnit,
    w.energy, w.energyUnit, w.avgHr, w.maxHr, w.source,
  ]);
  const wkPath = writeTSV("wk.tsv", wkRows);
  console.log(`   apple_workouts: ${wkRows.length} rows...`);
  if (psqlCopy("apple_workouts",
    ["user_id", "activity_type", "start_date", "end_date", "duration_minutes",
     "total_distance", "distance_unit", "total_energy", "energy_unit",
     "avg_hr", "max_hr", "source"], wkPath)) {
    console.log(`   ✅ apple_workouts: ${wkRows.length} rows`);
  }

  // 4. Sleep sessions (COPY)
  const slRows = sleepSessions.map((s) => [USER_ID, ...s]);
  const slPath = writeTSV("sl.tsv", slRows);
  console.log(`   sleep_sessions: ${slRows.length} rows...`);
  if (psqlCopy("sleep_sessions",
    ["user_id", "start_date", "end_date", "stage", "source"], slPath)) {
    console.log(`   ✅ sleep_sessions: ${slRows.length} rows`);
  }

  // 5. Heart rate samples (COPY — largest, ~116k rows)
  const hrRows = heartRateSamples.map((s) => [USER_ID, ...s]);
  const hrPath = writeTSV("hr.tsv", hrRows);
  console.log(`   heart_rate_samples: ${hrRows.length} rows (this may take a moment)...`);
  if (psqlCopy("heart_rate_samples",
    ["user_id", "timestamp", "bpm", "context", "source"], hrPath)) {
    console.log(`   ✅ heart_rate_samples: ${hrRows.length} rows`);
  }

  console.log("\n🎉 Import complete!");
}

/* ─── Main ─── */
async function main() {
  console.log("🏥 Apple Health → Supabase Import (direct psql)");
  console.log("═════════════════════════════════════════════════\n");
  await scan();
  await upload();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
