import * as yaml from 'js-yaml';

export interface ParsedMarkdown {
  frontMatter: Record<string, any>;
  content: string;
}

/** Parse a Hexo markdown file (YAML front-matter + body). */
export function parseMarkdown(raw: string): ParsedMarkdown {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw || '');
  if (!m) return { frontMatter: {}, content: raw || '' };
  const loaded = yaml.load(m[1]);
  const frontMatter =
    loaded && typeof loaded === 'object'
      ? (loaded as Record<string, any>)
      : {};
  return { frontMatter, content: m[2] || '' };
}

/** Serialize front-matter + body into a Hexo markdown file. */
export function serializeMarkdown(
  frontMatter: Record<string, any>,
  content: string,
): string {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(frontMatter || {})) {
    if (v !== undefined && v !== null && v !== '') clean[k] = v;
  }
  const y = yaml.dump(clean, { lineWidth: -1, noRefs: true, sortKeys: false });
  return `---\n${y}---\n${content || ''}\n`;
}

/** URL-friendly slug, keeps CJK characters (Hexo supports them). */
export function slugify(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Format a date to Hexo's `YYYY-MM-DD HH:mm:ss` convention. */
export function formatDateTime(input: string | Date | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/** Extract Y/M/D from a date string (for permalink generation). */
export function dateParts(input: string | Date | number) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    year: String(d.getFullYear()),
    month: p(d.getMonth() + 1),
    day: p(d.getDate()),
  };
}

/** Normalize a value that may be string/array into a trimmed string[]. */
export function normalizeList(values: any): string[] {
  if (values === undefined || values === null) return [];
  const list = Array.isArray(values) ? values : [values];
  return Array.from(
    new Set(
      list
        .map((item) =>
          typeof item === 'string' ? item.trim() : String(item || '').trim(),
        )
        .filter(Boolean),
    ),
  );
}
