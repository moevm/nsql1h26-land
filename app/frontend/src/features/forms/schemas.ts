import { z } from 'zod';

const optionalNonNegativeNumber = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0),
    'Введите число >= 0',
  );

const optionalHttpUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^https?:\/\//i.test(value),
    'Укажите URL, начинающийся с http:// или https://',
  );

export const authFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа')
    .max(64, 'Максимум 64 символа'),
  password: z
    .string()
    .min(4, 'Минимум 4 символа')
    .max(128, 'Максимум 128 символов'),
});

export type AuthFormValues = z.infer<typeof authFormSchema>;

export const plotFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа')
    .max(180, 'Максимум 180 символов'),
  description: z.string().trim(),
  price: optionalNonNegativeNumber,
  area_sotki: optionalNonNegativeNumber,
  location: z.string().trim(),
  address: z.string().trim(),
  geo_ref: z.string().trim(),
  url: optionalHttpUrl,
  thumbnail: optionalHttpUrl,
});

export type PlotFormValues = z.infer<typeof plotFormSchema>;

const optionalScoreNumber = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (!Number.isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 1),
    'Введите число от 0 до 1',
  );

export const filterFormSchema = z
  .object({
    min_price: optionalNonNegativeNumber,
    max_price: optionalNonNegativeNumber,
    min_area: optionalNonNegativeNumber,
    max_area: optionalNonNegativeNumber,
    min_price_per_sotka: optionalNonNegativeNumber,
    max_price_per_sotka: optionalNonNegativeNumber,
    min_score: optionalScoreNumber,
    min_infra: optionalScoreNumber,
    min_feature: optionalScoreNumber,
    location: z.string().trim().max(120, 'Максимум 120 символов'),
  })
  .superRefine((value, ctx) => {
    const rangeRules: Array<{
      minKey: 'min_price' | 'min_area' | 'min_price_per_sotka';
      maxKey: 'max_price' | 'max_area' | 'max_price_per_sotka';
      label: string;
    }> = [
      { minKey: 'min_price', maxKey: 'max_price', label: 'цены' },
      { minKey: 'min_area', maxKey: 'max_area', label: 'площади' },
      { minKey: 'min_price_per_sotka', maxKey: 'max_price_per_sotka', label: 'цены за сотку' },
    ];

    for (const rule of rangeRules) {
      const minRaw = value[rule.minKey];
      const maxRaw = value[rule.maxKey];
      if (minRaw === '' || maxRaw === '') continue;

      if (Number(minRaw) > Number(maxRaw)) {
        ctx.addIssue({
          code: 'custom',
          path: [rule.maxKey],
          message: `Верхняя граница ${rule.label} должна быть больше или равна нижней`,
        });
      }
    }
  });

export type FilterFormValues = z.infer<typeof filterFormSchema>;