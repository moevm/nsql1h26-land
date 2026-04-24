import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';

import { fetchLocationSuggestions, type PlotFilters } from '../api';
import { filterFormSchema, type FilterFormValues } from '../features/forms/schemas';
import { Button, FieldCaption, FieldError, FieldLabel, Input, Surface } from './ui';

type FormState = FilterFormValues;

const EMPTY_FORM: FormState = {
  min_price: '',
  max_price: '',
  min_area: '',
  max_area: '',
  min_price_per_sotka: '',
  max_price_per_sotka: '',
  location: '',
};

interface Props {
  readonly visible: boolean;
  readonly filters: PlotFilters;
  readonly initialForm: FormState;
  readonly onApply: (form: FormState) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
};

function RangeField({ label, minReg, maxReg, minError, maxError, max, step }: {
  readonly label: string;
  readonly minReg: UseFormRegisterReturn;
  readonly maxReg: UseFormRegisterReturn;
  readonly minError?: string;
  readonly maxError?: string;
  readonly max: number;
  readonly step?: string;
}) {
  return (
    <div>
      <FieldCaption style={{ color: 'var(--c-text-dim)' }}>{label}</FieldCaption>
      <div className="flex gap-2">
        <Input type="number" min="0" max={max} step={step} inputMode="decimal" placeholder="от" style={inputStyle} {...minReg} />
        <Input type="number" min="0" max={max} step={step} inputMode="decimal" placeholder="до" style={inputStyle} {...maxReg} />
      </div>
      <FieldError message={minError || maxError} />
    </div>
  );
}

function LocationField({
  value,
  onChange,
  onBlur,
  inputRef,
  error,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onBlur: () => void;
  readonly inputRef: (el: HTMLInputElement | null) => void;
  readonly error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trimmed = value.trim();

  const { data: suggestions = [] } = useQuery({
    queryKey: ['plots', 'location-suggest', trimmed],
    queryFn: ({ signal }) => fetchLocationSuggestions(trimmed, { limit: 30, signal }),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => suggestions, [suggestions]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <FieldLabel htmlFor="filter-location" style={{ color: 'var(--c-text-dim)' }}>
        Район / Населённый пункт
      </FieldLabel>
      <Input
        id="filter-location"
        type="text"
        autoComplete="off"
        maxLength={120}
        placeholder="Пушкин, Гатчина..."
        value={value}
        ref={inputRef}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="filter-location-listbox"
        aria-autocomplete="list"
        style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}
      />
      <FieldError message={error} />
      {open && filtered.length > 0 && (
        <ul
          id="filter-location-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-lg shadow-lg max-h-64 overflow-auto"
          style={{
            background: 'var(--c-card)',
            border: '1px solid var(--c-border)',
          }}
        >
          {filtered.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={item}
                role="option"
                aria-selected={active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className="px-3 py-2 text-sm cursor-pointer"
                style={{
                  background: active ? 'var(--c-surface-hover)' : 'transparent',
                  color: 'var(--c-text)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {item}
              </li>
            );
          })}
        </ul>
      )}
      {open && filtered.length === 0 && trimmed.length > 0 && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg px-3 py-2 text-xs"
          style={{
            background: 'var(--c-card)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-text-dim)',
          }}
        >
          Ничего не найдено
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({ visible, filters, initialForm, onApply, onClear, onClose }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormState>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: initialForm,
  });

  useEffect(() => {
    reset(initialForm);
  }, [initialForm, reset]);

  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      const firstInteractive = document.querySelector<HTMLElement>(
        '#plots-filter-panel input, #plots-filter-panel button',
      );
      firstInteractive?.focus();
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible]);

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  function handleReset() {
    reset(EMPTY_FORM);
    onClear();
  }

  return (
    <>
      {visible && (
        <Surface
          id="plots-filter-panel"
          className="p-5 mb-6 animate-fade-in"
          role="dialog"
          aria-label="Фильтры каталога"
          aria-modal="false"
        >
          <form onSubmit={handleSubmit(onApply)}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-display)' }}>Фильтры</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                style={{ color: 'var(--c-text-dim)' }}
                aria-label="Закрыть фильтры"
              >
                <X size={28} />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RangeField
                label="Цена, ₽ (до 10 000 000 000)"
                minReg={register('min_price')}
                maxReg={register('max_price')}
                minError={errors.min_price?.message}
                maxError={errors.max_price?.message}
                max={10_000_000_000}
                step="1000"
              />
              <RangeField
                label="Площадь, сот. (до 100 000)"
                minReg={register('min_area')}
                maxReg={register('max_area')}
                minError={errors.min_area?.message}
                maxError={errors.max_area?.message}
                max={100_000}
                step="0.1"
              />
              <RangeField
                label="Цена за сотку, ₽ (до 1 000 000 000)"
                minReg={register('min_price_per_sotka')}
                maxReg={register('max_price_per_sotka')}
                minError={errors.min_price_per_sotka?.message}
                maxError={errors.max_price_per_sotka?.message}
                max={1_000_000_000}
                step="1000"
              />
              <div className="sm:col-span-2 lg:col-span-3">
                <Controller
                  control={control}
                  name="location"
                  render={({ field }) => (
                    <LocationField
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={errors.location?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button type="submit" variant="primary" size="sm">Применить</Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>Сбросить</Button>
            </div>
          </form>
        </Surface>
      )}

      {activeFilterCount > 0 && !visible && (
        <div className="flex flex-wrap gap-2 mb-5">
          {filters.min_price !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              Цена от {Number(filters.min_price).toLocaleString('ru-RU')} ₽
            </span>
          )}
          {filters.max_price !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              Цена до {Number(filters.max_price).toLocaleString('ru-RU')} ₽
            </span>
          )}
          {filters.min_area !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              от {filters.min_area} сот.
            </span>
          )}
          {filters.max_area !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              до {filters.max_area} сот.
            </span>
          )}
          {filters.min_price_per_sotka !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)' }}>
              ₽/сот. от {Number(filters.min_price_per_sotka).toLocaleString('ru-RU')}
            </span>
          )}
          {filters.max_price_per_sotka !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)' }}>
              ₽/сот. до {Number(filters.max_price_per_sotka).toLocaleString('ru-RU')}
            </span>
          )}
          {filters.location && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}>
              {filters.location}
            </span>
          )}
          <Button
            onClick={onClear}
            variant="ghost"
            size="sm"
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{ color: 'var(--c-red)', background: 'var(--c-red-dim)' }}
          >
            <X size={22} /> Сбросить
          </Button>
        </div>
      )}
    </>
  );
}

export type { FormState };
