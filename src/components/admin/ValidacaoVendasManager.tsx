import { useState, useMemo, useEffect } from "react";
import { ApproveVendaDialog } from "./ApproveVendaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { StatCard, EmptyState } from "@/components/ui-kit";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle, XCircle, Eye, Clock, DollarSign, User, MapPin,
  TrendingUp, Zap, AlertTriangle, History, Filter, FileText,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePendingValidations, type PendingValidation } from "@/hooks/usePendingValidations";

interface LeadSimulacao {
  id: string;
  investimento_estimado: number | null;
  potencia_recomendada_kwp: number | null;
  economia_mensal: number | null;
  consumo_kwh: number | null;
  geracao_mensal_estimada: number | null;
  payback_meses: number | null;
  created_at: string;
}

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
  const [loadingVendedor, setLoadingVendedor] = useState(false);
  const [activeTab, setActiveTab] = useState("pendentes");
  const [leadSimulacoes, setLeadSimulacoes] = useState<LeadSimulacao[]>([]);
  const [selectedSimulacaoId, setSelectedSimulacaoId] = useState<string>("");

  // Vendedor selector state
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");

  // Filters
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [filterPeriodo, setFilterPeriodo] = useState("all");

  // Fetch vendedores on mount
  useEffect(() => {
    const fetchVendedores = async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome, percentual_comissao")
        .eq("ativo", true)
        .order("nome");
      if (data) setVendedores(data);
    };
    fetchVendedores();
  }, []);

  // Derived: unique vendors from pending items using vendedor_id
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

  // Open approval dialog — fetch simulações and pre-select vendedor
  const openApprovalDialog = async (cliente: PendingValidation) => {
    setSelectedCliente(cliente);
    setLeadSimulacoes([]);
    setSelectedSimulacaoId("");

    const valor = cliente.simulacoes?.investimento_estimado || cliente.valor_projeto || 0;
    setValorVenda(valor > 0 ? valor : 0);

    setLoadingVendedor(true);

    try {
      const promises: Promise<void>[] = [];

      // 1) Try to match vendedor by vendedor_id from lead
      const vendedorId = cliente.leads?.consultor_id;
      if (vendedorId) {
        const matchedVendedor = vendedores.find((v) => v.id === vendedorId);
        if (matchedVendedor) {
          setSelectedVendedorId(matchedVendedor.id);
          setPercentualComissao(
            matchedVendedor.percentual_comissao?.toString() || "2.0"
          );
        } else {
          setSelectedVendedorId("");
          setPercentualComissao("2.0");
        }
      } else {
        // Fallback: try name matching for legacy data
        const vendedorNome = cliente.leads?.consultores?.nome || cliente.leads?.consultor;
        if (vendedorNome) {
          const matchedVendedor = vendedores.find(
            (v) => v.nome.toLowerCase() === vendedorNome.toLowerCase()
          );
          if (matchedVendedor) {
            setSelectedVendedorId(matchedVendedor.id);
            setPercentualComissao(
              matchedVendedor.percentual_comissao?.toString() || "2.0"
            );
          } else {
            setSelectedVendedorId("");
            setPercentualComissao("2.0");
          }
        } else {
          setSelectedVendedorId("");
          setPercentualComissao("2.0");
        }
      }

      // 2) All simulações for this lead
      if (cliente.lead_id) {
        const simsPromise = async () => {
          const { data } = await supabase
            .from("simulacoes")
            .select("id, investimento_estimado, potencia_recomendada_kwp, economia_mensal, consumo_kwh, geracao_mensal_estimada, payback_meses, created_at")
            .eq("lead_id", cliente.lead_id!)
            .order("created_at", { ascending: false });
          const sims = (data as LeadSimulacao[]) || [];
          setLeadSimulacoes(sims);
          if (cliente.simulacao_aceita_id) {
            setSelectedSimulacaoId(cliente.simulacao_aceita_id);
          } else if (sims.length > 0) {
            setSelectedSimulacaoId(sims[0].id);
            if (sims[0].investimento_estimado && sims[0].investimento_estimado > 0) {
              setValorVenda(sims[0].investimento_estimado);
            }
          }
        };
        promises.push(simsPromise());
      }

      await Promise.all(promises);
    } catch {
      setPercentualComissao("2.0");
    } finally {
      setLoadingVendedor(false);
    }

    setApprovalDialogOpen(true);
  };

  // When vendedor selection changes, update commission percentage
  const handleVendedorChange = (vendedorId: string) => {
    setSelectedVendedorId(vendedorId);
    const vendedor = vendedores.find((v) => v.id === vendedorId);
    if (vendedor?.percentual_comissao != null) {
      setPercentualComissao(vendedor.percentual_comissao.toString());
    } else {
      setPercentualComissao("2.0");
    }
  };

  // Handle simulação selection change
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

    const valorBase = valorVenda || 0;
    if (valorBase <= 0) {
      toast({
        title: "Valor obrigatório",
        description: "Informe o valor da venda para validar.",
        variant: "destructive",
      });
      return;
    }

    setApproving(selectedCliente.id);
    try {
      const { data: convertidoStatus } = await supabase
        .from("lead_status").select("id").eq("nome", "Convertido").single();
      if (!convertidoStatus) throw new Error("Status 'Convertido' não encontrado");

      if (selectedCliente.lead_id) {
        await supabase.from("leads").update({ status_id: convertidoStatus.id }).eq("id", selectedCliente.lead_id);
        await supabase.from("orcamentos").update({ status_id: convertidoStatus.id }).eq("lead_id", selectedCliente.lead_id);
      }

      // Update client valor_projeto
      if (valorBase > 0) {
        await supabase.from("clientes").update({ valor_projeto: valorBase }).eq("id", selectedCliente.id);
      }

      // Comissão agora é gerada ao aceitar proposta (ProposalDetail)
      // Aqui apenas validamos a venda e atualizamos o status

      toast({
        title: "Venda validada!",
        description: `Venda de ${selectedCliente.nome} aprovada com sucesso.`,
      });
      setApprovalDialogOpen(false);
      setSelectedCliente(null);
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
      const { data: negociacaoStatus } = await supabase
        .from("lead_status").select("id").eq("nome", "Negociação").single();
      if (negociacaoStatus && selectedCliente.lead_id) {
        await supabase.from("leads").update({
          status_id: negociacaoStatus.id,
          observacoes: `Rejeição de validação: ${motivoRejeicao}`,
        }).eq("id", selectedCliente.lead_id);
        await supabase.from("orcamentos").update({ status_id: negociacaoStatus.id }).eq("lead_id", selectedCliente.lead_id);
      }

      // Check for blocking dependencies before deleting client
      const depChecks = await Promise.all([
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", selectedCliente.id),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("cliente_id", selectedCliente.id),
        supabase.from("deals").select("id", { count: "exact", head: true }).eq("customer_id", selectedCliente.id),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("cliente_id", selectedCliente.id),
        supabase.from("obras").select("id", { count: "exact", head: true }).eq("cliente_id", selectedCliente.id),
        supabase.from("wa_conversations").select("id", { count: "exact", head: true }).eq("cliente_id", selectedCliente.id),
      ]);
      const depNames = ["Propostas", "Projetos", "Negociações", "Agendamentos", "Obras", "Conversas WhatsApp"];
      const blocking: string[] = [];
      depChecks.forEach((res, i) => {
        if ((res.count ?? 0) > 0) blocking.push(`${depNames[i]} (${res.count})`);
      });

      if (blocking.length > 0) {
        // Cannot delete — just inactivate the client instead
        await supabase.from("clientes").update({ ativo: false }).eq("id", selectedCliente.id);
        toast({
          title: "Venda rejeitada",
          description: `Cliente desativado (possui ${blocking.join(", ")} vinculados).`,
        });
      } else {
        await supabase.from("clientes").delete().eq("id", selectedCliente.id);
        toast({
          title: "Venda rejeitada",
          description: `A venda de ${selectedCliente.nome} foi rejeitada. Motivo registrado.`,
        });
      }

      toast({
        title: "Venda rejeitada",
        description: `A venda de ${selectedCliente.nome} foi rejeitada. Motivo registrado.`,
      });
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const valorComissaoPreview = () => {
    const base = valorVenda || 0;
    return (base * (parseFloat(percentualComissao) || 0)) / 100;
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "historico" && historyItems.length === 0) {
      fetchHistory();
    }
  };

  // Check if approval form is valid
  const isApprovalValid = valorVenda > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
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
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Pendentes" value={stats.count} color="warning" />
        <StatCard icon={DollarSign} label="Valor total" value={formatCurrency(stats.totalValue)} color="primary" />
        <StatCard icon={TrendingUp} label="Comissão estimada" value={formatCurrency(stats.totalComissao)} color="success" />
        <StatCard icon={Zap} label="Potência total" value={`${stats.totalPotencia.toFixed(1)} kWp`} color="info" />
      </div>

      {/* Tabs */}
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

          {/* Table */}
          <SectionCard icon={Clock} title="Vendas Pendentes" variant="warning" noPadding>
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
                        <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                        <TableHead className="font-semibold text-foreground">Vendedor</TableHead>
                        <TableHead className="font-semibold text-foreground">Localização</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Potência</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Geração</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Valor Venda</TableHead>
                        <TableHead className="font-semibold text-foreground">Data</TableHead>
                        <TableHead className="w-44"></TableHead>
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
                          <TableRow key={cliente.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                <p className="text-xs text-muted-foreground">{cliente.leads?.lead_code || "-"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{vendedorNome || "-"}</span>
                                {vendedorNome && !vendedorFound && (
                                  <Badge variant="outline" className="text-[10px] text-warning border-warning/30 h-4 px-1">
                                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                    Não cadastrado
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ""}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {potencia > 0 ? `${potencia} kWp` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {geracaoMensal > 0 ? `${geracaoMensal.toFixed(0)} kWh` : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {clienteValorVenda > 0 ? formatCurrency(clienteValorVenda) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openApprovalDialog(cliente)}>
                                  <Eye className="h-4 w-4 text-secondary" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="success"
                                  className="bg-success hover:bg-success/90 text-success-foreground"
                                  onClick={() => openApprovalDialog(cliente)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => { setSelectedCliente(cliente); setMotivoRejeicao(""); setRejectionDialogOpen(true); }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <SectionCard icon={History} title="Vendas Validadas Recentemente" variant="green">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="md" />
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
                        <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                        <TableHead className="font-semibold text-foreground">Vendedor</TableHead>
                        <TableHead className="font-semibold text-foreground">Localização</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Potência</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-foreground">Data Conversão</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyItems.map((cliente) => (
                        <TableRow key={cliente.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-medium">{cliente.nome}</p>
                              <p className="text-xs text-muted-foreground">{cliente.leads?.lead_code || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{cliente.leads?.consultores?.nome || cliente.leads?.consultor || "-"}</TableCell>
                          <TableCell className="text-sm">
                            {cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ""}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {cliente.potencia_kwp ? `${cliente.potencia_kwp} kWp` : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            {cliente.valor_projeto ? formatCurrency(cliente.valor_projeto) : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-success/10 text-success border-0">
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
          </SectionCard>
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
        ].filter(doc => doc.label !== "Arquivos do Orçamento" || (doc.urls && doc.urls.length > 0)) : []}
      />

      {/* Rejection Dialog */}
      <Dialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Rejeitar Venda
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para {selectedCliente?.nome}. O lead voltará para "Negociação".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{selectedCliente?.nome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendedor</span>
                <span className="font-medium">{selectedCliente?.leads?.consultores?.nome || selectedCliente?.leads?.consultor || "-"}</span>
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectionDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="default"
              onClick={handleReject}
              disabled={rejecting || !motivoRejeicao.trim()}
            >
              {rejecting && <Spinner size="sm" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
