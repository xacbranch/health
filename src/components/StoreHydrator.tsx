"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Hydrates the Zustand store from Supabase on mount.
 * Shows a loading indicator until hydration is complete.
 * Wraps children so pages don't render with empty data.
 */
export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="text-[10px] font-bold tracking-[0.3em] text-eva/60 mb-2">MAGI SYSTEM</div>
          <div className="text-[8px] tracking-[0.2em] text-text-dim animate-pulse">INITIALIZING DATA LINK...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
