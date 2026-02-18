import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Search, Copy, Loader2, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
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
  /** Called when coordinates change (for map sync) */
  onCoordsChange?: (lat: number, lon: number) => void;
  /** Called when a map click provides reverse-geocoded address */
  reverseGeocodedAddress?: Partial<ProjectAddress> | null;
}

const EMPTY_ADDRESS: ProjectAddress = {
  cep: "", rua: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf: "", lat: null, lon: null,
};

function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
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

  // Apply reverse geocoded address from map click
  useEffect(() => {
    if (!reverseGeocodedAddress) return;
    const key = JSON.stringify(reverseGeocodedAddress);
    if (key === lastReverseRef.current) return;
    lastReverseRef.current = key;

    onAddressChange({
      ...address,
      rua: reverseGeocodedAddress.rua || address.rua,
      numero: reverseGeocodedAddress.numero || address.numero,
      bairro: reverseGeocodedAddress.bairro || address.bairro,
      cidade: reverseGeocodedAddress.cidade || address.cidade,
      uf: reverseGeocodedAddress.uf || address.uf,
      cep: reverseGeocodedAddress.cep || address.cep,
      lat: reverseGeocodedAddress.lat ?? address.lat,
      lon: reverseGeocodedAddress.lon ?? address.lon,
    });
  }, [reverseGeocodedAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback((field: keyof ProjectAddress, value: string | number | null) => {
    const updated = { ...address, [field]: value };
    onAddressChange(updated);
    if (sameAsClient) setSameAsClient(false);
  }, [address, onAddressChange, sameAsClient]);

  // CEP auto-fill via ViaCEP
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
          lat: address.lat,
          lon: address.lon,
        };
        onAddressChange(updated);
        // Trigger forward geocoding
        forwardGeocode(updated);
      }
    } catch {
      // Silent fail — user can fill manually
    } finally {
      setCepLoading(false);
    }
  }, [address, onAddressChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Forward geocoding: address text → coordinates
  const forwardGeocode = useCallback(async (addr: ProjectAddress) => {
    if (!addr.cidade || !addr.uf) return;

    const parts = [addr.rua, addr.numero, addr.bairro, addr.cidade, addr.uf, "Brasil"]
      .filter(Boolean).join(", ");

    if (!parts) return;

    setGeocoding(true);
    try {
      // Use Nominatim (free, no API key needed for forward geocoding)
      const query = encodeURIComponent(parts);
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
        { headers: { "User-Agent": "MaisEnergiaSolar/1.0" } }
      );
      const results = await resp.json();
      if (results?.[0]) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        onAddressChange({ ...addr, lat, lon });
        onCoordsChange?.(lat, lon);
      }
    } catch {
      // Silent
    } finally {
      setGeocoding(false);
    }
  }, [onAddressChange, onCoordsChange]);

  // Debounced forward geocode when rua+numero changes
  const triggerForwardGeocode = useCallback((addr: ProjectAddress) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => forwardGeocode(addr), 800);
  }, [forwardGeocode]);

  // Same as client toggle
  const handleSameAsClient = useCallback((checked: boolean) => {
    setSameAsClient(checked);
    if (checked && clienteData) {
      const mapped: ProjectAddress = {
        cep: clienteData.cep || "",
        rua: clienteData.endereco || "",
        numero: clienteData.numero || "",
        complemento: clienteData.complemento || "",
        bairro: clienteData.bairro || "",
        cidade: clienteData.cidade || "",
        uf: clienteData.estado || "",
        lat: null, lon: null,
      };
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
    if (address.rua && address.cidade) {
      triggerForwardGeocode(address);
    }
  };

  const handleNumeroBlur = () => {
    if (address.rua && address.numero && address.cidade) {
      triggerForwardGeocode(address);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with "same as client" */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Endereço de Instalação
        </Label>
        <div className="flex items-center gap-2">
          {geocoding && (
            <Badge variant="outline" className="text-[9px] gap-1 text-primary border-primary/30">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Localizando
            </Badge>
          )}
          {address.lat !== null && address.lon !== null && (
            <Badge variant="outline" className="text-[9px] gap-1 text-success border-success/30">
              <MapPin className="h-2.5 w-2.5" />
              {address.lat.toFixed(4)}, {address.lon.toFixed(4)}
            </Badge>
          )}
        </div>
      </div>

      {/* Same as client checkbox */}
      {clienteData && (clienteData.endereco || clienteData.cidade) && (
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
          <Checkbox
            checked={sameAsClient}
            onCheckedChange={(v) => handleSameAsClient(!!v)}
          />
          <div className="flex items-center gap-1.5 text-xs">
            <Copy className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Mesmo endereço do cliente</span>
            {clienteData.cidade && (
              <span className="text-foreground font-medium">
                ({clienteData.endereco ? `${clienteData.endereco}, ` : ""}{clienteData.cidade}/{clienteData.estado})
              </span>
            )}
          </div>
        </label>
      )}

      {/* Grid: CEP + Número */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">CEP</Label>
          <div className="relative">
            <Input
              className="h-9 text-xs pr-8"
              placeholder="00000-000"
              value={address.cep}
              maxLength={9}
              onChange={(e) => updateField("cep", formatCEP(e.target.value))}
              onBlur={(e) => handleCepBlur(e.target.value)}
            />
            {cepLoading && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Número</Label>
          <Input
            className="h-9 text-xs"
            placeholder="Nº"
            value={address.numero}
            onChange={(e) => updateField("numero", e.target.value)}
            onBlur={handleNumeroBlur}
          />
        </div>
      </div>

      {/* Rua */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Rua / Logradouro</Label>
        <Input
          className="h-9 text-xs"
          placeholder="Rua, Avenida, Travessa..."
          value={address.rua}
          onChange={(e) => updateField("rua", e.target.value)}
          onBlur={handleRuaBlur}
        />
      </div>

      {/* Bairro + Cidade + UF */}
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Bairro</Label>
          <Input
            className="h-9 text-xs"
            placeholder="Bairro"
            value={address.bairro}
            onChange={(e) => updateField("bairro", e.target.value)}
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Cidade</Label>
          {cidades.length > 0 ? (
            <Select value={address.cidade} onValueChange={handleCidadeChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={cidadesLoading ? "Carregando..." : "Cidade"} />
              </SelectTrigger>
              <SelectContent>
                {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-9 text-xs"
              placeholder="Cidade"
              value={address.cidade}
              onChange={(e) => updateField("cidade", e.target.value)}
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">UF</Label>
          <Select value={address.uf} onValueChange={handleUfChange}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Complemento */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Complemento</Label>
        <Input
          className="h-9 text-xs"
          placeholder="Apto, Bloco, Referência..."
          value={address.complemento}
          onChange={(e) => updateField("complemento", e.target.value)}
        />
      </div>

      {/* Warning if no coordinates */}
      {!address.lat && address.cidade && !geocoding && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
          <span className="text-[10px] text-warning">
            Coordenadas não definidas. Clique no mapa ou preencha o endereço completo para localizar automaticamente.
          </span>
        </div>
      )}
    </div>
  );
}
