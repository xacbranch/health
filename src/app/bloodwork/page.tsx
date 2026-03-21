"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { BloodworkPanel, BloodworkMarker } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiNumber, MagiSelect } from "@/components/ui/MagiField";

const TREND_MARKERS = ["Vitamin D", "Total Testosterone", "TSH", "Free T4"];

function getStatusBadge(flag: BloodworkMarker["flag"]) {
  switch (flag) {
    case "normal":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-positive/10 text-positive border border-positive/20">
          NOMINAL
        </span>
      );
    case "low":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-warning/10 text-warning border border-warning/20">
          LOW
        </span>
      );
    case "high":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-danger/10 text-danger border border-danger/20">
          HIGH
        </span>
      );
  }
}

function getTrendColor(oldVal: number, newVal: number, refLow: number, refHigh: number): string {
  const midRef = (refLow + refHigh) / 2;
  const oldDist = Math.abs(oldVal - midRef);
  const newDist = Math.abs(newVal - midRef);
  if (Math.abs(oldDist - newDist) < 0.5) return "text-text-dim";
  return newDist < oldDist ? "text-positive" : "text-danger";
}

const emptyPanel = { date: "", lab: "", physician: "" };
const emptyMarker: BloodworkMarker = { name: "", value: 0, unit: "", ref_low: 0, ref_high: 0, flag: "normal" };

export default function BloodworkPage() {
  const {
    bloodwork,
    addBloodworkPanel, updateBloodworkPanel, deleteBloodworkPanel,
    addBloodworkMarker, updateBloodworkMarker, deleteBloodworkMarker,
  } = useStore();

  const [selectedPanelId, setSelectedPanelId] = useState(
    bloodwork[bloodwork.length - 1]?.id ?? ""
  );

  // Panel CRUD state
  const [panelModal, setPanelModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState<BloodworkPanel | null>(null);
  const [panelForm, setPanelForm] = useState(emptyPanel);
  const [deletePanelTarget, setDeletePanelTarget] = useState<BloodworkPanel | null>(null);

  // Marker CRUD state
  const [markerModal, setMarkerModal] = useState(false);
  const [editingMarkerName, setEditingMarkerName] = useState<string | null>(null);
  const [markerForm, setMarkerForm] = useState<BloodworkMarker>(emptyMarker);
  const [deleteMarkerTarget, setDeleteMarkerTarget] = useState<{ panelId: string; name: string } | null>(null);

  const selectedPanel = bloodwork.find((p) => p.id === selectedPanelId);

  // Trend data
  const trendData = TREND_MARKERS.map((name) => {
    const older = bloodwork.length >= 2 ? bloodwork[0].markers.find((m) => m.name === name) : null;
    const newer = bloodwork.length >= 2 ? bloodwork[1].markers.find((m) => m.name === name) : null;
    if (!older || !newer) return null;
    return {
      name,
      oldVal: older.value,
      newVal: newer.value,
      unit: newer.unit,
      refLow: newer.ref_low,
      refHigh: newer.ref_high,
      color: getTrendColor(older.value, newer.value, newer.ref_low, newer.ref_high),
    };
  }).filter(Boolean) as { name: string; oldVal: number; newVal: number; unit: string; refLow: number; refHigh: number; color: string }[];

  // Panel handlers
  function openAddPanel() {
    setEditingPanel(null);
    setPanelForm({ date: new Date().toISOString().split("T")[0], lab: "", physician: "" });
    setPanelModal(true);
  }

  function openEditPanel(p: BloodworkPanel) {
    setEditingPanel(p);
    setPanelForm({ date: p.date, lab: p.lab, physician: p.physician });
    setPanelModal(true);
  }

  function handleSavePanel() {
    if (!panelForm.date) return;
    if (editingPanel) {
      updateBloodworkPanel(editingPanel.id, panelForm);
    } else {
      addBloodworkPanel(panelForm);
    }
    setPanelModal(false);
  }

  // Marker handlers
  function openAddMarker() {
    if (!selectedPanel) return;
    setEditingMarkerName(null);
    setMarkerForm(emptyMarker);
    setMarkerModal(true);
  }

  function openEditMarker(m: BloodworkMarker) {
    setEditingMarkerName(m.name);
    setMarkerForm({ ...m });
    setMarkerModal(true);
  }

  function handleSaveMarker() {
    if (!selectedPanel || !markerForm.name.trim()) return;
    if (editingMarkerName) {
      updateBloodworkMarker(selectedPanel.id, editingMarkerName, markerForm);
    } else {
      addBloodworkMarker(selectedPanel.id, markerForm);
    }
    setMarkerModal(false);
  }

  function autoFlag(value: number, refLow: number, refHigh: number): BloodworkMarker["flag"] {
    if (value < refLow) return "low";
    if (value > refHigh) return "high";
    return "normal";
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eva-label mb-1">DIAGNOSTICS MODULE</div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-bright">
            BLOODWORK ANALYSIS
          </h1>
        </div>
        <button
          onClick={openAddPanel}
          className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
        >
          + ADD PANEL
        </button>
      </div>

      {/* Panel selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bloodwork.map((panel) => (
          <div
            key={panel.id}
            className={`p-4 text-left transition-all cursor-pointer group ${
              selectedPanelId === panel.id
                ? "hud-panel corner-brackets border-eva/30"
                : "hud-panel corner-brackets"
            }`}
            onClick={() => setSelectedPanelId(panel.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="eva-label mb-2">{panel.lab.toUpperCase()}</div>
                <div className="font-bold text-text-bright text-sm">{panel.date}</div>
                <div className="font-mono text-[10px] text-text-dim mt-1">
                  DR. {panel.physician.toUpperCase()}
                </div>
                <div className="font-mono text-[10px] text-text-dim mt-1">
                  {panel.markers.length} MARKERS
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); openEditPanel(panel); }}
                  className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                >
                  EDIT
                </button>
                <span className="text-text-dim/30">|</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletePanelTarget(panel); }}
                  className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                >
                  DEL
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Marker table */}
      {selectedPanel && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="flex items-center justify-between mb-4">
            <div className="eva-label">
              PANEL RESULTS — {selectedPanel.date}
            </div>
            <button
              onClick={openAddMarker}
              className="text-[7px] tracking-wider text-eva hover:text-eva-bright transition-colors"
            >
              + ADD MARKER
            </button>
          </div>

          {/* Header row */}
          <div className="grid grid-cols-5 gap-2 pb-2 mb-2 border-b border-border">
            <div className="eva-label">MARKER</div>
            <div className="eva-label">VALUE</div>
            <div className="eva-label">RANGE</div>
            <div className="eva-label">STATUS</div>
            <div className="eva-label text-right">ACTIONS</div>
          </div>

          {/* Marker rows */}
          <div className="space-y-1">
            {selectedPanel.markers.map((m) => (
              <div
                key={m.name}
                className="grid grid-cols-5 gap-2 py-2 border-b border-border/50 items-center group/mk"
              >
                <div className="text-text font-mono text-xs">{m.name}</div>
                <div className="data-readout text-sm">
                  {m.value}
                  <span className="text-text-dim font-mono text-[9px] ml-1">{m.unit}</span>
                </div>
                <div className="text-text-dim font-mono text-[10px]">
                  {m.ref_low} — {m.ref_high}
                </div>
                <div>{getStatusBadge(m.flag)}</div>
                <div className="flex justify-end gap-1 opacity-0 group-hover/mk:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditMarker(m)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                  >
                    EDIT
                  </button>
                  <span className="text-text-dim/30">|</span>
                  <button
                    onClick={() => setDeleteMarkerTarget({ panelId: selectedPanel.id, name: m.name })}
                    className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend comparison */}
      {trendData.length > 0 && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="eva-label mb-4">
            TREND ANALYSIS — {bloodwork[0].date} → {bloodwork[1].date}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trendData.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between p-3 bg-surface-2 border border-border/40"
              >
                <div>
                  <div className="font-mono text-xs text-text">{t.name}</div>
                  <div className="font-mono text-[10px] text-text-dim mt-0.5">
                    {t.unit} · ref {t.refLow}–{t.refHigh}
                  </div>
                </div>
                <div className={`font-mono font-bold text-sm ${t.color}`}>
                  {t.oldVal} → {t.newVal}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel Modal */}
      <MagiModal
        open={panelModal}
        onClose={() => setPanelModal(false)}
        title={editingPanel ? "EDIT PANEL" : "NEW PANEL"}
      >
        <div className="space-y-3">
          <MagiInput label="DATE" type="date" value={panelForm.date} onChange={(v) => setPanelForm({ ...panelForm, date: v })} required />
          <MagiInput label="LAB" value={panelForm.lab} onChange={(v) => setPanelForm({ ...panelForm, lab: v })} placeholder="Quest Diagnostics, Labcorp..." />
          <MagiInput label="PHYSICIAN" value={panelForm.physician} onChange={(v) => setPanelForm({ ...panelForm, physician: v })} placeholder="Dr. Name" />
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setPanelModal(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSavePanel} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">{editingPanel ? "UPDATE" : "ADD"} PANEL</button>
          </div>
        </div>
      </MagiModal>

      {/* Marker Modal */}
      <MagiModal
        open={markerModal}
        onClose={() => setMarkerModal(false)}
        title={editingMarkerName ? "EDIT MARKER" : "ADD MARKER"}
      >
        <div className="space-y-3">
          <MagiInput label="MARKER NAME" value={markerForm.name} onChange={(v) => setMarkerForm({ ...markerForm, name: v })} placeholder="Vitamin D, TSH..." required />
          <div className="grid grid-cols-2 gap-3">
            <MagiNumber label="VALUE" value={markerForm.value} onChange={(v) => {
              const val = v === "" ? 0 : v;
              setMarkerForm({ ...markerForm, value: val, flag: autoFlag(val, markerForm.ref_low, markerForm.ref_high) });
            }} step={0.01} />
            <MagiInput label="UNIT" value={markerForm.unit} onChange={(v) => setMarkerForm({ ...markerForm, unit: v })} placeholder="ng/mL, mg/dL..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MagiNumber label="REF LOW" value={markerForm.ref_low} onChange={(v) => {
              const low = v === "" ? 0 : v;
              setMarkerForm({ ...markerForm, ref_low: low, flag: autoFlag(markerForm.value, low, markerForm.ref_high) });
            }} step={0.01} />
            <MagiNumber label="REF HIGH" value={markerForm.ref_high} onChange={(v) => {
              const high = v === "" ? 0 : v;
              setMarkerForm({ ...markerForm, ref_high: high, flag: autoFlag(markerForm.value, markerForm.ref_low, high) });
            }} step={0.01} />
          </div>
          <MagiSelect
            label="FLAG"
            value={markerForm.flag}
            onChange={(v) => setMarkerForm({ ...markerForm, flag: v as BloodworkMarker["flag"] })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "low", label: "Low" },
              { value: "high", label: "High" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setMarkerModal(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSaveMarker} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">{editingMarkerName ? "UPDATE" : "ADD"} MARKER</button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Panel Confirm */}
      <MagiConfirm
        open={!!deletePanelTarget}
        onClose={() => setDeletePanelTarget(null)}
        onConfirm={() => { if (deletePanelTarget) { deleteBloodworkPanel(deletePanelTarget.id); setDeletePanelTarget(null); } }}
        title="DELETE PANEL"
        message={`Remove panel from ${deletePanelTarget?.date}? All markers will be lost.`}
        confirmLabel="DELETE"
        danger
      />

      {/* Delete Marker Confirm */}
      <MagiConfirm
        open={!!deleteMarkerTarget}
        onClose={() => setDeleteMarkerTarget(null)}
        onConfirm={() => { if (deleteMarkerTarget) { deleteBloodworkMarker(deleteMarkerTarget.panelId, deleteMarkerTarget.name); setDeleteMarkerTarget(null); } }}
        title="DELETE MARKER"
        message={`Remove "${deleteMarkerTarget?.name}" from this panel?`}
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
