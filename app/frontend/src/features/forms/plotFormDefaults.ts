import type { Plot } from '../../api';
import type { PlotFormState } from '../../plotPayload';

export const PLOT_FORM_DEFAULT_VALUES: PlotFormState = {
  title: '',
  description: '',
  price: '',
  area_sotki: '',
  location: '',
  address: '',
  geo_ref: '',
  url: '',
  thumbnail: '',
};

export function toPlotFormState(plot: Plot): PlotFormState {
  return {
    title: plot.title || '',
    description: plot.description || '',
    price: plot.price ? String(plot.price) : '',
    area_sotki: plot.area_sotki ? String(plot.area_sotki) : '',
    location: plot.location || '',
    address: plot.address || '',
    geo_ref: plot.geo_ref || '',
    url: plot.url || '',
    thumbnail: plot.thumbnail || '',
  };
}
