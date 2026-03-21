/**
 * Downsample time-series data for large date ranges.
 * Groups by ISO week and averages numeric fields.
 */

/** Get ISO week key: "2024-W03" */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isoMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "2024-01"
}

export function downsampleToWeekly<T extends Record<string, unknown> & { date: string }>(
  data: T[],
  numericKeys: (keyof T)[],
): T[] {
  return downsample(data, numericKeys, isoWeekKey);
}

export function downsampleToMonthly<T extends Record<string, unknown> & { date: string }>(
  data: T[],
  numericKeys: (keyof T)[],
): T[] {
  return downsample(data, numericKeys, isoMonthKey);
}

function downsample<T extends Record<string, unknown> & { date: string }>(
  data: T[],
  numericKeys: (keyof T)[],
  groupFn: (date: string) => string,
): T[] {
  if (data.length === 0) return [];

  const groups = new Map<string, { items: T[]; firstDate: string }>();

  for (const item of data) {
    const key = groupFn(item.date);
    if (!groups.has(key)) {
      groups.set(key, { items: [], firstDate: item.date });
    }
    groups.get(key)!.items.push(item);
  }

  const result: T[] = [];
  for (const [, { items, firstDate }] of groups) {
    const averaged = { ...items[0], date: firstDate } as T;
    for (const k of numericKeys) {
      const vals = items
        .map((it) => it[k] as unknown)
        .filter((v): v is number => typeof v === "number" && !isNaN(v));
      if (vals.length > 0) {
        (averaged as Record<string, unknown>)[k as string] =
          +((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
      }
    }
    result.push(averaged);
  }

  return result;
}

/** Auto-downsample: weekly if >600 points, monthly if >2000 */
export function autoDownsample<T extends Record<string, unknown> & { date: string }>(
  data: T[],
  numericKeys: (keyof T)[],
): T[] {
  if (data.length <= 600) return data;
  if (data.length > 2000) return downsampleToMonthly(data, numericKeys);
  return downsampleToWeekly(data, numericKeys);
}
