import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { PriceHistoryPoint } from '../api';
import { formatPriceFull } from '../utils';
import { SectionTitle } from './SectionTitle';
import { Surface } from './ui';

function formatHistoryTick(value: number) {
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatHistoryLabel(value: number) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ChartPoint = { ts: number; price: number };

function toChartData(points: PriceHistoryPoint[]): ChartPoint[] {
  return points
    .map((p) => ({ ts: new Date(p.at).getTime(), price: p.price }))
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
}

export default function PriceHistoryChart({
  data,
  isLoading,
}: {
  readonly data: PriceHistoryPoint[];
  readonly isLoading: boolean;
}) {
  const chartData = toChartData(data);

  return (
    <Surface className="p-5">
      <SectionTitle className="mb-3">История цены</SectionTitle>
      {isLoading && (
        <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>Загрузка истории цены...</p>
      )}
      {!isLoading && chartData.length <= 1 && (
        <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>Недостаточно данных для графика</p>
      )}
      {!isLoading && chartData.length > 1 && (
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={formatHistoryTick}
                stroke="var(--c-text-dim)"
                fontSize={11}
              />
              <YAxis stroke="var(--c-text-dim)" fontSize={11} domain={['auto', 'auto']} />
              <Tooltip
                cursor={{ stroke: 'var(--c-border)' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const point = payload[0].payload as ChartPoint;
                  return (
                    <div
                      style={{
                        background: 'var(--c-surface)',
                        border: '1px solid var(--c-border)',
                        color: 'var(--c-text)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ color: 'var(--c-text-dim)', marginBottom: 2 }}>
                        {formatHistoryLabel(point.ts)}
                      </div>
                      <div>Цена: {formatPriceFull(point.price)}</div>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="price" stroke="var(--c-accent)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Surface>
  );
}
