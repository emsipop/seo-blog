import type { BlogCopy } from "./generateCopy";
import type { DatasetStats } from "./computeStats";
import type { Row } from "./classifyColumns";

export interface StoredBlog {
  slug: string;
  topic: string;
  createdAt: string;
  copy: BlogCopy;
  stats: DatasetStats;
  rows: Row[];
}

const store = () => useStorage<StoredBlog>("blogs");

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export async function uniqueSlug(base: string): Promise<string> {
  const root = base || "blog";
  let slug = root;
  let i = 2;
  while (await store().hasItem(slug)) slug = `${root}-${i++}`;
  return slug;
}

export async function saveBlog(blog: StoredBlog): Promise<void> {
  await store().setItem(blog.slug, blog);
}

export async function getBlog(slug: string): Promise<StoredBlog | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null; // slug comes from the URL: never trust it
  return await store().getItem(slug);
}

export async function listSlugs(): Promise<string[]> {
  return await store().getKeys();
}
