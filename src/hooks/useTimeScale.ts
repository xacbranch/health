"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore, type RangeData } from "@/lib/store";
import type { TimeScale } from "@/components/ui/TimeScaleSelector";
import type { HealthMetrics, WeighIn, ActivitySummary, AppleWorkout, SleepSession, BodyMeasurement } from "@/types";
import { subDays, subYears, format } from "date-fns";

function computeRange(scale: TimeScale, customFrom?: string, customTo?: string): { from: string; to: string } {
  const today = new Date();
  const to = format(today, "yyyy-MM-dd");

  switch (scale) {
    case "7D":
      return { from: format(subDays(today, 7), "yyyy-MM-dd"), to };
    case "30D":
      return { from: format(subDays(today, 30), "yyyy-MM-dd"), to };
    case "90D":
      return { from: format(subDays(today, 90), "yyyy-MM-dd"), to };
    case "1Y":
      return { from: format(subYears(today, 1), "yyyy-MM-dd"), to };
    case "ALL":
      return { from: "2010-01-01", to };
    case "custom":
      return { from: customFrom || format(subDays(today, 30), "yyyy-MM-dd"), to: customTo || to };
    default:
      return { from: format(subDays(today, 30), "yyyy-MM-dd"), to };
  }
}

/** Filter array by date field within range */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterByDate<T>(arr: T[], from: string, to: string, dateField = "date"): T[] {
  return arr.filter((item) => {
    const d = ((item as any)[dateField] as string)?.slice(0, 10);
    return d && d >= from && d <= to;
  });
}

export interface TimeScaleData {
  healthMetrics: HealthMetrics[];
  weighIns: WeighIn[];
  activitySummaries: ActivitySummary[];
  appleWorkouts: AppleWorkout[];
  sleepSessions: SleepSession[];
  bodyMeasurements: BodyMeasurement[];
}

export function useTimeScale(defaultScale: TimeScale = "30D") {
  const [scale, setScale] = useState<TimeScale>(defaultScale);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const storeHealthMetrics = useStore((s) => s.healthMetrics);
  const storeWeighIns = useStore((s) => s.weighIns);
  const storeActivitySummaries = useStore((s) => s.activitySummaries);
  const storeAppleWorkouts = useStore((s) => s.appleWorkouts);
  const storeSleepSessions = useStore((s) => s.sleepSessions);
  const storeBodyMeasurements = useStore((s) => s.bodyMeasurements);
  const rangeCache = useStore((s) => s.rangeCache);
  const rangeFetching = useStore((s) => s.rangeFetching);
  const fetchRange = useStore((s) => s.fetchRange);

  const range = useMemo(() => computeRange(scale, customFrom, customTo), [scale, customFrom, customTo]);

  // For 1Y/ALL/custom — fetch from Supabase if not cached
  const needsRemoteFetch = scale === "1Y" || scale === "ALL" || scale === "custom";
  const cacheKey = `${range.from}|${range.to}`;

  useEffect(() => {
    if (needsRemoteFetch && !rangeCache[cacheKey]) {
      fetchRange(range.from, range.to);
    }
  }, [needsRemoteFetch, cacheKey, range.from, range.to, rangeCache, fetchRange]);

  const data: TimeScaleData = useMemo(() => {
    if (needsRemoteFetch && rangeCache[cacheKey]) {
      return rangeCache[cacheKey] as unknown as TimeScaleData;
    }

    // For short ranges (7D/30D/90D), filter from the store's default data
    return {
      healthMetrics: filterByDate(storeHealthMetrics, range.from, range.to),
      weighIns: filterByDate(storeWeighIns, range.from, range.to),
      activitySummaries: filterByDate(storeActivitySummaries, range.from, range.to),
      appleWorkouts: filterByDate(storeAppleWorkouts, range.from, range.to, "start_date"),
      sleepSessions: filterByDate(storeSleepSessions, range.from, range.to, "start_date"),
      bodyMeasurements: filterByDate(storeBodyMeasurements, range.from, range.to),
    };
  }, [
    needsRemoteFetch, cacheKey, rangeCache, range,
    storeHealthMetrics, storeWeighIns, storeActivitySummaries,
    storeAppleWorkouts, storeSleepSessions, storeBodyMeasurements,
  ]);

  const setCustomRange = useCallback((from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    setScale("custom");
  }, []);

  const loading = needsRemoteFetch && rangeFetching && !rangeCache[cacheKey];

  return {
    scale,
    setScale,
    range,
    data,
    loading,
    customRange: { from: customFrom, to: customTo },
    setCustomRange,
    scaleLabel: scale === "custom" ? `${range.from} → ${range.to}` : scale,
  };
}
