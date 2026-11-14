import {
  isMissing,
  parseNumber,
  type ColumnProfile,
  type Row,
} from "./classifyColumns";

export interface Count {
  value: string;
  count: number;
  share: number; // fraction of all rows
  metricTotal?: number; // category columns only (multi-value would double count)
  metricShare?: number;
}

export interface Breakdown {
  column: string;
  type: "category" | "multi";
  counts: Count[]; // top 8 by count
  omitted: string[]; // values on >= 90% of rows: too generic to be an insight
}

export interface MetricSummary {
  column: string;
  currency: string;
  total: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  topEntity: { name: string; value: number } | null;
  topN: number;
  topNShare: number;
}

export interface DatasetStats {
  rowCount: number;
  labelColumn: string | null;
  metric: MetricSummary | null;
  breakdowns: Breakdown[];
  constants: { column: string; value: string }[]; // columns where every row has the same value
}

const median = (sorted: number[]) => {
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
};

export function computeStats(
  rows: Row[],
  columns: ColumnProfile[],
): DatasetStats {
  const n = rows.length;
  // The column that names each row: first text column where every value is different.
  const labelColumn =
    columns.find((c) => c.type === "text" && c.distinct === n)?.name ?? null;
  // The number we rank and total by: a money column if there is one, else a plain number.
  const metricCol =
    columns.find((c) => c.type === "money") ??
    columns.find((c) => c.type === "number");

  const nums: (number | null)[] = metricCol
    ? rows.map((r) => {
        const raw = r[metricCol.name];
        return raw === undefined || isMissing(raw) ? null : parseNumber(raw);
      })
    : [];

  let metric: MetricSummary | null = null;
  if (metricCol) {
    const valid = nums.filter((v): v is number => v !== null);
    const sorted = [...valid].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (min !== undefined && max !== undefined) {
      const total = valid.reduce((a, b) => a + b, 0);
      const topN = Math.min(10, Math.max(1, Math.ceil(n / 10)));
      const topNSum = [...sorted]
        .reverse()
        .slice(0, topN)
        .reduce((a, b) => a + b, 0);
      const topRow = rows[nums.findIndex((v) => v === max)];
      const topName = labelColumn && topRow ? topRow[labelColumn] : undefined;
      const sample =
        rows.find((r) => !isMissing(r[metricCol.name]))?.[metricCol.name] ?? "";
      metric = {
        column: metricCol.name,
        currency: sample.match(/^[£$€]/)?.[0] ?? "",
        total,
        mean: total / valid.length,
        median: median(sorted),
        min,
        max,
        topEntity: topName !== undefined ? { name: topName, value: max } : null,
        topN,
        topNShare: total ? topNSum / total : 0,
      };
    }
  }

  const breakdowns: Breakdown[] = columns
    .filter((c) => c.type === "category" || c.type === "multi")
    .map((c) => {
      const counts = new Map<string, number>();
      const sums = new Map<string, number>();
      rows.forEach((r, i) => {
        const cell = r[c.name];
        if (cell === undefined || isMissing(cell)) return;
        const items =
          c.type === "multi"
            ? cell
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean)
            : [cell.trim()];
        for (const item of items) {
          counts.set(item, (counts.get(item) ?? 0) + 1);
          if (c.type === "category" && nums[i] != null) {
            sums.set(item, (sums.get(item) ?? 0) + (nums[i] as number));
          }
        }
      });
      const all: Count[] = [...counts.entries()].map(([value, count]) => ({
        value,
        count,
        share: count / n,
        ...(c.type === "category" && metric
          ? {
              metricTotal: sums.get(value) ?? 0,
              metricShare: (sums.get(value) ?? 0) / metric.total,
            }
          : {}),
      }));
      all.sort((a, b) => b.count - a.count);
      return {
        column: c.name,
        type: c.type as "category" | "multi",
        counts: all.filter((x) => x.share < 0.9).slice(0, 8),
        omitted: all.filter((x) => x.share >= 0.9).map((x) => x.value),
      };
    });

  const constants = columns
    .filter((c) => c.type === "constant" && c.distinct === 1)
    .flatMap((c) => {
      const value = rows
        .map((r) => r[c.name])
        .find((v) => v !== undefined && !isMissing(v));
      return value !== undefined && value.trim().length <= 40
        ? [{ column: c.name, value: value.trim() }]
        : [];
    });

  return { rowCount: n, labelColumn, metric, breakdowns, constants };
}
