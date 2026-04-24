import { z } from 'zod';

const latitude = z.number().gte(-90).lte(90);
const longitude = z.number().gte(-180).lte(180);

export const plotImportRecordSchema = z
  .object({
    title: z.string().max(200).optional(),
    description: z.string().max(80_000).optional(),
    price: z.number().nonnegative().max(10_000_000_000).optional(),
    area_sotki: z.number().positive().max(100_000).optional(),
    location: z.string().max(120).optional(),
    address: z.string().max(2_500).optional(),
    geo_ref: z.string().max(200).optional(),
    lat: latitude.optional(),
    lon: longitude.optional(),
    lng: longitude.optional(),
    url: z.string().max(500).optional(),
    thumbnail: z.string().max(500).optional(),
    avito_id: z.union([z.number(), z.string()]).optional(),
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
