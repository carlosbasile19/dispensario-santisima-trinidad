import Link from "next/link";

import { MAX_PAGE, pageHref } from "@/lib/crm/pagination";

export function Pagination({ path, filters = {}, page, hasNext, pageKey }: {
  path: string;
  filters?: Record<string, string>;
  page: number;
  hasNext: boolean;
  pageKey?: string;
}) {
  if (page === 1 && !hasNext) return null;
  const button = "inline-flex min-h-11 items-center rounded-lg border border-outline px-3 text-sm font-medium hover:border-navy";
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
      {page > 1 ? (
        <Link href={pageHref(path, filters, page - 1, pageKey)} prefetch={false} scroll={false} className={button}>Anterior</Link>
      ) : <span />}
      <span className="text-sm text-muted">Página {page}</span>
      {hasNext && page < MAX_PAGE ? (
        <Link href={pageHref(path, filters, page + 1, pageKey)} prefetch={false} scroll={false} className={button}>Siguiente</Link>
      ) : <span />}
    </nav>
  );
}
