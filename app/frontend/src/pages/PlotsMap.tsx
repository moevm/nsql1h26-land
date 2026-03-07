import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPlotsForMap, type MapPlot } from '../api';
import { formatPrice, scoreHexColor, SPB_CENTER, getErrorMessage } from '../utils';
import { getCached, setCache } from '../cache';

const MAP_CACHE_KEY = 'map-plots';
const MAP_CACHE_TTL = 120_000; // 2 min

/** Map from marker id to total_score, used by cluster icon. */
const _scoreById = new Map<string, number>();

/** Creates a small colored circle DivIcon based on score. */
function createScoreIcon(score: number) {
  const color = scoreHexColor(score);
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};opacity:0.85;box-shadow:0 0 6px ${color}44;"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Custom cluster icon matching the dark theme. */
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();
  // Average score color
  let totalScore = 0;
  markers.forEach((m: any) => { totalScore += _scoreById.get(m.options.alt ?? '') || 0; });
  const avgScore = markers.length > 0 ? totalScore / markers.length : 0;
  const color = scoreHexColor(avgScore);

  const size = count < 10 ? 36 : count < 50 ? 44 : 52;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color}33;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-mono);font-weight:700;font-size:${size > 44 ? 13 : 11}px;
      color:${color};
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ plots }: { plots: MapPlot[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (plots.length === 0 || fitted.current) return;
    const lats = plots.map((p) => p.lat);
    const lons = plots.map((p) => p.lon);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.02, Math.min(...lons) - 0.02],
        [Math.max(...lats) + 0.02, Math.max(...lons) + 0.02],
      ],
      { maxZoom: 12, padding: [30, 30] },
    );
    fitted.current = true;
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
      return r;
    } catch (e) {
      if (signal?.aborted) return null;
      setError(getErrorMessage(e));
      return null;
    }
  }, []);

  useEffect(() => {
    // Try cache first
    const cached = getCached<MapPlot[]>(MAP_CACHE_KEY, MAP_CACHE_TTL);
    if (cached && cached.length > 0) {
      setPlots(cached);
      setTotalPlots(cached.length);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const first = await loadPage(1, controller.signal);
      if (controller.signal.aborted || !first) { setLoading(false); return; }
      for (let p = 2; p <= first.pages; p++) {
        if (controller.signal.aborted) break;
        await loadPage(p, controller.signal);
      }
      if (!controller.signal.aborted) {
        setLoading(false);
        // Cache all loaded plots
        setPlots((all) => { setCache(MAP_CACHE_KEY, all); return all; });
      }
    })();
    return () => controller.abort();
  }, [loadPage]);

  const stats = useMemo(() => {
    if (plots.length === 0) return null;
    const scores = plots.map((p) => p.total_score);
    // Populate score map for cluster icon
    _scoreById.clear();
    for (const p of plots) _scoreById.set(p._id, p.total_score);
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
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={60}
              spiderfyOnMaxZoom
              showCoverageOnHover={false}
              iconCreateFunction={createClusterIcon}
            >
              {plots.map((plot) => {
                const icon = createScoreIcon(plot.total_score);
                return (
                  <Marker
                    key={plot._id}
                    position={[plot.lat, plot.lon]}
                    icon={icon}
                    alt={plot._id}
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
                              background: scoreHexColor(plot.total_score) + '22',
                              color: scoreHexColor(plot.total_score),
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
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      )}
    </div>
  );
}
