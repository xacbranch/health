"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Invisible component that hydrates the Zustand store from Supabase on mount.
 * Place once in the root layout.
 */
export function StoreHydrator() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrate, hydrated]);

  return null;
}
