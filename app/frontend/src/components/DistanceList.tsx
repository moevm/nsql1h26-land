import { TrainFront, Hospital, School, Baby, ShoppingCart, Package, Bus, AlertTriangle } from 'lucide-react';
import type { PlotDistances } from '../api';
import { SectionTitle } from './SectionTitle';
import { Surface } from './ui';

const DISTANCE_ROW_CONFIG = [
  { key: 'nearest_metro', icon: TrainFront, label: 'МЕТРО' },
  { key: 'nearest_hospital', icon: Hospital, label: 'БОЛЬНИЦА' },
  { key: 'nearest_school', icon: School, label: 'ШКОЛА' },
  { key: 'nearest_kindergarten', icon: Baby, label: 'ДЕТСАД' },
  { key: 'nearest_store', icon: ShoppingCart, label: 'МАГАЗИН' },
  { key: 'nearest_pickup_point', icon: Package, label: 'ПВЗ' },
  { key: 'nearest_bus_stop', icon: Bus, label: 'АВТОБУС' },
  { key: 'nearest_negative', icon: AlertTriangle, label: 'НЕГАТИВ' },
] as const;

function distanceColor(km: number): string {
  if (km < 5) return 'var(--c-green)';
  if (km < 15) return 'var(--c-yellow)';
  return 'var(--c-red)';
}

function DistanceRow({ icon: Icon, label, name, km }: { readonly icon: React.ElementType; readonly label: string; readonly name: string; readonly km: number }) {
  const color = distanceColor(km);
  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-lg row-hover"
      style={{ borderBottom: '1px solid var(--c-border)' }}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} style={{ color: 'var(--c-text-muted)', flexShrink: 0 }} />
        <div>
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>{label}</span>
          <p className="text-sm" style={{ color: 'var(--c-text)' }}>{name || '—'}</p>
        </div>
      </div>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color, fontFamily: 'var(--font-mono)' }}
      >
        {km.toFixed(1)} км
      </span>
    </div>
  );
}

export default function DistanceList({ distances }: { readonly distances: PlotDistances }) {
  return (
    <Surface className="p-5">
      <SectionTitle className="mb-3">Расстояния</SectionTitle>
      <div className="space-y-0">
        {DISTANCE_ROW_CONFIG.map((item) => {
          const distance = distances[item.key];
          return (
            <DistanceRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              name={distance?.name ?? ''}
              km={distance?.km ?? 0}
            />
          );
        })}
      </div>
    </Surface>
  );
}
