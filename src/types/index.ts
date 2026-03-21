export interface WeighIn {
  id: string;
  date: string;
  weight: number;
  body_fat_pct: number | null;
}

export interface Goal {
  id: string;
  category: "weight" | "bloodwork" | "strength" | "tennis" | "body_comp" | "custom";
  name: string;
  current: number;
  target: number;
  unit: string;
  direction: "up" | "down";
  trend: "improving" | "declining" | "stable" | null;
}

export interface Supplement {
  id: string;
  name: string;
  category: "peptide" | "supplement" | "medication";
  dose: string;
  timing: string;
  purpose: string;
  route: "oral" | "nasal" | "injection" | "topical";
  active: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string;
  type: "gym" | "tennis" | "recovery" | "cardio";
  name: string;
  duration_minutes: number | null;
  completed: boolean;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  completed: boolean;
}

export interface HealthMetrics {
  date: string;
  resting_hr: number;
  hrv: number;
  sleep_hours: number;
  steps: number;
  active_energy: number;
  /* ── Apple Health expanded fields ── */
  vo2_max?: number | null;
  respiratory_rate?: number | null;
  blood_oxygen?: number | null;
  wrist_temp_f?: number | null;
  heart_rate_recovery?: number | null;
  walking_hr_avg?: number | null;
  exercise_minutes?: number | null;
  stand_hours?: number | null;
  distance_mi?: number | null;
  flights_climbed?: number | null;
  basal_energy?: number | null;
  daylight_minutes?: number | null;
  walking_steadiness?: number | null;
  six_min_walk_m?: number | null;
}

export interface ActivitySummary {
  id?: string;
  date: string;
  active_energy_burned: number;
  active_energy_goal: number;
  exercise_minutes: number;
  exercise_goal: number;
  stand_hours: number;
  stand_goal: number;
}

export interface HeartRateSample {
  id?: string;
  timestamp: string;
  bpm: number;
  context: "resting" | "active" | "workout" | "sleep" | null;
  source: string | null;
}

export interface AppleWorkout {
  id?: string;
  activity_type: string;
  start_date: string;
  end_date: string;
  duration_minutes: number;
  total_distance: number | null;
  distance_unit: string | null;
  total_energy: number | null;
  energy_unit: string | null;
  avg_hr: number | null;
  max_hr: number | null;
  source: string | null;
}

export interface SleepSession {
  id?: string;
  start_date: string;
  end_date: string;
  stage: "inBed" | "asleep" | "awake" | "core" | "deep" | "rem";
  source: string | null;
}

export interface BloodworkMarker {
  name: string;
  value: number;
  unit: string;
  ref_low: number;
  ref_high: number;
  flag: "normal" | "low" | "high";
}

export interface BloodworkPanel {
  id: string;
  date: string;
  lab: string;
  physician: string;
  markers: BloodworkMarker[];
}

export interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
}

/* ─── Body Measurements ─── */

export type MeasurementSite =
  | "waist"
  | "chest"
  | "hips"
  | "neck"
  | "left_arm"
  | "right_arm"
  | "left_thigh"
  | "right_thigh"
  | "left_calf"
  | "right_calf"
  | "shoulders"
  | "forearm";

export interface BodyMeasurement {
  id: string;
  date: string;
  site: MeasurementSite;
  value: number;
  unit: "in" | "cm";
}

/* ─── Schedule / Calendar types ─── */

export type EventType = "block" | "point";
export type EventCategory =
  | "work"
  | "training"
  | "supplement"
  | "meal"
  | "routine"
  | "sleep"
  | "health_check";

export interface ScheduleEvent {
  id: string;
  title: string;
  event_type: EventType;
  category: EventCategory;
  /** HH:MM format */
  start_time: string;
  /** HH:MM format, null for point events */
  end_time: string | null;
  /** 0=Sun..6=Sat for recurring templates */
  day_of_week: number[] | null;
  /** For one-off events */
  specific_date: string | null;
  color: string | null;
  icon: string | null;
  is_template: boolean;
  completed: boolean;
  notes: string | null;
  sort_order: number;
}

/** Resolved event for a specific calendar day */
export interface CalendarDayEvent extends ScheduleEvent {
  /** The actual date this event falls on */
  resolved_date: string;
}
