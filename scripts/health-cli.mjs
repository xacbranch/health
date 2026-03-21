#!/usr/bin/env node
/**
 * Health Dashboard CLI — for OpenClaw to call via exec
 * ────────────────────────────────────────────────────
 * Usage:
 *   node scripts/health-cli.mjs <command> [args...]
 *
 * Commands:
 *   status                     Today's snapshot (vitals, checklist, goals)
 *   log-weight <lbs> [bf%]     Log a weigh-in
 *   log-metric <key> <value>   Log a health metric (sleep, steps, etc.)
 *   log-measurement <site> <value> [unit]  Log body measurement
 *   checklist                  Show today's checklist
 *   check <key>                Mark checklist item done
 *   skip <key>                 Mark checklist item skipped
 *   goals                      Show goal progress
 *   trend <metric> [days]      Get metric trend (default 14 days)
 *   recent-workouts [n]        Show last N workouts
 *   weekly-summary             This week's summary
 *   query <sql>                Run arbitrary read query (SELECT only)
 */

import { execSync } from "node:child_process";

const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const CONN = "postgresql://postgres:3Tr%23j%21bsZxrf0xYh@db.htfapeuyebowmtpavgjq.supabase.co:5432/postgres";
const USER_ID = "efd6fb17-951e-4d8c-a768-ec826ca3ae50";

function sql(query) {
  try {
    const result = execSync(
      `${PSQL} "${CONN}" -t -A -F '\t' -c "${query.replace(/"/g, '\\"')}"`,
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    ).trim();
    return result;
  } catch (err) {
    return `ERROR: ${err.stderr?.toString().slice(0, 200) || err.message}`;
  }
}

function sqlJSON(query) {
  const raw = sql(query);
  if (raw.startsWith("ERROR:")) return raw;
  if (!raw) return "No data";
  return raw;
}

const today = new Date().toISOString().slice(0, 10);
const dayOfWeek = new Date().getDay(); // 0=Sun

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case "status": {
    const vitals = sql(`
      SELECT date, resting_hr, hrv, sleep_hours, steps, active_energy,
             vo2_max, blood_oxygen, exercise_minutes, distance_mi
      FROM health_metrics
      WHERE user_id = '${USER_ID}' AND date >= '${today}'::date - 1
      ORDER BY date DESC LIMIT 2
    `);
    const weight = sql(`
      SELECT date, weight, body_fat_pct FROM weigh_ins
      WHERE user_id = '${USER_ID}' ORDER BY date DESC LIMIT 2
    `);
    const checklist = sql(`
      SELECT key, label, completed FROM daily_checklist
      WHERE user_id = '${USER_ID}' AND date = '${today}'
    `);
    const goals = sql(`
      SELECT name, current, target, unit, direction, trend FROM goals
      WHERE user_id = '${USER_ID}'
    `);
    const workouts = sql(`
      SELECT activity_type, duration_minutes, avg_hr, start_date::date
      FROM apple_workouts
      WHERE user_id = '${USER_ID}' AND start_date::date = '${today}'
    `);

    console.log(`=== HEALTH STATUS — ${today} ===\n`);
    console.log("VITALS (today + yesterday):");
    console.log(vitals || "  No data yet today");
    console.log("\nWEIGHT (last 2):");
    console.log(weight || "  No weigh-ins");
    console.log("\nCHECKLIST:");
    console.log(checklist || "  No checklist items");
    console.log("\nGOALS:");
    console.log(goals || "  No goals");
    console.log("\nTODAY'S WORKOUTS:");
    console.log(workouts || "  None yet");
    break;
  }

  case "log-weight": {
    const weight = parseFloat(args[0]);
    const bf = args[1] ? parseFloat(args[1]) : null;
    if (isNaN(weight)) { console.log("Usage: log-weight <lbs> [bf%]"); break; }
    sql(`
      INSERT INTO weigh_ins (user_id, date, weight, body_fat_pct, source)
      VALUES ('${USER_ID}', '${today}', ${weight}, ${bf ?? "NULL"}, 'telegram')
      ON CONFLICT (user_id, date) DO UPDATE SET weight = ${weight}, body_fat_pct = COALESCE(${bf ?? "NULL"}, weigh_ins.body_fat_pct)
    `);
    console.log(`Logged: ${weight} lbs${bf ? `, ${bf}% BF` : ""} for ${today}`);

    // Show delta from previous
    const prev = sql(`
      SELECT weight FROM weigh_ins WHERE user_id = '${USER_ID}' AND date < '${today}'
      ORDER BY date DESC LIMIT 1
    `);
    if (prev) {
      const delta = (weight - parseFloat(prev)).toFixed(1);
      console.log(`Delta from previous: ${delta > 0 ? "+" : ""}${delta} lbs`);
    }
    break;
  }

  case "log-metric": {
    const key = args[0];
    const value = parseFloat(args[1]);
    if (!key || isNaN(value)) { console.log("Usage: log-metric <key> <value>"); break; }
    // Valid keys
    const validKeys = [
      "resting_hr", "hrv", "sleep_hours", "steps", "active_energy",
      "vo2_max", "respiratory_rate", "blood_oxygen", "wrist_temp_f",
      "heart_rate_recovery", "walking_hr_avg", "exercise_minutes",
      "stand_hours", "distance_mi", "flights_climbed", "basal_energy",
      "daylight_minutes", "walking_steadiness", "six_min_walk_m"
    ];
    if (!validKeys.includes(key)) {
      console.log(`Invalid metric key. Valid: ${validKeys.join(", ")}`);
      break;
    }
    sql(`
      INSERT INTO health_metrics (user_id, date, ${key}, source)
      VALUES ('${USER_ID}', '${today}', ${value}, 'telegram')
      ON CONFLICT (user_id, date) DO UPDATE SET ${key} = ${value}, source = 'telegram'
    `);
    console.log(`Logged: ${key} = ${value} for ${today}`);
    break;
  }

  case "log-measurement": {
    const site = args[0];
    const value = parseFloat(args[1]);
    const unit = args[2] || "in";
    const validSites = ["waist", "chest", "hips", "neck", "left_arm", "right_arm",
      "left_thigh", "right_thigh", "left_calf", "right_calf", "shoulders", "forearm"];
    if (!site || isNaN(value)) { console.log("Usage: log-measurement <site> <value> [in|cm]"); break; }
    if (!validSites.includes(site)) {
      console.log(`Invalid site. Valid: ${validSites.join(", ")}`);
      break;
    }
    sql(`
      INSERT INTO body_measurements (user_id, date, site, value, unit, source)
      VALUES ('${USER_ID}', '${today}', '${site}', ${value}, '${unit}', 'telegram')
    `);
    console.log(`Logged: ${site} = ${value}${unit} for ${today}`);
    break;
  }

  case "checklist": {
    const items = sql(`
      SELECT key, label, completed FROM daily_checklist
      WHERE user_id = '${USER_ID}' AND date = '${today}'
      ORDER BY sort_order
    `);
    if (!items) {
      console.log("No checklist items for today. Checklist may not be initialized.");
    } else {
      console.log(`=== CHECKLIST — ${today} ===`);
      items.split("\n").forEach(line => {
        const [key, label, done] = line.split("\t");
        console.log(`${done === "t" ? "✅" : "⬜"} ${label} [${key}]`);
      });
    }
    break;
  }

  case "check": {
    const key = args[0];
    if (!key) { console.log("Usage: check <key>"); break; }
    sql(`
      UPDATE daily_checklist SET completed = true
      WHERE user_id = '${USER_ID}' AND date = '${today}' AND key = '${key}'
    `);
    console.log(`✅ Marked "${key}" as done`);
    break;
  }

  case "skip": {
    const key = args[0];
    if (!key) { console.log("Usage: skip <key>"); break; }
    sql(`
      UPDATE daily_checklist SET completed = false, notes = 'skipped'
      WHERE user_id = '${USER_ID}' AND date = '${today}' AND key = '${key}'
    `);
    console.log(`⏭ Skipped "${key}"`);
    break;
  }

  case "goals": {
    const goals = sql(`
      SELECT name, current, target, unit, direction, trend FROM goals
      WHERE user_id = '${USER_ID}'
    `);
    if (!goals) { console.log("No goals found."); break; }
    console.log("=== GOALS ===");
    goals.split("\n").forEach(line => {
      const [name, current, target, unit, dir, trend] = line.split("\t");
      const arrow = trend === "improving" ? "↑" : trend === "declining" ? "↓" : "→";
      const gap = dir === "down"
        ? (parseFloat(current) - parseFloat(target)).toFixed(1)
        : (parseFloat(target) - parseFloat(current)).toFixed(1);
      console.log(`${arrow} ${name}: ${current} → ${target} ${unit} (${gap} to go)`);
    });
    break;
  }

  case "trend": {
    const metric = args[0] || "resting_hr";
    const days = parseInt(args[1]) || 14;
    const data = sql(`
      SELECT date, ${metric} FROM health_metrics
      WHERE user_id = '${USER_ID}' AND ${metric} IS NOT NULL
      ORDER BY date DESC LIMIT ${days}
    `);
    if (!data) { console.log(`No ${metric} data found.`); break; }
    console.log(`=== ${metric.toUpperCase()} — LAST ${days} DAYS ===`);
    const rows = data.split("\n").reverse();
    rows.forEach(line => {
      const [date, val] = line.split("\t");
      console.log(`${date}: ${val}`);
    });
    // Calculate average and trend
    const values = rows.map(r => parseFloat(r.split("\t")[1])).filter(v => !isNaN(v));
    if (values.length >= 2) {
      const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
      const first = values.slice(0, Math.ceil(values.length / 2));
      const second = values.slice(Math.ceil(values.length / 2));
      const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
      const avgSecond = second.reduce((a, b) => a + b, 0) / second.length;
      const direction = avgSecond > avgFirst ? "↑ trending up" : avgSecond < avgFirst ? "↓ trending down" : "→ stable";
      console.log(`\nAverage: ${avg} | ${direction}`);
    }
    break;
  }

  case "recent-workouts": {
    const n = parseInt(args[0]) || 7;
    const data = sql(`
      SELECT start_date::date, activity_type, duration_minutes::int,
             total_energy::int, avg_hr::int, source
      FROM apple_workouts
      WHERE user_id = '${USER_ID}'
      ORDER BY start_date DESC LIMIT ${n}
    `);
    if (!data) { console.log("No workouts found."); break; }
    console.log(`=== LAST ${n} WORKOUTS ===`);
    data.split("\n").forEach(line => {
      const [date, type, dur, cal, hr, src] = line.split("\t");
      console.log(`${date} | ${type} | ${dur}min | ${cal || "?"}cal | HR:${hr || "?"} | ${src}`);
    });
    break;
  }

  case "weekly-summary": {
    const weekAgo = sql(`SELECT ('${today}'::date - 7)::text`);
    const metrics = sql(`
      SELECT
        round(avg(resting_hr)::numeric, 0) as avg_hr,
        round(avg(hrv)::numeric, 0) as avg_hrv,
        round(avg(sleep_hours)::numeric, 1) as avg_sleep,
        round(avg(steps)::numeric, 0) as avg_steps,
        round(sum(active_energy)::numeric, 0) as total_cal,
        round(sum(exercise_minutes)::numeric, 0) as total_exercise,
        round(sum(distance_mi)::numeric, 1) as total_mi
      FROM health_metrics
      WHERE user_id = '${USER_ID}' AND date >= '${weekAgo}'
    `);
    const workouts = sql(`
      SELECT count(*), round(sum(duration_minutes)::numeric, 0),
             round(avg(avg_hr)::numeric, 0)
      FROM apple_workouts
      WHERE user_id = '${USER_ID}' AND start_date >= '${weekAgo}'
    `);
    const weightChange = sql(`
      SELECT
        (SELECT weight FROM weigh_ins WHERE user_id = '${USER_ID}' ORDER BY date DESC LIMIT 1) -
        (SELECT weight FROM weigh_ins WHERE user_id = '${USER_ID}' AND date <= '${weekAgo}' ORDER BY date DESC LIMIT 1)
    `);

    console.log(`=== WEEKLY SUMMARY (${weekAgo} → ${today}) ===\n`);
    if (metrics) {
      const [hr, hrv, sleep, steps, cal, exercise, mi] = metrics.split("\t");
      console.log(`Avg Resting HR: ${hr} bpm`);
      console.log(`Avg HRV: ${hrv} ms`);
      console.log(`Avg Sleep: ${sleep} hrs`);
      console.log(`Avg Steps: ${steps}/day`);
      console.log(`Total Active Cal: ${cal}`);
      console.log(`Total Exercise: ${exercise} min`);
      console.log(`Total Distance: ${mi} mi`);
    }
    if (workouts) {
      const [count, dur, hr] = workouts.split("\t");
      console.log(`\nWorkouts: ${count} sessions, ${dur} total min, avg HR ${hr}`);
    }
    if (weightChange && weightChange !== "") {
      const delta = parseFloat(weightChange).toFixed(1);
      console.log(`Weight change: ${delta > 0 ? "+" : ""}${delta} lbs`);
    }
    break;
  }

  default:
    console.log(`Health Dashboard CLI

Commands:
  status                       Today's full snapshot
  log-weight <lbs> [bf%]       Log weigh-in
  log-metric <key> <value>     Log health metric
  log-measurement <site> <val> Log body measurement
  checklist                    Show today's checklist
  check <key>                  Mark item done
  skip <key>                   Skip item
  goals                        Goal progress
  trend <metric> [days]        Metric trend
  recent-workouts [n]          Last N workouts
  weekly-summary               This week's recap`);
}
