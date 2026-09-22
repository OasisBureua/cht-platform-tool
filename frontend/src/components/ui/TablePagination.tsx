import { buildPaginationRange } from '../../utils/table-pagination';

type TablePaginationProps = {
  page: number;
  totalPages: number;
  totalItems?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
};

const btnClass =
  'min-w-[2rem] rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export default function TablePagination({
  page,
  totalPages,
  totalItems,
  itemLabel = 'items',
  onPageChange,
}: TablePaginationProps) {
  if (totalPages <= 1 && totalItems === undefined) return null;

  const range = buildPaginationRange(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      {totalItems != null ? (
        <span>
          {totalItems} {itemLabel}
        </span>
      ) : (
        <span />
      )}

      {totalPages > 1 ? (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={btnClass}
          >
            Previous
          </button>

          {range.map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1 text-xs text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
                className={[
                  btnClass,
                  item === page
                    ? 'border-gray-900 bg-gray-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-card text-foreground hover:bg-muted',
                ].join(' ')}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={btnClass}
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
