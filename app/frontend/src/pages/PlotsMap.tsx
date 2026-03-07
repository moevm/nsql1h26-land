import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPlotsForMap, type MapPlot } from '../api';
import { formatPrice, scoreHexColor, SPB_CENTER, getErrorMessage } from '../utils';

function FitBounds({ plots }: { plots: MapPlot[] }) {
  const map = useMap();
  useEffect(() => {
    if (plots.length === 0) return;
    const lats = plots.map((p) => p.lat);
    const lons = plots.map((p) => p.lon);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.02, Math.min(...lons) - 0.02],
        [Math.max(...lats) + 0.02, Math.max(...lons) + 0.02],
      ],
      { maxZoom: 12, padding: [30, 30] },
    );
  }, [plots, map]);
  return null;
}

export default function PlotsMap() {
  const [plots, setPlots] = useState<MapPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedPages, setLoadedPages] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlots, setTotalPlots] = useState(0);

  const loadPage = useCallback(async (page: number, signal?: AbortSignal) => {
    try {
      const r = await fetchPlotsForMap(page, 200, signal);
      setPlots((prev) => [...prev, ...r.items]);
      setTotalPages(r.pages);
      setTotalPlots(r.total);
      setLoadedPages(page);
      return r.pages;
    } catch (e) {
      if (signal?.aborted) return 0;
      setError(getErrorMessage(e));
      return 0;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const pages = await loadPage(1, controller.signal);
      if (controller.signal.aborted || !pages) { setLoading(false); return; }
      for (let p = 2; p <= pages; p++) {
        if (controller.signal.aborted) break;
        await loadPage(p, controller.signal);
      }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, [loadPage]);

  const stats = useMemo(() => {
    if (plots.length === 0) return null;
    const scores = plots.map((p) => p.total_score);
    return {
      count: plots.length,
      avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    };
  }, [plots]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
          >
            Карта участков
          </h1>
          <p style={{ color: 'var(--c-text-muted)', fontSize: '0.9rem' }}>
            Все объявления на интерактивной карте
          </p>
        </div>
        {stats && (
          <div className="flex gap-4">
            <div
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: 'var(--c-accent-dim)',
                color: 'var(--c-accent)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {plots.length}{loading ? ` / ${totalPlots}` : ''} участков
              {loading && loadedPages > 0 && (
                <span style={{ color: 'var(--c-text-dim)', marginLeft: '4px' }}>
                  (стр. {loadedPages}/{totalPages})
                </span>
              )}
            </div>
            <div
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: 'var(--c-green-dim)',
                color: 'var(--c-green)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              avg score {stats.avgScore}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs" style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#5cb08a' }} />
          <span>score &ge; 70</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#c9a84c' }} />
          <span>score 40–69</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#c75f5f' }} />
          <span>score &lt; 40</span>
        </span>
      </div>

      {/* Map */}
      {loading && (
        <p className="text-center py-20" style={{ color: 'var(--c-text-dim)' }}>
          Загрузка карты...
        </p>
      )}
      {error && (
        <p className="text-center py-20" style={{ color: 'var(--c-red)' }}>{error}</p>
      )}

      {!loading && !error && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--c-border)', height: 'calc(100vh - 280px)', minHeight: '500px' }}
        >
          <MapContainer
            center={SPB_CENTER}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {plots.length > 0 && <FitBounds plots={plots} />}
            {plots.map((plot) => {
              const color = scoreHexColor(plot.total_score);
              return (
                <CircleMarker
                  key={plot._id}
                  center={[plot.lat, plot.lon]}
                  radius={7}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.7,
                    weight: 2,
                    opacity: 0.9,
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'var(--font-body)', minWidth: '200px' }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          marginBottom: '4px',
                          color: '#1a1a1a',
                        }}
                      >
                        {plot.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '6px' }}>
                        {plot.location}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#b8863e' }}>
                          {formatPrice(plot.price)}
                        </span>
                        {plot.area_sotki && (
                          <span style={{ fontSize: '0.75rem', color: '#888' }}>
                            {plot.area_sotki} сот.
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: color + '22',
                            color,
                            fontWeight: 600,
                          }}
                        >
                          score {(plot.total_score * 100).toFixed(0)}
                        </span>
                        <a
                          href={`/plots/${plot._id}`}
                          style={{
                            fontSize: '0.75rem',
                            color: '#b8863e',
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          Подробнее →
                        </a>
                      </div>
                      {plot.features_text && (
                        <p style={{ fontSize: '0.65rem', color: '#999', marginTop: '4px' }}>
                          {plot.features_text}
                        </p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
