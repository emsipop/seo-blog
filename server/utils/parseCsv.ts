import Papa from "papaparse";
import { classifyColumns, type Row } from "./classifyColumns";

export function parseCsv(text: string) {
  const result = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return {
    rows: result.data,
    columns: classifyColumns(result.data),
    errors: result.errors,
  };
}
