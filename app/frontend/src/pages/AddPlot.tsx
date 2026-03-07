import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createPlot } from '../api';
import { SPB_CENTER, getErrorMessage } from '../utils';
import { invalidateCache } from '../cache';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom gold marker
const goldIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: 'hue-rotate-[30deg] brightness-125',
});

function MapPicker({ lat, lon, onChange }: { readonly lat: number | null; readonly lon: number | null; readonly onChange: (lat: number, lon: number) => void }) {
  function ClickHandler() {
    useMapEvents({
      click(e) {
        onChange(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  return (
    <MapContainer
      center={lat && lon ? [lat, lon] : SPB_CENTER}
      zoom={10}
      style={{ height: '360px', width: '100%', borderRadius: '12px' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ClickHandler />
      {lat && lon && <Marker position={[lat, lon]} icon={goldIcon} />}
    </MapContainer>
  );
}

export default function AddPlot() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    area_sotki: '',
    location: '',
    address: '',
    geo_ref: '',
    url: '',
    thumbnail: '',
  });

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const handleMapClick = useCallback((newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (lat === null || lon === null) {
      setError('Укажите точку на карте');
      return;
    }

    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: Number(form.price) || 0,
        area_sotki: form.area_sotki ? Number(form.area_sotki) : null,
        location: form.location,
        address: form.address,
        geo_ref: form.geo_ref,
        lat,
        lon,
        url: form.url,
        thumbnail: form.thumbnail,
      };
      const created = await createPlot(data);
      invalidateCache('plots');
      invalidateCache('map-plots');
      navigate(`/plots/${created._id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
      >
        Новый участок
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
        Добавьте объявление — система автоматически рассчитает расстояния и характеристики
      </p>

      {error && (
        <div
          className="px-4 py-3 rounded-xl mb-5 text-sm"
          style={{ background: 'var(--c-red-dim)', color: 'var(--c-red)', border: '1px solid var(--c-red)' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Map picker */}
        <div
          className="rounded-xl overflow-hidden p-5"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-lg font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
            >
              Местоположение *
            </h2>
            {lat !== null && lon !== null && (
              <span
                className="text-xs px-3 py-1 rounded-lg"
                style={{
                  background: 'var(--c-green-dim)',
                  color: 'var(--c-green)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {lat.toFixed(6)}, {lon.toFixed(6)}
              </span>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--c-text-dim)' }}>
            Кликните на карту, чтобы указать точку расположения участка
          </p>
          <MapPicker lat={lat} lon={lon} onChange={handleMapClick} />
        </div>

        {/* Main info */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
          >
            Основная информация
          </h2>

          <div>
            <label htmlFor="add-title" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Заголовок *
            </label>
            <input id="add-title" name="title" value={form.title} onChange={onChange} required className="input-field" />
          </div>

          <div>
            <label htmlFor="add-description" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Описание
            </label>
            <textarea
              id="add-description"
              name="description"
              value={form.description}
              onChange={onChange}
              rows={5}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-price" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Цена (₽)
              </label>
              <input id="add-price" name="price" type="number" value={form.price} onChange={onChange} className="input-field" />
            </div>
            <div>
              <label htmlFor="add-area" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Площадь (сотки)
              </label>
              <input id="add-area" name="area_sotki" type="number" step="0.1" value={form.area_sotki} onChange={onChange} className="input-field" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-location" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Район
              </label>
              <input id="add-location" name="location" value={form.location} onChange={onChange} className="input-field" />
            </div>
            <div>
              <label htmlFor="add-address" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Адрес
              </label>
              <input id="add-address" name="address" value={form.address} onChange={onChange} className="input-field" />
            </div>
          </div>

          <div>
            <label htmlFor="add-geo-ref" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Гео-описание
            </label>
            <input
              id="add-geo-ref"
              name="geo_ref"
              value={form.geo_ref}
              onChange={onChange}
              className="input-field"
              placeholder="д. Низино, СНТ Сад-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-url" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                URL объявления
              </label>
              <input id="add-url" name="url" value={form.url} onChange={onChange} className="input-field" />
            </div>
            <div>
              <label htmlFor="add-thumbnail" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                URL изображения
              </label>
              <input id="add-thumbnail" name="thumbnail" value={form.thumbnail} onChange={onChange} className="input-field" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
            {loading ? 'Добавление... (расчёт фич и расстояний)' : 'Добавить участок'}
          </button>
          <p className="text-xs mt-3 text-center" style={{ color: 'var(--c-text-dim)' }}>
            При добавлении автоматически рассчитываются текстовые фичи, эмбеддинги и расстояния до инфраструктуры
          </p>
        </div>
      </form>
    </div>
  );
}
