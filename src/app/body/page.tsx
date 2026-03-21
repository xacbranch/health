"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { WeighIn, BodyMeasurement, MeasurementSite } from "@/types";
import MagiModal from "@/components/ui/MagiModal";
import MagiConfirm from "@/components/ui/MagiConfirm";
import { MagiNumber, MagiInput, MagiSelect } from "@/components/ui/MagiField";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

const SITE_LABELS: Record<MeasurementSite, string> = {
  waist: "WAIST",
  chest: "CHEST",
  hips: "HIPS",
  neck: "NECK",
  left_arm: "L ARM",
  right_arm: "R ARM",
  left_thigh: "L THIGH",
  right_thigh: "R THIGH",
  left_calf: "L CALF",
  right_calf: "R CALF",
  shoulders: "SHOULDERS",
  forearm: "FOREARM",
};

const ALL_SITES: MeasurementSite[] = [
  "waist", "chest", "hips", "neck", "shoulders",
  "left_arm", "right_arm", "left_thigh", "right_thigh",
  "left_calf", "right_calf", "forearm",
];

export default function BodyPage() {
  const {
    weighIns, goals, addWeighIn, updateWeighIn, deleteWeighIn,
    bodyMeasurements, addBodyMeasurement, updateBodyMeasurement, deleteBodyMeasurement,
  } = useStore();

  // ── Weigh-in state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WeighIn | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formWeight, setFormWeight] = useState<number | "">("");
  const [formBf, setFormBf] = useState<number | "">("");
  const [deleteTarget, setDeleteTarget] = useState<WeighIn | null>(null);
  const [showWeighInTable, setShowWeighInTable] = useState(false);

  // ── Measurement state ──
  const [measModal, setMeasModal] = useState(false);
  const [editingMeas, setEditingMeas] = useState<BodyMeasurement | null>(null);
  const [measDate, setMeasDate] = useState("");
  const [measSite, setMeasSite] = useState<MeasurementSite>("waist");
  const [measValue, setMeasValue] = useState<number | "">("");
  const [measUnit, setMeasUnit] = useState<"in" | "cm">("in");
  const [deleteMeasTarget, setDeleteMeasTarget] = useState<BodyMeasurement | null>(null);
  const [showMeasTable, setShowMeasTable] = useState(false);

  // ── Weigh-in computed ──
  const latest = weighIns[weighIns.length - 1];
  const last30 = weighIns.slice(-30);
  const last7 = weighIns.slice(-7);

  const avg7d = last7.length
    ? Math.round((last7.reduce((a, b) => a + b.weight, 0) / last7.length) * 10) / 10
    : 0;

  const change30d =
    last30.length >= 2
      ? Math.round((last30[last30.length - 1].weight - last30[0].weight) * 10) / 10
      : 0;

  const goalWeight = 185;

  const chartData = last30.map((w) => ({
    date: w.date.slice(5),
    weight: w.weight,
  }));

  const bodyCompGoals = goals.filter((g) => g.category === "body_comp");

  // ── Measurement computed ──
  const measurementDates = useMemo(() => {
    const dates = [...new Set(bodyMeasurements.map((m) => m.date))].sort();
    return dates;
  }, [bodyMeasurements]);

  const latestMeasDate = measurementDates[measurementDates.length - 1];
  const prevMeasDate = measurementDates.length >= 2 ? measurementDates[measurementDates.length - 2] : null;

  // Group latest measurements by site
  const latestMeasurements = useMemo(() => {
    if (!latestMeasDate) return new Map<MeasurementSite, BodyMeasurement>();
    const map = new Map<MeasurementSite, BodyMeasurement>();
    bodyMeasurements
      .filter((m) => m.date === latestMeasDate)
      .forEach((m) => map.set(m.site, m));
    return map;
  }, [bodyMeasurements, latestMeasDate]);

  const prevMeasurements = useMemo(() => {
    if (!prevMeasDate) return new Map<MeasurementSite, BodyMeasurement>();
    const map = new Map<MeasurementSite, BodyMeasurement>();
    bodyMeasurements
      .filter((m) => m.date === prevMeasDate)
      .forEach((m) => map.set(m.site, m));
    return map;
  }, [bodyMeasurements, prevMeasDate]);

  // Sites that have data
  const activeSites = useMemo(() => {
    const sites = new Set<MeasurementSite>();
    bodyMeasurements.forEach((m) => sites.add(m.site));
    return [...sites].sort((a, b) => ALL_SITES.indexOf(a) - ALL_SITES.indexOf(b));
  }, [bodyMeasurements]);

  // ── Weigh-in handlers ──
  function openAddWeighIn() {
    setEditing(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormWeight("");
    setFormBf("");
    setModalOpen(true);
  }

  function openEditWeighIn(w: WeighIn) {
    setEditing(w);
    setFormDate(w.date);
    setFormWeight(w.weight);
    setFormBf(w.body_fat_pct ?? "");
    setModalOpen(true);
  }

  function handleSaveWeighIn() {
    if (formWeight === "" || !formDate) return;
    const data = {
      date: formDate,
      weight: Number(formWeight),
      body_fat_pct: formBf === "" ? null : Number(formBf),
    };
    if (editing) {
      updateWeighIn(editing.id, data);
    } else {
      addWeighIn(data);
    }
    setModalOpen(false);
  }

  // ── Measurement handlers ──
  function openAddMeas() {
    setEditingMeas(null);
    setMeasDate(new Date().toISOString().split("T")[0]);
    setMeasSite("waist");
    setMeasValue("");
    setMeasUnit("in");
    setMeasModal(true);
  }

  function openEditMeas(m: BodyMeasurement) {
    setEditingMeas(m);
    setMeasDate(m.date);
    setMeasSite(m.site);
    setMeasValue(m.value);
    setMeasUnit(m.unit);
    setMeasModal(true);
  }

  function handleSaveMeas() {
    if (measValue === "" || !measDate) return;
    const data = {
      date: measDate,
      site: measSite,
      value: Number(measValue),
      unit: measUnit,
    };
    if (editingMeas) {
      updateBodyMeasurement(editingMeas.id, data);
    } else {
      addBodyMeasurement(data);
    }
    setMeasModal(false);
  }

  // Sites where losing inches = good (waist, hips)
  const lossSites: MeasurementSite[] = ["waist", "hips", "left_thigh", "right_thigh"];

  function getDelta(site: MeasurementSite): { delta: number; isGood: boolean } | null {
    const curr = latestMeasurements.get(site);
    const prev = prevMeasurements.get(site);
    if (!curr || !prev) return null;
    const delta = Math.round((curr.value - prev.value) * 10) / 10;
    const isGood = lossSites.includes(site) ? delta <= 0 : delta >= 0;
    return { delta, isGood };
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="eva-label mb-1">BIOMETRICS MODULE</div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-bright">
            BODY COMPOSITION
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAddMeas}
            className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-cyan border border-cyan/40 hover:bg-cyan/10 transition-colors"
          >
            + MEASUREMENT
          </button>
          <button
            onClick={openAddWeighIn}
            className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors"
          >
            + WEIGH-IN
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="hud-panel p-3 md:p-4 corner-brackets border border-lime/20">
          <div className="eva-label mb-2">CURRENT WEIGHT</div>
          <div className="flex items-baseline gap-1">
            <span className="data-readout text-2xl md:text-3xl text-lime">
              {latest?.weight ?? "—"}
            </span>
            <span className="font-mono text-[10px] text-text-dim">LBS</span>
          </div>
        </div>

        <div className="hud-panel p-3 md:p-4 corner-brackets border border-cyan/20">
          <div className="eva-label mb-2">7D AVERAGE</div>
          <div className="flex items-baseline gap-1">
            <span className="data-readout text-2xl md:text-3xl text-cyan">
              {avg7d || "—"}
            </span>
            <span className="font-mono text-[10px] text-text-dim">LBS</span>
          </div>
        </div>

        <div className="hud-panel p-3 md:p-4 corner-brackets border border-lime/20">
          <div className="eva-label mb-2">30D CHANGE</div>
          <div className="flex items-baseline gap-1">
            <span
              className={`data-readout text-2xl md:text-3xl ${
                change30d < 0 ? "text-positive" : change30d > 0 ? "text-danger" : "text-text-dim"
              }`}
            >
              {change30d > 0 ? "+" : ""}
              {change30d}
            </span>
            <span className="font-mono text-[10px] text-text-dim">LBS</span>
          </div>
          {change30d !== 0 && (
            <div
              className={`font-mono text-[10px] mt-1 ${
                change30d < 0 ? "text-positive" : "text-danger"
              }`}
            >
              {change30d < 0 ? "▼ LOSING" : "▲ GAINING"}
            </div>
          )}
        </div>

        <div className="hud-panel p-3 md:p-4 corner-brackets border border-cyan/20">
          <div className="eva-label mb-2">GOAL WEIGHT</div>
          <div className="flex items-baseline gap-1">
            <span className="data-readout text-2xl md:text-3xl text-cyan">
              {goalWeight}
            </span>
            <span className="font-mono text-[10px] text-text-dim">LBS</span>
          </div>
          {latest && (
            <div className="font-mono text-[10px] text-text-dim mt-1">
              {Math.round((latest.weight - goalWeight) * 10) / 10} TO GO
            </div>
          )}
        </div>
      </div>

      {/* Weight Chart */}
      <div className="hud-panel p-4 md:p-5 corner-brackets">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="eva-label mb-1">TELEMETRY</div>
            <div className="text-sm font-bold text-text-bright">
              Weight Trend — 30d
            </div>
          </div>
          <div className="data-readout text-2xl">
            {latest?.weight ?? "—"}
            <span className="text-xs text-text-dim ml-1">LBS</span>
          </div>
        </div>
        <div className="h-64 md:h-80 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bodyLimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E5FF8F" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E5FF8F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666", fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 3", "dataMax + 3"]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#666", fontSize: 10 }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  background: "#0A0A0A",
                  border: "1px solid #E5FF8F30",
                  fontSize: "12px",
                  color: "#E5FF8F",
                }}
              />
              <ReferenceLine
                y={goalWeight}
                stroke="#00D0FF"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: "GOAL 185",
                  position: "right",
                  fill: "#00D0FF",
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#E5FF8F"
                strokeWidth={2}
                fill="url(#bodyLimeGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          BODY MEASUREMENTS SECTION
          ═══════════════════════════════════════════ */}

      {/* Measurement Summary — latest session */}
      {activeSites.length > 0 && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="eva-label mb-1">BODY MEASUREMENTS</div>
              <div className="text-[10px] text-text-dim font-mono">
                Last measured: {latestMeasDate}
                {prevMeasDate && ` · Prev: ${prevMeasDate}`}
              </div>
            </div>
            <button
              onClick={openAddMeas}
              className="text-[7px] tracking-wider text-cyan hover:text-cyan/80 transition-colors"
            >
              + LOG MEASUREMENT
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {activeSites.map((site) => {
              const latest = latestMeasurements.get(site);
              const deltaInfo = getDelta(site);

              return (
                <div
                  key={site}
                  className="bg-surface-2 border border-border/40 p-3 space-y-1"
                >
                  <div className="text-[7px] tracking-[0.2em] text-text-dim">
                    {SITE_LABELS[site]}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="data-readout text-lg text-cyan">
                      {latest?.value ?? "—"}
                    </span>
                    <span className="text-[8px] text-text-dim font-mono">
                      {latest?.unit ?? "in"}
                    </span>
                  </div>
                  {deltaInfo && (
                    <div
                      className={`text-[9px] font-mono ${
                        deltaInfo.isGood ? "text-positive" : "text-danger"
                      }`}
                    >
                      {deltaInfo.delta > 0 ? "+" : ""}{deltaInfo.delta}{" "}
                      {deltaInfo.isGood ? "▼" : "▲"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Measurement History — Trend Table */}
      {measurementDates.length > 0 && (
        <div className="hud-panel p-4 corner-brackets">
          <div className="flex items-center justify-between mb-3">
            <div className="eva-label">MEASUREMENT TREND</div>
            <div className="text-[7px] text-text-dim tracking-wider">
              {measurementDates.length} SESSION{measurementDates.length !== 1 && "S"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-[7px] tracking-[0.2em] text-text-dim py-2 pr-3 sticky left-0 bg-surface">
                    SITE
                  </th>
                  {measurementDates.map((d) => (
                    <th key={d} className="text-[7px] tracking-[0.2em] text-text-dim py-2 px-2 text-center">
                      {d.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeSites.map((site) => (
                  <tr key={site} className="border-b border-border/20">
                    <td className="text-[9px] font-mono text-text-dim py-1.5 pr-3 sticky left-0 bg-surface">
                      {SITE_LABELS[site]}
                    </td>
                    {measurementDates.map((d) => {
                      const m = bodyMeasurements.find(
                        (bm) => bm.date === d && bm.site === site
                      );
                      return (
                        <td key={d} className="text-[10px] font-mono text-center py-1.5 px-2">
                          {m ? (
                            <span className="text-text">{m.value}</span>
                          ) : (
                            <span className="text-text-dim/30">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Measurement Log — All Entries (expandable) */}
      <div className="hud-panel p-4 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="eva-label">MEASUREMENT LOG</div>
          <button
            onClick={() => setShowMeasTable(!showMeasTable)}
            className="text-[7px] tracking-wider text-text-dim hover:text-cyan transition-colors"
          >
            {showMeasTable ? "HIDE" : "SHOW"} ENTRIES ({bodyMeasurements.length})
          </button>
        </div>
        {showMeasTable && (
          <div className="space-y-0">
            <div className="grid grid-cols-5 gap-2 pb-2 border-b border-border/40">
              <div className="text-[7px] tracking-[0.2em] text-text-dim">DATE</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim">SITE</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim">VALUE</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim">UNIT</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim text-right">ACTIONS</div>
            </div>
            {[...bodyMeasurements]
              .sort((a, b) => b.date.localeCompare(a.date) || a.site.localeCompare(b.site))
              .map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-5 gap-2 py-1.5 border-b border-border/20 items-center group/row"
                >
                  <div className="text-[9px] font-mono text-text-dim">{m.date}</div>
                  <div className="text-[9px] font-mono text-text">{SITE_LABELS[m.site]}</div>
                  <div className="text-[10px] font-bold font-mono text-cyan">{m.value}</div>
                  <div className="text-[9px] font-mono text-text-dim">{m.unit}</div>
                  <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditMeas(m)}
                      className="text-[7px] tracking-wider text-text-dim hover:text-cyan transition-colors"
                    >
                      EDIT
                    </button>
                    <span className="text-text-dim/30">|</span>
                    <button
                      onClick={() => setDeleteMeasTarget(m)}
                      className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                    >
                      DEL
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Weigh-in Log Table */}
      <div className="hud-panel p-4 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="eva-label">WEIGH-IN LOG</div>
          <button
            onClick={() => setShowWeighInTable(!showWeighInTable)}
            className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
          >
            {showWeighInTable ? "HIDE" : "SHOW"} ENTRIES ({weighIns.length})
          </button>
        </div>
        {showWeighInTable && (
          <div className="space-y-0">
            <div className="grid grid-cols-4 gap-2 pb-2 border-b border-border/40">
              <div className="text-[7px] tracking-[0.2em] text-text-dim">DATE</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim">WEIGHT</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim">BODY FAT</div>
              <div className="text-[7px] tracking-[0.2em] text-text-dim text-right">ACTIONS</div>
            </div>
            {[...weighIns].reverse().slice(0, 30).map((w) => (
              <div
                key={w.id}
                className="grid grid-cols-4 gap-2 py-1.5 border-b border-border/20 items-center group/row"
              >
                <div className="text-[9px] font-mono text-text-dim">{w.date}</div>
                <div className="text-[10px] font-bold font-mono text-text">{w.weight} lbs</div>
                <div className="text-[10px] font-mono text-text-dim">
                  {w.body_fat_pct ? `${w.body_fat_pct}%` : "—"}
                </div>
                <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditWeighIn(w)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-eva transition-colors"
                  >
                    EDIT
                  </button>
                  <span className="text-text-dim/30">|</span>
                  <button
                    onClick={() => setDeleteTarget(w)}
                    className="text-[7px] tracking-wider text-text-dim hover:text-danger transition-colors"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Body Comp Goals */}
      <div className="hud-panel p-4 md:p-5 corner-brackets">
        <div className="eva-label mb-4">BODY COMPOSITION TARGETS</div>
        <div className="space-y-5">
          {bodyCompGoals.map((g) => {
            const start = g.direction === "down" ? g.current + (g.current - g.target) * 0.5 : 0;
            const pct =
              g.direction === "down"
                ? Math.min(100, Math.max(0, ((start - g.current) / (start - g.target)) * 100))
                : Math.min(100, Math.max(0, (g.current / g.target) * 100));

            return (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[12px] font-bold text-text-bright">
                    {g.name.toUpperCase()}
                  </span>
                  <span className="font-mono text-[11px] text-text-dim">
                    {g.current}{g.unit} → {g.target}{g.unit}
                  </span>
                </div>
                <div className="h-2 bg-surface-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${
                      g.trend === "improving"
                        ? "bg-lime"
                        : g.trend === "declining"
                          ? "bg-danger"
                          : "bg-cyan"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span
                    className={`font-mono text-[9px] tracking-wider ${
                      g.trend === "improving"
                        ? "text-positive"
                        : g.trend === "declining"
                          ? "text-danger"
                          : "text-text-dim"
                    }`}
                  >
                    {g.trend ? g.trend.toUpperCase() : "NO DATA"}
                  </span>
                  <span className="font-mono text-[9px] text-text-dim">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Weigh-in Modal */}
      <MagiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "EDIT WEIGH-IN" : "LOG WEIGH-IN"}
      >
        <div className="space-y-3">
          <MagiInput label="DATE" type="date" value={formDate} onChange={setFormDate} required />
          <div className="grid grid-cols-2 gap-3">
            <MagiNumber label="WEIGHT (LBS)" value={formWeight} onChange={setFormWeight} step={0.1} min={0} required />
            <MagiNumber label="BODY FAT %" value={formBf} onChange={setFormBf} step={0.1} min={0} max={100} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSaveWeighIn} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-eva border border-eva/40 hover:bg-eva/10 transition-colors">{editing ? "UPDATE" : "LOG"} WEIGH-IN</button>
          </div>
        </div>
      </MagiModal>

      {/* Measurement Modal */}
      <MagiModal
        open={measModal}
        onClose={() => setMeasModal(false)}
        title={editingMeas ? "EDIT MEASUREMENT" : "LOG MEASUREMENT"}
      >
        <div className="space-y-3">
          <MagiInput label="DATE" type="date" value={measDate} onChange={setMeasDate} required />
          <MagiSelect
            label="SITE"
            value={measSite}
            onChange={(v) => setMeasSite(v as MeasurementSite)}
            options={ALL_SITES.map((s) => ({ value: s, label: SITE_LABELS[s] }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <MagiNumber label="VALUE" value={measValue} onChange={setMeasValue} step={0.1} min={0} required />
            <MagiSelect
              label="UNIT"
              value={measUnit}
              onChange={(v) => setMeasUnit(v as "in" | "cm")}
              options={[
                { value: "in", label: "Inches" },
                { value: "cm", label: "Centimeters" },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border/30">
            <button onClick={() => setMeasModal(false)} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-text-dim hover:text-text border border-border/40 hover:border-border transition-colors">CANCEL</button>
            <button onClick={handleSaveMeas} className="px-3 py-1.5 text-[8px] font-bold tracking-wider text-cyan border border-cyan/40 hover:bg-cyan/10 transition-colors">{editingMeas ? "UPDATE" : "LOG"} MEASUREMENT</button>
          </div>
        </div>
      </MagiModal>

      {/* Delete Weigh-in Confirm */}
      <MagiConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteWeighIn(deleteTarget.id); setDeleteTarget(null); } }}
        title="DELETE WEIGH-IN"
        message={`Remove weigh-in from ${deleteTarget?.date}? This cannot be undone.`}
        confirmLabel="DELETE"
        danger
      />

      {/* Delete Measurement Confirm */}
      <MagiConfirm
        open={!!deleteMeasTarget}
        onClose={() => setDeleteMeasTarget(null)}
        onConfirm={() => { if (deleteMeasTarget) { deleteBodyMeasurement(deleteMeasTarget.id); setDeleteMeasTarget(null); } }}
        title="DELETE MEASUREMENT"
        message={`Remove ${SITE_LABELS[deleteMeasTarget?.site ?? "waist"]} measurement from ${deleteMeasTarget?.date}?`}
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
