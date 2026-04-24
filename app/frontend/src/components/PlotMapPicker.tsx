import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

import { configureLeafletDefaultMarker, goldMarkerIcon } from '../leafletSetup';
import { SPB_CENTER } from '../utils';

import 'leaflet/dist/leaflet.css';

configureLeafletDefaultMarker();

type PlotMapPickerProps = {
  readonly lat: number | null;
  readonly lon: number | null;
  readonly onChange: (lat: number, lon: number) => void;
  readonly zoom?: number;
  readonly height?: string;
};

function ClickHandler({ onChange }: { readonly onChange: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function PlotMapPicker({
  lat,
  lon,
  onChange,
  zoom = 10,
  height = '360px',
}: Readonly<PlotMapPickerProps>) {
  const hasCoordinates = lat !== null && lon !== null;
  const center: [number, number] = hasCoordinates ? [lat, lon] : SPB_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', borderRadius: '12px' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <ClickHandler onChange={onChange} />
      {hasCoordinates && <Marker position={[lat, lon]} icon={goldMarkerIcon} />}
    </MapContainer>
  );
}
