const MAX_BYTES = 1_000_000; // 1 MB
const MIN_ROWS = 3;
const MAX_ROWS = 1000;

// Excel's plain "CSV" is often Windows-1252, which mangles £ if read as UTF-8.
function decode(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  return utf8.includes("\uFFFD")
    ? new TextDecoder("windows-1252").decode(buf)
    : utf8;
}

const bad = (statusCode: number, statusMessage: string) =>
  createError({ statusCode, statusMessage });

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  if (!parts) throw bad(400, "Send the CSV as a form upload");

  const file = parts.find((p) => p.name === "file");
  const topic = (
    parts.find((p) => p.name === "topic")?.data.toString("utf8") ?? ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

  if (!file || file.data.length === 0) throw bad(400, "Choose a CSV file");
  if (file.data.length > MAX_BYTES) throw bad(413, "File is over 1 MB");
  if (!topic) throw bad(400, 'Add a topic, e.g. "UK fintech start-ups"');

  const { rows, columns } = parseCsv(decode(file.data));
  if (rows.length < MIN_ROWS)
    throw bad(400, `Need at least ${MIN_ROWS} data rows`);
  if (rows.length > MAX_ROWS) throw bad(400, `Over ${MAX_ROWS} rows`);

  const stats = computeStats(rows, columns);
  const copy = await generateCopy(topic, stats, rows);

  const slug = await uniqueSlug(slugify(copy.title));
  await saveBlog({
    slug,
    topic,
    createdAt: new Date().toISOString(),
    copy,
    stats,
    rows,
  });

  setResponseStatus(event, 201);
  return { slug, url: `/blog/${slug}` };
});
