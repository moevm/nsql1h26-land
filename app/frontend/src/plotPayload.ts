import type { PlotCreatePayload } from './api';
import type { PlotFormValues } from './features/forms/schemas';

export type PlotFormState = PlotFormValues;

export function buildPlotPayload(form: PlotFormState, lat: number, lon: number): PlotCreatePayload {
  return {
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
}
