import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPlot, updatePlot, type Plot } from '../api';
import { SPB_CENTER, getErrorMessage, formatPrice } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { invalidateCache } from '../cache';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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

function MapPicker({ lat, lon, onChange }: { readonly lat: number; readonly lon: number; readonly onChange: (lat: number, lon: number) => void }) {
  function ClickHandler() {
    useMapEvents({ click(e) { onChange(e.latlng.lat, e.latlng.lng); } });
    return null;
  }
  return (
    <MapContainer center={[lat, lon]} zoom={12} style={{ height: '300px', width: '100%', borderRadius: '12px' }} className="z-0">
      <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <ClickHandler />
      <Marker position={[lat, lon]} icon={goldIcon} />
    </MapContainer>
  );
}

export default function EditPlot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [plot, setPlot] = useState<Plot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '', description: '', price: '', area_sotki: '',
    location: '', address: '', geo_ref: '', url: '', thumbnail: '',
  });
  const [lat, setLat] = useState(SPB_CENTER[0]);
  const [lon, setLon] = useState(SPB_CENTER[1]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchPlot(id, controller.signal)
      .then((p) => {
        setPlot(p);
        setForm({
          title: p.title || '',
          description: p.description || '',
          price: p.price ? String(p.price) : '',
          area_sotki: p.area_sotki ? String(p.area_sotki) : '',
          location: p.location || '',
          address: p.address || '',
          geo_ref: p.geo_ref || '',
          url: p.url || '',
          thumbnail: p.thumbnail || '',
        });
        if (p.lat && p.lon) { setLat(p.lat); setLon(p.lon); }
      })
      .catch((e) => { if (!controller.signal.aborted) setError(getErrorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  // Permission check
  useEffect(() => {
    if (!loading && plot && user) {
      const canEdit = isAdmin || plot.owner_id === user._id;
      if (!canEdit) {
        setError('У вас нет прав для редактирования этого объявления');
      }
    }
  }, [loading, plot, user, isAdmin]);

  const handleMapClick = useCallback((newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price: Number(form.price) || 0,
        area_sotki: form.area_sotki ? Number(form.area_sotki) : null,
        location: form.location,
        address: form.address,
        geo_ref: form.geo_ref,
        lat, lon,
        url: form.url,
        thumbnail: form.thumbnail,
      };
      await updatePlot(id, data);
      invalidateCache('plots');
      invalidateCache('plot:');
      invalidateCache('map-plots');
      navigate(`/plots/${id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Загрузка...</p>;
  if (!user) return <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>Необходимо войти в систему</p>;
  if (error && !plot) return <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}
      >
        Редактирование
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--c-text-muted)' }}>
        При сохранении система пересчитает характеристики и расстояния
      </p>

      {error && (
        <div className="px-4 py-3 rounded-xl mb-5 text-sm"
          style={{ background: 'var(--c-red-dim)', color: 'var(--c-red)', border: '1px solid var(--c-red)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Map */}
        <div className="rounded-xl overflow-hidden p-5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}>
              Местоположение
            </h2>
            <span className="text-xs px-3 py-1 rounded-lg"
              style={{ background: 'var(--c-green-dim)', color: 'var(--c-green)', fontFamily: 'var(--font-mono)' }}>
              {lat.toFixed(6)}, {lon.toFixed(6)}
            </span>
          </div>
          <MapPicker lat={lat} lon={lon} onChange={handleMapClick} />
        </div>

        {/* Main fields */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--c-heading)' }}>
            Основная информация
          </h2>
          <div>
            <label htmlFor="edit-title" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Заголовок *</label>
            <input id="edit-title" name="title" value={form.title} onChange={onChange} required className="input-field" placeholder="Земельный участок 10 соток, ИЖС" />
          </div>
          <div>
            <label htmlFor="edit-description" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Описание</label>
            <textarea id="edit-description" name="description" value={form.description} onChange={onChange} rows={5} className="input-field" placeholder="Опишите участок: коммуникации, особенности, окружение..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-price" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Цена (₽)</label>
              <input id="edit-price" name="price" type="number" step="10000" min="0" placeholder="1 500 000" value={form.price} onChange={onChange} className="input-field" />
              {form.price && Number(form.price) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>{formatPrice(Number(form.price))}</p>
              )}
            </div>
            <div>
              <label htmlFor="edit-area" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Площадь (сотки)</label>
              <input id="edit-area" name="area_sotki" type="number" step="0.5" min="0" placeholder="10" value={form.area_sotki} onChange={onChange} className="input-field" />
              {form.price && form.area_sotki && Number(form.area_sotki) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>≈ {formatPrice(Number(form.price) / Number(form.area_sotki))}/сот.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-location" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Район</label>
              <input id="edit-location" name="location" value={form.location} onChange={onChange} className="input-field" />
            </div>
            <div>
              <label htmlFor="edit-address" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Адрес</label>
              <input id="edit-address" name="address" value={form.address} onChange={onChange} className="input-field" />
            </div>
          </div>
          <div>
            <label htmlFor="edit-geo-ref" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>Гео-описание</label>
            <input id="edit-geo-ref" name="geo_ref" value={form.geo_ref} onChange={onChange} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-url" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>URL объявления</label>
              <input id="edit-url" name="url" value={form.url} onChange={onChange} className="input-field" />
            </div>
            <div>
              <label htmlFor="edit-thumbnail" className="block text-xs mb-1.5 uppercase tracking-wide" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>URL изображения</label>
              <input id="edit-thumbnail" name="thumbnail" value={form.thumbnail} onChange={onChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1 py-3">
            {saving ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost px-6">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
