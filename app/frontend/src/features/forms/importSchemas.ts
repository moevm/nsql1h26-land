import { z } from 'zod';

const latitude = z.number().gte(-90).lte(90);
const longitude = z.number().gte(-180).lte(180);

export const plotImportRecordSchema = z
  .object({
    title: z.string().nullish(),
    description: z.string().nullish(),
    price: z.number().nullish(),
    area_sotki: z.number().nullish(),
    location: z.string().nullish(),
    address: z.string().nullish(),
    geo_ref: z.string().nullish(),
    lat: latitude.nullish(),
    lon: longitude.nullish(),
    lng: longitude.nullish(),
    url: z.string().nullish(),
    thumbnail: z.string().nullish(),
    avito_id: z.union([z.number(), z.string()]).nullish(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const hasLat = typeof value.lat === 'number';
    const hasLon = typeof value.lon === 'number' || typeof value.lng === 'number';
    if (!hasLat || !hasLon) {
      ctx.addIssue({
        code: 'custom',
        message: 'В записи должны быть числовые lat и lon (или lng)',
      });
    }
  });

export const plotsImportPayloadSchema = z.array(plotImportRecordSchema).min(1, 'Файл не содержит записей');

export const infraRecordSchema = z.object({
  name: z.string().trim().min(1, 'name обязателен').max(80, 'name до 80 символов'),
  lat: latitude,
  lon: longitude,
  type: z.string().max(20).optional(),
});

export const infraImportPayloadSchema = z
  .record(
    z.string().regex(/^[a-z_]+$/, 'ключ коллекции латиницей (snake_case)'),
    z.array(infraRecordSchema),
  )
  .refine(
    (record) => Object.keys(record).length > 0,
    'JSON должен содержать хотя бы одну коллекцию',
  );

const INFRA_COLLECTION_KEYS = [
  'metro_stations',
  'hospitals',
  'schools',
  'kindergartens',
  'stores',
  'pickup_points',
  'bus_stops',
  'negative_objects',
] as const;

export function splitCombinedImport(input: unknown): {
  plots: unknown[];
  infra: Record<string, unknown[]>;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Ожидается объект с ключами plots и/или инфраструктурными коллекциями');
  }
  const obj = input as Record<string, unknown>;
  const plots = Array.isArray(obj.plots)
    ? obj.plots
    : Array.isArray(obj.data)
      ? obj.data
      : [];
  const infra: Record<string, unknown[]> = {};
  for (const key of INFRA_COLLECTION_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) infra[key] = value;
  }
  if (!plots.length && Object.keys(infra).length === 0) {
    throw new Error('Файл не содержит ни plots, ни коллекций инфраструктуры');
  }
  return { plots, infra };
}
export function extractPlotsArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (Array.isArray(obj.plots)) return obj.plots;
    if (Array.isArray(obj.data)) return obj.data;
  }
  throw new Error('Неверный формат файла: ожидается массив или объект с ключом "plots"/"data"');
}
export function formatZodError(err: z.ZodError): string {
  const issues = err.issues.slice(0, 5).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(корень)';
    return `${path}: ${issue.message}`;
  });
  const tail = err.issues.length > 5 ? ` …и ещё ${err.issues.length - 5}` : '';
  return `Ошибка валидации — ${issues.join('; ')}${tail}`;
}
