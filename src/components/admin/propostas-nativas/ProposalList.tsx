import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search, ChevronRight, Loader2, Send, Layers, Eye } from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  rascunho: { label: "Rascunho", variant: "secondary", color: "border-l-muted-foreground" },
  gerada: { label: "Gerada", variant: "default", color: "border-l-primary" },
  enviada: { label: "Enviada", variant: "outline", color: "border-l-info" },
  aceita: { label: "Aceita", variant: "default", color: "border-l-success" },
  recusada: { label: "Recusada", variant: "destructive", color: "border-l-destructive" },
  expirada: { label: "Expirada", variant: "secondary", color: "border-l-muted-foreground" },
  cancelada: { label: "Cancelada", variant: "destructive", color: "border-l-destructive" },
  draft: { label: "Rascunho", variant: "secondary", color: "border-l-muted-foreground" },
  generated: { label: "Gerada", variant: "default", color: "border-l-primary" },
  sent: { label: "Enviada", variant: "outline", color: "border-l-info" },
  accepted: { label: "Aceita", variant: "default", color: "border-l-success" },
  rejected: { label: "Recusada", variant: "destructive", color: "border-l-destructive" },
  expired: { label: "Expirada", variant: "secondary", color: "border-l-muted-foreground" },
};

const formatBRL = (v: number | null) => {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

const PAGE_SIZE = 25;

export function ProposalList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPropostas = useCallback(async () => {
    setLoading(true);
    try {
      // Count total
      let countQuery = supabase
        .from("propostas_nativas")
        .select("id", { count: "exact", head: true });
      if (statusFilter !== "all") countQuery = countQuery.eq("status", statusFilter);
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Fetch page
      const from = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from("propostas_nativas")
        .select(`
          id, titulo, codigo, versao_atual, status, origem, created_at, enviada_at, aceita_at, lead_id, cliente_id,
          proposta_versoes (
            id, versao_numero, status, valor_total, economia_mensal, payback_meses, potencia_kwp, grupo, engine_version, created_at,
            proposta_cenarios (id, tipo, preco_final, is_default),
            proposta_envios (id, canal, status, enviado_em)
          ),
          proposta_aceite_tokens (view_count, first_viewed_at, decisao)
        `)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data } = await query;
      setPropostas(data || []);
    } catch (e) {
      console.error("Erro ao carregar propostas:", e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadPropostas();
  }, [loadPropostas]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const filtered = propostas.filter(p => {
    const matchesSearch = !search || 
      p.titulo?.toLowerCase().includes(search.toLowerCase()) || 
      p.codigo?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Propostas Nativas</h2>
            <p className="text-sm text-muted-foreground">{filtered.length} de {propostas.length} proposta(s)</p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/admin/propostas-nativas/nova")}>
            <Plus className="h-4 w-4" /> Nova Proposta
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou código..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="gerada">Gerada</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="aceita">Aceita</SelectItem>
              <SelectItem value="recusada">Recusada</SelectItem>
              <SelectItem value="expirada">Expirada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-7 w-7 opacity-30" />
              </div>
              <p className="font-medium">
                {propostas.length === 0 ? "Nenhuma proposta nativa ainda" : "Nenhuma proposta encontrada"}
              </p>
              <p className="text-sm mt-1">
                {propostas.length === 0 
                  ? 'Clique em "Nova Proposta" para criar com o wizard.'
                  : "Tente alterar os filtros de busca."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => {
              const versions = (p.proposta_versoes || []) as any[];
              const latestVersion = versions
                .sort((a: any, b: any) => b.versao_numero - a.versao_numero)?.[0];
              const statusKey = p.status || latestVersion?.status || "rascunho";
              const statusInfo = STATUS_LABELS[statusKey] || STATUS_LABELS.rascunho;

              // Aggregate tracking from latest version
              const cenarios = (latestVersion?.proposta_cenarios || []) as any[];
              const envios = (latestVersion?.proposta_envios || []) as any[];
              const cenariosCount = cenarios.length;
              const enviosCount = envios.length;
              const engineVersion = latestVersion?.engine_version;

              // View tracking from tokens
              const tokensList = (p.proposta_aceite_tokens || []) as any[];
              const totalViewCount = tokensList.reduce((sum: number, t: any) => sum + (t.view_count || 0), 0);
              const hasDecision = tokensList.some((t: any) => t.decisao);

              return (
                <Card
                  key={p.id}
                  className={`hover:shadow-md transition-shadow cursor-pointer border-l-[3px] ${statusInfo.color} border-border/60`}
                  onClick={() => {
                    if (latestVersion) {
                      navigate(`/admin/propostas-nativas/${p.id}/versoes/${latestVersion.id}`);
                    }
                  }}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{p.titulo}</p>
                        <Badge variant={statusInfo.variant} className="text-[10px]">{statusInfo.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.codigo} • v{latestVersion?.versao_numero ?? 1}
                        {latestVersion?.potencia_kwp ? ` • ${latestVersion.potencia_kwp} kWp` : ""}
                        {latestVersion?.grupo ? ` • Grupo ${latestVersion.grupo}` : ""}
                      </p>
                      {/* Tracking badges */}
                      <div className="flex items-center gap-2 mt-1.5">
                        {cenariosCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                                <Layers className="h-3 w-3" />
                                {cenariosCount} cenário{cenariosCount > 1 ? "s" : ""}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {cenarios.map((c: any) => c.tipo).join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {enviosCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-[10px] text-info bg-info/10 rounded px-1.5 py-0.5">
                                <Send className="h-3 w-3" />
                                {enviosCount} envio{enviosCount > 1 ? "s" : ""}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {envios.map((e: any) => e.canal).join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {engineVersion && (
                          <span className="text-[10px] text-muted-foreground/60">
                            engine {engineVersion}
                          </span>
                        )}
                        {totalViewCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                            <Eye className="h-3 w-3" />
                            {totalViewCount} view{totalViewCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{formatBRL(latestVersion?.valor_total)}</p>
                      {latestVersion?.payback_meses ? (
                        <p className="text-xs text-muted-foreground">{latestVersion.payback_meses}m payback</p>
                      ) : null}
                      {latestVersion?.economia_mensal ? (
                        <p className="text-xs text-success">{formatBRL(latestVersion.economia_mensal)}/mês</p>
                      ) : null}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <PaginationControls
            page={page}
            totalPages={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            isFetching={loading}
            onGoToPage={setPage}
            onNextPage={() => setPage(p => p + 1)}
            onPrevPage={() => setPage(p => Math.max(1, p - 1))}
            hasNextPage={page < Math.ceil(totalCount / PAGE_SIZE)}
            hasPrevPage={page > 1}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
