import type { SellerProfile } from '../api';
import { formatPriceFull } from '../utils';
import { SectionTitle } from './SectionTitle';
import { Surface } from './ui';

const DATE_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

function MetaRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (!value) return null;
  return (
    <p className="flex items-start gap-2">
      <span style={{ color: 'var(--c-text-dim)' }}>{label}:</span>
      <span style={{ color: 'var(--c-text)' }}>{value}</span>
    </p>
  );
}

export default function SellerProfileCard({
  profile,
  isLoading,
  error,
  ownerName,
}: {
  readonly profile: SellerProfile | undefined;
  readonly isLoading: boolean;
  readonly error: string;
  readonly ownerName?: string;
}) {
  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString('ru-RU', DATE_LABEL_OPTIONS)
    : null;

  return (
    <Surface className="p-5">
      <SectionTitle className="mb-3">Продавец</SectionTitle>
      {isLoading && (
        <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>
          Загружаем профиль продавца...
        </p>
      )}
      {!isLoading && error && (
        <p className="text-sm" style={{ color: 'var(--c-red)' }}>{error}</p>
      )}
      {!isLoading && !error && profile && (
        <div className="space-y-2 text-sm" style={{ color: 'var(--c-text)' }}>
          <MetaRow label="Пользователь" value={profile.username} />
          <MetaRow label="Роль" value={profile.role === 'admin' ? 'Администратор' : 'Пользователь'} />
          <MetaRow label="Объявлений" value={String(profile.plots_total)} />
          <MetaRow label="Средний score" value={profile.avg_total_score?.toFixed(3) ?? '—'} />
          <MetaRow
            label="Средняя цена за сотку"
            value={profile.avg_price_per_sotka ? formatPriceFull(profile.avg_price_per_sotka) : '—'}
          />
          <MetaRow label="С нами с" value={memberSince ?? '—'} />
        </div>
      )}
      {!isLoading && !error && !profile && (
        <p className="text-sm" style={{ color: 'var(--c-text-dim)' }}>
          {ownerName ? 'Профиль продавца недоступен' : 'Владелец не указан'}
        </p>
      )}
    </Surface>
  );
}
