import { z } from 'zod';

function optionalBoundedNumber(max: number, maxMessage: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        if (value === '') return true;
        const n = Number(value);
        return !Number.isNaN(n) && Number.isFinite(n) && n >= 0 && n <= max;
      },
      maxMessage,
    );
}

function requiredPositiveNumber(max: number, message: string) {
  return z
    .string()
    .trim()
    .min(1, 'Обязательное поле')
    .refine((value) => {
      const n = Number(value);
      return !Number.isNaN(n) && n > 0 && n <= max;
    }, message);
}

function optionalHttpUrlWithMax(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Максимум ${max} символов`)
    .refine(
      (value) => value === '' || /^https?:\/\//i.test(value),
      'Укажите URL, начинающийся с http:// или https://',
    );
}

export const authFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Минимум 3 символа')
    .max(20, 'Максимум 20 символов'),
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
    .max(100, 'Максимум 100 символов'),
  description: z
    .string()
    .trim()
    .min(10, 'Минимум 10 символов')
    .max(80_000, 'Максимум 80 000 символов'),
  price: requiredPositiveNumber(10_000_000_000, 'Цена должна быть > 0 и ≤ 10 000 000 000'),
  area_sotki: requiredPositiveNumber(100_000, 'Площадь должна быть > 0 и ≤ 100 000 соток'),
  location: z
    .string()
    .trim()
    .min(2, 'Минимум 2 символа')
    .max(50, 'Максимум 50 символов'),
  address: z
    .string()
    .trim()
    .min(5, 'Минимум 5 символов')
    .max(2_500, 'Максимум 2500 символов'),
  geo_ref: z
    .string()
    .trim()
    .min(2, 'Минимум 2 символа')
    .max(150, 'Максимум 150 символов'),
  url: optionalHttpUrlWithMax(200),
  thumbnail: optionalHttpUrlWithMax(300),
});

export type PlotFormValues = z.infer<typeof plotFormSchema>;

const PRICE_MAX = 10_000_000_000;
const AREA_MAX = 100_000;
const PRICE_PER_SOTKA_MAX = 1_000_000_000;

export const filterFormSchema = z
  .object({
    min_price: optionalBoundedNumber(PRICE_MAX, 'От 0 до 10 000 000 000 ₽'),
    max_price: optionalBoundedNumber(PRICE_MAX, 'От 0 до 10 000 000 000 ₽'),
    min_area: optionalBoundedNumber(AREA_MAX, 'От 0 до 100 000 соток'),
    max_area: optionalBoundedNumber(AREA_MAX, 'От 0 до 100 000 соток'),
    min_price_per_sotka: optionalBoundedNumber(PRICE_PER_SOTKA_MAX, 'От 0 до 1 000 000 000 ₽'),
    max_price_per_sotka: optionalBoundedNumber(PRICE_PER_SOTKA_MAX, 'От 0 до 1 000 000 000 ₽'),
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