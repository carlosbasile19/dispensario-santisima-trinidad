export const PAGE_SIZE = 50;
export const MAX_PAGE = 20_000;

/** Reject malformed or excessively deep offsets before they reach Postgres. */
export function pageNumber(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value;
  if (!text || !/^[1-9]\d{0,5}$/.test(text)) return 1;
  return Math.min(Number(text), MAX_PAGE);
}

export function pageHref(path: string, filters: Record<string, string>, page: number, pageKey = "pagina"): string {
  const params = new URLSearchParams(filters);
  for (const [key, value] of Object.entries(filters)) if (!value) params.delete(key);
  if (page > 1) params.set(pageKey, String(page));
  else params.delete(pageKey);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
