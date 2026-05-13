import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  fetchCustomStats,
  fetchStatsDimensions,
  type CustomStatsResponse,
  type StatsDimension,
} from '../api';
import { getErrorMessage } from '../utils';
import { AlertMessage } from '../components/AlertMessage';
import { PageHeader } from '../components/PageHeader';
import { SectionTitle } from '../components/SectionTitle';
import { Button, FieldCaption, FieldError, FieldLabel, Input, Surface } from '../components/ui';

const FEATURE_OPTIONS = [
  { key: 'is_izhs', label: 'ИЖС' },
  { key: 'is_snt', label: 'СНТ/ДНП' },
  { key: 'has_gas', label: 'газ' },
  { key: 'has_electricity', label: 'электричество' },
  { key: 'has_water', label: 'вода' },
  { key: 'has_house', label: 'дом' },
  { key: 'has_road', label: 'хороший подъезд' },
  { key: 'documents_ready', label: 'документы готовы' },
];

const PALETTE = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#fb923c', '#22d3ee', '#f472b6', '#94a3b8', '#84cc16',
  '#e879f9', '#facc15',
];

interface FilterState {
  min_price: string;
  max_price: string;
  min_area: string;
  max_area: string;
  min_score: string;
  max_score: string;
  location: string;
  require_features: string[];
}

const INITIAL_FILTERS: FilterState = {
  min_price: '',
  max_price: '',
  min_area: '',
  max_area: '',
  min_score: '',
  max_score: '',
  location: '',
  require_features: [],
};

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type FilterErrors = Partial<Record<keyof FilterState | 'axes', string>>;

function validateFilters(filters: FilterState, x: string, y: string): FilterErrors {
  const errors: FilterErrors = {};
  const check = (key: keyof FilterState, min: number, max: number, label: string) => {
    const raw = (filters[key] as string).trim();
    if (!raw) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors[key] = `${label} — введите число`;
    } else if (n < min || n > max) {
      errors[key] = `${label} — допустимо от ${min} до ${max.toLocaleString('ru-RU')}`;
    }
  };
  check('min_price', 0, 10_000_000_000, 'Цена от');
  check('max_price', 0, 10_000_000_000, 'Цена до');
  check('min_area', 0, 100_000, 'Площадь от');
  check('max_area', 0, 100_000, 'Площадь до');
  check('min_score', 0, 1, 'Скор от');
  check('max_score', 0, 1, 'Скор до');

  const pairs: Array<[keyof FilterState, keyof FilterState, string]> = [
    ['min_price', 'max_price', 'цены'],
    ['min_area', 'max_area', 'площади'],
    ['min_score', 'max_score', 'скора'],
  ];
  for (const [minK, maxK, label] of pairs) {
    const minRaw = (filters[minK] as string).trim();
    const maxRaw = (filters[maxK] as string).trim();
    if (minRaw && maxRaw && Number(minRaw) > Number(maxRaw)) {
      errors[maxK] = `Верхняя граница ${label} должна быть ≥ нижней`;
    }
  }

  if (x === y) {
    errors.axes = 'Оси X и Y должны быть разными';
  }
  return errors;
}

export default function Statistics() {
  const [dimensions, setDimensions] = useState<StatsDimension[]>([]);
  const [x, setX] = useState('price');
  const [y, setY] = useState('total_score');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [data, setData] = useState<CustomStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatsDimensions()
      .then(setDimensions)
      .catch((e) => setError(getErrorMessage(e)));
  }, []);

  const fieldErrors = useMemo(() => validateFilters(filters, x, y), [filters, x, y]);
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  async function runQuery() {
    if (hasFieldErrors) return;
    setLoading(true);
    setError('');
    try {
      const result = await fetchCustomStats({
        x,
        y,
        min_price: parseOptionalNumber(filters.min_price),
        max_price: parseOptionalNumber(filters.max_price),
        min_area: parseOptionalNumber(filters.min_area),
        max_area: parseOptionalNumber(filters.max_area),
        min_score: parseOptionalNumber(filters.min_score),
        max_score: parseOptionalNumber(filters.max_score),
        location: filters.location.trim() || undefined,
        require_features: filters.require_features,
      });
      setData(result);
    } catch (e) {
      setError(getErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (dimensions.length) runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.length]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.x_values.map((xv) => {
      const row: Record<string, string | number> = { x: xv };
      for (const yv of data.y_values) {
        const cell = data.cells.find((c) => c.x === xv && c.y === yv);
        row[yv] = cell?.count ?? 0;
      }
      return row;
    });
  }, [data]);

  const yAxisTicks = useMemo(() => {
    if (!chartData.length) return undefined;
    const maxTotal = chartData.reduce((acc, row) => {
      const total = Object.entries(row).reduce(
        (s, [k, v]) => (k === 'x' ? s : s + (typeof v === 'number' ? v : 0)),
        0,
      );
      return Math.max(acc, total);
    }, 0);
    if (maxTotal <= 0) return [0];

    const targetTickCount = 6;
    const rawStep = maxTotal / targetTickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let niceStep: number;
    if (normalized < 1.5) niceStep = 1 * magnitude;
    else if (normalized < 3) niceStep = 2 * magnitude;
    else if (normalized < 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    const step = Math.max(1, Math.round(niceStep));

    const ticks: number[] = [];
    for (let v = 0; v <= maxTotal + step / 2; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] < maxTotal) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }, [chartData]);

  const yAxisMax = yAxisTicks ? yAxisTicks[yAxisTicks.length - 1] : undefined;

  function toggleFeature(key: string) {
    setFilters((prev) => ({
      ...prev,
      require_features: prev.require_features.includes(key)
        ? prev.require_features.filter((k) => k !== key)
        : [...prev.require_features, key],
    }));
  }

  function resetFilters() {
    setFilters(INITIAL_FILTERS);
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      <PageHeader
        title="Статистика"
        subtitle="Многокритериальный фильтр + произвольные оси для распределения объявлений"
      />

      <AlertMessage message={error} />

      <Surface className="p-5 mb-5 space-y-4">
        <SectionTitle>Фильтр</SectionTitle>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <FieldLabel htmlFor="stats-min-price">Цена от, ₽</FieldLabel>
            <Input
              id="stats-min-price"
              type="number"
              min="0"
              value={filters.min_price}
              onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
            />
            <FieldError message={fieldErrors.min_price} />
          </div>
          <div>
            <FieldLabel htmlFor="stats-max-price">Цена до, ₽</FieldLabel>
            <Input
              id="stats-max-price"
              type="number"
              min="0"
              value={filters.max_price}
              onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
            />
            <FieldError message={fieldErrors.max_price} />
          </div>
          <div>
            <FieldLabel htmlFor="stats-location">Район</FieldLabel>
            <Input
              id="stats-location"
              placeholder="подстрока (например, Всеволожск)"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="stats-min-area">Площадь от, сот.</FieldLabel>
            <Input
              id="stats-min-area"
              type="number"
              min="0"
              value={filters.min_area}
              onChange={(e) => setFilters({ ...filters, min_area: e.target.value })}
            />
            <FieldError message={fieldErrors.min_area} />
          </div>
          <div>
            <FieldLabel htmlFor="stats-max-area">Площадь до, сот.</FieldLabel>
            <Input
              id="stats-max-area"
              type="number"
              min="0"
              value={filters.max_area}
              onChange={(e) => setFilters({ ...filters, max_area: e.target.value })}
            />
            <FieldError message={fieldErrors.max_area} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel htmlFor="stats-min-score">Скор от</FieldLabel>
              <Input
                id="stats-min-score"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={filters.min_score}
                onChange={(e) => setFilters({ ...filters, min_score: e.target.value })}
              />
              <FieldError message={fieldErrors.min_score} />
            </div>
            <div>
              <FieldLabel htmlFor="stats-max-score">Скор до</FieldLabel>
              <Input
                id="stats-max-score"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={filters.max_score}
                onChange={(e) => setFilters({ ...filters, max_score: e.target.value })}
              />
              <FieldError message={fieldErrors.max_score} />
            </div>
          </div>
        </div>

        <div>
          <FieldCaption>Должны присутствовать признаки</FieldCaption>
          <div className="flex flex-wrap gap-2 mt-1">
            {FEATURE_OPTIONS.map((opt) => {
              const active = filters.require_features.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleFeature(opt.key)}
                  className="text-xs px-3 py-1.5 rounded-md border"
                  style={{
                    background: active ? 'var(--c-accent-dim)' : 'var(--c-surface)',
                    color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
                    borderColor: active ? 'var(--c-accent)' : 'var(--c-border)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FieldLabel htmlFor="stats-x">Ось X</FieldLabel>
            <select
              id="stats-x"
              value={x}
              onChange={(e) => setX(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            >
              {dimensions.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              const prevX = x;
              setX(y);
              setY(prevX);
            }}
            title="Поменять X и Y местами"
            aria-label="Поменять X и Y местами"
            className="mb-px"
          >
            <ArrowLeftRight size={16} />
          </Button>
          <div className="flex-1">
            <FieldLabel htmlFor="stats-y">Ось Y (группы)</FieldLabel>
            <select
              id="stats-y"
              value={y}
              onChange={(e) => setY(e.target.value)}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-text)',
              }}
            >
              {dimensions.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <FieldError message={fieldErrors.axes} />

        <div className="flex gap-2">
          <Button onClick={runQuery} disabled={loading || hasFieldErrors}>
            <BarChart3 size={14} className="inline-block mr-1.5" />
            {loading ? 'Считаем...' : 'Построить диаграмму'}
          </Button>
          <Button onClick={resetFilters} variant="ghost" disabled={loading}>
            Сбросить фильтр
          </Button>
        </div>
      </Surface>

      <Surface className="p-5">
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>
            {data ? `${data.x_label} × ${data.y_label}` : 'Диаграмма'}
          </SectionTitle>
          {data && (
            <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {data.total} объявлений
            </span>
          )}
        </div>

        {data && chartData.length > 0 ? (
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
                <XAxis dataKey="x" tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }}
                  allowDecimals={false}
                  ticks={yAxisTicks}
                  domain={[0, yAxisMax ?? 'auto']}
                  label={{
                    value: 'Количество',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fontSize: 11, fill: 'var(--c-text-dim)' },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--c-card)',
                    border: '1px solid var(--c-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {data.y_values.map((yv, idx) => (
                  <Bar
                    key={yv}
                    dataKey={yv}
                    stackId="a"
                    fill={PALETTE[idx % PALETTE.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>
            {loading ? 'Загрузка...' : 'Нет данных под текущий фильтр.'}
          </p>
        )}

        {data && chartData.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="text-xs w-full" style={{ fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr>
                  <th className="text-left p-1.5" style={{ color: 'var(--c-text-dim)' }}>
                    {data.y_label} \ {data.x_label}
                  </th>
                  {data.x_values.map((xv) => (
                    <th key={xv} className="text-right p-1.5" style={{ color: 'var(--c-text-dim)' }}>
                      {xv}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.y_values.map((yv) => (
                  <tr key={yv} style={{ borderTop: '1px solid var(--c-border)' }}>
                    <td className="text-left p-1.5" style={{ color: 'var(--c-text)' }}>
                      {yv}
                    </td>
                    {data.x_values.map((xv) => {
                      const cell = data.cells.find((c) => c.x === xv && c.y === yv);
                      const count = cell?.count ?? 0;
                      return (
                        <td
                          key={xv}
                          className="text-right p-1.5 tabular-nums"
                          style={{
                            color: count > 0 ? 'var(--c-text)' : 'var(--c-text-dim)',
                          }}
                        >
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
