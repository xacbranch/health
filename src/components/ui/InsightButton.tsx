"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import MagiModal from "./MagiModal";
import { useInsight } from "@/hooks/useInsight";

interface InsightButtonProps {
  metric: string;
  data: unknown[];
  timeScale: string;
  context?: string;
}

export function InsightButton({ metric, data, timeScale, context }: InsightButtonProps) {
  const [open, setOpen] = useState(false);
  const { requestInsight, response, loading, error, reset } = useInsight();

  function handleClick() {
    setOpen(true);
    reset();
    requestInsight(metric, data, timeScale, context);
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={!data.length}
        className="flex items-center gap-1 px-2 py-0.5 text-[7px] font-bold tracking-[0.15em] border border-cyan/30 text-cyan/70 hover:bg-cyan/10 hover:text-cyan hover:border-cyan/50 transition-all disabled:opacity-30 disabled:pointer-events-none"
      >
        <Sparkles size={8} />
        GET INSIGHT
      </button>

      <MagiModal
        open={open}
        onClose={() => setOpen(false)}
        title={`MAGI ANALYSIS // ${metric.toUpperCase().replace(/_/g, " ")} // ${timeScale}`}
        wide
      >
        <div className="min-h-[200px] relative">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/30">
            <div
              className={`w-2 h-2 rounded-full ${
                loading
                  ? "bg-eva animate-pulse"
                  : error
                    ? "bg-danger"
                    : response
                      ? "bg-neon"
                      : "bg-text-dim"
              }`}
            />
            <span className="text-[7px] font-bold tracking-[0.2em] text-text-dim">
              {loading
                ? "ANALYZING..."
                : error
                  ? "ERROR"
                  : response
                    ? "ANALYSIS COMPLETE"
                    : "INITIALIZING"}
            </span>
            <span className="text-[7px] text-text-dim ml-auto tabular-nums">
              {data.length} DATA POINTS
            </span>
          </div>

          {/* Response */}
          {error && (
            <div className="text-[10px] text-danger font-mono p-2 bg-danger/5 border border-danger/20">
              {error}
            </div>
          )}

          {(response || loading) && (
            <div className="text-[11px] text-text leading-relaxed font-mono whitespace-pre-wrap">
              {response}
              {loading && <span className="inline-block w-1.5 h-3 bg-eva/70 animate-pulse ml-0.5" />}
            </div>
          )}
        </div>
      </MagiModal>
    </>
  );
}
