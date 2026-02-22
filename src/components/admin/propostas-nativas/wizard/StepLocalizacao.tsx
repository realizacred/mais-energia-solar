import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Sun, Zap, Loader2, CheckCircle2, AlertTriangle, Edit3, Home, Navigation } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
import { ROOF_TYPE_ICONS } from "./roofTypeIcons";
import { ProjectAddressFields, type ProjectAddress } from "./ProjectAddressFields";
import type { ClienteData } from "./types";
import { cn } from "@/lib/utils";

// Lazy-load Google Maps
const GoogleMapView = lazy(() => import("./GoogleMapView"));

/** Haversine distance in km between two lat/lon points */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  onGhiSeriesChange?: (series: Record<string, number> | null) => void;
  onLatitudeChange?: (lat: number) => void;
  onMapSnapshotsChange?: (snapshots: string[]) => void;
  /** Client data for "same address" feature */
  clienteData?: ClienteData | null;
  /** Project address sync */
  projectAddress?: ProjectAddress;
  onProjectAddressChange?: (addr: ProjectAddress) => void;
  /** Distance from company to client (km) — editable */
  distanciaKm?: number;
  onDistanciaKmChange?: (km: number) => void;
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
  onIrradiacaoChange, onGhiSeriesChange, onLatitudeChange,
  onMapSnapshotsChange,
  clienteData, projectAddress, onProjectAddressChange,
  distanciaKm, onDistanciaKmChange,
}: Props) {
  const { tiposTelhado } = useTiposTelhado();
  const [concessionarias, setConcessionarias] = useState<ConcessionariaOption[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);
  const [irradiacao, setIrradiacao] = useState<number | null>(null);
  const [irradSource, setIrradSource] = useState<string | null>(null);
  const [loadingIrrad, setLoadingIrrad] = useState(false);
  const [ghiSeries, setGhiSeries] = useState<Record<string, number> | null>(null);
  const [irradDialogOpen, setIrradDialogOpen] = useState(false);

  // Geo state
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [distKm, setDistKm] = useState<number | null>(null);
  const [distDialogOpen, setDistDialogOpen] = useState(false);
  const [distManualInput, setDistManualInput] = useState<string>("");

  // Reverse geocoded address from map click
  const [reverseGeoResult, setReverseGeoResult] = useState<Partial<ProjectAddress> | null>(null);

  // ── Company location for distance calculation ──
  const companyCoords = useRef<{ lat: number; lon: number } | null>(null);
  const companyGeocodedFor = useRef<string>("");

  // Fetch and geocode tenant location on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .maybeSingle();
        if (!profile?.tenant_id) return;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("cidade, estado")
          .eq("id", profile.tenant_id)
          .maybeSingle();
        if (!tenant?.cidade || !tenant?.estado) return;

        const tenantKey = `${tenant.cidade}-${tenant.estado}`;
        if (companyGeocodedFor.current === tenantKey) return;
        companyGeocodedFor.current = tenantKey;

        // Geocode tenant city
        const query = encodeURIComponent(`${tenant.cidade}, ${tenant.estado}, Brasil`);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
          { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
        );
        const results = await resp.json();
        if (results?.[0]) {
          companyCoords.current = {
            lat: parseFloat(results[0].lat),
            lon: parseFloat(results[0].lon),
          };
          // If we already have client coords, calc distance now
          if (geoLat != null && geoLon != null) {
            const d = haversineKm(companyCoords.current.lat, companyCoords.current.lon, geoLat, geoLon);
            onDistanciaKmChange?.(Math.round(d * 10) / 10);
          }
        }
      } catch (e) {
        console.warn("[StepLocalizacao] Failed to geocode tenant location:", e);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate distance when client coords change
  useEffect(() => {
    if (geoLat == null || geoLon == null || !companyCoords.current) return;
    const d = haversineKm(companyCoords.current.lat, companyCoords.current.lon, geoLat, geoLon);
    onDistanciaKmChange?.(Math.round(d * 10) / 10);
  }, [geoLat, geoLon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync address coords → geoLat/geoLon
  useEffect(() => {
    if (projectAddress?.lat != null && projectAddress?.lon != null) {
      if (projectAddress.lat !== geoLat || projectAddress.lon !== geoLon) {
        setGeoLat(projectAddress.lat);
        setGeoLon(projectAddress.lon);
        setGeoStatus("localizado");
        onLatitudeChange?.(projectAddress.lat);
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
          onLatitudeChange?.(lat);
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
          const ghi = (data as any).ghi;
          setIrradiacao(Number(avg));
          setIrradSource(dsCode);
          setDistKm(dist != null ? Number(dist) : null);
          const ghiData = ghi && typeof ghi === "object" ? ghi : null;
          setGhiSeries(ghiData);
          onIrradiacaoChange?.(Number(avg));
          onGhiSeriesChange?.(ghiData);
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
    onLatitudeChange?.(lat);
    fetchIrradiacao(lat, lon);

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
      if (result.uf && result.uf !== estado) onEstadoChange(result.uf);
      if (result.cidade && result.cidade !== cidade) onCidadeChange(result.cidade);
    } catch (err) {
      console.error("[StepLocalizacao] Reverse geocoding error:", err);
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
    onLatitudeChange?.(lat);
    fetchIrradiacao(lat, lon);
  }, [fetchIrradiacao, onLatitudeChange]);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1fr] gap-2.5">
      {/* ═══ LEFT COLUMN ═══ */}
      <div className="min-w-0 order-2 lg:order-1">
        <Card className="border-border/40">
          <CardHeader className="pb-0.5 pt-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                Endereço de instalação
              </CardTitle>
              {geoStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-2.5 space-y-2">
            {onProjectAddressChange && projectAddress && (
              <ProjectAddressFields
                address={projectAddress}
                onAddressChange={onProjectAddressChange}
                clienteData={clienteData}
                onCoordsChange={handleCoordsFromAddress}
                reverseGeocodedAddress={reverseGeoResult}
              />
            )}

            {/* Telhado + Distribuidora + Irradiação — inline dentro do card */}
            <div className="border-t border-border/30 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Tipo de Telhado */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Home className="h-2.5 w-2.5" /> Tipo de Telhado *
                  </Label>
                  <Select value={tipoTelhado} onValueChange={onTipoTelhadoChange}>
                    <SelectTrigger className={cn(
                      "h-7 text-xs",
                      !tipoTelhado && "border-destructive ring-1 ring-destructive/30"
                    )}>
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
                    <p className="text-[9px] text-destructive font-medium">⚠ Obrigatório</p>
                  )}
                </div>

                {/* Distribuidora */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> Distribuidora *
                  </Label>
                  {loadingConc ? (
                    <div className="flex items-center gap-1.5 px-2 h-7 border rounded-md bg-muted/30">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[10px] text-muted-foreground">Carregando...</span>
                    </div>
                  ) : (
                    <Select value={distribuidoraId} onValueChange={handleConcChange}>
                      <SelectTrigger className={cn(
                        "h-7 text-xs",
                        !distribuidoraId && estado && "border-destructive/50"
                      )}>
                        <SelectValue placeholder="Selecione" />
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
                    <p className="text-[9px] text-destructive">Obrigatório</p>
                  )}
                </div>

                {/* Irradiação Solar */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Sun className="h-2.5 w-2.5" /> Irradiação Solar
                    {loadingIrrad && <Loader2 className="h-2 w-2 animate-spin text-primary ml-0.5" />}
                  </Label>
                  <div
                    className={cn(
                      "flex items-center gap-1 h-7 px-2 border rounded-md bg-muted/10 text-xs",
                      irradiacao !== null && ghiSeries && "cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                    )}
                    onClick={() => { if (irradiacao !== null && ghiSeries) setIrradDialogOpen(true); }}
                    title={irradiacao !== null && ghiSeries ? "Clique para ver detalhes mensais" : undefined}
                  >
                    {irradiacao !== null ? (
                      <>
                        <Sun className="h-3 w-3 text-warning shrink-0" />
                        <span className="font-bold text-foreground">{irradiacao.toFixed(2)}</span>
                        <span className="text-[9px] text-muted-foreground">kWh/m²/dia</span>
                        {distKm !== null && (
                          <span className="text-[9px] text-muted-foreground">~{distKm.toFixed(0)}km</span>
                        )}
                        <Badge variant="secondary" className="text-[8px] ml-auto px-1 py-0">
                          {irradSource?.includes("INPE") || irradSource?.includes("inpe") ? "INPE" : irradSource || "Atlas"}
                        </Badge>
                      </>
                    ) : loadingIrrad ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buscando...
                      </span>
                    ) : cidade ? (
                      <span className="text-[10px] text-muted-foreground">Geocodificando...</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Preencha endereço</span>
                    )}
                  </div>
                </div>

                {/* Distância empresa → cliente */}
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Navigation className="h-2.5 w-2.5" /> Distância até o cliente
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex items-center gap-1 h-7 px-2 border rounded-md bg-muted/10 text-xs cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors min-w-[72px]"
                      onClick={() => {
                        setDistManualInput(String(distanciaKm ?? 0));
                        setDistDialogOpen(true);
                      }}
                      title="Clique para editar distância"
                    >
                      <span className="font-bold text-primary">{(distanciaKm ?? 0).toFixed(1)}</span>
                      <span className="text-[9px] text-muted-foreground font-medium">km</span>
                      <Edit3 className="h-2.5 w-2.5 text-muted-foreground/50 ml-auto" />
                    </div>
                  </div>
                </div>

                {/* Dialog Distância Manual */}
                <Dialog open={distDialogOpen} onOpenChange={setDistDialogOpen}>
                  <DialogContent className="max-w-xs">
                    <DialogHeader>
                      <DialogTitle className="text-sm flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-primary" />
                        Distância até o cliente
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Distância da empresa até o local de instalação (em km). Usada para cálculo de custos de deslocamento.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={distManualInput}
                          onChange={e => setDistManualInput(e.target.value)}
                          className="h-9 text-sm font-bold"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              onDistanciaKmChange?.(Number(distManualInput) || 0);
                              setDistDialogOpen(false);
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground font-medium">km</span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          onDistanciaKmChange?.(Number(distManualInput) || 0);
                          setDistDialogOpen(false);
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Dialog Irradiação Mensal */}
                <IrradiacaoMensalDialog
                  open={irradDialogOpen}
                  onOpenChange={setIrradDialogOpen}
                  ghiSeries={ghiSeries}
                  mediaAnual={irradiacao}
                  source={irradSource}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ RIGHT COLUMN — Map ═══ */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-2 lg:self-start">
        <Card className="border-border/40">
          <CardHeader className="pb-0.5 pt-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-semibold flex items-center gap-1.5 text-foreground">
                <MapPin className="h-3 w-3 text-secondary" />
                Mapa
              </CardTitle>
              {geoLat && geoLon && (
                <span className="text-[9px] font-mono text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded">
                  {geoLat.toFixed(4)}, {geoLon.toFixed(4)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-1.5">
            <Suspense fallback={
              <div className="h-[220px] lg:h-[360px] xl:h-[420px] flex items-center justify-center bg-muted/20">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Irradiação Mensal Dialog ─────────────────────────────────

const MONTH_LABELS_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const MONTH_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"];

function IrradiacaoMensalDialog({
  open, onOpenChange, ghiSeries, mediaAnual, source,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ghiSeries: Record<string, number> | null;
  mediaAnual: number | null;
  source: string | null;
}) {
  if (!ghiSeries) return null;

  const values = MONTH_KEYS.map(k => Number(ghiSeries[k] ?? 0));
  const avg = mediaAnual ?? (values.reduce((a, b) => a + b, 0) / 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            Irradiação solar diária média mensal no plano horizontal (kWh/m².dia)
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b uppercase tracking-wide text-[10px]">
                  Inclinação
                </th>
                {MONTH_LABELS_SHORT.slice(0, 6).map(m => (
                  <th key={m} className="px-3 py-2 text-center font-semibold text-muted-foreground border-b uppercase tracking-wide text-[10px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2.5 text-center text-muted-foreground border-b">0°</td>
                {values.slice(0, 6).map((v, i) => (
                  <td key={i} className="px-3 py-2.5 text-center font-mono border-b">{v.toFixed(2)}</td>
                ))}
              </tr>
            </tbody>
          </table>

          <table className="w-full text-xs border-collapse mt-2">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b uppercase tracking-wide text-[10px]">
                  Média
                </th>
                {MONTH_LABELS_SHORT.slice(6).map(m => (
                  <th key={m} className="px-3 py-2 text-center font-semibold text-muted-foreground border-b uppercase tracking-wide text-[10px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2.5 text-center font-mono font-bold border-b">{avg.toFixed(2)}</td>
                {values.slice(6).map((v, i) => (
                  <td key={i} className="px-3 py-2.5 text-center font-mono border-b">{v.toFixed(2)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-1">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
