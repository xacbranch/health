"use client";

import { useState } from "react";

export type TimeScale = "7D" | "30D" | "90D" | "1Y" | "ALL" | "custom";

interface TimeScaleSelectorProps {
  active: TimeScale;
  onChange: (scale: TimeScale) => void;
  customRange?: { from: string; to: string };
  onCustomRange?: (from: string, to: string) => void;
  loading?: boolean;
}

const SCALES: TimeScale[] = ["7D", "30D", "90D", "1Y", "ALL"];

export function TimeScaleSelector({
  active,
  onChange,
  customRange,
  onCustomRange,
  loading,
}: TimeScaleSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(customRange?.from || "");
  const [to, setTo] = useState(customRange?.to || "");

  return (
    <div className="flex items-center gap-1">
      {SCALES.map((s) => (
        <button
          key={s}
          onClick={() => {
            setShowCustom(false);
            onChange(s);
          }}
          className={`px-2 py-0.5 text-[7px] font-bold tracking-[0.15em] border transition-all duration-100 ${
            active === s
              ? "bg-eva/10 text-eva border-eva/40"
              : "text-text-dim border-border/40 hover:border-eva/20 hover:text-text"
          }`}
        >
          {s}
        </button>
      ))}
      <button
        onClick={() => {
          setShowCustom(!showCustom);
          if (!showCustom) onChange("custom");
        }}
        className={`px-2 py-0.5 text-[7px] font-bold tracking-[0.15em] border transition-all duration-100 ${
          active === "custom"
            ? "bg-cyan/10 text-cyan border-cyan/40"
            : "text-text-dim border-border/40 hover:border-cyan/20 hover:text-text"
        }`}
      >
        RANGE
      </button>
      {loading && (
        <span className="text-[7px] text-eva/50 tracking-wider animate-pulse ml-1">
          LOADING...
        </span>
      )}
      {showCustom && active === "custom" && (
        <div className="flex items-center gap-1 ml-1">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-surface-2 border border-border/40 text-text text-[8px] px-1 py-0.5 font-mono focus:outline-none focus:border-eva/50"
          />
          <span className="text-[7px] text-text-dim">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-surface-2 border border-border/40 text-text text-[8px] px-1 py-0.5 font-mono focus:outline-none focus:border-eva/50"
          />
          <button
            onClick={() => {
              if (from && to && onCustomRange) onCustomRange(from, to);
            }}
            className="px-1.5 py-0.5 text-[7px] font-bold tracking-wider bg-cyan/10 text-cyan border border-cyan/40 hover:bg-cyan/20"
          >
            GO
          </button>
        </div>
      )}
    </div>
  );
}
