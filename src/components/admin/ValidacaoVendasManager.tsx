import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ApproveVendaDialog } from "./ApproveVendaDialog";
import type { PaymentItemInput } from "@/services/paymentComposition/types";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle, XCircle, Eye, Clock, DollarSign, User, MapPin,
  TrendingUp, Zap, AlertTriangle, History, Filter, RotateCcw, MoreHorizontal, ShieldCheck,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatters";
import { usePendingValidations, type PendingValidation } from "@/hooks/usePendingValidations";
import { useReopenLead } from "@/hooks/useReopenLead";
import { useLeadStatusMap } from "@/hooks/useLeadStatusMap";
import {
  useVendedoresAtivos,
  useApproveVenda,
  useRejectVenda,
  fetchLeadSimulacoes,
  fetchClientePaymentComposition,
  type LeadSimulacao,
} from "@/hooks/useValidacaoVendas";

interface Vendedor {
  id: string;
  nome: string;
  percentual_comissao: number | null;
}

export function ValidacaoVendasManager() {
  const {
    pendingItems, historyItems, loading, historyLoading,
    refetchPending, fetchHistory,
  } = usePendingValidations();

  const [approving, setApproving] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<PendingValidation | null>(null);
  
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("2.0");
  const [valorVenda, setValorVenda] = useState(0);
  const [paymentItems, setPaymentItems] = useState<PaymentItemInput[]>([]);
  const [loadingVendedor, setLoadingVendedor] = useState(false);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [leadSimulacoes, setLeadSimulacoes] = useState<LeadSimulacao[]>([]);
  const [selectedSimulacaoId, setSelectedSimulacaoId] = useState<string>("");
  const { reopenLead, reopening } = useReopenLead(() => refetchPending());
  const { reopenTarget } = useLeadStatusMap();

  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");

  // Filters
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [filterPeriodo, setFilterPeriodo] = useState("all");

  // Fetch vendedores via hook
  const { data: vendedores = [] } = useVendedoresAtivos();

  // Mutations
  const approveVendaMutation = useApproveVenda();
  const rejectVendaMutation = useRejectVenda();

  // Derived: unique vendors from pending items
  const vendedorNames = useMemo(() => {
    const map = new Map<string, string>();
    pendingItems.forEach((c) => {
      const vId = c.leads?.consultor_id;
      const vNome = c.leads?.consultores?.nome || c.leads?.consultor;
      if (vId && vNome) map.set(vId, vNome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pendingItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = [...pendingItems];
    if (filterVendedor !== "all") {
      items = items.filter((c) => c.leads?.consultor_id === filterVendedor);
    }
    if (filterPeriodo !== "all") {
      const now = new Date();
      const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[filterPeriodo] || 0;
      if (days > 0) {
        const cutoff = new Date(now.getTime() - days * 86400000);
        items = items.filter((c) => new Date(c.created_at) >= cutoff);
      }
    }
    return items;
  }, [pendingItems, filterVendedor, filterPeriodo]);

  // Stats
  const stats = useMemo(() => {
    const totalValue = pendingItems.reduce((acc, c) => acc + (c.simulacoes?.investimento_estimado || c.valor_projeto || 0), 0);
    const totalComissao = (totalValue * 2) / 100;
    const totalPotencia = pendingItems.reduce((acc, c) => acc + (c.simulacoes?.potencia_recomendada_kwp || c.potencia_kwp || 0), 0);
    return { count: pendingItems.length, totalValue, totalComissao, totalPotencia };
  }, [pendingItems]);

  // Open approval dialog
  const openApprovalDialog = async (cliente: PendingValidation) => {
    setSelectedCliente(cliente);
    setLeadSimulacoes([]);
    setSelectedSimulacaoId("");
    // Try to load payment composition: DB first, localStorage fallback
    const leadId = cliente.lead_id;
    let prefilledItems: PaymentItemInput[] = [];
    // 1) Try DB (source of truth)
    const dbItems = await fetchClientePaymentComposition(cliente.id);
    if (dbItems.length > 0) {
      prefilledItems = dbItems;
    }
    // 2) Fallback to localStorage
    if (prefilledItems.length === 0 && leadId) {
      try {
        const stored = localStorage.getItem(`lead_payment_composition_${leadId}`);
        if (stored) {
          prefilledItems = JSON.parse(stored);
        }
      } catch (e) {
        console.warn("[ValidacaoVendas] Could not parse stored payment composition:", e);
      }
    }
    setPaymentItems(prefilledItems);

    const valor = cliente.simulacoes?.investimento_estimado || cliente.valor_projeto || 0;
    setValorVenda(valor > 0 ? valor : 0);

    setLoadingVendedor(true);

    try {
      const vendedorId = cliente.leads?.consultor_id;
      if (vendedorId) {
        const matchedVendedor = vendedores.find((v) => v.id === vendedorId);
        if (matchedVendedor) {
          setSelectedVendedorId(matchedVendedor.id);
          setPercentualComissao(matchedVendedor.percentual_comissao?.toString() || "2.0");
        } else {
          setSelectedVendedorId("");
          setPercentualComissao("2.0");
        }
      } else {
        const vendedorNome = cliente.leads?.consultores?.nome || cliente.leads?.consultor;
        if (vendedorNome) {
          const matchedVendedor = vendedores.find((v) => v.nome.toLowerCase() === vendedorNome.toLowerCase());
          if (matchedVendedor) {
            setSelectedVendedorId(matchedVendedor.id);
            setPercentualComissao(matchedVendedor.percentual_comissao?.toString() || "2.0");
          } else {
            setSelectedVendedorId("");
            setPercentualComissao("2.0");
          }
        } else {
          setSelectedVendedorId("");
          setPercentualComissao("2.0");
        }
      }

      if (cliente.lead_id) {
        const sims = await fetchLeadSimulacoes(cliente.lead_id);
        setLeadSimulacoes(sims);

        if (cliente.simulacao_aceita_id && sims.some((s) => s.id === cliente.simulacao_aceita_id)) {
          setSelectedSimulacaoId(cliente.simulacao_aceita_id);
        } else if (sims.length > 0) {
          setSelectedSimulacaoId(sims[0].id);
          if (sims[0].investimento_estimado && sims[0].investimento_estimado > 0) {
            setValorVenda(sims[0].investimento_estimado);
          }
        }
      }
    } catch {
      setPercentualComissao("2.0");
    } finally {
      setLoadingVendedor(false);
    }

    setApprovalDialogOpen(true);
  };

  const handleVendedorChange = (vendedorId: string) => {
    setSelectedVendedorId(vendedorId);
    const vendedor = vendedores.find((v) => v.id === vendedorId);
    if (vendedor?.percentual_comissao != null) {
      setPercentualComissao(vendedor.percentual_comissao.toString());
    } else {
      setPercentualComissao("2.0");
    }
  };

  const handleSimulacaoChange = (simId: string) => {
    setSelectedSimulacaoId(simId);
    if (simId === "manual") {
      setValorVenda(0);
      return;
    }
    const sim = leadSimulacoes.find((s) => s.id === simId);
    if (sim?.investimento_estimado && sim.investimento_estimado > 0) {
      setValorVenda(sim.investimento_estimado);
    }
  };

  const handleApprove = async () => {
    if (!selectedCliente) return;
    if (approving) return; // prevent double submit

    const valorBase = valorVenda || 0;
    if (valorBase <= 0) {
      toast({
        title: "Valor obrigatório",
        description: "Informe o valor da venda para validar.",
        variant: "destructive",
      });
      return;
    }

    // Validate payment composition if items exist
    let computedItems: any[] = [];
    if (paymentItems.length > 0) {
      const { validateComposition, computeSummary, computeItem } = await import("@/services/paymentComposition/calculator");
      const compositionErrors = validateComposition(paymentItems, valorBase);
      if (compositionErrors.length > 0) {
        toast({
          title: "Composição de pagamento inválida",
          description: compositionErrors[0],
          variant: "destructive",
        });
        return;
      }
      const summary = computeSummary(paymentItems, valorBase);
      if (!summary.is_valid) {
        toast({
          title: "Composição divergente",
          description: `A soma dos pagamentos não bate com o valor da venda. Diferença: ${formatBRL(Math.abs(summary.valor_restante))}`,
          variant: "destructive",
        });
        return;
      }
      // Pre-compute items for the RPC payload
      computedItems = paymentItems.map((item) => {
        const computed = computeItem(item);
        return {
          forma_pagamento: computed.forma_pagamento,
          valor_base: computed.valor_base,
          entrada: computed.entrada,
          data_pagamento: computed.data_pagamento || null,
          data_primeiro_vencimento: computed.data_primeiro_vencimento || null,
          parcelas: computed.parcelas,
          intervalo_dias: computed.intervalo_dias,
          juros_tipo: computed.juros_tipo,
          juros_valor: computed.juros_valor,
          juros_responsavel: computed.juros_responsavel,
          observacoes: computed.observacoes || null,
          metadata_json: {},
          parcelas_detalhes: computed.parcelas_detalhes.map((p) => ({
            numero_parcela: p.numero_parcela,
            tipo_parcela: p.tipo_parcela,
            valor: p.valor,
            vencimento: p.vencimento,
          })),
        };
      });
    }

    setApproving(selectedCliente.id);
    try {
      await approveVendaMutation.mutateAsync({
        clienteId: selectedCliente.id,
        leadId: selectedCliente.lead_id || null,
        valorTotal: valorBase,
        observacoes: null,
        itens: computedItems,
      });

      toast({
        title: "Venda validada!",
        description: `Venda de ${selectedCliente.nome} aprovada com sucesso.`,
      });
      setApprovalDialogOpen(false);
      setSelectedCliente(null);
      setPaymentItems([]);
      // Clean up localStorage
      if (selectedCliente?.lead_id) {
        localStorage.removeItem(`lead_payment_composition_${selectedCliente.lead_id}`);
      }
      refetchPending();
    } catch (error: any) {
      toast({ title: "Erro ao validar venda", description: error.message, variant: "destructive" });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async () => {
    if (!selectedCliente || !motivoRejeicao.trim()) return;
    setRejecting(true);
    try {
      const result = await rejectVendaMutation.mutateAsync({
        clienteId: selectedCliente.id,
        leadId: selectedCliente.lead_id,
        reopenStatusId: reopenTarget?.id || null,
        motivoRejeicao,
      });

      if (result.deactivated) {
        toast({
          title: "Venda rejeitada",
          description: `Cliente desativado (possui ${result.blocking.join(", ")} vinculados).`,
        });
      } else {
        toast({
          title: "Venda rejeitada",
          description: `A venda de ${selectedCliente.nome} foi rejeitada. Motivo registrado.`,
        });
      }

      setRejectionDialogOpen(false);
      setSelectedCliente(null);
      setMotivoRejeicao("");
      refetchPending();
    } catch (error) {
      toast({ title: "Erro ao rejeitar venda", variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "historico" && historyItems.length === 0) {
      fetchHistory();
    }
  };

  const isApprovalValid = valorVenda > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-l-[3px] border-l-primary bg-card shadow-sm">
              <CardContent className="flex items-center gap-4 p-5">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* §26 — Page Header */}
      <PageHeader
        icon={ShieldCheck}
        title="Validação de Vendas"
        description="Revise e aprove vendas convertidas pelos consultores"
      />

      {/* §27 — KPI Cards — ALL border-l-primary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Clock, label: "Pendentes", value: stats.count.toString() },
          { icon: DollarSign, label: "Valor Total", value: formatBRL(stats.totalValue) },
          { icon: TrendingUp, label: "Comissão Estimada", value: formatBRL(stats.totalComissao) },
          { icon: Zap, label: "Potência Total", value: `${stats.totalPotencia.toFixed(1)} kWp` },
        ].map((card, i) => (
          <Card key={i} className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs — §29 after header */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="pendentes" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pendentes
            {stats.count > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{stats.count}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">Filtros:</span>
            </div>
            <Select value={filterVendedor} onValueChange={setFilterVendedor}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {vendedorNames.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
            {(filterVendedor !== "all" || filterPeriodo !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterVendedor("all"); setFilterPeriodo("all"); }}>
                Limpar
              </Button>
            )}
          </div>

          {/* §34 — Table matching Leads pattern */}
          <div className="rounded-lg border border-border overflow-hidden">
            {filteredItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="Nenhuma venda pendente"
                description="Todas as vendas foram validadas."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Cliente / Lead</TableHead>
                      <TableHead className="font-semibold text-foreground hidden lg:table-cell">Vendedor</TableHead>
                      <TableHead className="font-semibold text-foreground hidden sm:table-cell">Localização</TableHead>
                      <TableHead className="font-semibold text-foreground text-right hidden sm:table-cell">Potência</TableHead>
                      <TableHead className="font-semibold text-foreground text-right hidden sm:table-cell">Geração</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Valor Venda</TableHead>
                      <TableHead className="font-semibold text-foreground hidden sm:table-cell">Data</TableHead>
                      <TableHead className="w-[60px] lg:w-[180px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((cliente) => {
                      const clienteValorVenda = cliente.simulacoes?.investimento_estimado || cliente.valor_projeto || 0;
                      const potencia = cliente.simulacoes?.potencia_recomendada_kwp || cliente.potencia_kwp || 0;
                      const geracaoMensal = cliente.simulacoes?.geracao_mensal_estimada || 0;
                      const vendedorNome = cliente.leads?.consultores?.nome || cliente.leads?.consultor;
                      const vendedorFound = cliente.leads?.consultor_id
                        ? vendedores.some((v) => v.id === cliente.leads?.consultor_id)
                        : false;

                      return (
                        <TableRow key={cliente.id} className="align-middle hover:bg-muted/30 transition-colors">
                          <TableCell className="align-middle">
                            <div>
                              <p className="font-medium text-foreground">{cliente.nome}</p>
                              <Badge variant="outline" className="font-mono text-xs mt-0.5">
                                {cliente.leads?.lead_code || "-"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="align-middle hidden lg:table-cell">
                            {vendedorNome ? (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="bg-primary/10 text-primary border-primary/20 text-xs"
                                >
                                  {vendedorNome}
                                </Badge>
                                {!vendedorFound && (
                                  <Badge variant="outline" className="text-[10px] text-warning border-warning/30 h-4 px-1">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                    N/C
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="align-middle hidden sm:table-cell">
                            <Badge
                              variant="secondary"
                              className="bg-secondary/10 text-secondary text-xs"
                            >
                              {cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-middle text-right font-medium hidden sm:table-cell">
                            {potencia > 0 ? `${potencia} kWp` : "-"}
                          </TableCell>
                          <TableCell className="align-middle text-right font-medium hidden sm:table-cell">
                            {geracaoMensal > 0 ? `${geracaoMensal.toFixed(0)} kWh` : "-"}
                          </TableCell>
                          <TableCell className="align-middle text-right font-mono text-sm">
                            {clienteValorVenda > 0 ? formatBRL(clienteValorVenda) : "-"}
                          </TableCell>
                          <TableCell className="align-middle text-sm text-muted-foreground hidden sm:table-cell">
                            {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="align-middle">
                            {/* §34 — Inline actions for lg+ */}
                            <TooltipProvider>
                              <div className="hidden lg:flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary/80" onClick={() => openApprovalDialog(cliente)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:text-success/80" onClick={() => openApprovalDialog(cliente)}>
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Aprovar venda</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive/80"
                                      onClick={() => { setSelectedCliente(cliente); setMotivoRejeicao(""); setRejectionDialogOpen(true); }}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Rejeitar venda</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-warning hover:text-warning/80"
                                      onClick={() => cliente.lead_id && reopenLead(cliente.lead_id, cliente.id)}
                                      disabled={reopening || !cliente.lead_id}
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reabrir lead</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>

                            {/* §34 — Dropdown for mobile (<lg) */}
                            <div className="flex lg:hidden">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => openApprovalDialog(cliente)}>
                                    <Eye className="w-4 h-4 mr-2 text-primary" />
                                    Ver detalhes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openApprovalDialog(cliente)}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                    Aprovar venda
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setSelectedCliente(cliente); setMotivoRejeicao(""); setRejectionDialogOpen(true); }}>
                                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                                    Rejeitar venda
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => cliente.lead_id && reopenLead(cliente.lead_id, cliente.id)}
                                    disabled={reopening || !cliente.lead_id}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-2 text-warning" />
                                    Reabrir lead
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            {historyLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sem histórico"
                description="Nenhuma venda validada encontrada."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Cliente / Lead</TableHead>
                      <TableHead className="font-semibold text-foreground hidden lg:table-cell">Vendedor</TableHead>
                      <TableHead className="font-semibold text-foreground hidden sm:table-cell">Localização</TableHead>
                      <TableHead className="font-semibold text-foreground text-right hidden sm:table-cell">Potência</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                      <TableHead className="font-semibold text-foreground hidden sm:table-cell">Data</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyItems.map((cliente) => (
                      <TableRow key={cliente.id} className="align-middle hover:bg-muted/30 transition-colors">
                        <TableCell className="align-middle">
                          <div>
                            <p className="font-medium text-foreground">{cliente.nome}</p>
                            <Badge variant="outline" className="font-mono text-xs mt-0.5">
                              {cliente.leads?.lead_code || "-"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="align-middle hidden lg:table-cell">
                          {(cliente.leads?.consultores?.nome || cliente.leads?.consultor) ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                              {cliente.leads?.consultores?.nome || cliente.leads?.consultor}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="align-middle hidden sm:table-cell">
                          <Badge variant="secondary" className="bg-secondary/10 text-secondary text-xs">
                            {cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle text-right text-sm hidden sm:table-cell">
                          {cliente.potencia_kwp ? `${cliente.potencia_kwp} kWp` : "-"}
                        </TableCell>
                        <TableCell className="align-middle text-right font-mono text-sm">
                          {cliente.valor_projeto ? formatBRL(cliente.valor_projeto) : "-"}
                        </TableCell>
                        <TableCell className="align-middle text-sm text-muted-foreground hidden sm:table-cell">
                          {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="align-middle">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Validada
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <ApproveVendaDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        cliente={selectedCliente}
        vendedores={vendedores}
        leadSimulacoes={leadSimulacoes}
        loadingVendedor={loadingVendedor}
        selectedVendedorId={selectedVendedorId}
        onVendedorChange={handleVendedorChange}
        selectedSimulacaoId={selectedSimulacaoId}
        onSimulacaoChange={handleSimulacaoChange}
        valorVenda={valorVenda}
        onValorVendaChange={setValorVenda}
        percentualComissao={percentualComissao}
        onPercentualChange={setPercentualComissao}
        onApprove={handleApprove}
        approving={approving === selectedCliente?.id}
        isValid={isApprovalValid}
        documents={selectedCliente ? [
          { label: "Arquivos do Lead", urls: selectedCliente.leads?.arquivos_urls || null },
          { label: "Arquivos do Orçamento", urls: selectedCliente.leads?.orcamentos?.flatMap(o => o.arquivos_urls || []).filter(Boolean) as string[] || null },
          { label: "Identidade / RG / CNH", urls: selectedCliente.identidade_urls || (selectedCliente.identidade_url ? [selectedCliente.identidade_url] : null) },
          { label: "Comprovante de endereço", urls: selectedCliente.comprovante_endereco_urls || (selectedCliente.comprovante_endereco_url ? [selectedCliente.comprovante_endereco_url] : null) },
          { label: "Comprovante beneficiária", urls: selectedCliente.comprovante_beneficiaria_urls || null },
          { label: "Assinatura do cliente", urls: selectedCliente.assinatura_url ? [selectedCliente.assinatura_url] : null },
        ].filter(doc => doc.label !== "Arquivos do Orçamento" || (doc.urls && doc.urls.length > 0)) : []}
        paymentItems={paymentItems}
        onPaymentItemsChange={setPaymentItems}
      />

      {/* Rejection Dialog — §25 */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Rejeitar Venda
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                O lead voltará para "{reopenTarget?.nome || 'status inicial'}"
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium text-foreground">{selectedCliente?.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendedor</span>
                <span className="font-medium text-foreground">{selectedCliente?.leads?.consultores?.nome || selectedCliente?.leads?.consultor || "-"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Rejeição *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da rejeição..."
                value={motivoRejeicao}
                onChange={(e) => setMotivoRejeicao(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="default"
              onClick={handleReject}
              disabled={rejecting || !motivoRejeicao.trim()}
            >
              {rejecting && <Spinner size="sm" />}
              Confirmar Rejeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
