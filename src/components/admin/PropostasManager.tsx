import { useState, useCallback } from "react";
import {
  FileText, Plus, Search, Zap, DollarSign,
  SunMedium,
} from "lucide-react";
import { LoadingState } from "@/components/ui-kit";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatProposalMessage } from "@/lib/solarMarket/formatProposalMessage";
import { extractProposalSummary, type ProposalSummary } from "@/lib/solarMarket/extractProposalSummary";
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Propostas Comerciais</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie propostas enviadas aos clientes
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Proposta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="flex items-center gap-3 pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-info">
            <CardContent className="flex items-center gap-3 pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
                <SunMedium className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enviadas}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-success">
            <CardContent className="flex items-center gap-3 pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aceitas}</p>
                <p className="text-xs text-muted-foreground">Aceitas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-warning">
            <CardContent className="flex items-center gap-3 pt-5 pb-4">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
                <p className="text-xs text-muted-foreground">Valor Aceitas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou cliente..."
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
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 opacity-30" />
                </div>
                <p className="font-medium">
                  {propostas.length === 0
                    ? "Nenhuma proposta cadastrada"
                    : "Nenhuma proposta encontrada"}
                </p>
                <p className="text-sm mt-1">
                  {propostas.length === 0
                    ? 'Clique em "Nova Proposta" para criar a primeira.'
                    : "Tente alterar os filtros de busca."}
                </p>
              </div>
            </CardContent>
          </Card>
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
