/**
 * Minimal data helpers — only the default checklist template.
 * All real data comes from Supabase via store hydration.
 */

import type { ChecklistItem } from "@/types";

/* ─── Default daily checklist template ─── */
const defaultChecklist: ChecklistItem[] = [
  { key: "weighin", label: "WEIGH-IN", completed: false },
  { key: "iron", label: "IRON + VIT C", completed: false },
  { key: "hydrate", label: "HYDRATION 16OZ", completed: false },
  { key: "dogwalk", label: "DOG WALK", completed: false },
  { key: "semax", label: "SEMAX + SELANK", completed: false },
  { key: "d3k2", label: "D3+K2 W/ MEAL", completed: false },
  { key: "magnesium", label: "MAGNESIUM GLYCINATE", completed: false },
];

export function getChecklist(): ChecklistItem[] {
  return defaultChecklist.map((c) => ({ ...c }));
}
