"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { ScheduleEvent, EventType, EventCategory } from "@/types";
import Link from "next/link";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiSelect, MagiTextarea, MagiToggle } from "@/components/ui/MagiField";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const CATEGORY_COLORS: Record<string, string> = {
  work: "#FF6A00",
  training: "#00D0FF",
  supplement: "#39FF14",
  meal: "#FFB800",
  routine: "#555555",
  sleep: "#6B21A8",
  health_check: "#00D0FF",
};

const HOURS_FULL = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export default function ScheduleEventPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { scheduleEvents, updateScheduleEvent, deleteScheduleEvent } = useStore();
  const event = scheduleEvents.find((e) => e.id === id) ?? null;

  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [form, setForm] = useState<Omit<ScheduleEvent, "id">>({
    title: "", event_type: "block", category: "routine", start_time: "09:00",
    end_time: null, day_of_week: null, specific_date: null, color: null,
    icon: null, is_template: true, completed: false, notes: null, sort_order: 0,
  });

  if (!event) {
    return (
      <div className="p-6">
        <div className="eva-label mb-2">EVENT NOT FOUND</div>
        <div className="text-[9px] text-text-dim mb-4">No event with ID: {id}</div>
        <Link href="/" className="text-[9px] text-eva hover:text-eva-bright transition-colors">
          ← RETURN TO COMMAND CENTER
        </Link>
      </div>
    );
  }

  const color = event.color || CATEGORY_COLORS[event.category] || "#444";
  const timeRange =
    event.event_type === "block" && event.end_time
      ? `${formatTime(event.start_time)} — ${formatTime(event.end_time)}`
      : formatTime(event.start_time);

  const durationMin =
    event.event_type === "block" && event.end_time
      ? timeToMinutes(event.end_time) - timeToMinutes(event.start_time)
      : null;

  const scheduledDays = event.day_of_week
    ? event.day_of_week.map((d) => DAY_NAMES[d])
    : event.specific_date
      ? [event.specific_date]
      : [];

  const frequency = event.is_template
    ? event.day_of_week
      ? event.day_of_week.length === 7
        ? "DAILY"
        : event.day_of_week.length === 5 && event.day_of_week.every((d) => d >= 1 && d <= 5)
          ? "WEEKDAYS"
          : `${event.day_of_week.length}X / WEEK`
      : "ONE-OFF"
    : "INSTANCE";

  function openEdit() {
    setForm({
      title: event!.title,
      event_type: event!.event_type,
      category: event!.category,
      start_time: event!.start_time,
      end_time: event!.end_time,
      day_of_week: event!.day_of_week ? [...event!.day_of_week] : null,
      specific_date: event!.specific_date,
      color: event!.color,
      icon: event!.icon,
      is_template: event!.is_template,
      completed: event!.completed,
      notes: event!.notes,
      sort_order: event!.sort_order,
    });
    setEditModal(true);
  }

  function handleSave() {
    if (!form.title.trim()) return;
    updateScheduleEvent(id, form);
    setEditModal(false);
  }

  function handleDelete() {
    deleteScheduleEvent(id);
    router.push("/");
  }

  function toggleDay(day: number) {
    const current = form.day_of_week ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setForm({ ...form, day_of_week: next.length > 0 ? next : null });
  }

  return (
    <div className="p-4 md:p-6 pb-20 md:pb-6 max-w-2xl">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="text-[9px] text-eva/60 hover:text-eva tracking-wider transition-colors mb-4 block"
      >
        ← BACK TO COMMAND CENTER
      </button>

      {/* Header */}
      <div className="hud-panel p-4 corner-brackets mb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="eva-label text-[8px] mb-1">▎ SCHEDULE EVENT</div>
            <h1
              className="text-xl md:text-2xl font-black tracking-tight"
              style={{ color, textShadow: `0 0 20px ${color}40` }}
            >
              {event.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-1 text-[8px] font-bold tracking-wider uppercase"
              style={{ color: `${color}CC`, background: `${color}12`, border: `1px solid ${color}30` }}
            >
              {event.category}
            </div>
            <button
              onClick={openEdit}
              className="px-2 py-1 text-[7px] font-bold tracking-wider text-text-dim hover:text-eva border border-border/40 hover:border-eva/40 transition-colors"
            >
              EDIT
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-2 py-1 text-[7px] font-bold tracking-wider text-text-dim hover:text-danger border border-border/40 hover:border-danger/40 transition-colors"
            >
              DEL
            </button>
          </div>
        </div>

        <div className="h-px bg-border mb-3" />

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label="TYPE" value={event.event_type.toUpperCase()} />
          <InfoRow label="TIME" value={timeRange} />
          {durationMin !== null && <InfoRow label="DURATION" value={`${durationMin} MIN`} />}
          <InfoRow label="FREQUENCY" value={frequency} />
          <InfoRow label="TEMPLATE" value={event.is_template ? "YES" : "NO"} />
          <InfoRow label="STATUS" value={event.completed ? "COMPLETED" : "PENDING"} />
        </div>
      </div>

      {/* Schedule Pattern */}
      <div className="hud-panel p-4 corner-brackets mb-3">
        <div className="eva-label text-[8px] mb-3">▎ SCHEDULE PATTERN</div>

        <div className="flex gap-1 mb-3">
          {DAY_NAMES.map((name, i) => {
            const active = event.day_of_week?.includes(i);
            return (
              <div
                key={name}
                className="flex-1 text-center py-2 transition-all"
                style={{
                  background: active ? `${color}15` : "#0A0A0A",
                  border: `1px solid ${active ? `${color}40` : "#1A1A1A"}`,
                  boxShadow: active ? `0 0 10px ${color}15` : "none",
                }}
              >
                <div className="text-[8px] font-bold tracking-wider" style={{ color: active ? color : "#333" }}>
                  {name}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time visualization */}
        <div className="mb-2">
          <div className="text-[7px] text-text-dim tracking-wider mb-1">
            TIME POSITION (7AM — 10:30PM)
          </div>
          <div className="relative h-6 bg-surface-2 overflow-hidden">
            {HOURS_FULL.map((h) => {
              const pct = ((h - 7) / 15.5) * 100;
              return (
                <div key={h} className="absolute top-0 bottom-0 border-l border-border/30" style={{ left: `${pct}%` }} />
              );
            })}
            {event.event_type === "block" && event.end_time ? (
              <div
                className="absolute top-1 bottom-1 rounded-sm"
                style={{
                  left: `${((timeToMinutes(event.start_time) - 420) / 930) * 100}%`,
                  width: `${((timeToMinutes(event.end_time) - timeToMinutes(event.start_time)) / 930) * 100}%`,
                  background: `${color}30`,
                  borderLeft: `2px solid ${color}`,
                  boxShadow: `0 0 10px ${color}20`,
                }}
              />
            ) : (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2"
                style={{
                  left: `${((timeToMinutes(event.start_time) - 420) / 930) * 100}%`,
                  background: color,
                  boxShadow: `0 0 8px ${color}80`,
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[6px] text-text-dim">7AM</span>
            <span className="text-[6px] text-text-dim">12PM</span>
            <span className="text-[6px] text-text-dim">5PM</span>
            <span className="text-[6px] text-text-dim">10:30PM</span>
          </div>
        </div>

        <div className="text-[8px] text-text-dim">
          Scheduled days:{" "}
          <span style={{ color: `${color}CC` }}>{scheduledDays.join(" · ")}</span>
        </div>
        <div className="text-[8px] text-text-dim mt-0.5">
          Occurrences per week:{" "}
          <span style={{ color: `${color}CC` }}>{event.day_of_week?.length ?? 1}</span>
        </div>
      </div>

      {/* Notes */}
      {event.notes && (
        <div className="hud-panel p-4 corner-brackets mb-3">
          <div className="eva-label text-[8px] mb-2">▎ NOTES</div>
          <div className="text-[10px] text-text leading-relaxed">{event.notes}</div>
        </div>
      )}

      {/* Metadata */}
      <div className="hud-panel p-4 corner-brackets">
        <div className="eva-label text-[8px] mb-2">▎ EVENT METADATA</div>
        <div className="space-y-1">
          <MetaRow label="ID" value={event.id} />
          <MetaRow label="LINKED SUPPLEMENT" value="—" />
          <MetaRow label="LINKED WORKOUT" value="—" />
          <MetaRow label="SORT ORDER" value={String(event.sort_order)} />
        </div>
      </div>

      {/* Edit Modal */}
      <MagiModal open={editModal} onClose={() => setEditModal(false)} title="EDIT SCHEDULE EVENT" wide>
        <div className="space-y-3">
          <MagiInput label="TITLE" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          <div className="grid grid-cols-2 gap-3">
            <MagiSelect
              label="EVENT TYPE"
              value={form.event_type}
              onChange={(v) => setForm({ ...form, event_type: v as EventType })}
              options={[
                { value: "block", label: "Block (duration)" },
                { value: "point", label: "Point (instant)" },
              ]}
            />
            <MagiSelect
              label="CATEGORY"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as EventCategory })}
              options={[
                { value: "work", label: "Work" },
                { value: "training", label: "Training" },
                { value: "supplement", label: "Supplement" },
                { value: "meal", label: "Meal" },
                { value: "routine", label: "Routine" },
                { value: "sleep", label: "Sleep" },
                { value: "health_check", label: "Health Check" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MagiInput label="START TIME" type="time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} />
            {form.event_type === "block" && (
              <MagiInput label="END TIME" type="time" value={form.end_time ?? ""} onChange={(v) => setForm({ ...form, end_time: v || null })} />
            )}
          </div>

          {/* Day picker */}
          <div>
            <div className="text-[7px] tracking-[0.2em] text-text-dim mb-1">DAYS OF WEEK</div>
            <div className="flex gap-1">
              {DAY_NAMES.map((name, i) => {
                const active = form.day_of_week?.includes(i);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 py-1.5 text-[8px] font-bold tracking-wider text-center transition-colors border ${
                      active
                        ? "text-eva bg-eva/10 border-eva/40"
                        : "text-text-dim bg-surface-2 border-border/40 hover:border-eva/20"
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <MagiInput label="COLOR" value={form.color ?? ""} onChange={(v) => setForm({ ...form, color: v || null })} placeholder="#FF6A00" />
          <MagiTextarea label="NOTES" value={form.notes ?? ""} onChange={(v) => setForm({ ...form, notes: v || null })} rows={2} />
          <MagiToggle label="TEMPLATE" checked={form.is_template} onChange={(v) => setForm({ ...form, is_template: v })} />
          <MagiToggle label="COMPLETED" checked={form.completed} onChange={(v) => setForm({ ...form, completed: v })} />

          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setEditModal(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">UPDATE EVENT</button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Confirm */}
      <MagiConfirm
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="DELETE SCHEDULE EVENT"
        message={`Remove "${event.title}" from the schedule? This cannot be undone.`}
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}

/* ─── Sub-components ─── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[7px] tracking-[0.2em] text-text-dim mb-0.5">{label}</div>
      <div className="text-[11px] font-bold text-text-bright">{value}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/30">
      <span className="text-[8px] text-text-dim tracking-wider">{label}</span>
      <span className="text-[8px] text-text font-mono">{value}</span>
    </div>
  );
}

/* ─── Util ─── */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
