/**
 * Data provider — returns seed data now, Supabase when configured.
 * Every function here is async so the switch to Supabase is seamless.
 */

import type {
  WeighIn, Goal, Supplement, WorkoutSession,
  HealthMetrics, BloodworkPanel, ChecklistItem,
  ScheduleEvent, CalendarDayEvent, BodyMeasurement, MeasurementSite,
} from "@/types";

/* ═══════════════════════════════════════════════
   SEED: Schedule Events (the weekly rhythm)
   ═══════════════════════════════════════════════ */

const WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun-Sat
const GYM_DAYS = [1, 3, 5]; // Mon/Wed/Fri
const TENNIS_DAYS = [2, 4]; // Tue/Thu

const seedScheduleEvents: ScheduleEvent[] = [
  // ── Block events ──
  { id: "se-sleep", title: "SLEEP", event_type: "block", category: "sleep", start_time: "22:30", end_time: "07:00", day_of_week: ALL_DAYS, specific_date: null, color: "#6B21A8", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-dogwalk-am", title: "DOG WALK", event_type: "block", category: "routine", start_time: "07:30", end_time: "08:15", day_of_week: ALL_DAYS, specific_date: null, color: "#555555", icon: null, is_template: true, completed: false, notes: "1 mile", sort_order: 0 },
  { id: "se-breakfast", title: "BREAKFAST", event_type: "block", category: "meal", start_time: "08:15", end_time: "09:00", day_of_week: ALL_DAYS, specific_date: null, color: "#FFB800", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-work", title: "WORK", event_type: "block", category: "work", start_time: "09:00", end_time: "17:00", day_of_week: WEEKDAYS, specific_date: null, color: "#FF6A00", icon: null, is_template: true, completed: false, notes: "Protected block", sort_order: 0 },
  { id: "se-lunch", title: "LUNCH", event_type: "block", category: "meal", start_time: "12:00", end_time: "13:00", day_of_week: WEEKDAYS, specific_date: null, color: "#FFB800", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-gym", title: "GYM", event_type: "block", category: "training", start_time: "17:00", end_time: "18:30", day_of_week: GYM_DAYS, specific_date: null, color: "#00D0FF", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-tennis", title: "TENNIS", event_type: "block", category: "training", start_time: "17:00", end_time: "19:00", day_of_week: TENNIS_DAYS, specific_date: null, color: "#00D0FF", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-dinner", title: "DINNER", event_type: "block", category: "meal", start_time: "19:30", end_time: "20:00", day_of_week: ALL_DAYS, specific_date: null, color: "#FFB800", icon: null, is_template: true, completed: false, notes: "Last meal — 8pm cutoff", sort_order: 0 },
  { id: "se-dogwalk-pm", title: "DOG WALK", event_type: "block", category: "routine", start_time: "20:00", end_time: "21:00", day_of_week: ALL_DAYS, specific_date: null, color: "#555555", icon: null, is_template: true, completed: false, notes: "Glucose mgmt", sort_order: 0 },
  { id: "se-winddown", title: "WIND DOWN", event_type: "block", category: "routine", start_time: "21:30", end_time: "22:30", day_of_week: ALL_DAYS, specific_date: null, color: "#333333", icon: null, is_template: true, completed: false, notes: null, sort_order: 0 },

  // ── Point events ──
  { id: "se-iron", title: "IRON + VIT C", event_type: "point", category: "supplement", start_time: "07:00", end_time: null, day_of_week: ALL_DAYS, specific_date: null, color: "#39FF14", icon: "💊", is_template: true, completed: false, notes: "Empty stomach", sort_order: 0 },
  { id: "se-hydrate", title: "HYDRATE 16OZ", event_type: "point", category: "supplement", start_time: "07:05", end_time: null, day_of_week: ALL_DAYS, specific_date: null, color: "#39FF14", icon: "💧", is_template: true, completed: false, notes: null, sort_order: 1 },
  { id: "se-semax", title: "SEMAX + SELANK", event_type: "point", category: "supplement", start_time: "07:15", end_time: null, day_of_week: ALL_DAYS, specific_date: null, color: "#39FF14", icon: "💊", is_template: true, completed: false, notes: "Nasal", sort_order: 0 },
  { id: "se-weighin", title: "WEIGH-IN", event_type: "point", category: "health_check", start_time: "08:15", end_time: null, day_of_week: ALL_DAYS, specific_date: null, color: "#00D0FF", icon: "⚖", is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-d3k2", title: "D3+K2", event_type: "point", category: "supplement", start_time: "08:20", end_time: null, day_of_week: ALL_DAYS, specific_date: null, color: "#39FF14", icon: "💊", is_template: true, completed: false, notes: "With first meal", sort_order: 1 },
  { id: "se-hydrate-pm", title: "HYDRATION CHECK", event_type: "point", category: "health_check", start_time: "15:00", end_time: null, day_of_week: WEEKDAYS, specific_date: null, color: "#00D0FF", icon: "💧", is_template: true, completed: false, notes: null, sort_order: 0 },
  { id: "se-preworkout", title: "PRE-WORKOUT", event_type: "point", category: "supplement", start_time: "16:45", end_time: null, day_of_week: WEEKDAYS, specific_date: null, color: "#39FF14", icon: "⚡", is_template: true, completed: false, notes: "Hydration + session preview", sort_order: 0 },
];

/* ═══════════════════════════════════════════════
   SEED: All other data (same as before in store.ts)
   ═══════════════════════════════════════════════ */

const today = new Date().toISOString().split("T")[0];

const seedWeighIns: WeighIn[] = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (29 - i));
  const base = 210 - (i * 4) / 29;
  const jitter = Math.sin(i * 1.5) * 0.8 + (Math.random() - 0.5) * 0.6;
  return {
    id: `w${i}`,
    date: d.toISOString().split("T")[0],
    weight: Math.round((base + jitter) * 10) / 10,
    body_fat_pct: null,
  };
});

const seedGoals: Goal[] = [
  { id: "g1", category: "weight", name: "Body Weight", current: 206, target: 185, unit: "lbs", direction: "down", trend: "improving" },
  { id: "g2", category: "bloodwork", name: "Vitamin D", current: 27.2, target: 50, unit: "ng/mL", direction: "up", trend: "improving" },
  { id: "g3", category: "bloodwork", name: "Testosterone", current: 409, target: 550, unit: "ng/dL", direction: "up", trend: "declining" },
  { id: "g4", category: "bloodwork", name: "LDL", current: 144, target: 100, unit: "mg/dL", direction: "down", trend: null },
  { id: "g5", category: "bloodwork", name: "HDL", current: 45, target: 55, unit: "mg/dL", direction: "up", trend: null },
  { id: "g6", category: "tennis", name: "Tennis NTRP", current: 4.5, target: 5.0, unit: "NTRP", direction: "up", trend: "stable" },
  { id: "g7", category: "strength", name: "Bench Press", current: 225, target: 315, unit: "lbs", direction: "up", trend: "improving" },
  { id: "g8", category: "body_comp", name: "Body Fat", current: 22, target: 13, unit: "%", direction: "down", trend: "improving" },
  { id: "g9", category: "body_comp", name: "Waist", current: 35.5, target: 32.5, unit: "in", direction: "down", trend: "improving" },
];

const seedSupplements: Supplement[] = [
  { id: "s1", name: "Retatrutide", category: "peptide", dose: "Per protocol", timing: "Per physician", purpose: "Body recomp, fat loss, insulin sensitivity", route: "injection", active: true },
  { id: "s2", name: "Tesamorelin", category: "peptide", dose: "Per protocol", timing: "Per physician", purpose: "GH pulse, visceral fat, recovery, sleep", route: "injection", active: true },
  { id: "s3", name: "Semax", category: "peptide", dose: "Nasal spray", timing: "7:30am", purpose: "BDNF, focus, cognitive performance", route: "nasal", active: true },
  { id: "s4", name: "Selank", category: "peptide", dose: "Nasal spray", timing: "7:30am", purpose: "Anxiolytic, IL-6 modulation, anti-inflammatory", route: "nasal", active: true },
  { id: "s5", name: "Copper Peptides", category: "peptide", dose: "Topical", timing: "Daily", purpose: "Collagen synthesis, skin/hair quality", route: "topical", active: true },
  { id: "s6", name: "Vitamin D3+K2", category: "supplement", dose: "5000 IU + 100mcg", timing: "With first meal", purpose: "Correct D insufficiency (target >50)", route: "oral", active: true },
  { id: "s7", name: "Iron Bisglycinate", category: "supplement", dose: "Chelated iron", timing: "7:00am empty stomach", purpose: "Correct low iron (45 ug/dL)", route: "oral", active: true },
];

const seedWorkouts: WorkoutSession[] = [
  {
    id: "wk1", date: today, type: "gym", name: "Push Day", duration_minutes: 65, completed: false,
    exercises: [
      { id: "ex1", name: "Bench Press", sets: 4, reps: 8, weight: 185, completed: false },
      { id: "ex2", name: "OHP", sets: 3, reps: 10, weight: 95, completed: false },
      { id: "ex3", name: "Incline DB Press", sets: 3, reps: 12, weight: 60, completed: false },
      { id: "ex4", name: "Cable Flyes", sets: 3, reps: 15, weight: 30, completed: false },
      { id: "ex5", name: "Tricep Pushdowns", sets: 3, reps: 12, weight: 50, completed: false },
    ],
  },
];

const seedHealth: HealthMetrics[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toISOString().split("T")[0],
    resting_hr: 62 + Math.floor(Math.random() * 8),
    hrv: 38 + Math.floor(Math.random() * 20),
    sleep_hours: +(6.5 + Math.random() * 2).toFixed(1),
    steps: 6000 + Math.floor(Math.random() * 6000),
    active_energy: 300 + Math.floor(Math.random() * 400),
  };
});

const seedBloodwork: BloodworkPanel[] = [
  {
    id: "bp1", date: "2023-04-26", lab: "Quest Diagnostics", physician: "Mahyar Eidgah",
    markers: [
      { name: "Vitamin D", value: 18, unit: "ng/mL", ref_low: 30, ref_high: 100, flag: "low" },
      { name: "Total Testosterone", value: 440, unit: "ng/dL", ref_low: 264, ref_high: 916, flag: "normal" },
      { name: "TSH", value: 1.44, unit: "uIU/mL", ref_low: 0.45, ref_high: 4.5, flag: "normal" },
      { name: "Free T4", value: 1.2, unit: "ng/dL", ref_low: 0.82, ref_high: 1.77, flag: "normal" },
      { name: "Glucose", value: 92, unit: "mg/dL", ref_low: 65, ref_high: 99, flag: "normal" },
      { name: "Total Cholesterol", value: 213, unit: "mg/dL", ref_low: 100, ref_high: 199, flag: "high" },
      { name: "LDL", value: 144, unit: "mg/dL", ref_low: 0, ref_high: 99, flag: "high" },
      { name: "HDL", value: 45, unit: "mg/dL", ref_low: 39, ref_high: 200, flag: "normal" },
    ],
  },
  {
    id: "bp2", date: "2026-03-16", lab: "Labcorp", physician: "J Sackett",
    markers: [
      { name: "Vitamin D", value: 27.2, unit: "ng/mL", ref_low: 30, ref_high: 100, flag: "low" },
      { name: "Total Testosterone", value: 409, unit: "ng/dL", ref_low: 264, ref_high: 916, flag: "normal" },
      { name: "TSH", value: 1.23, unit: "uIU/mL", ref_low: 0.45, ref_high: 4.5, flag: "normal" },
      { name: "Free T4", value: 1.29, unit: "ng/dL", ref_low: 0.82, ref_high: 1.77, flag: "normal" },
      { name: "Glucose", value: 87, unit: "mg/dL", ref_low: 65, ref_high: 99, flag: "normal" },
      { name: "Total Cholesterol", value: 201, unit: "mg/dL", ref_low: 100, ref_high: 199, flag: "high" },
      { name: "LDL", value: 131, unit: "mg/dL", ref_low: 0, ref_high: 99, flag: "high" },
      { name: "HDL", value: 48, unit: "mg/dL", ref_low: 39, ref_high: 200, flag: "normal" },
      { name: "Iron", value: 45, unit: "ug/dL", ref_low: 38, ref_high: 169, flag: "normal" },
      { name: "Ferritin", value: 52, unit: "ng/mL", ref_low: 30, ref_high: 400, flag: "normal" },
    ],
  },
];

const defaultChecklist: ChecklistItem[] = [
  { key: "weighin", label: "WEIGH-IN", completed: false },
  { key: "iron", label: "IRON + VIT C", completed: false },
  { key: "hydrate", label: "HYDRATION 16OZ", completed: false },
  { key: "dogwalk", label: "DOG WALK", completed: false },
  { key: "semax", label: "SEMAX + SELANK", completed: false },
  { key: "d3k2", label: "D3+K2 W/ MEAL", completed: false },
];

/* ═══════════════════════════════════════════════
   SEED: Body Measurements
   ═══════════════════════════════════════════════ */

const MEASUREMENT_SITES: MeasurementSite[] = [
  "waist", "chest", "hips", "neck", "left_arm", "right_arm",
  "left_thigh", "right_thigh", "shoulders",
];

// Baseline values (inches) — approximate starting points
const baselines: Record<string, number> = {
  waist: 37.0, chest: 44.5, hips: 42.0, neck: 17.0,
  left_arm: 15.5, right_arm: 15.8, left_thigh: 25.0, right_thigh: 25.2,
  shoulders: 52.0,
};

// Direction of improvement for each site (negative = losing inches = good for waist/hips)
const drifts: Record<string, number> = {
  waist: -0.15, chest: 0.02, hips: -0.08, neck: -0.02,
  left_arm: 0.04, right_arm: 0.04, left_thigh: -0.03, right_thigh: -0.03,
  shoulders: 0.03,
};

const seedBodyMeasurements: BodyMeasurement[] = [];
// Generate 4 measurement sessions spread over the last 8 weeks
for (let session = 0; session < 4; session++) {
  const d = new Date();
  d.setDate(d.getDate() - (8 - session * 2) * 7); // every 2 weeks
  const dateStr = d.toISOString().split("T")[0];

  for (const site of MEASUREMENT_SITES) {
    const base = baselines[site];
    const drift = drifts[site] * session;
    const jitter = (Math.random() - 0.5) * 0.3;
    seedBodyMeasurements.push({
      id: `bm-${session}-${site}`,
      date: dateStr,
      site,
      value: Math.round((base + drift + jitter) * 10) / 10,
      unit: "in",
    });
  }
}

/* ═══════════════════════════════════════════════
   Data Access Functions
   ═══════════════════════════════════════════════ */

export function getWeighIns(): WeighIn[] { return seedWeighIns; }
export function getGoals(): Goal[] { return seedGoals; }
export function getSupplements(): Supplement[] { return seedSupplements; }
export function getWorkouts(): WorkoutSession[] { return seedWorkouts; }
export function getHealthMetrics(): HealthMetrics[] { return seedHealth; }
export function getBloodwork(): BloodworkPanel[] { return seedBloodwork; }
export function getChecklist(): ChecklistItem[] { return defaultChecklist; }
export function getBodyMeasurements(): BodyMeasurement[] { return seedBodyMeasurements; }

/** Resolve schedule events for a specific date */
export function getEventsForDate(date: Date): CalendarDayEvent[] {
  const dow = date.getDay(); // 0=Sun..6=Sat
  const dateStr = date.toISOString().split("T")[0];

  return seedScheduleEvents
    .filter((ev) => {
      if (ev.specific_date) return ev.specific_date === dateStr;
      if (ev.day_of_week) return ev.day_of_week.includes(dow);
      return false;
    })
    .map((ev) => ({ ...ev, resolved_date: dateStr }))
    .sort((a, b) => {
      const at = a.start_time.replace(":", "");
      const bt = b.start_time.replace(":", "");
      if (at !== bt) return at.localeCompare(bt);
      return a.sort_order - b.sort_order;
    });
}

/** Look up a schedule event by ID */
export function getScheduleEventById(id: string): ScheduleEvent | null {
  return seedScheduleEvents.find((ev) => ev.id === id) ?? null;
}

/** Get all schedule events (for listing) */
export function getAllScheduleEvents(): ScheduleEvent[] {
  return seedScheduleEvents;
}

/** Get 7 days of calendar data starting from today */
export function getWeekSchedule(): { date: Date; dateStr: string; events: CalendarDayEvent[] }[] {
  const days: { date: Date; dateStr: string; events: CalendarDayEvent[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d,
      dateStr: d.toISOString().split("T")[0],
      events: getEventsForDate(d),
    });
  }
  return days;
}
