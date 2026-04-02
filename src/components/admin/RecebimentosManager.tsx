import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { useRecebimentosFull, useClientesAtivos, useRefreshRecebimentos } from "@/hooks/useRecebimentos";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign, Plus, Edit, Trash2, Receipt, CreditCard,
  Calendar, BarChart3, CalendarDays, Download, X, Info,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PagamentosDialog } from "./PagamentosDialog";
import { ParcelasManager } from "./recebimentos/ParcelasManager";
import { RelatoriosFinanceiros } from "./recebimentos/RelatoriosFinanceiros";
import { CalendarioPagamentos } from "./recebimentos/CalendarioPagamentos";
import { ParcelasAtrasadasWidget } from "./widgets/ParcelasAtrasadasWidget";
import { PagamentoLivreDialog } from "./recebimentos/PagamentoLivreDialog";
import { PageHeader, StatCard, EmptyState, LoadingState, SearchInput } from "@/components/ui-kit";
import { TablePagination } from "@/components/ui-kit/TablePagination";

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Pagamento {
  id: string;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  observacoes: string | null;
}

interface Recebimento {
  id: string;
  cliente_id: string;
  valor_total: number;
  forma_pagamento_acordada: string;
  numero_parcelas: number;
  descricao: string | null;
  data_acordo: string;
  data_vencimento?: string | null;
  status: string;
  created_at: string;
  total_pago?: number;
  composicao_acordada?: { forma: string; valor: number }[];
  ultimo_pagamento_em?: string | null;
  clientes?: Cliente;
  pagamentos?: Pagamento[];
}

const FORMAS_PAGAMENTO_COMPOSICAO = [
  { value: "pix", label: "PIX" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "financiamento", label: "Financiamento" },
  { value: "cheque", label: "Cheque" },
];

const STATUS_COLORS: Record<string, string> = {
  aguardando_instalacao: "bg-muted text-muted-foreground border-border",
  pendente: "bg-muted text-muted-foreground border-border",
  parcial: "bg-info/15 text-info border-info/20",
  quitado: "bg-success/15 text-success border-success/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const STATUS_LABELS: Record<string, string> = {
  aguardando_instalacao: "Aguardando",
  pendente: "Pendente",
  parcial: "Parcial",
  quitado: "Quitado",
  cancelado: "Cancelado",
};

const FORMA_LABELS: Record<string, string> = {
  pix: "PIX",
  pix_chave: "PIX",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  financiamento: "Financiamento",
  cheque: "Cheque",
  boleto: "Boleto",
  boleto_manual: "Boleto",
  a_definir: "A definir",
};

export function RecebimentosManager() {
  const { data: recebimentos = [], isLoading: loading } = useRecebimentosFull();
  const { data: clientes = [] } = useClientesAtivos();
  const refreshRecebimentos = useRefreshRecebimentos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecebimento, setEditingRecebimento] = useState<Recebimento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [selectedRecebimento, setSelectedRecebimento] = useState<Recebimento | null>(null);
  const [pagamentoLivreOpen, setPagamentoLivreOpen] = useState(false);
  const [parcelasDialogOpen, setParcelasDialogOpen] = useState(false);
  const [pagamentosDialogOpen, setPagamentosDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("lista");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Form state
  const [formData, setFormData] = useState({
    cliente_id: "",
    valor_total: 0,
    descricao: "",
    data_acordo: new Date().toISOString().split("T")[0],
    data_vencimento: "",
  });
  const [composicao, setComposicao] = useState<{ forma: string; valor: number }[]>([]);

  // Realtime sync
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refreshRecebimentos(), 600);
    };
    const channel = supabase
      .channel('recebimentos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recebimentos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos' }, refresh)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const calcularTotalPago = (rec: Recebimento) => {
    // Prefer DB total_pago, fallback to sum of pagamentos
    if (typeof rec.total_pago === "number" && rec.total_pago > 0) return rec.total_pago;
    if (!rec.pagamentos) return 0;
    return rec.pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const recebimentoData: Record<string, unknown> = {
        cliente_id: formData.cliente_id || null,
        valor_total: formData.valor_total,
        descricao: formData.descricao || null,
        data_acordo: formData.data_acordo,
        composicao_acordada: composicao.length > 0 ? composicao : [],
        forma_pagamento_acordada: composicao.length > 0 ? composicao[0].forma : "a_definir",
        numero_parcelas: 1,
      };

      if (editingRecebimento) {
        const { error } = await supabase
          .from("recebimentos")
          .update(recebimentoData as any)
          .eq("id", editingRecebimento.id);
        if (error) throw error;
        toast({ title: "Recebimento atualizado!" });
      } else {
        const { error } = await supabase.from("recebimentos").insert(recebimentoData as any);
        if (error) throw error;
        toast({ title: "Recebimento cadastrado!" });
      }

      setDialogOpen(false);
      resetForm();
      refreshRecebimentos();
    } catch (error) {
      console.error("Error saving recebimento:", error);
      toast({ title: "Erro ao salvar recebimento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (recebimento: Recebimento) => {
    setEditingRecebimento(recebimento);
    setFormData({
      cliente_id: recebimento.cliente_id || "",
      valor_total: recebimento.valor_total,
      descricao: recebimento.descricao || "",
      data_acordo: recebimento.data_acordo,
      data_vencimento: recebimento.data_vencimento || "",
    });
    const comp = Array.isArray(recebimento.composicao_acordada) ? recebimento.composicao_acordada : [];
    setComposicao(comp);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este recebimento e todos os pagamentos?")) return;
    try {
      const { error } = await supabase.from("recebimentos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Recebimento excluído!" });
      refreshRecebimentos();
    } catch (error) {
      console.error("Error deleting recebimento:", error);
      toast({ title: "Erro ao excluir recebimento", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      cliente_id: "",
      valor_total: 0,
      descricao: "",
      data_acordo: new Date().toISOString().split("T")[0],
    });
    setComposicao([]);
    setEditingRecebimento(null);
  };

  // Composição helpers
  const totalAlocado = composicao.reduce((s, c) => s + (c.valor || 0), 0);
  const faltaAlocar = formData.valor_total - totalAlocado;

  const addComposicaoItem = () => {
    setComposicao([...composicao, { forma: "pix", valor: 0 }]);
  };

  const updateComposicaoItem = (idx: number, field: "forma" | "valor", value: string | number) => {
    const updated = [...composicao];
    if (field === "forma") updated[idx] = { ...updated[idx], forma: value as string };
    else updated[idx] = { ...updated[idx], valor: value as number };
    setComposicao(updated);
  };

  const removeComposicaoItem = (idx: number) => {
    setComposicao(composicao.filter((_, i) => i !== idx));
  };

  const filteredRecebimentos = useMemo(() => {
    return recebimentos.filter((r: any) => {
      const matchesSearch =
        r.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [recebimentos, searchTerm, statusFilter]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const paginatedRecebimentos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecebimentos.slice(start, start + pageSize);
  }, [filteredRecebimentos, page, pageSize]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [searchTerm, statusFilter]);

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter("all");
  }, []);

  const exportCSV = useCallback(() => {
    const headers = ["Cliente", "Valor Total", "Pago", "Saldo", "Status", "Data Acordo"];
    const rows = filteredRecebimentos.map((r: any) => {
      const tp = calcularTotalPago(r);
      return [
        r.clientes?.nome || "Sem cliente",
        r.valor_total.toFixed(2),
        tp.toFixed(2),
        (r.valor_total - tp).toFixed(2),
        STATUS_LABELS[r.status] || r.status,
        r.data_acordo,
      ];
    });
    const csvContent = [headers.join(";"), ...rows.map((row: string[]) => row.map((c) => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `recebimentos_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();
    toast({ title: "CSV exportado com sucesso!" });
  }, [filteredRecebimentos]);

  // Stats
  const totalPendente = recebimentos
    .filter((r: any) => r.status !== "quitado" && r.status !== "cancelado")
    .reduce((acc: number, r: any) => acc + r.valor_total - calcularTotalPago(r), 0);

  const totalRecebido = recebimentos.reduce((acc: number, r: any) => acc + calcularTotalPago(r), 0);

  const formatComposicao = (comp: { forma: string; valor: number }[]) => {
    if (!comp || comp.length === 0) return "Não definido";
    return comp.map((c) => `${FORMA_LABELS[c.forma] || c.forma} ${formatBRL(c.valor)}`).join(" + ");
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        icon={Receipt}
        title="Recebimentos"
        description="Conta corrente — registre pagamentos livres até quitar o saldo"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="lista" className="gap-2">
            <Receipt className="h-4 w-4 text-success" />
            <span className="hidden sm:inline">Recebimentos</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <BarChart3 className="h-4 w-4 text-info" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Calendário</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ParcelasAtrasadasWidget />
            <StatCard icon={Receipt} label="Total Recebido" value={formatBRL(totalRecebido)} color="success" />
            <StatCard icon={DollarSign} label="A Receber" value={formatBRL(totalPendente)} color="warning" />
          </div>

          {/* Filters and Actions */}
          <div className="admin-toolbar">
            <div className="flex flex-col sm:flex-row flex-1 gap-3 sm:gap-4 items-start sm:items-center">
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Buscar por cliente..." className="w-full sm:max-w-xs" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="quitado">Quitado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""}</Badge>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-8 text-xs">
                    <X className="h-3 w-3" />
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredRecebimentos.length === 0} className="gap-1.5">
                <Download className="h-4 w-4" />
                Exportar
              </Button>

              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Recebimento
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingRecebimento ? "Editar Recebimento" : "Novo Recebimento"}</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Select
                        value={formData.cliente_id || "__none__"}
                        onValueChange={(value) => setFormData({ ...formData, cliente_id: value === "__none__" ? "" : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem cliente (avulso)</SelectItem>
                          {clientes.map((cliente: any) => (
                            <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="descricao">Descrição / motivo *</Label>
                      <Textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                        rows={2}
                        required
                        placeholder="Ex: Projeto solar residencial 6kWp"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor total da dívida *</Label>
                        <CurrencyInput value={formData.valor_total} onChange={(v) => setFormData({ ...formData, valor_total: v })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data do acordo *</Label>
                        <DateInput value={formData.data_acordo} onChange={(v) => setFormData({ ...formData, data_acordo: v })} />
                      </div>
                    </div>

                    {/* Composição acordada */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Como foi combinado pagar</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addComposicaoItem} className="gap-1 text-xs">
                          <Plus className="h-3 w-3" />
                          Adicionar forma
                        </Button>
                      </div>

                      {composicao.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Select value={item.forma} onValueChange={(v) => updateComposicaoItem(idx, "forma", v)}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMAS_PAGAMENTO_COMPOSICAO.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <CurrencyInput value={item.valor} onChange={(v) => updateComposicaoItem(idx, "valor", v)} />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeComposicaoItem(idx)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}

                      {composicao.length > 0 && formData.valor_total > 0 && (
                        <div className="text-xs px-1">
                          {Math.abs(faltaAlocar) < 0.01 ? (
                            <span className="text-success">✓ Totalmente alocado</span>
                          ) : faltaAlocar > 0 ? (
                            <span className="text-warning">Faltam {formatBRL(faltaAlocar)} por definir</span>
                          ) : (
                            <span className="text-destructive">Excede em {formatBRL(Math.abs(faltaAlocar))}</span>
                          )}
                          <span className="text-muted-foreground ml-2">
                            (Alocado: {formatBRL(totalAlocado)} de {formatBRL(formData.valor_total)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" disabled={saving || !formData.descricao || formData.valor_total <= 0}>
                        {saving && <Spinner size="sm" />}
                        {editingRecebimento ? "Salvar" : "Cadastrar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingState />
          ) : filteredRecebimentos.length === 0 ? (
            <EmptyState icon={Receipt} title="Nenhum recebimento encontrado" />
          ) : (
            <SectionCard icon={Receipt} title="Lista de Recebimentos" variant="green" noPadding>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                      <TableHead className="font-semibold text-foreground">Descrição</TableHead>
                      <TableHead className="font-semibold text-foreground">Situação Financeira</TableHead>
                      <TableHead className="font-semibold text-foreground">Combinado</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecebimentos.map((recebimento: any) => {
                      const tp = calcularTotalPago(recebimento);
                      const saldo = recebimento.valor_total - tp;
                      const progresso = recebimento.valor_total > 0 ? Math.min((tp / recebimento.valor_total) * 100, 100) : 0;
                      const comp: { forma: string; valor: number }[] = Array.isArray(recebimento.composicao_acordada) ? recebimento.composicao_acordada : [];

                      return (
                        <TableRow key={recebimento.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{recebimento.clientes?.nome || "Sem cliente"}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(recebimento.data_acordo), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-foreground truncate max-w-[200px]">{recebimento.descricao || "—"}</p>
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <div className="space-y-1.5">
                              <Progress
                                value={progresso}
                                className={`h-2 ${recebimento.status === "quitado" ? "[&>div]:bg-success" : recebimento.status === "parcial" ? "[&>div]:bg-info" : ""}`}
                              />
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-foreground">Pago: {formatBRL(tp)}</span>
                                <span className={saldo > 0.01 ? "text-warning font-medium" : "text-success font-medium"}>
                                  Saldo: {formatBRL(saldo)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {comp.length > 0 ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">{comp.length} forma{comp.length > 1 ? "s" : ""}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{formatComposicao(comp)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[recebimento.status]}>
                              {STATUS_LABELS[recebimento.status] || recebimento.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs"
                                onClick={() => {
                                  setSelectedRecebimento(recebimento);
                                  setPagamentoLivreOpen(true);
                                }}
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Pagar</span>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setSelectedRecebimento(recebimento);
                                setParcelasDialogOpen(true);
                              }} title="Gerenciar Parcelas">
                                <Calendar className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(recebimento)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(recebimento.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                totalItems={filteredRecebimentos.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="relatorios" className="mt-6">
          <RelatoriosFinanceiros />
        </TabsContent>

        <TabsContent value="calendario" className="mt-6">
          <CalendarioPagamentos />
        </TabsContent>
      </Tabs>

      {/* Pagamento Livre Dialog */}
      {selectedRecebimento && (
        <PagamentoLivreDialog
          open={pagamentoLivreOpen}
          onClose={() => {
            setPagamentoLivreOpen(false);
            setSelectedRecebimento(null);
          }}
          recebimento={{
            id: selectedRecebimento.id,
            valor_total: selectedRecebimento.valor_total,
            total_pago: calcularTotalPago(selectedRecebimento),
            descricao: selectedRecebimento.descricao,
            clientes: selectedRecebimento.clientes || null,
            composicao_acordada: Array.isArray(selectedRecebimento.composicao_acordada)
              ? selectedRecebimento.composicao_acordada
              : [],
          }}
        />
      )}

      {/* Legacy Pagamentos Dialog */}
      {selectedRecebimento && (
        <PagamentosDialog
          open={pagamentosDialogOpen}
          onOpenChange={(open) => {
            setPagamentosDialogOpen(open);
            if (!open) setSelectedRecebimento(null);
          }}
          recebimento={selectedRecebimento}
          onUpdate={refreshRecebimentos}
        />
      )}

      {/* Parcelas Dialog */}
      {selectedRecebimento && (
        <ParcelasManager
          open={parcelasDialogOpen}
          onOpenChange={(open) => {
            setParcelasDialogOpen(open);
            if (!open) setSelectedRecebimento(null);
          }}
          recebimento={selectedRecebimento}
          onUpdate={refreshRecebimentos}
        />
      )}
    </motion.div>
  );
}
