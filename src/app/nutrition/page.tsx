"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from "recharts";
import { TimeScaleSelector, type TimeScale } from "@/components/ui/TimeScaleSelector";
import { InsightButton } from "@/components/ui/InsightButton";
import { useTimeScale } from "@/hooks/useTimeScale";
import MagiModal from "@/components/ui/MagiModal";
import { MagiInput, MagiNumber, MagiTextarea } from "@/components/ui/MagiField";
import MagiActionBar from "@/components/ui/MagiActionBar";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth } from "@/lib/supabase-data";
import type { Meal } from "@/types";

const AXIS_STYLE = { fill: "#333", fontSize: 8, fontFamily: "Monument Mono" };

/* ─── Calorie targets ─── */
const CAL_TARGET = 2200;
const PROTEIN_TARGET = 180; // g
const MACRO_COLORS = { protein: "#39FF14", carbs: "#FF6A00", fat: "#00D0FF" };

/* ─── Aggregate meals by day ─── */
interface DaySummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: Meal[];
}

function aggregateByDay(meals: Meal[]): DaySummary[] {
  const map = new Map<string, DaySummary>();
  for (const m of meals) {
    const d = m.date;
    if (!map.has(d)) map.set(d, { date: d, calories: 0, protein: 0, carbs: 0, fat: 0, meals: [] });
    const day = map.get(d)!;
    day.calories += m.calories || 0;
    day.protein += m.protein_g || 0;
    day.carbs += m.carbs_g || 0;
    day.fat += m.fat_g || 0;
    day.meals.push(m);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function NutritionPage() {
  const {
    scale, setScale, data, loading, scaleLabel,
    customRange, setCustomRange,
  } = useTimeScale("7D");

  const storeMeals = data.meals;
  const healthMetrics = data.healthMetrics;

  // Direct fetch as backup — store hydration can be slow
  const [directMeals, setDirectMeals] = useState<Meal[]>([]);
  useEffect(() => {
    async function loadMeals() {
      await ensureAuth();
      const sb = createClient();
      const { data: rows } = await sb.from("meals").select("*").order("date", { ascending: true }).limit(200);
      if (rows?.length) setDirectMeals(rows);
    }
    loadMeals();
  }, []);

  // Use whichever has more data
  const meals = storeMeals.length >= directMeals.length ? storeMeals : directMeals;

  const days = useMemo(() => aggregateByDay(meals), [meals]);
  // Use local date, not UTC
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todaySummary = days.find((d) => d.date === today);

  // Energy balance: calories in vs calories out
  const energyData = useMemo(() => {
    return days.map((d) => {
      const hm = healthMetrics.find((h) => h.date === d.date);
      const burned = (hm?.active_energy || 0) + (hm?.basal_energy || 0);
      return {
        date: d.date,
        dateLabel: d.date.slice(5),
        intake: d.calories,
        burned,
        net: d.calories - burned,
      };
    });
  }, [days, healthMetrics]);

  // Macro chart data
  const macroData = useMemo(() => {
    return days.map((d) => ({
      date: d.date,
      dateLabel: d.date.slice(5),
      protein: Math.round(d.protein),
      carbs: Math.round(d.carbs),
      fat: Math.round(d.fat),
    }));
  }, [days]);

  // Calorie chart data
  const calData = useMemo(() => {
    return days.map((d) => ({
      date: d.date,
      dateLabel: d.date.slice(5),
      calories: d.calories,
    }));
  }, [days]);

  // Today stats
  const todayCal = todaySummary?.calories || 0;
  const todayProtein = todaySummary?.protein || 0;
  const todayCarbs = todaySummary?.carbs || 0;
  const todayFat = todaySummary?.fat || 0;
  const todayMealCount = todaySummary?.meals.length || 0;

  // Averages
  const avgCal = days.length ? Math.round(days.reduce((a, d) => a + d.calories, 0) / days.length) : 0;
  const avgProtein = days.length ? Math.round(days.reduce((a, d) => a + d.protein, 0) / days.length) : 0;

  // Log meal modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: "", calories: 0, protein: 0, carbs: 0, fat: 0, notes: "" });
  const [saving, setSaving] = useState(false);

  async function logMeal() {
    if (!form.description || form.calories <= 0) return;
    setSaving(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setSaving(false); return; }
      await sb.from("meals").insert({
        user_id: session.user.id,
        date: today,
        description: form.description,
        calories: form.calories,
        protein_g: form.protein || null,
        carbs_g: form.carbs || null,
        fat_g: form.fat || null,
        notes: form.notes || null,
      });
      // Refresh store
      window.location.reload();
    } catch (err) {
      console.error("Failed to log meal:", err);
      setSaving(false);
    }
  }

  return (
    <div className="p-3 md:p-4 pb-20 md:pb-4 space-y-3">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight eva-text flex items-center gap-2">
            NUTRITION
            <span className="text-[8px] font-bold tracking-[0.2em] text-text-dim font-mono mt-1">
              // CALORIE &amp; MACRO TRACKING
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 text-[9px] font-bold tracking-wider bg-eva/10 border border-eva/30 text-eva hover:bg-eva/20 transition-colors"
        >
          + LOG MEAL
        </button>
      </div>

      {/* ═══ TIME SCALE ═══ */}
      <div className="flex items-center justify-between">
        <TimeScaleSelector
          active={scale}
          onChange={(s) => setScale(s as TimeScale)}
          loading={loading}
          customRange={customRange}
          onCustomRange={setCustomRange}
        />
        <div className="text-[7px] tracking-wider text-text-dim">
          WINDOW: <span className="text-eva/60">{scaleLabel}</span>
        </div>
      </div>

      {/* ═══ TODAY'S INTAKE ═══ */}
      <div className="hud-panel p-3 corner-brackets border border-eva/20">
        <div className="flex items-center justify-between mb-3">
          <div className="eva-label text-[8px]">▎ TODAY — {today}</div>
          <div className="text-[8px] text-text-dim">
            {todayMealCount} MEAL{todayMealCount !== 1 ? "S" : ""} LOGGED
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          <MacroBar label="CALORIES" value={todayCal} target={CAL_TARGET} unit="KCAL" color="#FF6A00" />
          <MacroBar label="PROTEIN" value={todayProtein} target={PROTEIN_TARGET} unit="G" color={MACRO_COLORS.protein} />
          <MacroBar label="CARBS" value={todayCarbs} target={250} unit="G" color={MACRO_COLORS.carbs} />
          <MacroBar label="FAT" value={todayFat} target={70} unit="G" color={MACRO_COLORS.fat} />
        </div>

        {/* Today's meals list */}
        {todaySummary && todaySummary.meals.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {todaySummary.meals.map((m, i) => (
              <div key={m.id || i} className="flex items-center justify-between px-2 py-1.5 bg-surface/80 border-l border-border">
                <div className="flex items-center gap-2">
                  <span className="text-[7px] text-text-dim tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[9px] text-text font-bold tracking-wider">{m.description}</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] tabular-nums">
                  <span className="text-eva">{m.calories} cal</span>
                  {m.protein_g && <span style={{ color: MACRO_COLORS.protein }}>{m.protein_g}p</span>}
                  {m.carbs_g && <span style={{ color: MACRO_COLORS.carbs }}>{m.carbs_g}c</span>}
                  {m.fat_g && <span style={{ color: MACRO_COLORS.fat }}>{m.fat_g}f</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ CALORIE TREND ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ DAILY CALORIES</div>
            <div className="text-[7px] tracking-wider text-text-dim">N-01</div>
          </div>
          <div className="flex items-center gap-3">
            <InsightButton
              metric="calories"
              data={calData}
              timeScale={scaleLabel}
              context={`Target: ${CAL_TARGET} kcal/day. Cutting phase, goal weight 185 lbs.`}
            />
            <div className="flex items-baseline gap-1">
              <span className="data-readout text-lg">{avgCal}</span>
              <span className="text-[8px] text-text-dim">AVG</span>
            </div>
          </div>
        </div>

        <div className="h-44 md:h-52">
          {calData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calData}>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} width={40} />
                <ReferenceLine y={CAL_TARGET} stroke="#FF6A0040" strokeDasharray="3 3"
                  label={{ value: `${CAL_TARGET}`, position: "right", fill: "#FF6A0060", fontSize: 8 }} />
                <Tooltip contentStyle={{
                  background: "#0A0A0A", border: "1px solid #FF6A0030",
                  borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#FF6A00",
                }} />
                <Bar dataKey="calories" radius={[2, 2, 0, 0]}>
                  {calData.map((d, i) => (
                    <Cell key={i} fill={d.calories > CAL_TARGET ? "#FF1A1A" : "#FF6A00"} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO MEAL DATA FOR SELECTED RANGE
            </div>
          )}
        </div>
      </div>

      {/* ═══ MACRO BREAKDOWN ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ MACRO SPLIT</div>
            <div className="text-[7px] tracking-wider text-text-dim">N-02</div>
          </div>
          <InsightButton
            metric="macros"
            data={macroData}
            timeScale={scaleLabel}
            context={`Protein target: ${PROTEIN_TARGET}g/day. Cutting phase.`}
          />
        </div>

        <div className="h-44 md:h-52">
          {macroData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={macroData}>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} width={35}
                  label={{ value: "G", angle: -90, position: "insideLeft", fill: "#333", fontSize: 7 }} />
                <Tooltip contentStyle={{
                  background: "#0A0A0A", border: "1px solid #33333380",
                  borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#ccc",
                }} />
                <Bar dataKey="protein" stackId="macro" fill={MACRO_COLORS.protein} />
                <Bar dataKey="carbs" stackId="macro" fill={MACRO_COLORS.carbs} />
                <Bar dataKey="fat" stackId="macro" fill={MACRO_COLORS.fat} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO MACRO DATA
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
          <MacroLegend color={MACRO_COLORS.protein} label="PROTEIN" />
          <MacroLegend color={MACRO_COLORS.carbs} label="CARBS" />
          <MacroLegend color={MACRO_COLORS.fat} label="FAT" />
        </div>
      </div>

      {/* ═══ ENERGY BALANCE ═══ */}
      <div className="hud-panel p-3 corner-brackets">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="eva-label text-[8px]">▎ ENERGY BALANCE</div>
            <div className="text-[7px] tracking-wider text-text-dim">N-03</div>
          </div>
          <div className="text-[7px] tracking-wider text-text-dim">
            INTAKE vs BURNED (ACTIVE + BASAL)
          </div>
        </div>

        <div className="h-44 md:h-52">
          {energyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyData}>
                <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={AXIS_STYLE} />
                <YAxis axisLine={false} tickLine={false} tick={AXIS_STYLE} width={40} />
                <ReferenceLine y={0} stroke="#333" />
                <Tooltip contentStyle={{
                  background: "#0A0A0A", border: "1px solid #33333380",
                  borderRadius: 0, fontFamily: "Monument Mono", fontSize: "10px", color: "#ccc",
                }} />
                <Bar dataKey="intake" fill="#FF6A00" fillOpacity={0.6} name="Intake" />
                <Bar dataKey="burned" fill="#00D0FF" fillOpacity={0.6} name="Burned" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-[9px] text-text-dim tracking-wider">
              NO ENERGY DATA
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
          <MacroLegend color="#FF6A00" label="INTAKE" />
          <MacroLegend color="#00D0FF" label="BURNED" />
        </div>
      </div>

      {/* ═══ AVERAGES ═══ */}
      {days.length > 0 && (
        <div className="hud-panel p-3 corner-brackets">
          <div className="eva-label text-[8px] mb-3">▎ RANGE AVERAGES — {scaleLabel}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AvgStat label="AVG CALORIES" value={`${avgCal}`} unit="KCAL" color="#FF6A00" />
            <AvgStat label="AVG PROTEIN" value={`${avgProtein}`} unit="G" color={MACRO_COLORS.protein} />
            <AvgStat label="DAYS TRACKED" value={`${days.length}`} />
            <AvgStat label="TOTAL MEALS" value={`${meals.length}`} />
          </div>
        </div>
      )}

      {/* ═══ LOG MEAL MODAL ═══ */}
      <MagiModal open={showAdd} onClose={() => setShowAdd(false)} title="LOG MEAL">
        <div className="space-y-3">
          <MagiInput label="DESCRIPTION" value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="e.g. Chicken breast + rice" />
          <div className="grid grid-cols-2 gap-2">
            <MagiNumber label="CALORIES" value={form.calories}
              onChange={(v) => setForm({ ...form, calories: +v || 0 })} />
            <MagiNumber label="PROTEIN (G)" value={form.protein}
              onChange={(v) => setForm({ ...form, protein: +v || 0 })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MagiNumber label="CARBS (G)" value={form.carbs}
              onChange={(v) => setForm({ ...form, carbs: +v || 0 })} />
            <MagiNumber label="FAT (G)" value={form.fat}
              onChange={(v) => setForm({ ...form, fat: +v || 0 })} />
          </div>
          <MagiTextarea label="NOTES" value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
            placeholder="Optional notes" />
          <MagiActionBar actions={[
            { label: "CANCEL", variant: "ghost", onClick: () => setShowAdd(false) },
            { label: saving ? "SAVING..." : "LOG MEAL", variant: "primary", onClick: logMeal },
          ]} />
        </div>
      </MagiModal>
    </div>
  );
}

/* ─── Sub-components ─── */

function MacroBar({ label, value, target, unit, color }: {
  label: string; value: number; target: number; unit: string; color: string;
}) {
  const pct = Math.min(100, (value / target) * 100);
  const over = value > target;
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] tracking-wider text-text-dim">{label}</span>
        <span className="text-[9px] font-bold tabular-nums" style={{ color }}>
          {Math.round(value)} <span className="text-text-dim text-[7px]">/ {target} {unit}</span>
        </span>
      </div>
      <div className="h-1.5 bg-surface-2 overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: over ? "#FF1A1A" : color,
            boxShadow: `0 0 6px ${over ? "#FF1A1A" : color}40`,
          }}
        />
      </div>
    </div>
  );
}

function MacroLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
      <span className="text-[7px] tracking-wider text-text-dim">{label}</span>
    </div>
  );
}

function AvgStat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[7px] tracking-[0.2em] text-text-dim mb-1">{label}</div>
      <div className="text-lg font-black tabular-nums" style={color ? { color, textShadow: `0 0 10px ${color}40` } : {}}>
        {value}
      </div>
      {unit && <div className="text-[7px] text-text-dim">{unit}</div>}
    </div>
  );
}
