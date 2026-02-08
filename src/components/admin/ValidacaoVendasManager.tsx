import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Loader2, CheckCircle, XCircle, Eye, Clock, DollarSign, User, MapPin,
  TrendingUp, Zap, AlertTriangle, History, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePendingValidations, type PendingValidation } from "@/hooks/usePendingValidations";

export function ValidacaoVendasManager() {
  const {
    pendingItems, historyItems, loading, historyLoading,
    refetchPending, fetchHistory,
  } = usePendingValidations();

  const [approving, setApproving] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<PendingValidation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [percentualComissao, setPercentualComissao] = useState("2.0");
  const [activeTab, setActiveTab] = useState("pendentes");

  // Filters
  const [filterVendedor, setFilterVendedor] = useState("all");
  const [filterPeriodo, setFilterPeriodo] = useState("all");

  // Derived: unique vendors
  const vendedores = useMemo(() => {
    const names = new Set(pendingItems.map((c) => c.leads?.vendedor).filter(Boolean) as string[]);
    return Array.from(names).sort();
  }, [pendingItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let items = [...pendingItems];
    if (filterVendedor !== "all") {
      items = items.filter((c) => c.leads?.vendedor === filterVendedor);
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

  const handleApprove = async () => {
    if (!selectedCliente) return;
    setApproving(selectedCliente.id);
    try {
      const { data: convertidoStatus } = await supabase
        .from("lead_status").select("id").eq("nome", "Convertido").single();
      if (!convertidoStatus) throw new Error("Status 'Convertido' não encontrado");

      if (selectedCliente.lead_id) {
        await supabase.from("leads").update({ status_id: convertidoStatus.id }).eq("id", selectedCliente.lead_id);
        await supabase.from("orcamentos").update({ status_id: convertidoStatus.id }).eq("lead_id", selectedCliente.lead_id);
      }

      const valorBase = selectedCliente.simulacoes?.investimento_estimado || selectedCliente.valor_projeto || 0;
      const vendedorNome = selectedCliente.leads?.vendedor;
      if (valorBase > 0 && vendedorNome) {
        const { data: vendedorData } = await supabase
          .from("vendedores").select("id").eq("nome", vendedorNome).eq("ativo", true).single();
        if (vendedorData) {
          const now = new Date();
          const percentual = parseFloat(percentualComissao);
          await supabase.from("comissoes").insert({
            vendedor_id: vendedorData.id,
            cliente_id: selectedCliente.id,
            descricao: `Venda - ${selectedCliente.nome} (${selectedCliente.simulacoes?.potencia_recomendada_kwp || selectedCliente.potencia_kwp || 0}kWp)`,
            valor_base: valorBase,
            percentual_comissao: percentual,
            valor_comissao: (valorBase * percentual) / 100,
            mes_referencia: now.getMonth() + 1,
            ano_referencia: now.getFullYear(),
            status: "pendente",
          });
        }
      }

      toast({ title: "Venda validada!", description: `Venda de ${selectedCliente.nome} foi aprovada e comissão gerada.` });
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
      await supabase.from("clientes").delete().eq("id", selectedCliente.id);

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
    const valorBase = selectedCliente?.simulacoes?.investimento_estimado || selectedCliente?.valor_projeto || 0;
    return (valorBase * (parseFloat(percentualComissao) || 0)) / 100;
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "historico" && historyItems.length === 0) {
      fetchHistory();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-warning">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalComissao)}</p>
              <p className="text-xs text-muted-foreground">Comissão Estimada</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="flex items-center gap-3 pt-5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalPotencia.toFixed(1)} kWp</p>
              <p className="text-xs text-muted-foreground">Potência Total</p>
            </div>
          </CardContent>
        </Card>
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
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
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
          <Card>
            <CardContent className="p-0">
              {filteredItems.length === 0 ? (
                <div className="empty-state py-16">
                  <div className="empty-state-icon">
                    <CheckCircle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="empty-state-title">Nenhuma venda pendente</p>
                  <p className="empty-state-description">Todas as vendas foram validadas.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="premium-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="text-right">Potência</TableHead>
                        <TableHead className="text-right">Valor Venda</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-44"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((cliente) => {
                        const valorVenda = cliente.simulacoes?.investimento_estimado || cliente.valor_projeto || 0;
                        const potencia = cliente.simulacoes?.potencia_recomendada_kwp || cliente.potencia_kwp || 0;
                        return (
                          <TableRow key={cliente.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                <p className="text-xs text-muted-foreground">{cliente.leads?.lead_code || "-"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{cliente.leads?.vendedor || "-"}</span>
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
                              {valorVenda > 0 ? formatCurrency(valorVenda) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedCliente(cliente); setDetailsOpen(true); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-success hover:bg-success/90 text-success-foreground"
                                  onClick={() => { setSelectedCliente(cliente); setPercentualComissao("2.0"); setApprovalDialogOpen(true); }}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Vendas Validadas Recentemente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : historyItems.length === 0 ? (
                <div className="empty-state py-12">
                  <div className="empty-state-icon">
                    <History className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="empty-state-title">Sem histórico</p>
                  <p className="empty-state-description">Nenhuma venda validada encontrada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="premium-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="text-right">Potência</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Data Conversão</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyItems.map((cliente) => (
                        <TableRow key={cliente.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{cliente.nome}</p>
                              <p className="text-xs text-muted-foreground">{cliente.leads?.lead_code || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{cliente.leads?.vendedor || "-"}</TableCell>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Cliente</Label>
                  <p className="font-medium">{selectedCliente.nome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Telefone</Label>
                  <p>{selectedCliente.telefone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Localização</Label>
                  <p>{selectedCliente.cidade}, {selectedCliente.estado}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Vendedor</Label>
                  <p>{selectedCliente.leads?.vendedor || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Potência</Label>
                  <p>{selectedCliente.simulacoes?.potencia_recomendada_kwp || selectedCliente.potencia_kwp || 0} kWp</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Valor Investimento</Label>
                  <p className="font-bold text-primary">
                    {formatCurrency(selectedCliente.simulacoes?.investimento_estimado || selectedCliente.valor_projeto || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Aprovar Venda
            </DialogTitle>
            <DialogDescription>
              Confirme os dados da comissão para {selectedCliente?.nome}
            </DialogDescription>
          </DialogHeader>
          {selectedCliente && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vendedor</span>
                  <span className="font-medium">{selectedCliente.leads?.vendedor || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor da Venda</span>
                  <span className="font-medium">
                    {formatCurrency(selectedCliente.simulacoes?.investimento_estimado || selectedCliente.valor_projeto || 0)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentual">Percentual de Comissão (%)</Label>
                <Input id="percentual" type="number" step="0.1" value={percentualComissao} onChange={(e) => setPercentualComissao(e.target.value)} />
              </div>
              <div className="p-4 bg-success/10 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    <span className="font-medium text-sm">Valor da Comissão</span>
                  </div>
                  <span className="text-xl font-bold text-success">{formatCurrency(valorComissaoPreview())}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={approving === selectedCliente?.id} className="bg-success hover:bg-success/90 text-success-foreground">
              {approving === selectedCliente?.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <span className="font-medium">{selectedCliente?.leads?.vendedor || "-"}</span>
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
            <Button variant="outline" onClick={() => setRejectionDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting || !motivoRejeicao.trim()}
            >
              {rejecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
