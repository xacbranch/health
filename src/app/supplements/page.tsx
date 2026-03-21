"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Supplement } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiSelect, MagiTextarea, MagiToggle } from "@/components/ui/MagiField";

const CATEGORIES = ["ALL", "PEPTIDES", "SUPPLEMENTS", "MEDICATIONS"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

const categoryMap: Record<CategoryFilter, string | null> = {
  ALL: null,
  PEPTIDES: "peptide",
  SUPPLEMENTS: "supplement",
  MEDICATIONS: "medication",
};

const emptySupplement: Omit<Supplement, "id"> = {
  name: "",
  category: "supplement",
  dose: "",
  timing: "",
  purpose: "",
  route: "oral",
  active: true,
};

export default function SupplementsPage() {
  const { supplements, addSupplement, updateSupplement, deleteSupplement } = useStore();
  const [filter, setFilter] = useState<CategoryFilter>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [form, setForm] = useState<Omit<Supplement, "id">>(emptySupplement);
  const [deleteTarget, setDeleteTarget] = useState<Supplement | null>(null);

  const filtered =
    filter === "ALL"
      ? supplements
      : supplements.filter((s) => s.category === categoryMap[filter]);

  function openAdd() {
    setEditing(null);
    setForm(emptySupplement);
    setModalOpen(true);
  }

  function openEdit(s: Supplement) {
    setEditing(s);
    setForm({ name: s.name, category: s.category, dose: s.dose, timing: s.timing, purpose: s.purpose, route: s.route, active: s.active });
    setModalOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) {
      updateSupplement(editing.id, form);
    } else {
      addSupplement(form);
    }
    setModalOpen(false);
  }

  function handleDelete() {
    if (deleteTarget) {
      deleteSupplement(deleteTarget.id);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eva-label mb-1">PROTOCOL REGISTRY</div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-bright">
            ACTIVE PROTOCOLS
          </h1>
        </div>
        <button
          onClick={openAdd}
          className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
        >
          + ADD PROTOCOL
        </button>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 border font-mono text-[10px] font-bold tracking-wider transition-all ${
              filter === cat
                ? "bg-eva/10 text-eva border-eva/20"
                : "text-text-dim border-border hover:border-eva/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Protocol cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((s) => (
          <div key={s.id} className="hud-panel p-4 corner-brackets space-y-3 group">
            {/* Top: name + category badge + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-text-bright">{s.name}</span>
                <span
                  className={`px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider border ${
                    s.category === "peptide"
                      ? "bg-cyan/10 text-cyan border-cyan/20"
                      : s.category === "supplement"
                        ? "bg-lime/10 text-lime border-lime/20"
                        : "bg-eva/10 text-eva border-eva/20"
                  }`}
                >
                  {s.category.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {s.active && (
                  <div className="w-2 h-2 rounded-full bg-positive shrink-0" />
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(s)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                  >
                    EDIT
                  </button>
                  <span className="text-text-dim/30">|</span>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                  >
                    DEL
                  </button>
                </div>
              </div>
            </div>

            {/* Route indicator */}
            <div className="eva-label">{s.route.toUpperCase()}</div>

            {/* Dose and timing */}
            <div className="font-mono text-text-dim text-xs">
              {s.dose} · {s.timing}
            </div>

            {/* Purpose */}
            <div className="text-xs text-text">{s.purpose}</div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <MagiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "EDIT PROTOCOL" : "NEW PROTOCOL"}
      >
        <div className="space-y-3">
          <MagiInput
            label="NAME"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Protocol name"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <MagiSelect
              label="CATEGORY"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as Supplement["category"] })}
              options={[
                { value: "peptide", label: "Peptide" },
                { value: "supplement", label: "Supplement" },
                { value: "medication", label: "Medication" },
              ]}
            />
            <MagiSelect
              label="ROUTE"
              value={form.route}
              onChange={(v) => setForm({ ...form, route: v as Supplement["route"] })}
              options={[
                { value: "oral", label: "Oral" },
                { value: "nasal", label: "Nasal" },
                { value: "injection", label: "Injection" },
                { value: "topical", label: "Topical" },
              ]}
            />
          </div>
          <MagiInput
            label="DOSE"
            value={form.dose}
            onChange={(v) => setForm({ ...form, dose: v })}
            placeholder="e.g., 5000 IU"
          />
          <MagiInput
            label="TIMING"
            value={form.timing}
            onChange={(v) => setForm({ ...form, timing: v })}
            placeholder="e.g., With first meal"
          />
          <MagiTextarea
            label="PURPOSE"
            value={form.purpose}
            onChange={(v) => setForm({ ...form, purpose: v })}
            placeholder="What does this do?"
            rows={2}
          />
          <MagiToggle
            label="ACTIVE"
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
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
              {editing ? "UPDATE" : "ADD"} PROTOCOL
            </button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Confirm */}
      <MagiConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="DELETE PROTOCOL"
        message={`Remove "${deleteTarget?.name}" from the protocol registry? This cannot be undone.`}
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
