import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LocateFixed, Radar } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';

import { type MapPlot } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui';
import { useMapPlotsQuery } from '../features/plots/hooks';
import { cn } from '../lib/cn';
import { MOTION_DURATION_S, MOTION_TRANSITION } from '../lib/motion';
import { formatPrice, getErrorMessage, scoreHexColor, SPB_CENTER } from '../utils';

const scoreById = new Map<string, number>();
const markerIconCache = new Map<string, L.DivIcon>();

type ScoreMode = 'all' | 'high' | 'mid' | 'low';

const SCORE_MODES: ReadonlyArray<{
  id: ScoreMode;
  label: string;
  helper: string;
}> = [
  { id: 'all', label: 'Все', helper: 'Любой score' },
  { id: 'high', label: 'Высокий', helper: '>= 70' },
  { id: 'mid', label: 'Средний', helper: '40-69' },
  { id: 'low', label: 'Низкий', helper: '< 40' },
];

const MAP_PADDING_PX: [number, number] = [38, 38];

function fitMapToPlots(map: L.Map, plots: MapPlot[], animate: boolean): void {
  if (plots.length === 0) {
    return;
  }

  const lats = plots.map((plot) => plot.lat);
  const lons = plots.map((plot) => plot.lon);
  map.fitBounds(
    [
      [Math.min(...lats) - 0.02, Math.min(...lons) - 0.02],
      [Math.max(...lats) + 0.02, Math.max(...lons) + 0.02],
    ],
    {
      maxZoom: 12,
      padding: MAP_PADDING_PX,
      animate,
    },
  );
}

function matchesScoreMode(plot: MapPlot, mode: ScoreMode): boolean {
  const scorePercent = plot.total_score * 100;
  if (mode === 'high') {
    return scorePercent >= 70;
  }
  if (mode === 'mid') {
    return scorePercent >= 40 && scorePercent < 70;
  }
  if (mode === 'low') {
    return scorePercent < 40;
  }
  return true;
}

function getScoreIcon(score: number) {
  const bucket = Math.round(score * 20) / 20;
  const color = scoreHexColor(bucket);
  const cacheKey = String(bucket);
  const existing = markerIconCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const icon = L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid ${color};opacity:0.88;box-shadow:0 0 8px ${color}55;"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  markerIconCache.set(cacheKey, icon);
  return icon;
}

function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const markers = cluster.getAllChildMarkers();

  let totalScore = 0;
  markers.forEach((marker: any) => {
    totalScore += scoreById.get(marker.options.alt ?? '') || 0;
  });

  const avgScore = markers.length > 0 ? totalScore / markers.length : 0;
  const color = scoreHexColor(avgScore);
  const size = count < 10 ? 36 : count < 50 ? 44 : 52;

  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color}2b;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font-mono);font-weight:700;font-size:${size > 44 ? 13 : 11}px;
      color:${color};backdrop-filter:blur(2px);
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createPopupHtml(plot: MapPlot): string {
  const title = escapeHtml(plot.title);
  const location = escapeHtml(plot.location);
  const features = plot.features_text ? escapeHtml(plot.features_text) : '';
  const scoreColor = scoreHexColor(plot.total_score);
  const areaText = plot.area_sotki ? `<span style="font-size:0.75rem;color:#888;">${plot.area_sotki} сот.</span>` : '';

  return `
    <div class="map-popup-card">
      <p class="map-popup-title">${title}</p>
      <p class="map-popup-location">${location}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span class="map-popup-price">${formatPrice(plot.price)}</span>
        ${areaText}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:var(--font-mono);font-size:0.7rem;padding:2px 8px;border-radius:6px;background:${scoreColor}22;color:${scoreColor};font-weight:600;">
          score ${(plot.total_score * 100).toFixed(0)}
        </span>
        <a href="/plots/${plot._id}" class="map-popup-link">
          Подробнее -&gt;
        </a>
      </div>
      ${features ? `<p class="map-popup-features">${features}</p>` : ''}
    </div>
  `;
}

function MapHandleBridge({ onReady }: { readonly onReady: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

function FastClusterLayer({ plots }: { readonly plots: MapPlot[] }) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 120,
      chunkDelay: 0,
      animate: true,
      animateAddingMarkers: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: createClusterIcon,
    });

    clusterRef.current = cluster;
    map.addLayer(cluster);

    return () => {
      map.removeLayer(cluster);
      clusterRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) {
      return;
    }

    scoreById.clear();
    const markers: L.Marker[] = [];

    for (const plot of plots) {
      scoreById.set(plot._id, plot.total_score);

      const marker = L.marker([plot.lat, plot.lon], {
        icon: getScoreIcon(plot.total_score),
        alt: plot._id,
        keyboard: false,
      });
      marker.bindPopup(createPopupHtml(plot), {
        maxWidth: 290,
        className: 'plot-map-popup',
      });
      markers.push(marker);
    }

    cluster.clearLayers();
    window.requestAnimationFrame(() => {
      cluster.addLayers(markers);
    });
  }, [plots]);

  return null;
}

export default function PlotsMap() {
  const mapRef = useRef<L.Map | null>(null);
  const autoFitted = useRef(false);

  const mapQuery = useMapPlotsQuery();
  const { data, error: queryError, isPending, progress } = mapQuery;

  const [scoreMode, setScoreMode] = useState<ScoreMode>('all');

  const plots = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredPlots = useMemo(() => {
    if (plots.length === 0) {
      return [];
    }
    if (scoreMode === 'all') {
      return plots;
    }
    return plots.filter((plot) => matchesScoreMode(plot, scoreMode));
  }, [plots, scoreMode]);

  const stats = useMemo(() => {
    if (filteredPlots.length === 0) {
      return null;
    }

    const scores = filteredPlots.map((plot) => plot.total_score);
    return {
      avgScore: (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2),
      count: filteredPlots.length,
    };
  }, [filteredPlots]);

  const totalPages = progress.totalPages || data?.pages || 1;
  const loadedPages = progress.loadedPages || data?.loadedPages || 0;
  const totalPlots = progress.total || data?.total || 0;
  const isInitialLoading = isPending && plots.length === 0;
  const error = queryError ? getErrorMessage(queryError) : '';
  const hasActiveFilters = scoreMode !== 'all';
  const progressRatio = totalPages > 0 ? Math.min(1, loadedPages / totalPages) : 0;

  useEffect(() => {
    autoFitted.current = false;
  }, [data?.total]);

  useEffect(() => {
    if (!mapRef.current || filteredPlots.length === 0 || autoFitted.current) {
      return;
    }

    fitMapToPlots(mapRef.current, filteredPlots, false);
    autoFitted.current = true;
  }, [filteredPlots]);

  const bindMap = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  const handleFitToVisible = useCallback(() => {
    if (!mapRef.current || filteredPlots.length === 0) {
      return;
    }
    fitMapToPlots(mapRef.current, filteredPlots, true);
  }, [filteredPlots]);

  const handleMoveToCenter = useCallback(() => {
    if (!mapRef.current) {
      return;
    }
    mapRef.current.flyTo(SPB_CENTER, 10, { duration: MOTION_DURATION_S });
  }, []);

  const resetFilters = useCallback(() => {
    setScoreMode('all');
  }, []);

  return (
    <div className="animate-fade-in map-page-shell">
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <PageHeader
          title="Карта участков"
          className="min-w-0"
          titleClassName="mb-1"
        />

        {stats && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={MOTION_TRANSITION}
          >
            <span
              className="map-stat-chip"
              style={{
                background: 'var(--c-accent-dim)',
                color: 'var(--c-accent)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {stats.count}
              {totalPlots > 0 ? ` / ${totalPlots}` : ''} участков
              {loadedPages > 0 && totalPages > 1 && (
                <span style={{ color: 'var(--c-text-dim)', marginLeft: '4px' }}>
                  (стр. {loadedPages}/{totalPages}{progress.fromCache ? ', cache' : ''})
                </span>
              )}
            </span>
            <span
              className="map-stat-chip"
              style={{
                background: 'var(--c-green-dim)',
                color: 'var(--c-green)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              avg score {stats.avgScore}
            </span>
          </motion.div>
        )}
      </div>

      <motion.div
        className="map-toolbar mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TRANSITION, delay: MOTION_DURATION_S / 8 }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {SCORE_MODES.map((mode) => {
              const active = scoreMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setScoreMode(mode.id)}
                  className={cn('map-filter-chip', active && 'active')}
                  title={mode.helper}
                >
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="map-tool-button"
              onClick={handleFitToVisible}
              disabled={filteredPlots.length === 0}
            >
              <Radar size={14} />
              <span>Подогнать вид</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="map-tool-button"
              onClick={handleMoveToCenter}
            >
              <LocateFixed size={14} />
              <span>К центру</span>
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="map-tool-button" onClick={resetFilters}>
                Сбросить
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {isPending && totalPages > 0 && (
            <motion.div
              className="map-progress-track"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
                transition={MOTION_TRANSITION}
            >
              <motion.div
                className="map-progress-value"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(8, progressRatio * 100)}%` }}
                  transition={MOTION_TRANSITION}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div
        className="flex gap-4 mb-4 text-xs flex-wrap"
        style={{ color: 'var(--c-text-dim)', fontFamily: 'var(--font-mono)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#59c0aa' }} />
          <span>score &gt;= 70</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#d9ba63' }} />
          <span>score 40-69</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: '#d86d74' }} />
          <span>score &lt; 40</span>
        </span>
      </div>

      {isInitialLoading && (
        <motion.p
          className="text-center py-20"
          style={{ color: 'var(--c-text-dim)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Загружаем карту ({loadedPages}/{totalPages})...
        </motion.p>
      )}

      {error && (
        <p className="text-center py-20" style={{ color: 'var(--c-red)' }}>
          {error}
        </p>
      )}

      {!isInitialLoading && !error && filteredPlots.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden shadow-2xl map-shell"
          style={{ border: '1px solid var(--c-border)', height: 'calc(100vh - 280px)', minHeight: '500px' }}
        >
          <MapContainer
            center={SPB_CENTER}
            zoom={9}
            preferCanvas
            zoomAnimation
            fadeAnimation
              markerZoomAnimation
            zoomAnimationThreshold={4}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <MapHandleBridge onReady={bindMap} />
            <FastClusterLayer plots={filteredPlots} />
          </MapContainer>
        </div>
      )}

      {!isInitialLoading && !error && plots.length > 0 && filteredPlots.length === 0 && (
        <p className="text-center py-12" style={{ color: 'var(--c-text-dim)' }}>
          Ничего не найдено по текущим фильтрам
        </p>
      )}

      {!isInitialLoading && !error && plots.length === 0 && (
        <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>
          На карте пока нет данных
        </p>
      )}
    </div>
  );
}
