/// <reference types="google.maps" />
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Map, Satellite, Pencil, Trash2, Camera, Circle, Square,
  Minus, MapPin as MarkerIcon, X, ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  /** Called whenever snapshots change (add/remove). Array of data URLs. */
  onSnapshotsChange?: (snapshots: string[]) => void;
}

const DRAWING_TOOLS: { mode: DrawingMode; icon: React.ElementType; label: string }[] = [
  { mode: "polyline", icon: Minus, label: "Linha" },
  { mode: "polygon", icon: Pencil, label: "Polígono" },
  { mode: "rectangle", icon: Square, label: "Retângulo" },
  { mode: "circle", icon: Circle, label: "Círculo" },
  { mode: "marker", icon: MarkerIcon, label: "Marcador" },
];

export default function GoogleMapView({
  lat, lon, cidade, estado, onMapClick, onSnapshotsChange,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const overlaysRef = useRef<google.maps.MVCObject[]>([]);
  const activeDrawingRef = useRef<DrawingMode>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("hybrid");
  const [activeDrawing, setActiveDrawing] = useState<DrawingMode>(null);
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const apiKeyRef = useRef<string | null>(null);

  // Keep ref in sync for closure access
  useEffect(() => {
    activeDrawingRef.current = activeDrawing;
  }, [activeDrawing]);

  // Emit snapshots to parent
  useEffect(() => {
    onSnapshotsChange?.(snapshots);
  }, [snapshots, onSnapshotsChange]);

  // ─── Load Google Maps script + drawing library ────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Fetch API key
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

        // 2. Load core Maps script if not present
        if (!window.google?.maps) {
          const existing = document.querySelector('script[src*="maps.googleapis.com"]');
          if (!existing) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${data.api_key}&libraries=marker,drawing&v=weekly`;
              script.async = true;
              script.defer = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Script load failed"));
              document.head.appendChild(script);
            });
          } else {
            // Wait for existing script to finish loading
            if (!window.google?.maps) {
              await new Promise<void>((resolve) => {
                existing.addEventListener("load", () => resolve());
                // In case it already loaded
                if (window.google?.maps) resolve();
              });
            }
          }
        }

        if (cancelled) return;

        // 3. Dynamically import drawing library if missing
        if (window.google?.maps && !window.google.maps.drawing) {
          try {
            await (google.maps as any).importLibrary("drawing");
          } catch (e) {
            console.warn("[GoogleMapView] Could not import drawing library:", e);
          }
        }

        // 4. Dynamically import marker library if missing
        if (window.google?.maps && !window.google.maps.marker) {
          try {
            await (google.maps as any).importLibrary("marker");
          } catch (e) {
            console.warn("[GoogleMapView] Could not import marker library:", e);
          }
        }

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[GoogleMapView] load error:", err);
          setError("Falha ao carregar Google Maps");
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // ─── Initialize map + DrawingManager ─────────────
  useEffect(() => {
    if (loading || error || !mapRef.current || !window.google?.maps) return;
    if (mapInstanceRef.current) return;

    const center = { lat: lat ?? -15.78, lng: lon ?? -47.93 };
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: lat ? 18 : 5,
      mapTypeControl: false,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
      mapId: "proposal-map",
      mapTypeId: mapType,
    });

    // Use ref to avoid stale closure
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!activeDrawingRef.current && e.latLng) {
        onMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });

    mapInstanceRef.current = map;

    // Add marker if we have coords
    if (lat !== null && lon !== null && window.google.maps.marker) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng: lon },
      });
      markerRef.current = marker;
    }

    // Initialize DrawingManager
    if (window.google.maps.drawing) {
      const sharedStyle = {
        strokeColor: "#FF6600",
        fillColor: "#FF6600",
        fillOpacity: 0.15,
        strokeWeight: 2,
        editable: true,
      };

      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polylineOptions: { ...sharedStyle, strokeWeight: 3 },
        polygonOptions: sharedStyle,
        rectangleOptions: sharedStyle,
        circleOptions: sharedStyle,
        markerOptions: { draggable: true },
      });
      dm.setMap(map);

      dm.addListener("overlaycomplete", (e: google.maps.drawing.OverlayCompleteEvent) => {
        overlaysRef.current.push(e.overlay!);
        dm.setDrawingMode(null);
        setActiveDrawing(null);
      });

      drawingManagerRef.current = dm;
    } else {
      console.warn("[GoogleMapView] Drawing library not available after init");
    }
  }, [loading, error]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update map type ─────────────────────────────
  useEffect(() => {
    mapInstanceRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  // ─── Update drawing mode ─────────────────────────
  useEffect(() => {
    const dm = drawingManagerRef.current;
    if (!dm || !window.google?.maps?.drawing) return;

    const modeMap: Record<string, google.maps.drawing.OverlayType> = {
      marker: google.maps.drawing.OverlayType.MARKER,
      polyline: google.maps.drawing.OverlayType.POLYLINE,
      polygon: google.maps.drawing.OverlayType.POLYGON,
      rectangle: google.maps.drawing.OverlayType.RECTANGLE,
      circle: google.maps.drawing.OverlayType.CIRCLE,
    };

    dm.setDrawingMode(activeDrawing ? modeMap[activeDrawing] ?? null : null);
  }, [activeDrawing]);

  // ─── Update marker/center when coords change ────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (lat !== null && lon !== null) {
      const pos = { lat, lng: lon };
      map.setCenter(pos);
      if (map.getZoom()! < 15) map.setZoom(18);

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

  // ─── Clear all drawings ──────────────────────────
  const handleClearDrawings = useCallback(() => {
    overlaysRef.current.forEach((o: any) => {
      if (o.setMap) o.setMap(null);
    });
    overlaysRef.current = [];
    toast({ title: "Desenhos removidos" });
  }, []);

  // ─── Capture snapshot ────────────────────────────
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
        setSnapshots(prev => [...prev, dataUrl]);
        toast({
          title: "📸 Snapshot capturado",
          description: "Clique na miniatura para visualizar.",
        });
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("[GoogleMapView] snapshot error:", err);
      toast({
        title: "Erro ao capturar mapa",
        description: "Não foi possível gerar o snapshot.",
        variant: "destructive",
      });
    } finally {
      setSnapshotting(false);
    }
  }, [mapType]);

  // ─── Delete snapshot ─────────────────────────────
  const handleDeleteSnapshot = useCallback((idx: number) => {
    setSnapshots(prev => prev.filter((_, i) => i !== idx));
    setPreviewIdx(null);
  }, []);

  const drawingAvailable = !!drawingManagerRef.current || !!window.google?.maps?.drawing;

  // ─── Loading / Error states ──────────────────────
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
    <div className="space-y-2">
      {/* Map container */}
      <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[420px]">
        <div ref={mapRef} className="w-full h-full min-h-[280px] sm:min-h-[420px]" />

        {/* City label */}
        {cidade && estado && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md border border-border/50 z-10">
            <p className="text-xs sm:text-sm font-semibold">{cidade}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{estado}, Brasil</p>
          </div>
        )}

        {/* Map type toggle — top right */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10">
          <TooltipProvider delayDuration={200}>
            <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50 p-0.5 flex flex-col gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle size="sm" pressed={mapType === "roadmap"} onPressedChange={() => setMapType("roadmap")} className="h-7 w-7 p-0">
                    <Map className="h-3.5 w-3.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="left"><p className="text-xs">Mapa</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle size="sm" pressed={mapType === "satellite"} onPressedChange={() => setMapType("satellite")} className="h-7 w-7 p-0">
                    <Satellite className="h-3.5 w-3.5" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="left"><p className="text-xs">Satélite</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle size="sm" pressed={mapType === "hybrid"} onPressedChange={() => setMapType("hybrid")} className="h-7 w-7 p-0">
                    <span className="text-[8px] font-bold leading-none">H</span>
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent side="left"><p className="text-xs">Híbrido</p></TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Drawing tools — bottom left */}
        <div className="absolute bottom-10 left-2 sm:bottom-12 sm:left-3 z-10">
          <TooltipProvider delayDuration={200}>
            <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-md border border-border/50 p-0.5 flex gap-0.5 items-center">
              {DRAWING_TOOLS.map(({ mode, icon: Icon, label }) => (
                <Tooltip key={mode}>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={activeDrawing === mode}
                      onPressedChange={(pressed) => setActiveDrawing(pressed ? mode : null)}
                      className="h-7 w-7 p-0"
                      disabled={!drawingAvailable}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{drawingAvailable ? label : `${label} (indisponível)`}</p>
                  </TooltipContent>
                </Tooltip>
              ))}

              {/* Clear drawings */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={handleClearDrawings}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">Limpar desenhos</p></TooltipContent>
              </Tooltip>

              <div className="w-px h-5 bg-border/50 mx-0.5" />

              {/* Snapshot */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="sm"
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

        {/* Hint */}
        <p className="absolute bottom-2 right-2 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded z-10">
          Clique no mapa para alterar coordenadas · Arraste o boneco para Street View
        </p>
      </div>

      {/* ─── Snapshots gallery ────────────────────── */}
      {snapshots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            📸 Snapshots do mapa ({snapshots.length})
          </p>
          <div className="flex gap-2 flex-wrap">
            {snapshots.map((src, idx) => (
              <div
                key={idx}
                className="relative group rounded-lg overflow-hidden border border-border/50 shadow-sm w-[100px] h-[75px] cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                onClick={() => setPreviewIdx(idx)}
              >
                <img src={src} alt={`Snapshot ${idx + 1}`} className="w-full h-full object-cover" />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <ZoomIn className="h-4 w-4 text-white" />
                </div>
                {/* Delete button */}
                <button
                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                  onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(idx); }}
                  title="Remover snapshot"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Snapshot preview dialog ─────────────── */}
      <Dialog open={previewIdx !== null} onOpenChange={() => setPreviewIdx(null)}>
        <DialogContent className="max-w-3xl p-2">
          {previewIdx !== null && snapshots[previewIdx] && (
            <div className="space-y-2">
              <img
                src={snapshots[previewIdx]}
                alt={`Snapshot ${previewIdx + 1}`}
                className="w-full rounded-lg"
              />
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  Snapshot {previewIdx + 1} de {snapshots.length}
                </span>
                <Button
                  variant="destructive" size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleDeleteSnapshot(previewIdx)}
                >
                  <Trash2 className="h-3 w-3" /> Remover
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
