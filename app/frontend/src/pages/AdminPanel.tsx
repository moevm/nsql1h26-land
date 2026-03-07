import { useState, useEffect, useRef } from 'react';
import { Download, Upload, RefreshCw, X, Layers, TrainFront, Hospital as HospitalIcon, School as SchoolIcon, Baby, Store, Package, BusFront, AlertTriangle } from 'lucide-react';
import { exportAll, importPlots, getStats, clearCollection } from '../api';
import { getErrorMessage } from '../utils';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--c-text-dim)' }}>Необходимо войти в систему</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p style={{ color: 'var(--c-red)' }}>Доступ только для администраторов</p>
      </div>
    );
  }

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

  // Auto-clear success message after 5s (with proper cleanup)
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
      showErr('Выберите JSON-файл');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      let records: unknown[];
      if (Array.isArray(json)) {
        records = json;
      } else if (json.plots && Array.isArray(json.plots)) {
        records = json.plots;
      } else if (json.data && Array.isArray(json.data)) {
        records = json.data;
      } else {
        const plotsKey = Object.keys(json).find((k) => k === 'plots');
        if (plotsKey) {
          records = json[plotsKey];
        } else {
          throw new Error('Неверный формат файла');
        }
      }

      const result = await importPlots(records);
      showMsg(`Импортировано: ${result.inserted} объявлений`);
      loadStats();
    } catch (e) {
      showErr(getErrorMessage(e));
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
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

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
      >
        Панель данных
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
        Управление коллекциями, импорт и экспорт
      </p>

      {/* Alerts */}
      {message && (
        <div
          className="px-4 py-3 rounded-xl mb-5 text-sm animate-fade-in"
          style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)', border: '1px solid var(--c-green)' }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="px-4 py-3 rounded-xl mb-5 text-sm animate-fade-in"
          style={{ background: 'var(--c-red-dim)', color: 'var(--c-red)', border: '1px solid var(--c-red)' }}
        >
          {error}
        </div>
      )}

      {/* Export / Import */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        <h2
          className="text-lg font-semibold mb-5"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
        >
          Экспорт / Импорт
        </h2>

        <button
          onClick={handleExport}
          disabled={loading}
          className="btn-primary w-full mb-5"
        >
          {loading ? 'Загрузка...' : <><Download size={16} className="inline-block mr-2" />Экспорт всех данных (JSON)</>}
        </button>

        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
        >
          <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
            Импорт объявлений
          </p>
          <div className="flex gap-3 items-center">
            <input
              ref={fileInput}
              type="file"
              accept=".json"
              className="flex-1 text-sm"
              style={{
                color: 'var(--c-text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-ghost text-sm whitespace-nowrap"
              style={{
                borderColor: 'var(--c-green)',
                color: 'var(--c-green)',
              }}
            >
              {loading ? '...' : <><Upload size={14} className="inline-block mr-1" />Импорт</>}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--c-text-dim)' }}>
            Поддержка: массив объявлений, объект с ключом «plots» или «data».
            Если фичи уже рассчитаны — повторный расчёт не производится.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div
        className="rounded-xl p-6"
        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
          >
            Коллекции
          </h2>
          <div className="flex items-center gap-3">
            {stats && (
              <span className="text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
                {totalDocs} всего
              </span>
            )}
            <button
              onClick={loadStats}
              className="text-xs transition-colors"
              style={{ color: 'var(--c-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--c-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--c-accent)'}
            >
              <RefreshCw size={12} className="inline-block mr-1" /> Обновить
            </button>
          </div>
        </div>

        {stats ? (
          <div className="space-y-1 stagger-children">
            {Object.entries(stats).map(([col, count]) => {
              const meta = collectionMeta[col] || { label: col, Icon: Layers };
              return (
                <div
                  key={col}
                  className="flex items-center justify-between py-3 px-4 rounded-lg transition-colors duration-200 row-hover"
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
                    <button
                      onClick={() => handleClear(col)}
                      className="text-xs px-2 py-1 rounded-md transition-colors duration-200"
                      style={{ color: 'var(--c-red)', background: 'transparent' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--c-red-dim)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      title="Очистить коллекцию"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--c-text-dim)' }}>Загрузка...</p>
        )}
      </div>
    </div>
  );
}
