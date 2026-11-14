import { readFile } from "node:fs/promises";

let cached: unknown; // dev-only cache so reloads don't burn free quota

export default defineEventHandler(async () => {
  if (cached) return cached;
  const text = await readFile("data/fintech_companies_seed.csv", "utf8");
  const { rows, columns } = parseCsv(text);
  const stats = computeStats(rows, columns);
  cached = await generateCopy("UK fintech start-ups", stats, rows);
  return cached;
});
