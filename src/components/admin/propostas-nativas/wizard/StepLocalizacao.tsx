import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Sun, Home, Zap, Loader2, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { TIPO_TELHADO_OPTIONS, UF_LIST } from "./types";

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

export function StepLocalizacao({
  estado, cidade, tipoTelhado, distribuidoraId,
  onEstadoChange, onCidadeChange, onTipoTelhadoChange, onDistribuidoraChange,
  onIrradiacaoChange,
}: Props) {
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(estado);
  const [concessionarias, setConcessionarias] = useState<ConcessionariaOption[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);
  const [irradiacao, setIrradiacao] = useState<number | null>(null);
  const [loadingIrrad, setLoadingIrrad] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsKey, setMapsKey] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Fetch Google Maps key
  useEffect(() => {
    supabase.functions.invoke("get-maps-key").then(({ data }) => {
      if (data?.key) setMapsKey(data.key);
    });
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!mapsKey || mapsLoaded) return;
    if ((window as any).google?.maps) {
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, [mapsKey]);

  // Init map
  useEffect(() => {
    if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: -15.78, lng: -47.93 }, // Brazil center
      zoom: 5,
      mapTypeId: "hybrid",
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    });
    mapInstanceRef.current = map;
  }, [mapsLoaded]);

  // Geocode city and update map
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !cidade || !estado) return;
    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: `${cidade}, ${estado}, Brasil` }, (results: any, status: string) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        mapInstanceRef.current.setCenter(loc);
        mapInstanceRef.current.setZoom(13);

        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new google.maps.Marker({
          position: loc,
          map: mapInstanceRef.current,
          title: `${cidade}, ${estado}`,
        });

        // Fetch irradiation for this location
        fetchIrradiacao(loc.lat(), loc.lng());
      }
    });
  }, [cidade, estado, mapsLoaded]);

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
    try {
      // Try to get from irradiance system
      const { data: activeVersion } = await supabase
        .from("irradiance_dataset_versions")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (activeVersion) {
        const { data } = await supabase.rpc("get_irradiance_for_simulation", {
          _version_id: activeVersion.id,
          _lat: lat,
          _lon: lon,
        });
        if (data && typeof data === "object" && "ghi_annual_avg" in (data as any)) {
          const avg = (data as any).ghi_annual_avg;
          setIrradiacao(Number(avg));
          onIrradiacaoChange?.(Number(avg));
          return;
        }
      }
      setIrradiacao(null);
    } catch (err) {
      console.error("[StepLocalizacao] irradiance fetch error:", err);
      setIrradiacao(null);
    } finally {
      setLoadingIrrad(false);
    }
  }, [onIrradiacaoChange]);

  const handleEstadoChange = (v: string) => {
    onEstadoChange(v);
    onCidadeChange("");
    onDistribuidoraChange("", "");
  };

  const handleConcChange = (id: string) => {
    const c = concessionarias.find(c => c.id === id);
    onDistribuidoraChange(id, c?.nome || "");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> Localização
        </h3>
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
          Etapa 1/10
        </Badge>
      </div>

      {/* Fields Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Localização (Estado + Cidade) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Localização *</Label>
          <div className="flex gap-1.5">
            <Select value={estado} onValueChange={handleEstadoChange}>
              <SelectTrigger className="h-9 w-[72px] shrink-0">
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
                <SelectTrigger className="h-9 flex-1">
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

        {/* Irradiação */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Sun className="h-3 w-3 text-warning" /> Irradiação
            {loadingIrrad && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </Label>
          <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/20">
            {irradiacao !== null ? (
              <>
                <span className="text-sm font-semibold text-foreground">
                  {irradiacao.toFixed(2)} kWh/m²/dia
                </span>
                <Badge variant="secondary" className="text-[9px]">NASA</Badge>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                {cidade ? "Dados indisponíveis" : "Selecione a localização"}
              </span>
            )}
          </div>
        </div>

        {/* Tipo de Telhado */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Home className="h-3 w-3" /> Tipo de Telhado *
          </Label>
          <Select value={tipoTelhado} onValueChange={onTipoTelhadoChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {TIPO_TELHADO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <SelectTrigger className={`h-9 ${!distribuidoraId && estado ? "border-destructive/50" : ""}`}>
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
      </div>

      {/* Map */}
      <div className="rounded-xl border border-border/50 overflow-hidden relative" style={{ height: 420 }}>
        {!mapsKey ? (
          <div className="flex items-center justify-center h-full bg-muted/20">
            <div className="text-center space-y-2">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Mapa indisponível — configure a API key do Google Maps</p>
            </div>
          </div>
        ) : !mapsLoaded ? (
          <div className="flex items-center justify-center h-full bg-muted/20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}
        {/* Map label overlay */}
        {cidade && estado && (
          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border/50">
            <p className="text-sm font-semibold">{cidade}</p>
            <p className="text-[10px] text-muted-foreground">{cidade}, {estado}</p>
          </div>
        )}
      </div>

      {/* Footer nav hint */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => window.history.back()}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
