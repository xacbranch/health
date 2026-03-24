"use client";

/**
 * User config — derived from goals table + sensible defaults.
 * No hardcoded values in page files.
 */

import { useStore } from "@/lib/store";
import { useMemo } from "react";

interface UserConfig {
  weightGoal: number;
  weightStart: number;
  bodyFatGoal: number;
  waistGoal: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  sleepGoalMin: number;
  sleepGoalMax: number;
  stepsGoal: number;
  wakeHour: number;
  sleepHour: number;
}

const DEFAULTS: UserConfig = {
  weightGoal: 185,
  weightStart: 210,
  bodyFatGoal: 13,
  waistGoal: 32.5,
  calorieTarget: 2200,
  proteinTarget: 180,
  carbsTarget: 250,
  fatTarget: 70,
  sleepGoalMin: 7,
  sleepGoalMax: 8,
  stepsGoal: 10000,
  wakeHour: 7,
  sleepHour: 22.5,
};

export function useConfig(): UserConfig {
  const goals = useStore((s) => s.goals);

  return useMemo(() => {
    const cfg = { ...DEFAULTS };

    for (const g of goals) {
      const name = g.name.toLowerCase();
      if (name.includes("weight") && !name.includes("fat")) {
        cfg.weightGoal = g.target;
        // Use the earliest known value as start weight
        if (g.current > cfg.weightStart) cfg.weightStart = g.current;
      }
      if (name.includes("body fat") || name.includes("bf")) {
        cfg.bodyFatGoal = g.target;
      }
      if (name.includes("waist")) {
        cfg.waistGoal = g.target;
      }
    }

    return cfg;
  }, [goals]);
}

export { DEFAULTS as CONFIG_DEFAULTS };
export type { UserConfig };
