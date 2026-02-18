import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { MapPin, Sun, Zap, Loader2, CheckCircle2, AlertTriangle, Edit3 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
import { ROOF_TYPE_ICONS } from "./roofTypeIcons";
import { ProjectAddressFields, type ProjectAddress } from "./ProjectAddressFields";
import type { ClienteData } from "./types";

// Lazy-load Google Maps
const GoogleMapView = lazy(() => import("./GoogleMapView"));

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
  onMapSnapshotsChange?: (snapshots: string[]) => void;
  /** Client data for "same address" feature */
  clienteData?: ClienteData | null;
  /** Project address sync */
  projectAddress?: ProjectAddress;
  onProjectAddressChange?: (addr: ProjectAddress) => void;
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
  onIrradiacaoChange, onMapSnapshotsChange,
  clienteData, projectAddress, onProjectAddressChange,
}: Props) {
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
  const [distKm, setDistKm] = useState<number | null>(null);

  // Reverse geocoded address from map click
  const [reverseGeoResult, setReverseGeoResult] = useState<Partial<ProjectAddress> | null>(null);

  // Sync address coords → geoLat/geoLon
  useEffect(() => {
    if (projectAddress?.lat != null && projectAddress?.lon != null) {
      if (projectAddress.lat !== geoLat || projectAddress.lon !== geoLon) {
        setGeoLat(projectAddress.lat);
        setGeoLon(projectAddress.lon);
        setGeoStatus("localizado");
        fetchIrradiacao(projectAddress.lat, projectAddress.lon);
      }
    }
  }, [projectAddress?.lat, projectAddress?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync address uf/cidade → parent estado/cidade
  useEffect(() => {
    if (projectAddress?.uf && projectAddress.uf !== estado) {
      onEstadoChange(projectAddress.uf);
    }
    if (projectAddress?.cidade && projectAddress.cidade !== cidade) {
      onCidadeChange(projectAddress.cidade);
    }
  }, [projectAddress?.uf, projectAddress?.cidade]); // eslint-disable-line react-hooks/exhaustive-deps

  // Geocoding from estado+cidade when no address coords yet
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

    // Skip if address already has coords
    if (projectAddress?.lat != null && projectAddress?.lon != null) return;

    let cancelled = false;
    const geocode = async () => {
      setGeoStatus("buscando");
      setIrradiacao(null);
      setIrradSource(null);
      setDistKm(null);

      try {
        const { data: mapsConfig } = await supabase
          .from("integration_configs")
          .select("api_key, is_active")
          .eq("service_key", "google_maps")
          .eq("is_active", true)
          .maybeSingle();

        let lat: number | null = null;
        let lon: number | null = null;

        if (mapsConfig?.api_key) {
          const query = encodeURIComponent(`${cidade}, ${estado}, Brasil`);
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${mapsConfig.api_key}&region=br`,
          );
          const json = await resp.json();
          if (json.status === "OK" && json.results?.[0]) {
            lat = json.results[0].geometry.location.lat;
            lon = json.results[0].geometry.location.lng;
          }
        }

        if (lat === null) {
          const query = encodeURIComponent(`${cidade}, ${estado}, Brasil`);
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
            { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
          );
          const results = await resp.json();
          if (results?.[0]) {
            lat = parseFloat(results[0].lat);
            lon = parseFloat(results[0].lon);
          }
        }

        if (cancelled) return;

        if (lat !== null && lon !== null) {
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
        console.error("[StepLocalizacao] Geocoding error:", err);
        if (!cancelled) setGeoStatus("manual");
      }
    };

    const timer = setTimeout(geocode, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cidade, estado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch concessionarias by estado
  useEffect(() => {
    if (!estado) { setConcessionarias([]); return; }
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

  // Handle click on map — reverse geocode to fill address
  const handleMapClick = useCallback(async (lat: number, lon: number) => {
    setGeoLat(lat);
    setGeoLon(lon);
    setGeoStatus("localizado");
    fetchIrradiacao(lat, lon);

    // Reverse geocode to fill address fields
    try {
      const { data: mapsConfig } = await supabase
        .from("integration_configs")
        .select("api_key, is_active")
        .eq("service_key", "google_maps")
        .eq("is_active", true)
        .maybeSingle();

      let result: Partial<ProjectAddress> = { lat, lon };

      if (mapsConfig?.api_key) {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${mapsConfig.api_key}&language=pt-BR`
        );
        const json = await resp.json();
        if (json.status === "OK" && json.results?.[0]) {
          const components = json.results[0].address_components || [];
          const get = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || "";
          const getShort = (type: string) => components.find((c: any) => c.types.includes(type))?.short_name || "";

          result = {
            ...result,
            rua: get("route"),
            numero: get("street_number"),
            bairro: get("sublocality_level_1") || get("sublocality") || get("neighborhood"),
            cidade: get("administrative_area_level_2") || get("locality"),
            uf: getShort("administrative_area_level_1"),
            cep: get("postal_code").replace(/(\d{5})(\d{3})/, "$1-$2"),
          };
        }
      } else {
        // Fallback to Nominatim reverse
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
          { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
        );
        const data = await resp.json();
        if (data?.address) {
          result = {
            ...result,
            rua: data.address.road || "",
            numero: data.address.house_number || "",
            bairro: data.address.suburb || data.address.neighbourhood || "",
            cidade: data.address.city || data.address.town || data.address.municipality || "",
            uf: data.address.state_code?.toUpperCase() || "",
            cep: data.address.postcode?.replace(/(\d{5})(\d{3})/, "$1-$2") || "",
          };
        }
      }

      setReverseGeoResult(result);

      // Update parent estado/cidade from reverse geocode
      if (result.uf && result.uf !== estado) onEstadoChange(result.uf);
      if (result.cidade && result.cidade !== cidade) onCidadeChange(result.cidade);
    } catch (err) {
      console.error("[StepLocalizacao] Reverse geocoding error:", err);
      // Still update coords even if reverse geocode fails
      if (onProjectAddressChange && projectAddress) {
        onProjectAddressChange({ ...projectAddress, lat, lon });
      }
    }
  }, [fetchIrradiacao, estado, cidade, onEstadoChange, onCidadeChange, onProjectAddressChange, projectAddress]);

  // Handle coords change from address component (forward geocode)
  const handleCoordsFromAddress = useCallback((lat: number, lon: number) => {
    setGeoLat(lat);
    setGeoLon(lon);
    setGeoStatus("localizado");
    fetchIrradiacao(lat, lon);
  }, [fetchIrradiacao]);

  const handleEstadoChange = (v: string) => {
    onEstadoChange(v);
    onCidadeChange("");
    onDistribuidoraChange("", "");
    // Sync to address
    if (onProjectAddressChange && projectAddress) {
      onProjectAddressChange({ ...projectAddress, uf: v, cidade: "" });
    }
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
          <MapPin className="h-4 w-4 text-primary" /> Localização & Endereço
        </h3>
        <div className="flex items-center gap-2">
          {geoStatusBadge()}
          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
            Etapa 1/10
          </Badge>
        </div>
      </div>

      {/* Main grid: Address + Fields on left, Map on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Left column: Address + Config fields */}
        <div className="space-y-4">
          {/* Project Address Fields (bidirectional sync) */}
          {onProjectAddressChange && projectAddress && (
            <ProjectAddressFields
              address={projectAddress}
              onAddressChange={onProjectAddressChange}
              clienteData={clienteData}
              onCoordsChange={handleCoordsFromAddress}
              reverseGeocodedAddress={reverseGeoResult}
            />
          )}

          {/* Separator */}
          <div className="border-t border-border/30" />

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
                  {distKm !== null && (
                    <span className="text-[9px] text-muted-foreground">
                      ~{distKm.toFixed(0)}km
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[9px] ml-auto">
                    {irradSource?.includes("INPE") || irradSource?.includes("inpe") ? "Atlas INPE" : irradSource || "Atlas"}
                  </Badge>
                </>
              ) : loadingIrrad ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando dados de irradiação...
                </span>
              ) : geoStatus === "manual" ? (
                <span className="text-xs text-muted-foreground">Informe o endereço para buscar</span>
              ) : cidade ? (
                <span className="text-xs text-muted-foreground">Geocodificando endereço...</span>
              ) : (
                <span className="text-xs text-muted-foreground">Preencha o endereço para buscar</span>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Google Maps + Coords display */}
        <div className="lg:sticky lg:top-4 space-y-2">
          <Suspense fallback={
            <div className="rounded-xl border border-border/50 overflow-hidden relative min-h-[280px] sm:min-h-[360px] flex items-center justify-center bg-muted/20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }>
            <GoogleMapView
              lat={geoLat}
              lon={geoLon}
              cidade={cidade}
              estado={estado}
              onMapClick={handleMapClick}
              onSnapshotsChange={onMapSnapshotsChange}
            />
          </Suspense>

          {/* Coordinates bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/40 bg-card">
            {geoLat !== null && geoLon !== null ? (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-mono text-foreground font-medium">
                  {geoLat.toFixed(6)}, {geoLon.toFixed(6)}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Clique no mapa ou preencha o endereço para definir a localização
              </span>
            )}
            <span className="text-[9px] text-muted-foreground hidden sm:inline">
              Arraste o marcador · Clique para reposicionar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
