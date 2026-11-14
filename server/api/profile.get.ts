import { readFile } from "node:fs/promises";

export default defineEventHandler(async () => {
  const text = await readFile("data/fintech_companies_seed.csv", "utf8");
  const { rows, columns } = parseCsv(text);
  return { columns, stats: computeStats(rows, columns) };
});
