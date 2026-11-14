export type ColumnType =
  | "rank"
  | "money"
  | "number"
  | "category"
  | "multi"
  | "url"
  | "text"
  | "constant";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  distinct: number;
  missing: number;
}

export type Row = Record<string, string>;

const MISSING = new Set(["", "n/a", "na", "-", "null", "none"]);
const MONEY = /^[£$€]\s?\d[\d,]*(\.\d+)?\s?[kmb]?$/i;
const NUMBER = /^-?\d[\d,]*(\.\d+)?$/;

export const isMissing = (v: string | undefined) =>
  v === undefined || MISSING.has(v.trim().toLowerCase());

// "£30,314,247" -> 30314247. Returns null if it is not a money/number value.
export function parseNumber(v: string): number | null {
  const s = v
    .trim()
    .replace(/^[£$€]\s?/, "")
    .replace(/,/g, "");
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s?([kmb])?$/i);
  const num = m?.[1];
  if (!m || num === undefined) return null;
  const mult =
    { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ??
    1;
  return parseFloat(num) * mult;
}

const share = (values: string[], test: (v: string) => boolean) =>
  values.filter(test).length / values.length;

function classify(values: string[], totalRows: number): ColumnType {
  const distinct = new Set(values).size;
  if (values.length === 0 || distinct === 1) return "constant";
  if (share(values, (v) => /^https?:\/\//i.test(v)) >= 0.8) return "url";
  if (share(values, (v) => MONEY.test(v)) >= 0.8) return "money";
  if (share(values, (v) => v.includes(";")) >= 0.3) return "multi";
  if (share(values, (v) => NUMBER.test(v)) >= 0.8) {
    const nums = values.map((v) => Number(v.replace(/,/g, "")));
    const isSequence =
      distinct === totalRows && nums.every((n, i) => n === i + 1);
    return isSequence ? "rank" : "number";
  }
  if (distinct <= 20 && distinct <= values.length * 0.5) return "category";
  return "text";
}

export function classifyColumns(rows: Row[]): ColumnProfile[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first).map((name) => {
    const all = rows.map((r) => (r[name] ?? "").trim());
    const values = all.filter((v) => !isMissing(v));
    return {
      name,
      type: classify(values, rows.length),
      distinct: new Set(values).size,
      missing: all.length - values.length,
    };
  });
}
