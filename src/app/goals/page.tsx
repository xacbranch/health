"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Goal } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiNumber, MagiSelect } from "@/components/ui/MagiField";

// For "down" direction goals, we need a starting point to calculate progress.
// Use a generous multiplier of the target if no historical baseline exists.
function estimateStart(goal: Goal): number {
  // If current > target for down goals, use current as a reasonable start
  if (goal.direction === "down" && goal.current > goal.target) {
    return goal.current * 1.15; // assume 15% above current as baseline
  }
  return goal.current;
}

const CATEGORY_STYLES: Record<Goal["category"], string> = {
  weight: "bg-lime/10 text-lime border-lime/30",
  bloodwork: "bg-cyan/10 text-cyan border-cyan/30",
  strength: "bg-eva/10 text-eva border-eva/30",
  tennis: "bg-positive/10 text-positive border-positive/30",
  body_comp: "bg-warning/10 text-warning border-warning/30",
  custom: "bg-surface-3 text-text-dim border-border",
};

function getProgress(goal: Goal): number {
  if (goal.direction === "down") {
    const start = estimateStart(goal);
    const range = start - goal.target;
    if (range <= 0) return 100; // already at or past target
    return Math.min(100, Math.max(0, ((start - goal.current) / range) * 100));
  }
  if (goal.target === 0) return 0;
  return Math.min(100, Math.max(0, (goal.current / goal.target) * 100));
}

function getBarColor(trend: Goal["trend"]): string {
  if (trend === "improving") return "bg-lime";
  if (trend === "declining") return "bg-danger";
  return "bg-cyan";
}

function TrendBadge({ trend }: { trend: Goal["trend"] }) {
  if (trend === "improving")
    return <span className="text-positive font-mono text-[10px] tracking-wider">▲ IMPROVING</span>;
  if (trend === "declining")
    return <span className="text-danger font-mono text-[10px] tracking-wider">▼ AT RISK</span>;
  if (trend === "stable")
    return <span className="text-cyan font-mono text-[10px] tracking-wider">◆ HOLDING</span>;
  return <span className="text-text-dim font-mono text-[10px] tracking-wider">— NO DATA</span>;
}

const emptyGoal: Omit<Goal, "id"> = {
  category: "custom",
  name: "",
  current: 0,
  target: 0,
  unit: "",
  direction: "up",
  trend: null,
};

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<Omit<Goal, "id">>(emptyGoal);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [editingCurrent, setEditingCurrent] = useState<string | null>(null);
  const [currentVal, setCurrentVal] = useState<number | "">("");

  const totalGoals = goals.length;
  const improving = goals.filter((g) => g.trend === "improving").length;
  const atRisk = goals.filter((g) => g.trend === "declining").length;

  function openAdd() {
    setEditing(null);
    setForm(emptyGoal);
    setModalOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setForm({ category: g.category, name: g.name, current: g.current, target: g.target, unit: g.unit, direction: g.direction, trend: g.trend });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) {
      updateGoal(editing.id, form);
    } else {
      addGoal(form);
    }
    setModalOpen(false);
  }

  function handleInlineSave(goalId: string) {
    if (currentVal !== "") {
      updateGoal(goalId, { current: Number(currentVal) });
    }
    setEditingCurrent(null);
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="eva-label mb-1">OBJECTIVES MODULE</p>
          <h1 className="text-2xl md:text-3xl font-bold text-text-bright tracking-tight">
            MISSION OBJECTIVES
          </h1>
        </div>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
        >
          + ADD GOAL
        </button>
      </div>

      {/* Summary Bar */}
      <div className="hud-panel p-4 corner-brackets flex flex-wrap gap-6">
        <div>
          <p className="eva-label mb-1">TOTAL GOALS</p>
          <p className="data-readout text-2xl">{totalGoals}</p>
        </div>
        <div>
          <p className="eva-label mb-1">ACTIVE IMPROVING</p>
          <p className="data-readout text-2xl">{improving}</p>
        </div>
        <div>
          <p className="eva-label mb-1">GOALS AT RISK</p>
          <p className="data-readout text-2xl text-danger">{atRisk}</p>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const progress = getProgress(goal);
          const barColor = getBarColor(goal.trend);

          return (
            <div key={goal.id} className="hud-panel p-4 corner-brackets space-y-3 group">
              {/* Category Badge + Actions */}
              <div className="flex items-start justify-between">
                <span
                  className={`inline-block font-mono text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 border ${CATEGORY_STYLES[goal.category]}`}
                >
                  {goal.category.replace("_", " ")}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(goal)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                  >
                    EDIT
                  </button>
                  <span className="text-text-dim/30">|</span>
                  <button
                    onClick={() => setDeleteTarget(goal)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                  >
                    DEL
                  </button>
                </div>
              </div>

              {/* Goal Name */}
              <p className="font-bold text-text-bright text-base">{goal.name}</p>

              {/* Current Value — click to inline edit */}
              <div className="flex items-baseline gap-2">
                {editingCurrent === goal.id ? (
                  <input
                    autoFocus
                    type="number"
                    value={currentVal}
                    onChange={(e) => setCurrentVal(e.target.value === "" ? "" : Number(e.target.value))}
                    onBlur={() => handleInlineSave(goal.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleInlineSave(goal.id); if (e.key === "Escape") setEditingCurrent(null); }}
                    className="data-readout text-3xl bg-transparent border-b border-eva/40 w-24 outline-none"
                  />
                ) : (
                  <span
                    className="data-readout text-3xl cursor-pointer hover:text-eva transition-colors"
                    title="Click to update"
                    onClick={() => { setEditingCurrent(goal.id); setCurrentVal(goal.current); }}
                  >
                    {goal.current}
                  </span>
                )}
                <span className="font-mono text-sm text-text-dim">{goal.unit}</span>
                <span
                  className={`ml-auto text-lg ${
                    goal.direction === "down" ? "text-cyan" : "text-lime"
                  }`}
                >
                  {goal.direction === "down" ? "↓" : "↑"}
                </span>
              </div>

              {/* Target */}
              <p className="font-mono text-[10px] text-text-dim">
                TARGET: {goal.target} {goal.unit}
              </p>

              {/* Progress Bar */}
              <div className="h-2 bg-surface-2 overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Trend */}
              <TrendBadge trend={goal.trend} />
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      <MagiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "EDIT OBJECTIVE" : "NEW OBJECTIVE"}
      >
        <div className="space-y-3">
          <MagiInput
            label="NAME"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Goal name"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <MagiSelect
              label="CATEGORY"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as Goal["category"] })}
              options={[
                { value: "weight", label: "Weight" },
                { value: "bloodwork", label: "Bloodwork" },
                { value: "strength", label: "Strength" },
                { value: "tennis", label: "Tennis" },
                { value: "body_comp", label: "Body Comp" },
                { value: "custom", label: "Custom" },
              ]}
            />
            <MagiSelect
              label="DIRECTION"
              value={form.direction}
              onChange={(v) => setForm({ ...form, direction: v as "up" | "down" })}
              options={[
                { value: "up", label: "↑ Higher is better" },
                { value: "down", label: "↓ Lower is better" },
              ]}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MagiNumber
              label="CURRENT"
              value={form.current}
              onChange={(v) => setForm({ ...form, current: v === "" ? 0 : v })}
              step={0.1}
            />
            <MagiNumber
              label="TARGET"
              value={form.target}
              onChange={(v) => setForm({ ...form, target: v === "" ? 0 : v })}
              step={0.1}
            />
            <MagiInput
              label="UNIT"
              value={form.unit}
              onChange={(v) => setForm({ ...form, unit: v })}
              placeholder="lbs, ng/mL..."
            />
          </div>
          <MagiSelect
            label="TREND"
            value={form.trend ?? ""}
            onChange={(v) => setForm({ ...form, trend: v === "" ? null : v as Goal["trend"] })}
            options={[
              { value: "", label: "No data" },
              { value: "improving", label: "Improving" },
              { value: "declining", label: "Declining" },
              { value: "stable", label: "Stable" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button
              onClick={() => setModalOpen(false)}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
            >
              {editing ? "UPDATE" : "ADD"} OBJECTIVE
            </button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Confirm */}
      <MagiConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteGoal(deleteTarget.id); setDeleteTarget(null); } }}
        title="DELETE OBJECTIVE"
        message={`Remove "${deleteTarget?.name}" from mission objectives? This cannot be undone.`}
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
