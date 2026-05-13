import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type Plot } from '../api';
import { SPB_CENTER, getErrorMessage, formatPrice } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { buildPlotPayload, type PlotFormState } from '../plotPayload';
import { usePlotQuery, useUpdatePlotMutation } from '../features/plots/hooks';
import { PLOT_FORM_DEFAULT_VALUES, toPlotFormState } from '../features/forms/plotFormDefaults';
import { plotFormSchema } from '../features/forms/schemas';
import { AlertMessage } from '../components/AlertMessage';
import { CoordinateBadge } from '../components/CoordinateBadge';
import { PageHeader } from '../components/PageHeader';
import { PlotMapPicker } from '../components/PlotMapPicker';
import { SectionTitle } from '../components/SectionTitle';
import { Button, FieldError, FieldLabel, Input, Surface, Textarea } from '../components/ui';

export default function EditPlot() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [plot, setPlot] = useState<Plot | null>(null);
  const [error, setError] = useState('');

  const plotQuery = usePlotQuery(id ?? '');
  const updateMutation = useUpdatePlotMutation(id ?? '', {
    onSuccess: () => {
      if (id) {
        navigate(`/plots/${id}`);
      }
    },
  });

  const loading = plotQuery.isLoading;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PlotFormState>({
    resolver: zodResolver(plotFormSchema),
    defaultValues: PLOT_FORM_DEFAULT_VALUES,
  });
  const [lat, setLat] = useState(SPB_CENTER[0]);
  const [lon, setLon] = useState(SPB_CENTER[1]);

  const priceValue = watch('price');
  const areaValue = watch('area_sotki');

  useEffect(() => {
    const p = plotQuery.data;
    if (!p) return;
    setPlot(p);
    reset(toPlotFormState(p));
    if (p.lat && p.lon) {
      setLat(p.lat);
      setLon(p.lon);
    }
  }, [plotQuery.data, reset]);

  useEffect(() => {
    if (plotQuery.error) {
      setError(getErrorMessage(plotQuery.error));
    }
    if (!loading && plot && user) {
      const canEdit = isAdmin || plot.owner_id === user._id;
      if (!canEdit) {
        setError('У вас нет прав для редактирования этого объявления');
      }
    }
  }, [loading, plot, user, isAdmin, plotQuery.error]);

  const handleMapClick = useCallback((newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  }, []);

  async function onSubmit(values: PlotFormState) {
    if (!id) return;
    setError('');
    try {
      const data = buildPlotPayload(values, lat, lon);
      await updateMutation.mutateAsync(data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) return <p className="text-center py-16" style={{ color: 'var(--c-text-dim)' }}>Загрузка...</p>;
  if (error && !plot) return <p className="text-center py-16" style={{ color: 'var(--c-red)' }}>{error}</p>;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <PageHeader
        title="Редактирование"
        subtitle="При сохранении система пересчитает характеристики и расстояния"
      />

      <AlertMessage message={error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Surface className="overflow-hidden p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Местоположение</SectionTitle>
            <CoordinateBadge lat={lat} lon={lon} />
          </div>
          <PlotMapPicker lat={lat} lon={lon} onChange={handleMapClick} zoom={12} height="300px" />
        </Surface>

        <Surface className="p-5 space-y-4">
          <SectionTitle>Основная информация</SectionTitle>
          <div>
            <FieldLabel htmlFor="edit-title">Заголовок *</FieldLabel>
            <Input id="edit-title" {...register('title')} placeholder="Земельный участок 10 соток, ИЖС" />
            <FieldError message={errors.title?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="edit-description">Описание *</FieldLabel>
            <Textarea id="edit-description" {...register('description')} rows={5} placeholder="Опишите участок: коммуникации, особенности, окружение..." />
            <FieldError message={errors.description?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="edit-price">Цена (₽) *</FieldLabel>
              <Input id="edit-price" type="number" step="10000" min="0" placeholder="1 500 000" {...register('price')} />
              <FieldError message={errors.price?.message} />
              {priceValue && Number(priceValue) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>{formatPrice(Number(priceValue))}</p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="edit-area">Площадь (сотки) *</FieldLabel>
              <Input id="edit-area" type="number" step="0.5" min="0" placeholder="10" {...register('area_sotki')} />
              <FieldError message={errors.area_sotki?.message} />
              {priceValue && areaValue && Number(areaValue) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>≈ {formatPrice(Number(priceValue) / Number(areaValue))}/сот.</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="edit-location">Район *</FieldLabel>
              <Input id="edit-location" {...register('location')} />
              <FieldError message={errors.location?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="edit-address">Адрес *</FieldLabel>
              <Input id="edit-address" {...register('address')} />
              <FieldError message={errors.address?.message} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="edit-geo-ref">Гео-описание *</FieldLabel>
            <Input id="edit-geo-ref" {...register('geo_ref')} />
            <FieldError message={errors.geo_ref?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="edit-url">URL объявления</FieldLabel>
              <Input id="edit-url" {...register('url')} />
              <FieldError message={errors.url?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="edit-thumbnail">URL изображения</FieldLabel>
              <Input id="edit-thumbnail" {...register('thumbnail')} />
              <FieldError message={errors.thumbnail?.message} />
            </div>
          </div>
        </Surface>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={updateMutation.isPending} className="flex-1 py-3">
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </Button>
          <Button type="button" onClick={() => navigate(-1)} variant="ghost" className="px-6">
            Отмена
          </Button>
        </div>
      </form>
    </div>
  );
}
