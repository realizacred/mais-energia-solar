import { useState, useCallback } from "react";
import {
  FileText, Plus, Search, Zap, DollarSign,
  SunMedium,
} from "lucide-react";
import { LoadingState, PageHeader, EmptyState, SearchInput, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePropostas, type Proposta } from "@/hooks/usePropostas";
import { NovaPropostaDialog } from "./propostas/NovaPropostaDialog";
import { PropostaDetailDialog } from "./propostas/PropostaDetailDialog";
import { PropostaCard } from "@/components/propostas/PropostaCard";
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
  if (opts.totalValue) lines.push(`💰 Valor: R$ ${opts.totalValue.toLocaleString("pt-BR")}`);
  if (opts.economiaMensal) lines.push(`📉 Economia: R$ ${opts.economiaMensal.toLocaleString("pt-BR")}/mês`);
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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

  // Filter
  const filtered = propostas.filter((p) => {
    const matchesSearch =
      !search ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_nome?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: propostas.length,
    enviadas: propostas.filter((p) => ["enviada", "generated"].includes(p.status)).length,
    aceitas: propostas.filter((p) => p.status === "aceita").length,
    valorTotal: propostas
      .filter((p) => p.status === "aceita")
      .reduce((acc, p) => acc + (p.preco_total || 0), 0),
  };

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

      // Build prefill message
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

      // Signal to WaInbox via sessionStorage (existing pattern)
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
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova Proposta
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Total" value={stats.total} color="primary" />
          <StatCard icon={SunMedium} label="Enviadas" value={stats.enviadas} color="info" />
          <StatCard icon={Zap} label="Aceitas" value={stats.aceitas} color="success" />
          <StatCard icon={DollarSign} label="Valor Aceitas" value={formatCurrency(stats.valorTotal)} color="warning" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome ou cliente..."
            className="flex-1 max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <PropostaCard
                key={p.id}
                proposta={p}
                onOpenDetail={setDetailProposta}
                onWhatsApp={handleWhatsApp}
              />
            ))}
          </div>
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
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
