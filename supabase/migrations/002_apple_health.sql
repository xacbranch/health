-- ============================================================
-- Apple Health Import — Expanded Schema
-- ============================================================

-- Daily health aggregates (one row per day, merges Apple Watch + manual)
alter table health_metrics
  add column if not exists vo2_max numeric(5,2),
  add column if not exists respiratory_rate numeric(4,1),
  add column if not exists blood_oxygen numeric(4,2),
  add column if not exists wrist_temp_f numeric(5,2),
  add column if not exists heart_rate_recovery numeric(5,2),
  add column if not exists walking_hr_avg numeric(5,1),
  add column if not exists exercise_minutes integer,
  add column if not exists stand_hours integer,
  add column if not exists distance_mi numeric(6,2),
  add column if not exists flights_climbed integer,
  add column if not exists basal_energy integer,
  add column if not exists daylight_minutes integer,
  add column if not exists walking_steadiness numeric(5,3),
  add column if not exists six_min_walk_m numeric(6,1);

-- Activity ring summaries (straight from Apple, 1 per day)
create table activity_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  active_energy_burned numeric(7,1),
  active_energy_goal numeric(7,1),
  exercise_minutes integer,
  exercise_goal integer,
  stand_hours integer,
  stand_goal integer,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table activity_summaries enable row level security;
create policy "Users manage own activity_summaries" on activity_summaries
  for all using (auth.uid() = user_id);
create index idx_activity_summaries_date on activity_summaries(user_id, date);

-- Heart rate samples (granular — for charts and zones)
create table heart_rate_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  timestamp timestamptz not null,
  bpm numeric(5,1) not null,
  context text, -- 'resting', 'active', 'workout', 'sleep'
  source text,
  created_at timestamptz default now()
);

alter table heart_rate_samples enable row level security;
create policy "Users manage own heart_rate_samples" on heart_rate_samples
  for all using (auth.uid() = user_id);
create index idx_hr_samples_ts on heart_rate_samples(user_id, timestamp);

-- Apple Watch workouts (imported sessions with stats)
create table apple_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  activity_type text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  duration_minutes numeric(6,1),
  total_distance numeric(8,2),
  distance_unit text,
  total_energy numeric(7,1),
  energy_unit text,
  avg_hr numeric(5,1),
  max_hr numeric(5,1),
  source text,
  created_at timestamptz default now()
);

alter table apple_workouts enable row level security;
create policy "Users manage own apple_workouts" on apple_workouts
  for all using (auth.uid() = user_id);
create index idx_apple_workouts_date on apple_workouts(user_id, start_date);

-- Sleep sessions (granular segments from Apple)
create table sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  start_date timestamptz not null,
  end_date timestamptz not null,
  stage text not null check (stage in ('inBed', 'asleep', 'awake', 'core', 'deep', 'rem')),
  source text,
  created_at timestamptz default now()
);

alter table sleep_sessions enable row level security;
create policy "Users manage own sleep_sessions" on sleep_sessions
  for all using (auth.uid() = user_id);
create index idx_sleep_sessions_date on sleep_sessions(user_id, start_date);
