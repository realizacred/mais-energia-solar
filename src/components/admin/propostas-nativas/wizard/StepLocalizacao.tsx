import { useState, useEffect, useCallback } from "react";
import { MapPin, Sun, Zap, Loader2, CheckCircle2, AlertTriangle, Edit3 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
import { UF_LIST } from "./types";
import { ROOF_TYPE_ICONS } from "./roofTypeIcons";
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

/** Helper: click on map to update coordinates */
function MapClickHandler({ onClick }: { onClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Helper: recenter map when coords change */
function MapRecenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], 13);
  }, [lat, lon, map]);
  return null;
}

interface Props {
  estado: string;
  cidade: string;
  tipoTelhado: string;
  distribuidoraId: string;
  onEstadoChange: (v: string) => void;
  onCidadeChange: (v: string) => void;
  onTipoTelhadoChange: (v: string) => void;
  onDistribuidoraChange: (id: string, nome: string) => void;
  onIrradiacaoChange?: (avg: number) => void;
}

interface ConcessionariaOption {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
}

type GeoStatus = "idle" | "buscando" | "localizado" | "manual" | "erro";

export function StepLocalizacao({
  estado, cidade, tipoTelhado, distribuidoraId,
  onEstadoChange, onCidadeChange, onTipoTelhadoChange, onDistribuidoraChange,
  onIrradiacaoChange,
}: Props) {
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(estado);
  const { tiposTelhado } = useTiposTelhado();
  const [concessionarias, setConcessionarias] = useState<ConcessionariaOption[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);
  const [irradiacao, setIrradiacao] = useState<number | null>(null);
  const [irradSource, setIrradSource] = useState<string | null>(null);
  const [loadingIrrad, setLoadingIrrad] = useState(false);

  // Geo state
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [distKm, setDistKm] = useState<number | null>(null);

  

  // Nominatim geocoding when city+state change
  useEffect(() => {
    if (!cidade || !estado) {
      setGeoStatus("idle");
      setGeoLat(null);
      setGeoLon(null);
      setIrradiacao(null);
      setIrradSource(null);
      setDistKm(null);
      return;
    }

    let cancelled = false;
    const geocodeWithNominatim = async () => {
      setGeoStatus("buscando");
      setIrradiacao(null);
      setIrradSource(null);
      setDistKm(null);

      try {
        const query = encodeURIComponent(`${cidade}, ${estado}, Brasil`);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
          { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
        );
        const results = await resp.json();

        if (cancelled) return;

        if (results && results.length > 0) {
          const lat = parseFloat(results[0].lat);
          const lon = parseFloat(results[0].lon);
          setGeoLat(lat);
          setGeoLon(lon);
          setGeoStatus("localizado");
          fetchIrradiacao(lat, lon);
        } else {
          setGeoStatus("manual");
          setGeoLat(null);
          setGeoLon(null);
        }
      } catch (err) {
        console.error("[StepLocalizacao] Nominatim error:", err);
        if (!cancelled) {
          setGeoStatus("manual");
        }
      }
    };

    // Small debounce to avoid hammering Nominatim
    const timer = setTimeout(geocodeWithNominatim, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cidade, estado]);

  // Fetch concessionarias by estado
  useEffect(() => {
    if (!estado) {
      setConcessionarias([]);
      return;
    }
    setLoadingConc(true);
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado")
      .eq("ativo", true)
      .or(`estado.eq.${estado},estado.is.null`)
      .order("nome")
      .then(({ data }) => {
        setConcessionarias((data as ConcessionariaOption[]) || []);
        setLoadingConc(false);
      });
  }, [estado]);

  const fetchIrradiacao = useCallback(async (lat: number, lon: number) => {
    setLoadingIrrad(true);
    setDistKm(null);
    try {
      const { data: activeVersion } = await supabase
        .from("irradiance_dataset_versions")
        .select("id, version_tag")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (activeVersion) {
        const { data, error } = await supabase.rpc("get_irradiance_for_simulation", {
          _version_id: activeVersion.id,
          _lat: lat,
          _lon: lon,
        });

        if (error) {
          console.error("[StepLocalizacao] irradiance RPC error:", error);
          setIrradiacao(null);
          setIrradSource(null);
          return;
        }

        if (data && typeof data === "object" && "ghi_annual_avg" in (data as any)) {
          const avg = (data as any).ghi_annual_avg;
          const dsCode = (data as any).dataset_code || activeVersion.version_tag || "Atlas";
          const dist = (data as any).distance_km;
          setIrradiacao(Number(avg));
          setIrradSource(dsCode);
          setDistKm(dist != null ? Number(dist) : null);
          onIrradiacaoChange?.(Number(avg));
          return;
        }
      }
      setIrradiacao(null);
      setIrradSource(null);
    } catch (err) {
      console.error("[StepLocalizacao] irradiance fetch error:", err);
      setIrradiacao(null);
      setIrradSource(null);
    } finally {
      setLoadingIrrad(false);
    }
  }, [onIrradiacaoChange]);

  const handleManualSubmit = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon) || lat < -34 || lat > 6 || lon < -74 || lon > -34) return;
    setGeoLat(lat);
    setGeoLon(lon);
    setGeoStatus("localizado");
    fetchIrradiacao(lat, lon);
  };

  // Handle click on Leaflet map
  const handleMapClick = useCallback((lat: number, lon: number) => {
    setGeoLat(lat);
    setGeoLon(lon);
    setGeoStatus("localizado");
    fetchIrradiacao(lat, lon);
  }, [fetchIrradiacao]);

  const handleEstadoChange = (v: string) => {
    onEstadoChange(v);
    onCidadeChange("");
    onDistribuidoraChange("", "");
  };

  const handleConcChange = (id: string) => {
    const c = concessionarias.find(c => c.id === id);
    onDistribuidoraChange(id, c?.nome || "");
  };

  const RoofIcon = ROOF_TYPE_ICONS[tipoTelhado] || ROOF_TYPE_ICONS["_default"];

  const geoStatusBadge = () => {
    switch (geoStatus) {
      case "buscando":
        return (
          <Badge variant="outline" className="text-[9px] gap-1 text-primary border-primary/30">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buscando
          </Badge>
        );
      case "localizado":
        return (
          <Badge variant="outline" className="text-[9px] gap-1 text-success border-success/30">
            <CheckCircle2 className="h-2.5 w-2.5" /> Localizado
          </Badge>
        );
      case "manual":
        return (
          <Badge variant="outline" className="text-[9px] gap-1 text-warning border-warning/30">
            <Edit3 className="h-2.5 w-2.5" /> Manual
          </Badge>
        );
      case "erro":
        return (
          <Badge variant="outline" className="text-[9px] gap-1 text-destructive border-destructive/30">
            <AlertTriangle className="h-2.5 w-2.5" /> Erro
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> Localização
        </h3>
        <div className="flex items-center gap-2">
          {geoStatusBadge()}
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
            Etapa 1/10
          </Badge>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Left column: Form fields */}
        <div className="space-y-3">
          {/* Localização */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Localização *</Label>
            <div className="flex gap-1.5">
              <Select value={estado} onValueChange={handleEstadoChange}>
                <SelectTrigger className="h-9 w-[72px] shrink-0 text-xs">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
              {cidadesLoading ? (
                <div className="flex items-center gap-1.5 px-3 h-9 border rounded-md flex-1 bg-muted/30">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Carregando...</span>
                </div>
              ) : cidades.length > 0 ? (
                <Select value={cidade} onValueChange={onCidadeChange}>
                  <SelectTrigger className="h-9 flex-1 text-xs">
                    <SelectValue placeholder="Selecione a cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center px-3 h-9 border rounded-md flex-1 bg-muted/20">
                  <span className="text-xs text-muted-foreground">Selecione o estado</span>
                </div>
              )}
            </div>
          </div>

          {/* Coordenadas - show when localizado or manual */}
          {geoStatus === "localizado" && geoLat !== null && geoLon !== null && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-success/5 border border-success/20">
              <MapPin className="h-3 w-3 text-success shrink-0" />
              <span className="text-[10px] text-muted-foreground">
                Lat: <span className="font-mono font-medium text-foreground">{geoLat.toFixed(4)}</span>
                {" · "}
                Lon: <span className="font-mono font-medium text-foreground">{geoLon.toFixed(4)}</span>
              </span>
              {distKm !== null && (
                <span className="text-[9px] text-muted-foreground ml-auto">
                  ~{distKm.toFixed(0)}km do ponto Atlas
                </span>
              )}
            </div>
          )}

          {/* Manual lat/lon input */}
          {geoStatus === "manual" && (
            <div className="space-y-1.5 p-2.5 rounded-md bg-warning/5 border border-warning/20">
              <p className="text-[10px] text-warning font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Endereço não encontrado. Informe as coordenadas manualmente:
              </p>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Latitude (ex: -23.5505)"
                  value={manualLat}
                  onChange={e => setManualLat(e.target.value)}
                  className="h-8 text-xs flex-1"
                  type="number"
                  step="0.0001"
                />
                <Input
                  placeholder="Longitude (ex: -46.6333)"
                  value={manualLon}
                  onChange={e => setManualLon(e.target.value)}
                  className="h-8 text-xs flex-1"
                  type="number"
                  step="0.0001"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs px-3"
                  onClick={handleManualSubmit}
                  disabled={!manualLat || !manualLon}
                >
                  Buscar
                </Button>
              </div>
            </div>
          )}

          {/* Tipo de Telhado */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <RoofIcon className="h-3.5 w-3.5" /> Tipo de Telhado / Estrutura *
            </Label>
            <Select value={tipoTelhado} onValueChange={onTipoTelhadoChange}>
              <SelectTrigger className={`h-9 text-xs ${!tipoTelhado ? "border-destructive ring-1 ring-destructive/30" : ""}`}>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposTelhado.map(t => {
                  const Icon = ROOF_TYPE_ICONS[t] || ROOF_TYPE_ICONS["_default"];
                  return (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {t}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {!tipoTelhado && (
              <p className="text-[10px] text-destructive font-medium">⚠ Campo obrigatório</p>
            )}
          </div>

          {/* Distribuidora */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Zap className="h-3 w-3" /> Distribuidora de Energia *
            </Label>
            {loadingConc ? (
              <div className="flex items-center gap-1.5 px-3 h-9 border rounded-md bg-muted/30">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs text-muted-foreground">Carregando...</span>
              </div>
            ) : (
              <Select value={distribuidoraId} onValueChange={handleConcChange}>
                <SelectTrigger className={`h-9 text-xs ${!distribuidoraId && estado ? "border-destructive/50" : ""}`}>
                  <SelectValue placeholder="Selecione a distribuidora" />
                </SelectTrigger>
                <SelectContent>
                  {concessionarias.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.sigla ? `${c.sigla} — ${c.nome}` : c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!distribuidoraId && estado && (
              <p className="text-[10px] text-destructive">A distribuidora é obrigatória!</p>
            )}
          </div>

          {/* Irradiação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-warning" /> Irradiação Solar
              {loadingIrrad && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/10">
              {irradiacao !== null ? (
                <>
                  <Sun className="h-4 w-4 text-warning shrink-0" />
                  <span className="text-sm font-bold text-foreground">
                    {irradiacao.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">kWh/m²/dia</span>
                  <Badge variant="secondary" className="text-[9px] ml-auto">
                    {irradSource?.includes("INPE") || irradSource?.includes("inpe") ? "Atlas INPE" : irradSource || "Atlas"}
                  </Badge>
                </>
              ) : loadingIrrad ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando dados de irradiação...
                </span>
              ) : geoStatus === "manual" ? (
                <span className="text-xs text-muted-foreground">Informe as coordenadas para buscar</span>
              ) : cidade ? (
                <span className="text-xs text-muted-foreground">Geocodificando endereço...</span>
              ) : (
                <span className="text-xs text-muted-foreground">Selecione estado e cidade</span>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Leaflet Map (free, no API key needed) */}
        <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px]">
          <MapContainer
            center={[geoLat ?? -15.78, geoLon ?? -47.93]}
            zoom={geoLat ? 13 : 5}
            className="w-full h-full min-h-[280px] sm:min-h-[360px]"
            style={{ zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onClick={handleMapClick} />
            {geoLat !== null && geoLon !== null && (
              <>
                <Marker position={[geoLat, geoLon]} />
                <MapRecenter lat={geoLat} lon={geoLon} />
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
      </div>
    </div>
  );
}
