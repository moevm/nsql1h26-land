import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { getErrorMessage, formatPrice } from '../utils';
import { buildPlotPayload, type PlotFormState } from '../plotPayload';
import { useCreatePlotMutation } from '../features/plots/hooks';
import { uploadImage } from '../api';
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
    setValue,
    formState: { errors },
  } = useForm<PlotFormState>({
    resolver: zodResolver(plotFormSchema),
    defaultValues: PLOT_FORM_DEFAULT_VALUES,
  });

  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const thumbnailValue = watch('thumbnail');

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setValue('thumbnail', url, { shouldValidate: true, shouldDirty: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (imgInput.current) imgInput.current.value = '';
    }
  }

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
              <Input id="add-price" type="number" min="0" max="10000000000" placeholder="1 500 000" {...register('price')} />
              <FieldError message={errors.price?.message} />
              {priceValue && Number(priceValue) > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--c-accent)', fontFamily: 'var(--font-mono)' }}>{formatPrice(Number(priceValue))}</p>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="add-area">Площадь (сотки) *</FieldLabel>
              <Input id="add-area" type="number" min="0" max="100000" placeholder="10" {...register('area_sotki')} />
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
            <FieldLabel htmlFor="add-geo-ref">Гео-описание</FieldLabel>
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
              <FieldLabel htmlFor="add-thumbnail">Изображение</FieldLabel>
              <Input id="add-thumbnail" {...register('thumbnail')} placeholder="URL или загрузите файл" />
              <div className="flex items-center gap-2 mt-2">
                <input
                  ref={imgInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  type="button"
                  onClick={() => imgInput.current?.click()}
                  disabled={uploading}
                  variant="ghost"
                  size="sm"
                >
                  <Upload size={13} className="inline-block mr-1" />
                  {uploading ? 'Загрузка...' : 'Загрузить файл'}
                </Button>
                {thumbnailValue && (
                  <img
                    src={thumbnailValue}
                    alt=""
                    className="h-10 w-10 object-cover rounded"
                  />
                )}
              </div>
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
