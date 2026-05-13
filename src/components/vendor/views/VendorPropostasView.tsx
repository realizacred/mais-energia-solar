/**
 * VendorPropostasView — Portal Consultor: Minhas Propostas (read-only).
 *
 * SSOT: lê apenas `propostas_nativas` + `proposta_versoes` via
 * `useMinhasPropostasConsultor` (payload sanitizado, sem custo/margem/comissão).
 *
 * Boundary: consultor não cria, não edita, não recalcula, não gera PDF local.
 * Toda ação delega aos serviços oficiais (proposal-send, tokens, storage).
 */
import { useMemo, useState } from "react";
import { FileText, Send, Eye, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import {
  useMinhasPropostasConsultor,
  computePropostasKpis,
  type PropostaConsultor,
} from "@/hooks/useMinhasPropostasConsultor";
import { PropostaConsultorCard } from "@/components/vendor/propostas/PropostaConsultorCard";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function VendorPropostasView({ portal }: Props) {
  const consultorId = portal.vendedor?.id ?? null;
  const { data = [], isLoading, isError, refetch } = useMinhasPropostasConsultor(consultorId);
  const [search, setSearch] = useState("");

  const filtered = useMemo<PropostaConsultor[]>(() => {
    const q = normalize(search.trim());
    if (!q) return data;
    return data.filter((p) =>
      [p.codigo, p.titulo, p.cliente_nome, p.proposta_num?.toString()]
        .filter(Boolean)
        .some((v) => normalize(String(v)).includes(q)),
    );
  }, [data, search]);

  const kpis = useMemo(() => computePropostasKpis(data), [data]);

  if (!consultorId || consultorId === "admin") {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">
            Esta área é exclusiva de consultores com perfil vinculado.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <LoadingState message="Carregando propostas..." size="md" />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Não foi possível carregar suas propostas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Minhas Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe propostas oficiais geradas para seus leads e clientes.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total" value={kpis.total} icon={FileText} accent="primary" />
        <KpiCard label="Enviadas" value={kpis.enviadas} icon={Send} accent="info" />
        <KpiCard label="Visualizadas" value={kpis.visualizadas} icon={Eye} accent="warning" />
        <KpiCard label="Aceitas" value={kpis.aceitas} icon={CheckCircle2} accent="success" />
        <KpiCard label="Expiradas" value={kpis.expiradas} icon={AlertTriangle} accent="destructive" />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input
          placeholder="Buscar por cliente, código ou título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-2">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground">Nenhuma proposta encontrada</p>
            <p className="text-xs text-muted-foreground">
              Quando o sistema gerar propostas vinculadas a você, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PropostaConsultorCard key={p.id} proposta={p} onChanged={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "info" | "warning" | "success" | "destructive";
}

function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  const accentMap: Record<KpiCardProps["accent"], string> = {
    primary: "border-l-primary/60 text-primary",
    info: "border-l-info/60 text-info",
    warning: "border-l-warning/60 text-warning",
    success: "border-l-success/60 text-success",
    destructive: "border-l-destructive/60 text-destructive",
  };
  return (
    <Card className={`border-l-[3px] ${accentMap[accent]}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-3.5 w-3.5 opacity-70" />
        </div>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}

// Avoids "Skeleton unused" warning if a future loading variant is added
export const _internal = { Skeleton };
