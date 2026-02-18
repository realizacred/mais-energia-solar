import { useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 13);
  }, [lat, lon, map]);
  return null;
}

interface LeafletMapProps {
  lat: number | null;
  lon: number | null;
  cidade?: string;
  estado?: string;
  onMapClick: (lat: number, lon: number) => void;
}

export default function LeafletMap({ lat, lon, cidade, estado, onMapClick }: LeafletMapProps) {
  return (
    <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px]">
      <MapContainer
        center={[lat ?? -15.78, lon ?? -47.93]}
        zoom={lat ? 13 : 5}
        className="w-full h-full min-h-[280px] sm:min-h-[360px]"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onClick={onMapClick} />
        {lat !== null && lon !== null && (
          <>
            <Marker position={[lat, lon]} />
            <MapRecenter lat={lat} lon={lon} />
          </>
        )}
      </MapContainer>
      {cidade && estado && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md border border-border/50 z-[1000]">
          <p className="text-xs sm:text-sm font-semibold">{cidade}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{estado}, Brasil</p>
        </div>
      )}
      <p className="absolute bottom-2 right-2 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded z-[1000]">
        Clique no mapa para alterar coordenadas
      </p>
    </div>
  );
}
