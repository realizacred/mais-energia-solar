/// <reference types="google.maps" />
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: typeof google;
  }
}

interface GoogleMapProps {
  lat: number | null;
  lon: number | null;
  cidade?: string;
  estado?: string;
  onMapClick: (lat: number, lon: number) => void;
}

export default function GoogleMapView({ lat, lon, cidade, estado, onMapClick }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps script
  useEffect(() => {
    if (window.google?.maps) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadScript = async () => {
      try {
        // Fetch key from integration_configs
        const { data } = await supabase
          .from("integration_configs")
          .select("api_key, is_active")
          .eq("service_key", "google_maps")
          .eq("is_active", true)
          .maybeSingle();

        if (cancelled) return;

        if (!data?.api_key) {
          setError("Google Maps não configurado");
          setLoading(false);
          return;
        }

        // Check if already loaded by another instance
        if (window.google?.maps) {
          setLoading(false);
          return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          existingScript.addEventListener("load", () => {
            if (!cancelled) setLoading(false);
          });
          return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.api_key}&libraries=marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => { if (!cancelled) setLoading(false); };
        script.onerror = () => { if (!cancelled) { setError("Falha ao carregar Google Maps"); setLoading(false); } };
        document.head.appendChild(script);
      } catch (err) {
        if (!cancelled) {
          setError("Erro ao buscar configuração do mapa");
          setLoading(false);
        }
      }
    };

    loadScript();
    return () => { cancelled = true; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (loading || error || !mapRef.current || !window.google?.maps) return;
    if (mapInstanceRef.current) return;

    const center = { lat: lat ?? -15.78, lng: lon ?? -47.93 };
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: lat ? 13 : 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      mapId: "proposal-map",
    });

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });

    mapInstanceRef.current = map;

    // Add marker if we have coords
    if (lat !== null && lon !== null) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng: lon },
      });
      markerRef.current = marker;
    }
  }, [loading, error, lat, lon, onMapClick]);

  // Update marker/center when coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (lat !== null && lon !== null) {
      const pos = { lat, lng: lon };
      map.setCenter(pos);
      map.setZoom(13);

      if (markerRef.current) {
        markerRef.current.position = pos;
      } else {
        markerRef.current = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: pos,
        });
      }
    }
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px] flex items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px] flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px]">
      <div ref={mapRef} className="w-full h-full min-h-[280px] sm:min-h-[360px]" />
      {cidade && estado && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md border border-border/50 z-10">
          <p className="text-xs sm:text-sm font-semibold">{cidade}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{estado}, Brasil</p>
        </div>
      )}
      <p className="absolute bottom-2 right-2 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded z-10">
        Clique no mapa para alterar coordenadas
      </p>
    </div>
  );
}
