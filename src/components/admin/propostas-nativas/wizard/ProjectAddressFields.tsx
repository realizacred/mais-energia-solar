import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Copy, Loader2, AlertTriangle, Navigation } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { UF_LIST, type ClienteData } from "./types";

export interface ProjectAddress {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  lat: number | null;
  lon: number | null;
}

interface Props {
  address: ProjectAddress;
  onAddressChange: (address: ProjectAddress) => void;
  clienteData?: ClienteData | null;
  onCoordsChange?: (lat: number, lon: number) => void;
  reverseGeocodedAddress?: Partial<ProjectAddress> | null;
}

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

function isAddressEmpty(addr: ProjectAddress): boolean {
  return !addr.rua && !addr.cidade && !addr.uf && !addr.cep;
}

function clientHasAddress(c?: ClienteData | null): boolean {
  return !!(c && (c.endereco || c.cidade || c.cep));
}

export function ProjectAddressFields({
  address, onAddressChange, clienteData, onCoordsChange, reverseGeocodedAddress,
}: Props) {
  const [sameAsClient, setSameAsClient] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(address.uf);
  const lastReverseRef = useRef<string>("");
  const didAutoApplyRef = useRef(false);

  // ── Auto-apply client address on mount when project address is empty ──
  useEffect(() => {
    if (didAutoApplyRef.current) return;
    if (!clientHasAddress(clienteData)) return;
    if (!isAddressEmpty(address)) return;

    didAutoApplyRef.current = true;
    const mapped = mapClientToAddress(clienteData!);
    setSameAsClient(true);
    onAddressChange(mapped);
    forwardGeocode(mapped);
  }, [clienteData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply reverse geocoded address from map click ──
  useEffect(() => {
    if (!reverseGeocodedAddress) return;
    const key = JSON.stringify(reverseGeocodedAddress);
    if (key === lastReverseRef.current) return;
    lastReverseRef.current = key;

    const updated: ProjectAddress = {
      ...address,
      rua: reverseGeocodedAddress.rua || address.rua,
      numero: reverseGeocodedAddress.numero || address.numero,
      bairro: reverseGeocodedAddress.bairro || address.bairro,
      cidade: reverseGeocodedAddress.cidade || address.cidade,
      uf: reverseGeocodedAddress.uf || address.uf,
      cep: reverseGeocodedAddress.cep || address.cep,
      lat: reverseGeocodedAddress.lat ?? address.lat,
      lon: reverseGeocodedAddress.lon ?? address.lon,
    };
    onAddressChange(updated);
    if (sameAsClient) setSameAsClient(false);
  }, [reverseGeocodedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback((field: keyof ProjectAddress, value: string | number | null) => {
    const updated = { ...address, [field]: value };
    onAddressChange(updated);
    if (sameAsClient) setSameAsClient(false);
  }, [address, onAddressChange, sameAsClient]);

  // ── CEP auto-fill via ViaCEP ──
  const handleCepBlur = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const updated: ProjectAddress = {
          ...address,
          cep: formatCEP(digits),
          rua: data.logradouro || address.rua,
          bairro: data.bairro || address.bairro,
          cidade: data.localidade || address.cidade,
          uf: data.uf || address.uf,
          complemento: data.complemento || address.complemento,
          numero: address.numero,
          lat: address.lat,
          lon: address.lon,
        };
        onAddressChange(updated);
        forwardGeocode(updated);
      }
    } catch {
      // Silent — user can fill manually
    } finally {
      setCepLoading(false);
    }
  }, [address, onAddressChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Forward geocoding: address text → coordinates ──
  // Tries Google Maps API first, falls back to Nominatim
  const forwardGeocode = useCallback(async (addr: ProjectAddress) => {
    if (!addr.cidade && !addr.cep) return;

    const parts = [addr.rua, addr.numero, addr.bairro, addr.cidade, addr.uf, "Brasil"]
      .filter(Boolean).join(", ");
    if (!parts) return;

    setGeocoding(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;

      // Try Google Maps Geocoding first
      const { data: mapsConfig } = await supabase
        .from("integration_configs")
        .select("api_key, is_active")
        .eq("service_key", "google_maps")
        .eq("is_active", true)
        .maybeSingle();

      if (mapsConfig?.api_key) {
        const query = encodeURIComponent(parts);
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${mapsConfig.api_key}&region=br`
        );
        const json = await resp.json();
        if (json.status === "OK" && json.results?.[0]) {
          lat = json.results[0].geometry.location.lat;
          lon = json.results[0].geometry.location.lng;
        }
      }

      // Fallback to Nominatim
      if (lat === null) {
        const query = encodeURIComponent(parts);
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

      if (lat !== null && lon !== null) {
        onAddressChange({ ...addr, lat, lon });
        onCoordsChange?.(lat, lon);
      }
    } catch (err) {
      console.error("[ProjectAddressFields] Forward geocode error:", err);
    } finally {
      setGeocoding(false);
    }
  }, [onAddressChange, onCoordsChange]);

  // ── Debounced forward geocode ──
  const triggerForwardGeocode = useCallback((addr: ProjectAddress) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => forwardGeocode(addr), 800);
  }, [forwardGeocode]);

  // ── Map client data to ProjectAddress ──
  function mapClientToAddress(c: ClienteData): ProjectAddress {
    return {
      cep: c.cep || "",
      rua: c.endereco || "",
      numero: c.numero || "",
      complemento: c.complemento || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      uf: c.estado || "",
      lat: null, lon: null,
    };
  }

  // ── Same as client toggle ──
  const handleSameAsClient = useCallback((checked: boolean) => {
    setSameAsClient(checked);
    if (checked && clienteData) {
      const mapped = mapClientToAddress(clienteData);
      onAddressChange(mapped);
      forwardGeocode(mapped);
    }
  }, [clienteData, onAddressChange, forwardGeocode]);

  const handleUfChange = (uf: string) => {
    const updated = { ...address, uf, cidade: "" };
    onAddressChange(updated);
    if (sameAsClient) setSameAsClient(false);
  };

  const handleCidadeChange = (cidade: string) => {
    const updated = { ...address, cidade };
    onAddressChange(updated);
    triggerForwardGeocode(updated);
    if (sameAsClient) setSameAsClient(false);
  };

  const handleRuaBlur = () => {
    if (address.rua && address.cidade) triggerForwardGeocode(address);
  };

  const handleNumeroBlur = () => {
    if (address.rua && address.numero && address.cidade) triggerForwardGeocode(address);
  };

  const clientSummary = clienteData
    ? [clienteData.endereco, clienteData.numero ? `${clienteData.numero}` : "", clienteData.bairro, clienteData.cidade ? `${clienteData.cidade}/${clienteData.estado}` : ""].filter(Boolean).join(", ")
    : "";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Endereço de instalação
        </Label>
        {geocoding && (
          <Badge variant="outline" className="text-[9px] gap-1 text-primary border-primary/30 animate-pulse">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Geocodificando...
          </Badge>
        )}
      </div>

      {/* Same as client checkbox */}
      {clientHasAddress(clienteData) && (
        <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all duration-200
          ${sameAsClient
            ? 'border-primary/40 bg-primary/5 shadow-sm'
            : 'border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border'}
        `}>
          <Checkbox
            checked={sameAsClient}
            onCheckedChange={(v) => handleSameAsClient(!!v)}
          />
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground whitespace-nowrap">Mesmo endereço do cliente</span>
            {clientSummary && (
              <span className="text-foreground/70 font-medium truncate text-[11px]">
                ({clientSummary})
              </span>
            )}
          </div>
        </label>
      )}

      {/* Address grid */}
      <div className="rounded-lg border border-border/40 bg-card p-3 space-y-2.5">
        {/* Row 1: CEP + Número */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">CEP</Label>
            <div className="relative">
              <Input
                className="h-9 text-xs bg-background pr-8"
                placeholder="00000-000"
                value={address.cep}
                maxLength={9}
                onChange={(e) => updateField("cep", formatCEP(e.target.value))}
                onBlur={(e) => handleCepBlur(e.target.value)}
              />
              {cepLoading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Número</Label>
            <Input
              className="h-9 text-xs bg-background"
              placeholder="Nº"
              value={address.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              onBlur={handleNumeroBlur}
            />
          </div>
        </div>

        {/* Row 2: Rua */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Rua / Logradouro</Label>
          <Input
            className="h-9 text-xs bg-background"
            placeholder="Rua, Avenida, Travessa..."
            value={address.rua}
            onChange={(e) => updateField("rua", e.target.value)}
            onBlur={handleRuaBlur}
          />
        </div>

        {/* Row 3: Bairro + Cidade + UF */}
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Bairro</Label>
            <Input
              className="h-9 text-xs bg-background"
              placeholder="Bairro"
              value={address.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Cidade</Label>
            {cidades.length > 0 ? (
              <Select value={address.cidade} onValueChange={handleCidadeChange}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={cidadesLoading ? "Carregando..." : "Cidade"} />
                </SelectTrigger>
                <SelectContent>
                  {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-9 text-xs bg-background"
                placeholder="Cidade"
                value={address.cidade}
                onChange={(e) => updateField("cidade", e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">UF</Label>
            <Select value={address.uf} onValueChange={handleUfChange}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 4: Complemento */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Complemento</Label>
          <Input
            className="h-9 text-xs bg-background"
            placeholder="Apto, Bloco, Referência..."
            value={address.complemento}
            onChange={(e) => updateField("complemento", e.target.value)}
          />
        </div>
      </div>

      {/* Warning if no coordinates */}
      {!address.lat && address.cidade && !geocoding && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-[11px] text-warning font-medium">
            Coordenadas não definidas — clique no mapa ou preencha o endereço completo.
          </span>
        </div>
      )}
    </div>
  );
}
