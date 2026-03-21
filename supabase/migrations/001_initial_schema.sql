-- ============================================================
-- XACH HEALTH OS — Initial Schema
-- ============================================================

-- Weigh-ins
create table weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  weight numeric(5,1) not null,
  body_fat_pct numeric(4,1),
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null check (category in ('weight','bloodwork','strength','tennis','body_comp','custom')),
  name text not null,
  current numeric not null,
  target numeric not null,
  unit text not null,
  direction text not null check (direction in ('up','down')),
  trend text check (trend in ('improving','declining','stable')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Supplements
create table supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  category text not null check (category in ('peptide','supplement','medication')),
  dose text,
  timing text,
  purpose text,
  route text check (route in ('oral','nasal','injection','topical')),
  active boolean default true,
  created_at timestamptz default now()
);

-- Workout sessions
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  type text not null check (type in ('gym','tennis','recovery','cardio')),
  name text not null,
  duration_minutes integer,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Exercises (belong to workout sessions)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  name text not null,
  sets integer,
  reps integer,
  weight numeric,
  completed boolean default false,
  sort_order integer default 0
);

-- Health metrics (Apple HealthKit data)
create table health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  resting_hr integer,
  hrv integer,
  sleep_hours numeric(3,1),
  steps integer,
  active_energy integer,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Bloodwork panels
create table bloodwork_panels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  lab text,
  physician text,
  created_at timestamptz default now()
);

-- Bloodwork markers (belong to panels)
create table bloodwork_markers (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references bloodwork_panels(id) on delete cascade,
  name text not null,
  value numeric not null,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag text check (flag in ('normal','low','high'))
);

-- Schedule events (calendar data model)
create table schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  event_type text not null check (event_type in ('block','point')),
  category text not null check (category in ('work','training','supplement','meal','routine','sleep','health_check')),
  start_time time not null,
  end_time time,
  day_of_week integer[],
  specific_date date,
  color text,
  icon text,
  linked_supplement_id uuid references supplements(id) on delete set null,
  linked_workout_id uuid references workout_sessions(id) on delete set null,
  is_template boolean default true,
  completed boolean default false,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Daily checklist
create table daily_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  key text not null,
  label text not null,
  completed boolean default false,
  completed_at timestamptz,
  unique(user_id, date, key)
);

-- Body Measurements
create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  date date not null,
  site text not null check (site in (
    'waist','chest','hips','neck','left_arm','right_arm',
    'left_thigh','right_thigh','left_calf','right_calf',
    'shoulders','forearm'
  )),
  value numeric(5,1) not null,
  unit text not null default 'in' check (unit in ('in','cm')),
  created_at timestamptz default now()
);

-- Row Level Security (enable on all tables)
alter table weigh_ins enable row level security;
alter table goals enable row level security;
alter table supplements enable row level security;
alter table workout_sessions enable row level security;
alter table exercises enable row level security;
alter table health_metrics enable row level security;
alter table bloodwork_panels enable row level security;
alter table bloodwork_markers enable row level security;
alter table schedule_events enable row level security;
alter table daily_checklist enable row level security;
alter table body_measurements enable row level security;

-- RLS policies (allow authenticated users to manage their own data)
create policy "Users manage own weigh_ins" on weigh_ins for all using (auth.uid() = user_id);
create policy "Users manage own goals" on goals for all using (auth.uid() = user_id);
create policy "Users manage own supplements" on supplements for all using (auth.uid() = user_id);
create policy "Users manage own workout_sessions" on workout_sessions for all using (auth.uid() = user_id);
create policy "Users manage own health_metrics" on health_metrics for all using (auth.uid() = user_id);
create policy "Users manage own bloodwork_panels" on bloodwork_panels for all using (auth.uid() = user_id);
create policy "Users manage own schedule_events" on schedule_events for all using (auth.uid() = user_id);
create policy "Users manage own daily_checklist" on daily_checklist for all using (auth.uid() = user_id);
create policy "Users manage own body_measurements" on body_measurements for all using (auth.uid() = user_id);
-- exercises: access via workout_session ownership
create policy "Users manage own exercises" on exercises for all
  using (exists (select 1 from workout_sessions ws where ws.id = exercises.workout_session_id and ws.user_id = auth.uid()));
-- bloodwork_markers: access via panel ownership
create policy "Users manage own bloodwork_markers" on bloodwork_markers for all
  using (exists (select 1 from bloodwork_panels bp where bp.id = bloodwork_markers.panel_id and bp.user_id = auth.uid()));

-- Indexes
create index idx_weigh_ins_date on weigh_ins(user_id, date);
create index idx_health_metrics_date on health_metrics(user_id, date);
create index idx_schedule_events_dow on schedule_events using gin(day_of_week);
create index idx_schedule_events_date on schedule_events(specific_date);
create index idx_daily_checklist_date on daily_checklist(user_id, date);
create index idx_workout_sessions_date on workout_sessions(user_id, date);
create index idx_body_measurements_date on body_measurements(user_id, date);
