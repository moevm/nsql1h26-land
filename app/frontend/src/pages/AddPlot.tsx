import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage, formatPrice } from '../utils';
import { buildPlotPayload, type PlotFormState } from '../plotPayload';
import { useCreatePlotMutation } from '../features/plots/hooks';
import { plotFormSchema } from '../features/forms/schemas';
import { PLOT_FORM_DEFAULT_VALUES } from '../features/forms/plotFormDefaults';
import { AlertMessage } from '../components/AlertMessage';
import { CoordinateBadge } from '../components/CoordinateBadge';
import { PageHeader } from '../components/PageHeader';
import { PlotMapPicker } from '../components/PlotMapPicker';
import { SectionTitle } from '../components/SectionTitle';
import { Button, FieldError, FieldLabel, Input, Surface, Textarea } from '../components/ui';

export default function AddPlot() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const createMutation = useCreatePlotMutation({
    onSuccess: (created) => {
      navigate(`/plots/${created._id}`);
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PlotFormState>({
    resolver: zodResolver(plotFormSchema),
    defaultValues: PLOT_FORM_DEFAULT_VALUES,
  });

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const priceValue = watch('price');
  const areaValue = watch('area_sotki');

  const handleMapClick = useCallback((newLat: number, newLon: number) => {
    setLat(newLat);
    setLon(newLon);
  }, []);

  async function onSubmit(values: PlotFormState) {
    setError('');

    if (lat === null || lon === null) {
      setError('Укажите точку на карте');
      return;
    }

    try {
      const data = buildPlotPayload(values, lat, lon);
      await createMutation.mutateAsync(data);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <PageHeader title="Новый участок" />

      <AlertMessage message={error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Surface className="overflow-hidden p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Местоположение *</SectionTitle>
            <CoordinateBadge lat={lat} lon={lon} />
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--c-text-dim)' }}>
            Кликните на карту, чтобы указать точку расположения участка
          </p>
          <PlotMapPicker lat={lat} lon={lon} onChange={handleMapClick} />
        </Surface>

        <Surface className="p-5 space-y-4">
          <SectionTitle>Основная информация</SectionTitle>

          <div>
            <FieldLabel htmlFor="add-title">Заголовок *</FieldLabel>
            <Input id="add-title" {...register('title')} placeholder="Земельный участок 10 соток, ИЖС" />
            <FieldError message={errors.title?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="add-description">Описание *</FieldLabel>
            <Textarea
              id="add-description"
              {...register('description')}
              rows={5}
              placeholder="Опишите участок: коммуникации, особенности, окружение..."
            />
            <FieldError message={errors.description?.message} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="add-price">Цена (₽) *</FieldLabel>
              <Input id="add-price" type="number" step="10000" min="0" placeholder="1 500 000" {...register('price')} />
              <FieldError message={errors.price?.message} />
              {priceValue && Number(priceValue) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>{formatPrice(Number(priceValue))}</p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="add-area">Площадь (сотки) *</FieldLabel>
              <Input id="add-area" type="number" step="0.5" min="0" placeholder="10" {...register('area_sotki')} />
              <FieldError message={errors.area_sotki?.message} />
              {priceValue && areaValue && Number(areaValue) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>≈ {formatPrice(Number(priceValue) / Number(areaValue))}/сот.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="add-location">Район *</FieldLabel>
              <Input id="add-location" {...register('location')} />
              <FieldError message={errors.location?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="add-address">Адрес *</FieldLabel>
              <Input id="add-address" {...register('address')} />
              <FieldError message={errors.address?.message} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="add-geo-ref">Гео-описание *</FieldLabel>
            <Input
              id="add-geo-ref"
              {...register('geo_ref')}
              placeholder="д. Низино, СНТ Сад-2"
            />
            <FieldError message={errors.geo_ref?.message} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="add-url">URL объявления</FieldLabel>
              <Input id="add-url" {...register('url')} />
              <FieldError message={errors.url?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="add-thumbnail">URL изображения</FieldLabel>
              <Input id="add-thumbnail" {...register('thumbnail')} />
              <FieldError message={errors.thumbnail?.message} />
            </div>
          </div>
        </Surface>

        <div className="pt-2">
          <Button type="submit" disabled={createMutation.isPending} className="w-full py-4 text-base">
            {createMutation.isPending ? 'Добавление...' : 'Добавить участок'}
          </Button>
        </div>
      </form>
    </div>
  );
}
