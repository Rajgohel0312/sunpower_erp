import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button.jsx';

export function Pagination({
  page = 1,
  limit = 20,
  total = 0,
  totalPages = 1,
  onPageChange,
  onLimitChange,
  entityLabel = 'items',
  pageSizes = [10, 20, 50, 100],
  className = ''
}) {
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const startP = Math.max(2, page - 1);
      const endP = Math.min(totalPages - 1, page + 1);
      for (let i = startP; i <= endP; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 ${className}`}>
      {/* Left: Count summary & Rows per page selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span>
          Showing <strong className="text-slate-900 font-semibold font-mono">{start}</strong> to{' '}
          <strong className="text-slate-900 font-semibold font-mono">{end}</strong> of{' '}
          <strong className="text-slate-900 font-semibold font-mono">{total}</strong> {entityLabel}
        </span>

        {onLimitChange && (
          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
              }}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-midnight cursor-pointer"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page navigation controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-2.5 py-1 text-xs"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev
        </Button>

        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((p, idx) =>
            p === '...' ? (
              <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400">
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  page === p
                    ? 'bg-midnight text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="px-2.5 py-1 text-xs"
        >
          Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
