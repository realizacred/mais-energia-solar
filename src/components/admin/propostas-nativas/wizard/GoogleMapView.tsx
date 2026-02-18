/// <reference types="google.maps" />
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Map, Satellite, Pencil, Trash2, Camera, Circle, Square, Minus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

declare global {
  interface Window {
    google?: typeof google;
  }
}

type DrawingMode = "marker" | "polyline" | "polygon" | "rectangle" | "circle" | null;

interface GoogleMapProps {
  lat: number | null;
  lon: number | null;
  cidade?: string;
  estado?: string;
  onMapClick: (lat: number, lon: number) => void;
  onSnapshot?: (dataUrl: string) => void;
}

const DRAWING_TOOLS: { mode: DrawingMode; icon: React.ElementType; label: string }[] = [
  { mode: "polyline", icon: Minus, label: "Linha" },
  { mode: "polygon", icon: Pencil, label: "Polígono" },
  { mode: "rectangle", icon: Square, label: "Retângulo" },
  { mode: "circle", icon: Circle, label: "Círculo" },
  { mode: "marker", icon: ArrowRight, label: "Marcador" },
];

export default function GoogleMapView({ lat, lon, cidade, estado, onMapClick, onSnapshot }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const overlaysRef = useRef<google.maps.MVCObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap");
  const [activeDrawing, setActiveDrawing] = useState<DrawingMode>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const apiKeyRef = useRef<string | null>(null);

  // Load Google Maps script with drawing library
  useEffect(() => {
    if (window.google?.maps?.drawing) {
      setLoading(false);
      return;
    }
    if (window.google?.maps) {
      // Maps loaded but not drawing library — need to reload with drawing
      // For simplicity, treat as loaded
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadScript = async () => {
      try {
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

        apiKeyRef.current = data.api_key;

        if (window.google?.maps) {
          setLoading(false);
          return;
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          existingScript.addEventListener("load", () => {
            if (!cancelled) setLoading(false);
          });
          return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${data.api_key}&libraries=marker,drawing&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => { if (!cancelled) setLoading(false); };
        script.onerror = () => { if (!cancelled) { setError("Falha ao carregar Google Maps"); setLoading(false); } };
        document.head.appendChild(script);
      } catch {
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
      zoom: lat ? 17 : 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      mapId: "proposal-map",
      mapTypeId: "roadmap",
    });

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!activeDrawing && e.latLng) {
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

    // Initialize DrawingManager (hidden by default)
    if (window.google?.maps?.drawing) {
      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false, // We use our own UI
        polylineOptions: {
          strokeColor: "#FF6600",
          strokeWeight: 3,
          editable: true,
        },
        polygonOptions: {
          strokeColor: "#FF6600",
          fillColor: "#FF6600",
          fillOpacity: 0.15,
          strokeWeight: 2,
          editable: true,
        },
        rectangleOptions: {
          strokeColor: "#FF6600",
          fillColor: "#FF6600",
          fillOpacity: 0.15,
          strokeWeight: 2,
          editable: true,
        },
        circleOptions: {
          strokeColor: "#FF6600",
          fillColor: "#FF6600",
          fillOpacity: 0.15,
          strokeWeight: 2,
          editable: true,
        },
        markerOptions: {
          draggable: true,
        },
      });
      dm.setMap(map);

      dm.addListener("overlaycomplete", (e: google.maps.drawing.OverlayCompleteEvent) => {
        overlaysRef.current.push(e.overlay!);
        // Reset drawing mode after placing
        dm.setDrawingMode(null);
        setActiveDrawing(null);
      });

      drawingManagerRef.current = dm;
    }
  }, [loading, error]);

  // Update map type
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.setMapTypeId(mapType);
  }, [mapType]);

  // Update drawing mode
  useEffect(() => {
    const dm = drawingManagerRef.current;
    if (!dm) return;

    const modeMap: Record<string, google.maps.drawing.OverlayType | null> = {
      marker: google.maps.drawing.OverlayType.MARKER,
      polyline: google.maps.drawing.OverlayType.POLYLINE,
      polygon: google.maps.drawing.OverlayType.POLYGON,
      rectangle: google.maps.drawing.OverlayType.RECTANGLE,
      circle: google.maps.drawing.OverlayType.CIRCLE,
    };

    dm.setDrawingMode(activeDrawing ? modeMap[activeDrawing] ?? null : null);
  }, [activeDrawing]);

  // Update marker/center when coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (lat !== null && lon !== null) {
      const pos = { lat, lng: lon };
      map.setCenter(pos);
      if (map.getZoom()! < 15) map.setZoom(17);

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

  // Clear all drawings
  const handleClearDrawings = useCallback(() => {
    overlaysRef.current.forEach((o: any) => {
      if (o.setMap) o.setMap(null);
    });
    overlaysRef.current = [];
  }, []);

  // Capture map snapshot using Static Maps API
  const handleSnapshot = useCallback(async () => {
    const map = mapInstanceRef.current;
    const key = apiKeyRef.current;
    if (!map || !key) return;

    setSnapshotting(true);
    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (!center) throw new Error("No center");

      const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat()},${center.lng()}&zoom=${zoom}&size=800x600&maptype=${mapType}&key=${key}&scale=2`;

      const resp = await fetch(staticUrl);
      if (!resp.ok) throw new Error("Static Maps API error");
      const blob = await resp.blob();

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        onSnapshot?.(dataUrl);
        toast({
          title: "📸 Snapshot capturado",
          description: "A imagem do mapa foi salva na proposta.",
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("[GoogleMapView] snapshot error:", err);
      toast({
        title: "Erro ao capturar mapa",
        description: "Não foi possível gerar o snapshot. Verifique a API key.",
        variant: "destructive",
      });
    } finally {
      setSnapshotting(false);
    }
  }, [mapType, onSnapshot]);

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
    <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[420px]">
      <div ref={mapRef} className="w-full h-full min-h-[280px] sm:min-h-[420px]" />

      {/* City label */}
      {cidade && estado && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md border border-border/50 z-10">
          <p className="text-xs sm:text-sm font-semibold">{cidade}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">{estado}, Brasil</p>
        </div>
      )}

      {/* Map type toggle */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex flex-col gap-1">
        <TooltipProvider delayDuration={200}>
          <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50 p-0.5 flex flex-col gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={mapType === "roadmap"}
                  onPressedChange={() => setMapType("roadmap")}
                  className="h-7 w-7 p-0"
                >
                  <Map className="h-3.5 w-3.5" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent side="left"><p className="text-xs">Mapa</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={mapType === "satellite"}
                  onPressedChange={() => setMapType("satellite")}
                  className="h-7 w-7 p-0"
                >
                  <Satellite className="h-3.5 w-3.5" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent side="left"><p className="text-xs">Satélite</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={mapType === "hybrid"}
                  onPressedChange={() => setMapType("hybrid")}
                  className="h-7 w-7 p-0"
                >
                  <span className="text-[8px] font-bold leading-none">H</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent side="left"><p className="text-xs">Híbrido</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Drawing tools */}
      <div className="absolute bottom-10 left-2 sm:bottom-12 sm:left-3 z-10">
        <TooltipProvider delayDuration={200}>
          <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50 p-0.5 flex gap-0.5">
            {DRAWING_TOOLS.map(({ mode, icon: Icon, label }) => (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    pressed={activeDrawing === mode}
                    onPressedChange={(pressed) => setActiveDrawing(pressed ? mode : null)}
                    className="h-7 w-7 p-0"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">{label}</p></TooltipContent>
              </Tooltip>
            ))}

            {/* Clear */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={handleClearDrawings}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Limpar desenhos</p></TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px bg-border/50 mx-0.5" />

            {/* Snapshot */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-primary hover:text-primary"
                  onClick={handleSnapshot}
                  disabled={snapshotting}
                >
                  {snapshotting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p className="text-xs">Capturar snapshot</p></TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Bottom hint */}
      <p className="absolute bottom-2 right-2 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded z-10">
        Clique no mapa para alterar coordenadas
      </p>
    </div>
  );
}
