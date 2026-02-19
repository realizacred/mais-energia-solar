/// <reference types="google.maps" />
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Map, Satellite, Pencil, Trash2, Camera, Circle, Square,
  Minus, MapPin as MarkerIcon, X, ZoomIn, Info, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
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
  const [inStreetView, setInStreetView] = useState(false);
  const [drawingReady, setDrawingReady] = useState(false);
  const apiKeyRef = useRef<string | null>(null);
  const onMapClickRef = useRef(onMapClick);

  // Keep refs in sync with latest props/state
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { activeDrawingRef.current = activeDrawing; }, [activeDrawing]);

  useEffect(() => {
    onSnapshotsChange?.(snapshots);
  }, [snapshots, onSnapshotsChange]);

  // ─── Load Google Maps script + drawing library ────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
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

        // Load Google Maps script only if not already present
        if (!window.google?.maps) {
          const existing = document.querySelector('script[src*="maps.googleapis.com"]');
          if (!existing) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${data.api_key}&libraries=drawing&v=weekly`;
              script.async = true;
              script.defer = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Script load failed"));
              document.head.appendChild(script);
            });
          } else {
            // Script tag exists but hasn't finished loading yet
            await new Promise<void>((resolve) => {
              const check = () => {
                if (window.google?.maps) { resolve(); return; }
                setTimeout(check, 100);
              };
              existing.addEventListener("load", () => resolve());
              check();
            });
          }
        }
        // NOTE: Drawing library loaded via script tag `libraries=drawing`
        // Do NOT call importLibrary() — mixing methods causes init errors

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

    // NOTE: Do NOT use mapId — it requires cloud config and can break drawing tools
    const map = new google.maps.Map(mapRef.current, {
      center,
      zoom: lat ? 18 : 5,
      mapTypeControl: false,
      streetViewControl: true,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: "greedy",
      mapTypeId: mapType,
    });

    // Detect Street View enter/exit
    const sv = map.getStreetView();
    sv.addListener("visible_changed", () => {
      setInStreetView(sv.getVisible());
    });

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!activeDrawingRef.current && e.latLng) {
        onMapClickRef.current(e.latLng.lat(), e.latLng.lng());
      }
    });

    mapInstanceRef.current = map;

    // Add draggable marker (legacy Marker — no mapId required)
    if (lat !== null && lon !== null) {
      const marker = new google.maps.Marker({
        map,
        position: { lat, lng: lon },
        draggable: true,
      });
      marker.addListener("dragend", () => {
        const pos = marker.getPosition();
        if (pos) onMapClickRef.current(pos.lat(), pos.lng());
      });
      markerRef.current = marker;
    }

    // Initialize DrawingManager
    if (window.google.maps.drawing?.DrawingManager) {
      const sharedStyle = {
        strokeColor: "#FF6600",
        fillColor: "#FF6600",
        fillOpacity: 0.15,
        strokeWeight: 2,
        editable: true,
      };

      const dm = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false, // We use our own UI
        polylineOptions: { ...sharedStyle, strokeWeight: 3 },
        polygonOptions: sharedStyle,
        rectangleOptions: sharedStyle,
        circleOptions: sharedStyle,
        markerOptions: { draggable: true },
      });
      dm.setMap(map);

      dm.addListener("overlaycomplete", (e: google.maps.drawing.OverlayCompleteEvent) => {
        overlaysRef.current.push(e.overlay!);
        // After completing a shape, return to navigation mode and unlock map
        dm.setDrawingMode(null);
        map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: "greedy" });
        setActiveDrawing(null);
      });

      drawingManagerRef.current = dm;
      setDrawingReady(true);
    } else {
      console.warn("[GoogleMapView] Drawing library not available after init");
    }
  }, [loading, error]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update map type ─────────────────────────────
  useEffect(() => {
    mapInstanceRef.current?.setMapTypeId(mapType);
  }, [mapType]);

  // ─── Update drawing mode on DrawingManager + lock/unlock map drag ───
  useEffect(() => {
    const dm = drawingManagerRef.current;
    const map = mapInstanceRef.current;
    if (!dm || !map || !window.google?.maps?.drawing) return;

    if (!activeDrawing) {
      dm.setDrawingMode(null);
      // Unlock map dragging
      map.setOptions({ draggable: true, scrollwheel: true, disableDoubleClickZoom: false, gestureHandling: "greedy" });
      return;
    }

    const modeMap: Record<string, google.maps.drawing.OverlayType> = {
      marker: google.maps.drawing.OverlayType.MARKER,
      polyline: google.maps.drawing.OverlayType.POLYLINE,
      polygon: google.maps.drawing.OverlayType.POLYGON,
      rectangle: google.maps.drawing.OverlayType.RECTANGLE,
      circle: google.maps.drawing.OverlayType.CIRCLE,
    };

    const mode = modeMap[activeDrawing] ?? null;
    dm.setDrawingMode(mode);

    // Lock map dragging while drawing tool is active, but keep gesture
    // handling cooperative so DrawingManager can still receive mouse/touch events
    if (mode) {
      map.setOptions({ draggable: false, scrollwheel: false, disableDoubleClickZoom: true });
    }
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
        markerRef.current.setPosition(pos);
      } else {
        const marker = new google.maps.Marker({ map, position: pos, draggable: true });
        marker.addListener("dragend", () => {
          const p = marker.getPosition();
          if (p) onMapClickRef.current(p.lat(), p.lng());
        });
        markerRef.current = marker;
      }
    }
  }, [lat, lon]);

  // ─── Clear all drawings ──────────────────────────
  const handleClearDrawings = useCallback(() => {
    overlaysRef.current.forEach((o: any) => {
      if (o.setMap) o.setMap(null);
    });
    overlaysRef.current = [];
    setActiveDrawing(null);
    toast({ title: "Desenhos removidos" });
  }, []);

  // ─── Exit Street View ────────────────────────────
  const handleExitStreetView = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map) {
      map.getStreetView().setVisible(false);
    }
  }, []);

  // ─── Capture snapshot using html2canvas (includes drawings!) ────
  const handleSnapshot = useCallback(async () => {
    const container = mapRef.current;
    if (!container) return;

    setSnapshotting(true);
    try {
      // Temporarily hide controls for cleaner screenshot
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        backgroundColor: null,
        // Ignore Google Maps controls to get a cleaner image
        ignoreElements: (el) => {
          if (el.classList?.contains("gm-control-active")) return true;
          if (el.classList?.contains("gmnoprint") && !el.querySelector("canvas")) return true;
          return false;
        },
      });

      const dataUrl = canvas.toDataURL("image/png", 0.92);
      setSnapshots(prev => [...prev, dataUrl]);
      toast({
        title: "📸 Snapshot capturado",
        description: "Inclui todos os desenhos visíveis no mapa.",
      });
    } catch (err) {
      console.error("[GoogleMapView] html2canvas snapshot error:", err);
      // Fallback to Static Maps API (without drawings)
      try {
        const map = mapInstanceRef.current;
        const key = apiKeyRef.current;
        if (map && key) {
          const center = map.getCenter();
          const zoom = map.getZoom();
          if (center) {
            const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat()},${center.lng()}&zoom=${zoom}&size=800x600&maptype=${mapType}&key=${key}&scale=2`;
            const resp = await fetch(staticUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                setSnapshots(prev => [...prev, reader.result as string]);
                toast({
                  title: "📸 Snapshot capturado (sem desenhos)",
                  description: "Captura via Static Maps (fallback).",
                });
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      } catch {
        toast({
          title: "Erro ao capturar mapa",
          variant: "destructive",
        });
      }
    } finally {
      setSnapshotting(false);
    }
  }, [mapType]);

  // ─── Delete snapshot ─────────────────────────────
  const handleDeleteSnapshot = useCallback((idx: number) => {
    setSnapshots(prev => prev.filter((_, i) => i !== idx));
    setPreviewIdx(null);
  }, []);

  // ─── Loading / Error states ──────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden relative h-[260px] sm:h-[300px] md:h-[340px] flex items-center justify-center bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden relative h-[260px] sm:h-[300px] md:h-[340px] flex items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Map container */}
      <div ref={mapContainerRef} className="rounded-xl border border-border/50 overflow-hidden relative h-[260px] sm:h-[300px] md:h-[340px]">
        <div ref={mapRef} className="w-full h-full" />

        {/* City label */}
        {cidade && estado && !inStreetView && (
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-md border border-border/50 z-10">
            <p className="text-xs sm:text-sm font-semibold">{cidade}</p>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground">{estado}, Brasil</p>
          </div>
        )}

        {/* Street View exit button */}
        {inStreetView && (
          <div className="absolute top-2 left-2 z-20">
            <Button
              size="sm"
              variant="secondary"
              className="gap-1.5 shadow-lg text-xs h-8"
              onClick={handleExitStreetView}
            >
              <Navigation className="h-3.5 w-3.5" />
              Voltar ao Mapa
            </Button>
          </div>
        )}

        {/* Map type toggle — top right */}
        {!inStreetView && (
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
        )}

        {/* Drawing tools — bottom left */}
        {!inStreetView && (
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
                        disabled={!drawingReady}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Toggle>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">{drawingReady ? label : `${label} (indisponível)`}</p>
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

                <div className="w-px h-5 bg-border/50 mx-0.5" />

                {/* Info button */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-72 text-xs space-y-2 p-3">
                    <p className="font-semibold text-sm">Como usar o mapa</p>
                    <div className="space-y-1.5 text-muted-foreground">
                      <p>📍 <strong>Clique no mapa</strong> para posicionar o marcador</p>
                      <p>✏️ <strong>Ferramentas de desenho:</strong> Selecione uma ferramenta (Linha, Polígono, Retângulo, Círculo ou Marcador) e clique/arraste no mapa para desenhar</p>
                      <p>🗑️ <strong>Limpar:</strong> Remove todos os desenhos do mapa</p>
                      <p>📸 <strong>Snapshot:</strong> Captura uma imagem do mapa incluindo os desenhos</p>
                      <p>🧑 <strong>Street View:</strong> Arraste o boneco amarelo para explorar. Clique em &quot;Voltar ao Mapa&quot; para sair</p>
                      <p>🗺️ <strong>Tipos de mapa:</strong> Alterne entre Mapa, Satélite e Híbrido</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Active drawing mode indicator */}
        {activeDrawing && !inStreetView && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] font-medium shadow-lg flex items-center gap-1.5">
              <span className="animate-pulse">●</span>
              Desenhando: {DRAWING_TOOLS.find(t => t.mode === activeDrawing)?.label}
              <button
                className="ml-1 hover:opacity-80"
                onClick={() => setActiveDrawing(null)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Hint */}
        {!inStreetView && !activeDrawing && (
          <p className="absolute bottom-2 right-2 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded z-10">
            Clique no mapa para alterar coordenadas · Arraste o boneco para Street View
          </p>
        )}
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
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <ZoomIn className="h-4 w-4 text-white" />
                </div>
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
