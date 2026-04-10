import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PlotFilters } from '../api';
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
  min_score: '',
  min_infra: '',
  min_feature: '',
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

function RangeField({ label, minReg, maxReg, minError, maxError }: {
  readonly label: string;
  readonly minReg: UseFormRegisterReturn;
  readonly maxReg: UseFormRegisterReturn;
  readonly minError?: string;
  readonly maxError?: string;
}) {
  return (
    <div>
      <FieldCaption style={{ color: 'var(--c-text-dim)' }}>{label}</FieldCaption>
      <div className="flex gap-2">
        <Input type="number" min="0" placeholder="от" style={inputStyle} {...minReg} />
        <Input type="number" min="0" placeholder="до" style={inputStyle} {...maxReg} />
      </div>
      <FieldError message={minError || maxError} />
    </div>
  );
}

function ScoreField({ label, reg, error }: { readonly label: string; readonly reg: UseFormRegisterReturn; readonly error?: string }) {
  return (
    <div>
      <FieldCaption style={{ color: 'var(--c-text-dim)' }}>{label}</FieldCaption>
      <Input type="number" step="0.05" min="0" max="1" placeholder="0.00" style={inputStyle} {...reg} />
      <FieldError message={error} />
    </div>
  );
}

export default function FilterPanel({ visible, filters, initialForm, onApply, onClear, onClose }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormState>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: initialForm,
  });

  // Sync local form when parent resets filters externally
  useEffect(() => {
    reset(initialForm);
  }, [initialForm, reset]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const firstInteractive = document.querySelector<HTMLElement>('#plots-filter-panel input, #plots-filter-panel button');
    firstInteractive?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      previousActiveElement?.focus();
    };
  }, [visible, onClose]);

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
                <X size={16} />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RangeField
                label="Цена, ₽"
                minReg={register('min_price')}
                maxReg={register('max_price')}
                minError={errors.min_price?.message}
                maxError={errors.max_price?.message}
              />
              <RangeField
                label="Площадь, сот."
                minReg={register('min_area')}
                maxReg={register('max_area')}
                minError={errors.min_area?.message}
                maxError={errors.max_area?.message}
              />
              <RangeField
                label="Цена за сотку, ₽"
                minReg={register('min_price_per_sotka')}
                maxReg={register('max_price_per_sotka')}
                minError={errors.min_price_per_sotka?.message}
                maxError={errors.max_price_per_sotka?.message}
              />
              <ScoreField label="Мин. общий скор (0–1)" reg={register('min_score')} error={errors.min_score?.message} />
              <ScoreField label="Мин. скор инфраструктуры (0–1)" reg={register('min_infra')} error={errors.min_infra?.message} />
              <ScoreField label="Мин. скор характеристик (0–1)" reg={register('min_feature')} error={errors.min_feature?.message} />
              <div>
                <FieldLabel htmlFor="filter-location" style={{ color: 'var(--c-text-dim)' }}>
                  Район / Населённый пункт
                </FieldLabel>
                <Input id="filter-location" type="text" placeholder="Пушкин, Гатчина..." {...register('location')} style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem' }} />
                <FieldError message={errors.location?.message} />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button type="submit" variant="primary" size="sm">Применить</Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleReset}>Сбросить</Button>
            </div>
          </form>
        </Surface>
      )}

      {/* Active filter tags */}
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
          {filters.min_score !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-yellow-dim)', color: 'var(--c-yellow)' }}>
              Score ≥ {filters.min_score}
            </span>
          )}
          {filters.min_infra !== undefined && (
            <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--c-blue-dim)', color: 'var(--c-blue)' }}>
              Инфра ≥ {filters.min_infra}
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
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: 'var(--c-red)', background: 'var(--c-red-dim)' }}
          >
            <X size={12} /> Сбросить
          </Button>
        </div>
      )}
    </>
  );
}

export type { FormState };
