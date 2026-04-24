import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';

interface PaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-10">
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        variant="ghost"
        size="sm"
        className="disabled:opacity-30"
      >
        <ChevronLeft size={16} />
      </Button>
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
          <Button
            key={p}
            onClick={() => onPageChange(p)}
            variant="ghost"
            size="sm"
            className="w-9 h-9 rounded-lg font-medium"
            style={{
              background: p === currentPage ? 'var(--c-accent)' : 'var(--c-surface)',
              color: p === currentPage ? 'var(--c-bg)' : 'var(--c-text-muted)',
              border: `1px solid ${p === currentPage ? 'var(--c-accent)' : 'var(--c-border)'}`,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {p}
          </Button>
        );
      })}
      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        variant="ghost"
        size="sm"
        className="disabled:opacity-30"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}
