import { useState } from "react";
import { AlertCircle, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSolaryumFiltros } from "@/hooks/useSolaryumFiltros";
import { useSolaryumKits, type ProdutoSolaryum } from "@/hooks/useSolaryumKits";
import { useTenantPremises } from "@/hooks/useTenantPremises";
import { SolaryumKitCard } from "./SolaryumKitCard";

interface SolaryumTabProps {
  ibgeCodigo: string | null;
  potenciaKwp: number | null;
  onSelectKit: (kit: ProdutoSolaryum) => void;
  selectedKitId: number | null;
}

export function SolaryumTab({ ibgeCodigo, potenciaKwp, onSelectKit, selectedKitId }: SolaryumTabProps) {
  const { premises } = useTenantPremises();

  const hasVertys = !!premises.solaryum_token_vertys;
  const hasJng = !!premises.solaryum_token_jng;
  const hasAnyToken = hasVertys || hasJng;

  const [distribuidor, setDistribuidor] = useState<"vertys" | "jng" | null>(null);
  const [endpoint, setEndpoint] = useState<"BuscarKits" | "MontarKits">("BuscarKits");
  const [marcaPainel, setMarcaPainel] = useState<string>("");
  const [marcaInversor, setMarcaInversor] = useState<string>("");
  const [tipoInv, setTipoInv] = useState<string>("");
  const [searchTriggered, setSearchTriggered] = useState(false);

  const { data: filtros, isLoading: filtrosLoading } = useSolaryumFiltros(distribuidor);

  const { data: kits, isLoading: kitsLoading, error: kitsError } = useSolaryumKits({
    distribuidor,
    endpoint,
    potenciaDoKit: potenciaKwp,
    ibge: ibgeCodigo,
    marcaPainel: marcaPainel || undefined,
    marcaInversor: marcaInversor || undefined,
    tipoInv: tipoInv ? Number(tipoInv) : undefined,
    cifComDescarga: premises.solaryum_cif_descarga,
    enabled: searchTriggered && !!distribuidor && !!ibgeCodigo,
  });

  // No tokens configured
  if (!hasAnyToken) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-warning/50 mb-3" />
        <p className="text-sm font-medium text-foreground">Tokens não configurados</p>
        <p className="text-xs text-muted-foreground mt-1">
          Configure os tokens Solaryum em Configurações → Integrações
        </p>
      </div>
    );
  }

  // No IBGE code
  if (!ibgeCodigo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-warning/50 mb-3" />
        <p className="text-sm font-medium text-foreground">Código IBGE não disponível</p>
        <p className="text-xs text-muted-foreground mt-1">
          Configure o código IBGE nas premissas ou cadastre o endereço do cliente para buscar kits por região
        </p>
      </div>
    );
  }

  const handleSearch = () => {
    if (!distribuidor) return;
    setSearchTriggered(false);
    // Force re-enable on next tick
    setTimeout(() => setSearchTriggered(true), 0);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg border border-border bg-muted/30">
        {/* Distribuidor */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Distribuidor</Label>
          <Select
            value={distribuidor ?? ""}
            onValueChange={(v) => {
              setDistribuidor(v as "vertys" | "jng");
              setSearchTriggered(false);
              setMarcaPainel("");
              setMarcaInversor("");
              setTipoInv("");
            }}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {hasVertys && <SelectItem value="vertys">Vertys</SelectItem>}
              {hasJng && <SelectItem value="jng">JNG</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* Endpoint */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Tipo de Kit</Label>
          <Select value={endpoint} onValueChange={(v) => setEndpoint(v as "BuscarKits" | "MontarKits")}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BuscarKits">Kits Prontos</SelectItem>
              <SelectItem value="MontarKits">Kits Personalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Marca Painel (dynamic from filtros) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Marca Painel</Label>
          <Select value={marcaPainel} onValueChange={setMarcaPainel} disabled={filtrosLoading || !distribuidor}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {(filtros?.marcasPaineis ?? []).map(m => (
                <SelectItem key={m.idMarca} value={String(m.idMarca)}>
                  {m.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Marca Inversor (dynamic) */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Marca Inversor</Label>
          <Select value={marcaInversor} onValueChange={setMarcaInversor} disabled={filtrosLoading || !distribuidor}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {(filtros?.marcasInversores ?? []).map(m => (
                <SelectItem key={m.idMarca} value={String(m.idMarca)}>
                  {m.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo Inversor */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Tipo Inversor</Label>
          <Select value={tipoInv} onValueChange={setTipoInv} disabled={!distribuidor}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="0">String</SelectItem>
              <SelectItem value="1">Micro</SelectItem>
              <SelectItem value="2">Híbrido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search button */}
        <div className="flex items-end">
          <Button
            onClick={handleSearch}
            disabled={!distribuidor || kitsLoading}
            className="w-full"
          >
            {kitsLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Buscar
          </Button>
        </div>
      </div>

      {/* Results */}
      {kitsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-52 rounded-lg" />
          ))}
        </div>
      )}

      {kitsError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/50 mb-3" />
          <p className="text-sm font-medium text-destructive">
            Erro ao buscar kits
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {(kitsError as Error).message}
          </p>
        </div>
      )}

      {!kitsLoading && !kitsError && searchTriggered && kits && kits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum kit encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Ajuste os filtros e tente novamente
          </p>
        </div>
      )}

      {!kitsLoading && !kitsError && kits && kits.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {kits.map(kit => (
            <SolaryumKitCard
              key={kit.idProduto}
              kit={kit}
              onSelect={onSelectKit}
              selected={selectedKitId === kit.idProduto}
            />
          ))}
        </div>
      )}

      {!searchTriggered && !kitsLoading && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            Selecione um distribuidor e clique em Buscar
          </p>
        </div>
      )}
    </div>
  );
}
