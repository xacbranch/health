"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceArea, ReferenceLine,
} from "recharts";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth } from "@/lib/supabase-data";
import { InsightButton } from "@/components/ui/InsightButton";
import type { BloodworkPanel, BloodworkMarker } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiInput, MagiNumber, MagiSelect } from "@/components/ui/MagiField";

const AXIS_STYLE = { fill: "#333", fontSize: 8, fontFamily: "Monument Mono" };

/* ─── Marker colors (rotate) ─── */
const MARKER_COLORS: Record<string, string> = {
  "Vitamin D": "#FFB800",
  "Total Testosterone": "#00D0FF",
  "TSH": "#FF6A00",
  "Free T4": "#6B21A8",
  "Glucose": "#39FF14",
  "Total Cholesterol": "#FF6A00",
  "LDL": "#FF1A1A",
  "HDL": "#39FF14",
  "Triglycerides": "#FFB800",
  "Iron": "#00D0FF",
  "Ferritin": "#6B21A8",
};
const DEFAULT_COLOR = "#FF6A00";

function getMarkerColor(name: string): string {
  return MARKER_COLORS[name] || DEFAULT_COLOR;
}

function getStatusBadge(flag: BloodworkMarker["flag"]) {
  switch (flag) {
    case "normal":
      return <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-positive/10 text-positive border border-positive/20">NOMINAL</span>;
    case "low":
      return <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-warning/10 text-warning border border-warning/20">LOW</span>;
    case "high":
      return <span className="px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider bg-danger/10 text-danger border border-danger/20">HIGH</span>;
  }
}

function autoFlag(value: number, refLow: number, refHigh: number): BloodworkMarker["flag"] {
  if (value < refLow) return "low";
  if (value > refHigh) return "high";
  return "normal";
}

/* ─── Build trend data for a single marker across all panels ─── */
interface MarkerTrend {
  name: string;
  unit: string;
  refLow: number;
  refHigh: number;
  points: { date: string; value: number; flag: string }[];
  latest: number;
  latestFlag: string;
  delta: number | null;
  color: string;
}

function buildMarkerTrends(panels: BloodworkPanel[]): MarkerTrend[] {
  const sorted = [...panels].sort((a, b) => a.date.localeCompare(b.date));
  const markerMap = new Map<string, MarkerTrend>();

  for (const panel of sorted) {
    for (const m of panel.markers) {
      if (!markerMap.has(m.name)) {
        markerMap.set(m.name, {
          name: m.name,
          unit: m.unit,
          refLow: m.ref_low,
          refHigh: m.ref_high,
          points: [],
          latest: m.value,
          latestFlag: m.flag,
          delta: null,
          color: getMarkerColor(m.name),
        });
      }
      const trend = markerMap.get(m.name)!;
      trend.points.push({ date: panel.date, value: m.value, flag: m.flag });
      trend.refLow = m.ref_low;
      trend.refHigh = m.ref_high;
      trend.latest = m.value;
      trend.latestFlag = m.flag;
    }
  }

  // Compute deltas
  for (const trend of markerMap.values()) {
    if (trend.points.length >= 2) {
      const prev = trend.points[trend.points.length - 2].value;
      trend.delta = +(trend.latest - prev).toFixed(1);
    }
  }

  return [...markerMap.values()];
}

const emptyPanel = { date: "", lab: "", physician: "" };
const emptyMarker: BloodworkMarker = { name: "", value: 0, unit: "", ref_low: 0, ref_high: 0, flag: "normal" };

export default function BloodworkPage() {
  const {
    bloodwork: storeBloodwork,
    addBloodworkPanel, updateBloodworkPanel, deleteBloodworkPanel,
    addBloodworkMarker, updateBloodworkMarker, deleteBloodworkMarker,
  } = useStore();

  // Direct fetch backup
  const [directBloodwork, setDirectBloodwork] = useState<BloodworkPanel[]>([]);
  useEffect(() => {
    async function load() {
      await ensureAuth();
      const sb = createClient();
      const { data } = await sb
        .from("bloodwork_panels")
        .select("*, markers:bloodwork_markers(*)")
        .order("date", { ascending: true });
      if (data?.length) setDirectBloodwork(data);
    }
    load();
  }, []);

  const bloodwork = storeBloodwork.length >= directBloodwork.length ? storeBloodwork : directBloodwork;
  const trends = useMemo(() => buildMarkerTrends(bloodwork), [bloodwork]);

  // Panel CRUD
  const [panelModal, setPanelModal] = useState(false);
  const [editingPanel, setEditingPanel] = useState<BloodworkPanel | null>(null);
  const [panelForm, setPanelForm] = useState(emptyPanel);
  const [deletePanelTarget, setDeletePanelTarget] = useState<BloodworkPanel | null>(null);

  // Marker CRUD
  const [markerModal, setMarkerModal] = useState(false);
  const [editingMarkerName, setEditingMarkerName] = useState<string | null>(null);
  const [markerForm, setMarkerForm] = useState<BloodworkMarker>(emptyMarker);
  const [deleteMarkerTarget, setDeleteMarkerTarget] = useState<{ panelId: string; name: string } | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState("");

  // Select latest panel by default
  useEffect(() => {
    if (bloodwork.length && !selectedPanelId) {
      setSelectedPanelId(bloodwork[bloodwork.length - 1].id);
    }
  }, [bloodwork, selectedPanelId]);

  const selectedPanel = bloodwork.find((p) => p.id === selectedPanelId);

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
    if (editingPanel) updateBloodworkPanel(editingPanel.id, panelForm);
    else addBloodworkPanel(panelForm);
    setPanelModal(false);
  }

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
    if (editingMarkerName) updateBloodworkMarker(selectedPanel.id, editingMarkerName, markerForm);
    else addBloodworkMarker(selectedPanel.id, markerForm);
    setMarkerModal(false);
  }

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            BLOODWORK
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // DIAGNOSTICS
            </span>
          </h1>
        </div>
        <button onClick={openAddPanel} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">
          + ADD PANEL
        </button>
      </div>

      {/* Summary: latest values for all markers */}
      {trends.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {trends.map((t) => (
            <div key={t.name} className="hud-panel p-2.5 corner-brackets">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] tracking-[0.2em] text-text-dim">{t.name.toUpperCase()}</span>
                {getStatusBadge(t.latestFlag as BloodworkMarker["flag"])}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black tabular-nums" style={{ color: t.color }}>{t.latest}</span>
                <span className="text-[8px] text-text-dim">{t.unit}</span>
              </div>
              {t.delta !== null && (
                <div className={`text-[8px] mt-0.5 font-bold ${t.delta < 0 && t.latestFlag !== "low" ? "text-neon/60" : t.delta > 0 && t.latestFlag === "high" ? "text-danger/60" : "text-text-dim"}`}>
                  {t.delta > 0 ? "+" : ""}{t.delta} from prev
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Trend graphs — one per marker */}
      {trends.map((t) => (
        <div key={t.name} className="hud-panel p-3 corner-brackets">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="eva-label text-[8px]">| {t.name.toUpperCase()}</div>
              <div className="text-[7px] tracking-wider text-text-dim">
                {t.refLow}--{t.refHigh} {t.unit}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <InsightButton
                metric={t.name.toLowerCase().replace(/ /g, "_")}
                data={t.points}
                timeScale="ALL"
                context={`Reference range: ${t.refLow}-${t.refHigh} ${t.unit}. Latest: ${t.latest} (${t.latestFlag}).`}
              />
              <div className="flex items-baseline gap-1">
                <span className="data-readout text-lg" style={{ color: t.color }}>{t.latest}</span>
                <span className="text-[8px] text-text-dim">{t.unit}</span>
              </div>
            </div>
          </div>

          <div className="h-36">
            {t.points.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={t.points}>
                  {/* Reference range shading */}
                  <ReferenceArea y1={t.refLow} y2={t.refHigh} fill={`${t.color}08`} />
                  <ReferenceLine y={t.refLow} stroke={`${t.color}25`} strokeDasharray="3 3" />
                  <ReferenceLine y={t.refHigh} stroke={`${t.color}25`} strokeDasharray="3 3" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
                  <YAxis
                    domain={[(min: number) => Math.floor(min * 0.85), (max: number) => Math.ceil(max * 1.15)]}
                    axisLine={false} tickLine={false} tick={AXIS_STYLE} width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0A0A0A", border: `1px solid ${t.color}30`,
                      borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: t.color,
                    }}
                    formatter={(val) => [`${val} ${t.unit}`, t.name]}
                  />
                  <Line
                    type="monotone" dataKey="value" stroke={t.color} strokeWidth={2}
                    dot={{ r: 4, fill: t.color, stroke: "#000", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: t.color, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
                {t.points.length === 1 ? `${t.points[0].value} ${t.unit} on ${t.points[0].date} -- ADD MORE PANELS TO SEE TREND` : "NO DATA"}
              </div>
            )}
          </div>

          {/* Data points row */}
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
            {t.points.map((p, i) => (
              <div key={p.date} className="text-[7px] tracking-wider text-text-dim">
                {p.date.slice(5)}: <span style={{ color: p.flag === "normal" ? "#39FF14" : p.flag === "high" ? "#FF1A1A" : "#FFB800" }}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Panel selector + marker table for editing */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="eva-label text-[8px] mb-3">| PANEL DATA</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {bloodwork.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setSelectedPanelId(panel.id)}
              className={`px-3 py-1.5 text-[8px] font-bold tracking-wider transition-colors ${
                selectedPanelId === panel.id
                  ? "text-eva border border-eva/40 bg-eva/10"
                  : "text-text-dim border border-border/40 hover:border-eva/30"
              }`}
            >
              {panel.date}
              <span className="text-text-dim/50 ml-1 opacity-0 group-hover:opacity-100">
                {panel.markers.length} markers
              </span>
            </button>
          ))}
        </div>

        {selectedPanel && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[8px] text-text-dim tracking-wider">
                {selectedPanel.lab} -- {selectedPanel.physician} -- {selectedPanel.markers.length} MARKERS
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditPanel(selectedPanel)} className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors">EDIT</button>
                <button onClick={() => setDeletePanelTarget(selectedPanel)} className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors">DEL</button>
                <button onClick={openAddMarker} className="text-[7px] tracking-wider text-eva hover:text-eva-bright transition-colors">+ MARKER</button>
              </div>
            </div>

            {/* Marker rows */}
            <div className="space-y-px">
              {selectedPanel.markers.map((m) => (
                <div key={m.name} className="grid grid-cols-5 gap-2 py-1.5 border-b border-border/30 items-center group/mk">
                  <div className="text-text font-mono text-[10px]">{m.name}</div>
                  <div className="data-readout text-sm">
                    {m.value} <span className="text-text-dim font-mono text-[8px]">{m.unit}</span>
                  </div>
                  <div className="text-text-dim font-mono text-[9px]">{m.ref_low}--{m.ref_high}</div>
                  <div>{getStatusBadge(m.flag)}</div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover/mk:opacity-100 transition-opacity">
                    <button onClick={() => openEditMarker(m)} className="text-[7px] tracking-wider text-text-dim hover:text-eva">EDIT</button>
                    <button onClick={() => setDeleteMarkerTarget({ panelId: selectedPanel.id, name: m.name })} className="text-[7px] tracking-wider text-text-dim hover:text-danger">DEL</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <MagiModal open={panelModal} onClose={() => setPanelModal(false)} title={editingPanel ? "EDIT PANEL" : "NEW PANEL"}>
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

      <MagiModal open={markerModal} onClose={() => setMarkerModal(false)} title={editingMarkerName ? "EDIT MARKER" : "ADD MARKER"}>
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
          <MagiSelect label="FLAG" value={markerForm.flag} onChange={(v) => setMarkerForm({ ...markerForm, flag: v as BloodworkMarker["flag"] })} options={[
            { value: "normal", label: "Normal" },
            { value: "low", label: "Low" },
            { value: "high", label: "High" },
          ]} />
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setMarkerModal(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSaveMarker} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">{editingMarkerName ? "UPDATE" : "ADD"} MARKER</button>
          </div>
        </div>
      </MagiModal>

      <MagiConfirm open={!!deletePanelTarget} onClose={() => setDeletePanelTarget(null)}
        onConfirm={() => { if (deletePanelTarget) { deleteBloodworkPanel(deletePanelTarget.id); setDeletePanelTarget(null); } }}
        title="DELETE PANEL" message={`Remove panel from ${deletePanelTarget?.date}? All markers will be lost.`} confirmLabel="DELETE" danger />

      <MagiConfirm open={!!deleteMarkerTarget} onClose={() => setDeleteMarkerTarget(null)}
        onConfirm={() => { if (deleteMarkerTarget) { deleteBloodworkMarker(deleteMarkerTarget.panelId, deleteMarkerTarget.name); setDeleteMarkerTarget(null); } }}
        title="DELETE MARKER" message={`Remove "${deleteMarkerTarget?.name}" from this panel?`} confirmLabel="DELETE" danger />
    </div>
  );
}
