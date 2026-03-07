import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-10">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="btn-ghost text-sm disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let p: number;
        if (totalPages <= 7) {
          p = i + 1;
        } else if (currentPage <= 4) {
          p = i + 1;
        } else if (currentPage >= totalPages - 3) {
          p = totalPages - 6 + i;
        } else {
          p = currentPage - 3 + i;
        }
        return (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200"
            style={{
              background: p === currentPage ? 'var(--c-accent)' : 'var(--c-surface)',
              color: p === currentPage ? 'var(--c-bg)' : 'var(--c-text-muted)',
              border: `1px solid ${p === currentPage ? 'var(--c-accent)' : 'var(--c-border)'}`,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="btn-ghost text-sm disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
