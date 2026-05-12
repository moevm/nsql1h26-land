import { useState, useEffect, useRef } from 'react';
import { Download, Upload, RefreshCw, X, Layers, TrainFront, Hospital as HospitalIcon, School as SchoolIcon, Baby, Store, Package, BusFront, AlertTriangle } from 'lucide-react';
import { exportAll, importPlots, importInfra, getStats, clearCollection } from '../api';
import { getErrorMessage } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { AlertMessage } from '../components/AlertMessage';
import { PageHeader } from '../components/PageHeader';
import { SectionTitle } from '../components/SectionTitle';
import { Button, Surface } from '../components/ui';
import { cn } from '../lib/cn';
import {
  formatZodError,
  infraImportPayloadSchema,
  plotsImportPayloadSchema,
  splitCombinedImport,
} from '../features/forms/importSchemas';

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const [importFileName, setImportFileName] = useState('');

  async function loadStats() {
    try {
      const s = await getStats();
      setStats(s);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(loadStats, 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  function showMsg(msg: string) {
    setMessage(msg);
    setError('');
  }

  function showErr(msg: string) {
    setError(msg);
    setMessage('');
  }

  function toRecordArray(input: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(input)) {
      throw new Error('Ожидался массив объектов');
    }

    return input.filter((item): item is Record<string, unknown> => (
      typeof item === 'object' && item !== null && !Array.isArray(item)
    ));
  }

  async function handleExport() {
    setLoading(true);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `land_plots_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Экспорт завершён');
    } catch (e) {
      showErr(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      showErr('Выберите файл infra_and_plots.json');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Файл не является валидным JSON');
      }

      const { plots, infra } = splitCombinedImport(json);
      const messages: string[] = [];

      const ALL_INFRA = [
        'metro_stations', 'hospitals', 'schools', 'kindergartens',
        'stores', 'pickup_points', 'bus_stops', 'negative_objects',
      ];
      await clearCollection('plots').catch(() => undefined);
      await Promise.all(
        ALL_INFRA.map((col) => clearCollection(col).catch(() => undefined)),
      );

      if (Object.keys(infra).length > 0) {
        const parsedInfra = infraImportPayloadSchema.safeParse(infra);
        if (!parsedInfra.success) {
          throw new Error(formatZodError(parsedInfra.error));
        }
        let totalReplaced = 0;
        const collections = Object.keys(parsedInfra.data);
        for (const col of collections) {
          const result = await importInfra(col, toRecordArray(parsedInfra.data[col]));
          totalReplaced += result.replaced;
        }
        messages.push(`инфраструктура: ${totalReplaced} объектов в ${collections.length} коллекциях`);
      }

      if (plots.length > 0) {
        const parsedPlots = plotsImportPayloadSchema.safeParse(plots);
        if (!parsedPlots.success) {
          throw new Error(formatZodError(parsedPlots.error));
        }
        const result = await importPlots(toRecordArray(parsedPlots.data as unknown[]));
        messages.push(`объявления: ${result.inserted}`);
      }

      showMsg(`Импорт завершён — ${messages.join('; ')}`);
      loadStats();
    } catch (e) {
      showErr(getErrorMessage(e));
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
      setImportFileName('');
    }
  }

  async function handleClear(col: string) {
    if (!confirm(`Очистить коллекцию "${col}"?`)) return;
    try {
      const result = await clearCollection(col);
      showMsg(`Удалено ${result.deleted} документов из "${col}"`);
      loadStats();
    } catch (e) {
      showErr(getErrorMessage(e));
    }
  }

  const collectionMeta: Record<string, { label: string; Icon: React.ElementType }> = {
    plots: { label: 'Объявления', Icon: Layers },
    metro_stations: { label: 'Метро', Icon: TrainFront },
    hospitals: { label: 'Больницы', Icon: HospitalIcon },
    schools: { label: 'Школы', Icon: SchoolIcon },
    kindergartens: { label: 'Детские сады', Icon: Baby },
    stores: { label: 'Магазины', Icon: Store },
    pickup_points: { label: 'Пункты выдачи', Icon: Package },
    bus_stops: { label: 'Остановки', Icon: BusFront },
    negative_objects: { label: 'Негативные', Icon: AlertTriangle },
  };

  const totalDocs = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--c-red)' }}>Доступ только для администраторов</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <PageHeader
        title="Панель данных"
        subtitle="Управление коллекциями, импорт и экспорт"
      />

      <AlertMessage message={message} tone="success" className="animate-fade-in" />
      <AlertMessage message={error} className="animate-fade-in" />

      <Surface className="p-6 mb-6">
        <SectionTitle className="mb-5">Экспорт / Импорт</SectionTitle>

        <Button
          onClick={handleExport}
          disabled={loading}
          className="w-full mb-5"
        >
          {loading ? 'Загрузка...' : <><Download size={16} className="inline-block mr-2" />Экспорт всех данных (JSON)</>}
        </Button>

        <Surface className="p-4" style={{ background: 'var(--c-surface)' }}>
          <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
            Импорт объявлений и инфраструктуры
          </p>
          <div className="flex gap-3 items-center">
            <label
              className={cn('file-input flex-1', importFileName && 'file-input--selected')}
            >
              <input
                ref={fileInput}
                type="file"
                accept=".json"
                onChange={(e) => setImportFileName(e.target.files?.[0]?.name ?? '')}
              />
              <span className="file-input-btn">
                <Upload size={13} />
                Выберите файл
              </span>
              <span className="file-input-name">
                {importFileName || 'infra_and_plots.json'}
              </span>
            </label>
            <Button
              onClick={handleImport}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="whitespace-nowrap"
              style={{
                borderColor: 'var(--c-green)',
                color: 'var(--c-green)',
              }}
            >
              {loading ? '...' : <><Upload size={14} className="inline-block mr-1" />Импорт</>}
            </Button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--c-text-dim)' }}>
            Один JSON-файл infra_and_plots.json: объект с ключом «plots» (массив объявлений)
            и/или ключами коллекций инфраструктуры (metro_stations, hospitals и т.д.).
            Перед импортом все объявления и инфраструктура полностью удаляются.
          </p>
        </Surface>
      </Surface>

      <Surface className="p-6">
        <div className="flex items-center justify-between mb-5">
          <SectionTitle>Коллекции</SectionTitle>
          <div className="flex items-center gap-3">
            {stats && (
              <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                {totalDocs} всего
              </span>
            )}
            <Button
              onClick={loadStats}
              variant="ghost"
              size="sm"
              className="text-xs"
              style={{ color: 'var(--c-accent)' }}
            >
              <RefreshCw size={12} className="inline-block mr-1" /> Обновить
            </Button>
          </div>
        </div>

        {stats ? (
          <div className="space-y-1 stagger-children">
            {Object.entries(stats).map(([col, count]) => {
              const meta = collectionMeta[col] || { label: col, Icon: Layers };
              return (
                <div
                  key={col}
                  className="flex items-center justify-between py-3 px-4 rounded-lg row-hover"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs"
                      style={{ background: 'var(--c-accent-dim)', color: 'var(--c-accent)' }}
                    >
                      <meta.Icon size={14} />
                    </span>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--c-heading)' }}>
                        {meta.label}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {col}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: 'var(--c-heading)', fontFamily: 'var(--font-mono)' }}
                    >
                      {count}
                    </span>
                    <Button
                      onClick={() => handleClear(col)}
                      variant="ghost"
                      size="icon"
                      className="text-xs px-2 py-1 rounded-md"
                      style={{ color: 'var(--c-red)', background: 'transparent' }}
                      title="Очистить коллекцию"
                    >
                      <X size={15} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--c-text-dim)' }}>Загрузка...</p>
        )}
      </Surface>
    </div>
  );
}
