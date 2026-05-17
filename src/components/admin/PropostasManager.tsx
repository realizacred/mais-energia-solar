import { useState, useCallback, useMemo } from "react";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import {
  FileText, Plus, Search, Zap, DollarSign,
  SunMedium, FileX, Download, X, SlidersHorizontal,
} from "lucide-react";
import { LoadingState, PageHeader, EmptyState, SearchInput, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { usePropostas, type Proposta } from "@/hooks/usePropostas";
import { NovaPropostaDialog } from "./propostas/NovaPropostaDialog";
import { PropostaDetailDialog } from "./propostas/PropostaDetailDialog";
import { PropostaCard } from "@/components/propostas/PropostaCard";
import { TablePagination } from "@/components/ui-kit/TablePagination";
// Inline types (previously from SolarMarket lib)
interface ProposalSummary {
  totalValue?: number | null;
  downPayment?: number | null;
  installments?: { qty: number; value: number } | null;
  savings?: { monthly?: number | null } | null;
  equipment?: { modules?: string | null; inverter?: string | null } | null;
  raw?: { linkPdf?: string | null } | null;
}

function extractProposalSummary(_payload: any): ProposalSummary {
  return {};
}

function formatProposalMessage(opts: {
  clienteNome?: string; totalValue?: number; downPayment?: number | null;
  installmentsQty?: number; installmentsValue?: number;
  modules?: string; inverter?: string; economiaMensal?: number; linkPdf?: string;
}): string {
  const lines: string[] = [];
  if (opts.clienteNome) lines.push(`Olá ${opts.clienteNome}! 👋`);
  lines.push("Segue o resumo da sua proposta:");
  if (opts.totalValue) lines.push(`💰 Valor: ${formatBRL(opts.totalValue)}`);
  if (opts.economiaMensal) lines.push(`📉 Economia: ${formatBRL(opts.economiaMensal)}/mês`);
  if (opts.linkPdf) lines.push(`📄 PDF: ${opts.linkPdf}`);
  return lines.join("\n");
}
import { useNavigate } from "react-router-dom";

const STATUS_MAP: Record<string, { label: string }> = {
  pendente: { label: "Pendente" },
  rascunho: { label: "Rascunho" },
  enviada: { label: "Enviada" },
  visualizada: { label: "Visualizada" },
  aceita: { label: "Aceita" },
  recusada: { label: "Recusada" },
  expirada: { label: "Expirada" },
  generated: { label: "Gerada" },
};

function formatCurrency(value: number | null) {
  if (!value) return "—";
  return formatBRLInteger(value);
}

export function PropostasManager() {
  const {
    propostas, loading, creating, createProposta, deleteProposta, updateStatus,
  } = usePropostas();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailProposta, setDetailProposta] = useState<Proposta | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filter
  const filtered = useMemo(() => {
    return propostas.filter((p) => {
      const matchesSearch =
        !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.cliente_nome?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [propostas, search, statusFilter]);

  // Reset page on filter change
  const handleSearchChange = (v: string) => { setSearch(v); setPage(1); };
  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(1); };

  // Paginate
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.length > 0) count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [search, statusFilter]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  };

  // Stats
  const stats = useMemo(() => ({
    total: propostas.length,
    enviadas: propostas.filter((p) => ["enviada", "generated"].includes(p.status)).length,
    aceitas: propostas.filter((p) => p.status === "aceita").length,
    valorTotal: propostas
      .filter((p) => p.status === "aceita")
      .reduce((acc, p) => acc + (p.preco_total || 0), 0),
  }), [propostas]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/[/:\s]/g, "-");
    const header = ["Nome", "Cliente", "Status", "Potência kWp", "Valor Total", "Economia Mensal", "Consultor", "Criado em"];
    const rows = filtered.map(p => [
      p.nome || "",
      p.cliente_nome || "",
      p.status || "",
      String(p.potencia_kwp || ""),
      String(p.preco_total || ""),
      String(p.economia_mensal || ""),
      p.vendedor?.nome || "",
      p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `propostas_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success(`${filtered.length} propostas exportadas`);
  }, [filtered]);

  // WhatsApp CTA handler
  const handleWhatsApp = useCallback(
    (proposta: Proposta, summary: ProposalSummary) => {
      const phone = proposta.cliente_celular?.replace(/\D/g, "");
      if (!phone || phone.length < 10) {
        toast({
          title: "Telefone não disponível",
          description: "Esta proposta não possui telefone do cliente.",
          variant: "destructive",
        });
        return;
      }

      const msg = formatProposalMessage({
        clienteNome: proposta.cliente_nome ?? undefined,
        totalValue: proposta.preco_total ?? summary.totalValue,
        downPayment: summary.downPayment,
        installmentsQty: summary.installments?.qty,
        installmentsValue: summary.installments?.value,
        modules: proposta.modelo_modulo ?? summary.equipment?.modules ?? undefined,
        inverter: proposta.modelo_inversor ?? summary.equipment?.inverter ?? undefined,
        economiaMensal: proposta.economia_mensal ?? summary.savings?.monthly ?? undefined,
        linkPdf: proposta.link_pdf ?? summary.raw?.linkPdf ?? undefined,
      });

      sessionStorage.setItem(
        "wa_auto_open_lead",
        JSON.stringify({
          phone,
          nome: proposta.cliente_nome,
          prefillMessage: msg,
        })
      );

      navigate("/admin/inbox");
    },
    [navigate]
  );

  if (loading) {
    return <LoadingState message="Carregando propostas..." />;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          icon={FileText}
          title="Propostas Comerciais"
          description="Gerencie propostas enviadas aos clientes"
          actions={
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Exportar
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Exportar propostas filtradas em CSV</TooltipContent>
              </Tooltip>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Nova Proposta
              </Button>
            </div>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Total" value={stats.total} color="primary" />
          <StatCard icon={SunMedium} label="Enviadas" value={stats.enviadas} color="info" />
          <StatCard icon={Zap} label="Aceitas" value={stats.aceitas} color="success" />
          <StatCard icon={DollarSign} label="Valor Aceitas" value={formatCurrency(stats.valorTotal)} color="warning" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Buscar por nome ou cliente..."
            className="flex-1 max-w-sm"
          />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  {val.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <>
              <Badge variant="outline" className="text-[10px] h-6 bg-primary/10 text-primary border-primary/20 shrink-0">
                <SlidersHorizontal className="h-3 w-3 mr-1" />
                {activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-9 px-2 text-xs gap-1 hover:text-destructive shrink-0">
                <X className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </>
          )}
        </div>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={propostas.length === 0 ? "Nenhuma proposta cadastrada" : "Nenhuma proposta encontrada"}
            description={propostas.length === 0 ? 'Clique em "Nova Proposta" para criar a primeira.' : "Tente alterar os filtros de busca."}
            action={propostas.length === 0 ? { label: "Nova Proposta", onClick: () => setCreateOpen(true), icon: Plus } : undefined}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedItems.map((p) => (
                <PropostaCard
                  key={p.id}
                  proposta={p}
                  onOpenDetail={setDetailProposta}
                  onWhatsApp={handleWhatsApp}
                />
              ))}
            </div>

            {/* Pagination */}
            {filtered.length > pageSize && (
              <TablePagination
                totalItems={filtered.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </>
        )}

        {/* Dialogs */}
        <NovaPropostaDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={createProposta}
          creating={creating}
        />

        <PropostaDetailDialog
          proposta={detailProposta}
          open={!!detailProposta}
          onOpenChange={(open) => !open && setDetailProposta(null)}
          onStatusChange={updateStatus}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent className="w-[90vw] max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <FileX className="w-5 h-5 text-destructive" />
                </div>
                <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A proposta e todos os dados
                relacionados serão removidos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteId) deleteProposta(deleteId);
                  setDeleteId(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
