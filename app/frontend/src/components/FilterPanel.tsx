import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PlotFilters } from '../api';

type FormState = {
  min_price: string; max_price: string;
  min_area: string; max_area: string;
  min_pps: string; max_pps: string;
  min_score: string; min_infra: string; min_feature: string;
  location: string;
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
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  color: 'var(--c-text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8rem',
};

function RangeField({ label, minVal, maxVal, onMinChange, onMaxChange }: {
  readonly label: string;
  readonly minVal: string;
  readonly maxVal: string;
  readonly onMinChange: (v: string) => void;
  readonly onMaxChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </label>
      <div className="flex gap-2">
        <input type="number" placeholder="от" value={minVal} onChange={(e) => onMinChange(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={inputStyle} />
        <input type="number" placeholder="до" value={maxVal} onChange={(e) => onMaxChange(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={inputStyle} />
      </div>
    </div>
  );
}

function ScoreField({ label, value, onChange }: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </label>
      <input type="number" step="0.05" min="0" max="1" placeholder="0.00" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg" style={inputStyle} />
    </div>
  );
}

export default function FilterPanel({ visible, filters, initialForm, onApply, onClear, onClose }: Props) {
  const [form, setForm] = useState<FormState>(initialForm);
  const upd = (key: keyof FormState, val: string) => setForm((f) => ({ ...f, [key]: val }));

  // Sync local form when parent resets filters externally
  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <>
      {visible && (
        <div className="rounded-xl p-5 mb-6 animate-fade-in" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-display)' }}>Фильтры</h3>
            <button onClick={onClose} style={{ color: 'var(--c-text-dim)' }}><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <RangeField label="Цена, ₽" minVal={form.min_price} maxVal={form.max_price} onMinChange={(v) => upd('min_price', v)} onMaxChange={(v) => upd('max_price', v)} />
            <RangeField label="Площадь, сот." minVal={form.min_area} maxVal={form.max_area} onMinChange={(v) => upd('min_area', v)} onMaxChange={(v) => upd('max_area', v)} />
            <RangeField label="Цена за сотку, ₽" minVal={form.min_pps} maxVal={form.max_pps} onMinChange={(v) => upd('min_pps', v)} onMaxChange={(v) => upd('max_pps', v)} />
            <ScoreField label="Мин. общий скор (0–1)" value={form.min_score} onChange={(v) => upd('min_score', v)} />
            <ScoreField label="Мин. скор инфраструктуры (0–1)" value={form.min_infra} onChange={(v) => upd('min_infra', v)} />
            <ScoreField label="Мин. скор характеристик (0–1)" value={form.min_feature} onChange={(v) => upd('min_feature', v)} />
            <div>
              <label htmlFor="filter-location" className="text-xs uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                Район / Населённый пункт
              </label>
              <input id="filter-location" type="text" placeholder="Пушкин, Гатчина..." value={form.location} onChange={(e) => upd('location', e.target.value)} className="w-full px-3 py-2 rounded-lg" style={{ ...inputStyle, fontFamily: 'var(--font-body)' }} />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={() => onApply(form)} className="btn-primary text-sm">Применить</button>
            <button onClick={() => { setForm({ min_price: '', max_price: '', min_area: '', max_area: '', min_pps: '', max_pps: '', min_score: '', min_infra: '', min_feature: '', location: '' }); onClear(); }} className="btn-ghost text-sm">Сбросить</button>
          </div>
        </div>
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
          <button
            onClick={onClear}
            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
            style={{ color: 'var(--c-red)', background: 'var(--c-red-dim)' }}
          >
            <X size={12} /> Сбросить
          </button>
        </div>
      )}
    </>
  );
}

export type { FormState };
