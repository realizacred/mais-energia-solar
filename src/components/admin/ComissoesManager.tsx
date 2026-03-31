import { formatBRL } from "@/lib/formatters/index";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  DollarSign,
  Eye,
  CreditCard,
  BarChart3,
  List,
} from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PageHeader } from "@/components/ui-kit";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PagamentosComissaoDialog } from "./PagamentosComissaoDialog";
import { 
  BulkPaymentDialog, 
  VendorBalanceCard, 
  ComissoesFilters, 
  ComissoesStats, 
  ComissoesReports,
  ComissoesExport,
} from "./comissoes";
import {
  useComissoes,
  useAllComissoes,
  useConsultoresAtivos,
  useClientesAtivos,
  useSalvarComissao,
  useDeletarComissao,
  type ComissaoRow,
} from "@/hooks/useComissoes";
import { useQueryClient } from "@tanstack/react-query";

interface Comissao {
  id: string;
  consultor_id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  descricao: string;
  valor_base: number;
  percentual_comissao: number;
  valor_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  consultores?: { nome: string };
  clientes?: { nome: string } | null;
  projetos?: { codigo: string } | null;
  pagamentos_comissao?: { valor_pago: number; data_pagamento: string }[];
}

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export function ComissoesManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedComissao, setSelectedComissao] = useState<Comissao | null>(null);
  const [pagamentosDialogOpen, setPagamentosDialogOpen] = useState(false);
  const [bulkPaymentOpen, setBulkPaymentOpen] = useState(false);
  const [payDirectOpen, setPayDirectOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<"lista" | "relatorios">("lista");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Filters
  const currentDate = new Date();
  const [filterMes, setFilterMes] = useState(currentDate.getMonth() + 1);
  const [filterAno, setFilterAno] = useState(currentDate.getFullYear());
  const [filterVendedor, setFilterVendedor] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCliente, setFilterCliente] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    consultor_id: "",
    descricao: "",
    valor_base: "",
    percentual_comissao: "3.0",
    mes_referencia: currentDate.getMonth() + 1,
    ano_referencia: currentDate.getFullYear(),
    observacoes: "",
  });

  // --- Hooks (RB-04, §16) ---
  const { data: comissoes = [], isLoading: loadingComissoes } = useComissoes({
    mes: filterMes,
    ano: filterAno,
    consultor_id: filterVendedor,
    status: filterStatus,
    cliente_id: filterCliente,
  });

  const { data: allComissoes = [] } = useAllComissoes();
  const { data: vendedores = [] } = useConsultoresAtivos();
  const { data: clientes = [] } = useClientesAtivos();

  const salvarComissao = useSalvarComissao();
  const deletarComissao = useDeletarComissao();

  const loading = loadingComissoes;

  // ⚠️ HARDENING: Realtime for cross-user sync on comissões (financial data)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('comissoes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comissoes' }, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["comissoes"] });
        }, 700);
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter by search term
  const filteredComissoes = useMemo(() => {
    if (!searchTerm) return comissoes as Comissao[];
    const term = searchTerm.toLowerCase();
    return (comissoes as Comissao[]).filter(
      (c) =>
        c.descricao.toLowerCase().includes(term) ||
        c.consultores?.nome.toLowerCase().includes(term) ||
        c.projetos?.codigo?.toLowerCase().includes(term) ||
        c.clientes?.nome?.toLowerCase().includes(term)
    );
  }, [comissoes, searchTerm]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchTerm, filterMes, filterAno, filterVendedor, filterStatus, filterCliente]);

  const paginatedComissoes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredComissoes.slice(start, start + pageSize);
  }, [filteredComissoes, page, pageSize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const valorBase = parseFloat(formData.valor_base);
      const percentual = parseFloat(formData.percentual_comissao);
      const valorComissao = (valorBase * percentual) / 100;

      await salvarComissao.mutateAsync({
        consultor_id: formData.consultor_id,
        descricao: formData.descricao,
        valor_base: valorBase,
        percentual_comissao: percentual,
        valor_comissao: valorComissao,
        mes_referencia: formData.mes_referencia,
        ano_referencia: formData.ano_referencia,
        observacoes: formData.observacoes || null,
      });

      toast({ title: "Comissão registrada com sucesso!" });
      resetForm();
    } catch (error) {
      console.error("Error saving comissao:", error);
      toast({ title: "Erro ao registrar comissão", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta comissão?")) return;

    try {
      await deletarComissao.mutateAsync(id);
      toast({ title: "Comissão excluída!" });
    } catch (error) {
      console.error("Error deleting comissao:", error);
      toast({ title: "Erro ao excluir comissão", variant: "destructive" });
    }
  };

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["comissoes"] });
  }, [queryClient]);

  const resetForm = () => {
    setFormData({
      consultor_id: "",
      descricao: "",
      valor_base: "",
      percentual_comissao: "3.0",
      mes_referencia: currentDate.getMonth() + 1,
      ano_referencia: currentDate.getFullYear(),
      observacoes: "",
    });
    setDialogOpen(false);
  };

  const clearFilters = () => {
    setFilterVendedor("all");
    setFilterStatus("all");
    setFilterCliente("all");
    setSearchTerm("");
  };

  const formatCurrency = (value: number) => formatBRL(value);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pendente: { variant: "destructive", label: "Pendente" },
      parcial: { variant: "secondary", label: "Parcial" },
      pago: { variant: "default", label: "Pago" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const calcularValorPago = (comissao: Comissao) => {
    return comissao.pagamentos_comissao?.reduce((acc, p) => acc + p.valor_pago, 0) || 0;
  };

  const calcularSaldoRestante = (comissao: Comissao) => {
    const pago = calcularValorPago(comissao);
    return Math.max(0, comissao.valor_comissao - pago);
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredComissoes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredComissoes.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectedComissoes = filteredComissoes.filter((c) => selectedIds.has(c.id));
  const selectedTotalAReceber = selectedComissoes.reduce((acc, c) => acc + calcularSaldoRestante(c), 0);

  // Stats
  const totalComissoes = filteredComissoes.reduce((acc, c) => acc + c.valor_comissao, 0);
  const totalPago = filteredComissoes.reduce((acc, c) => acc + calcularValorPago(c), 0);
  const totalPendente = filteredComissoes.reduce((acc, c) => acc + calcularSaldoRestante(c), 0);

  // Check for overdue commissions (pending for more than 30 days)
  const comissoesAtrasadas = filteredComissoes.filter((c) => {
    if (c.status === "pago") return false;
    const createdDate = parseISO(c.created_at);
    return differenceInDays(new Date(), createdDate) > 30;
  }).length;

  // Calculate vendor balances
  const vendorBalances = vendedores
    .map((v) => {
      const vendorComissoes = filteredComissoes.filter((c) => c.consultor_id === v.id);
      const totalVendorComissoes = vendorComissoes.reduce((acc, c) => acc + c.valor_comissao, 0);
      const totalVendorPago = vendorComissoes.reduce((acc, c) => acc + calcularValorPago(c), 0);
      return {
        vendedor_id: v.id,
        vendedor_nome: v.nome,
        total_comissoes: totalVendorComissoes,
        total_pago: totalVendorPago,
        saldo: totalVendorPago - totalVendorComissoes,
      };
    })
    .filter((b) => b.total_comissoes > 0 || b.total_pago > 0);

  const anos = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  if (loading) {
    return <InlineLoader context="data_load" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={DollarSign} title="Comissões" description="Gerencie comissões dos consultores" />
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <ComissoesStats
            totalComissoes={totalComissoes}
            totalPago={totalPago}
            totalPendente={totalPendente}
            quantidadeRegistros={filteredComissoes.length}
            comissoesAtrasadas={comissoesAtrasadas}
            formatCurrency={formatCurrency}
          />
        </div>
        <VendorBalanceCard balances={vendorBalances} />
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "lista" | "relatorios")}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="lista" className="gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <ComissoesExport
              comissoes={filteredComissoes}
              filterMes={filterMes}
              filterAno={filterAno}
              formatCurrency={formatCurrency}
            />
            {selectedIds.size > 0 && (
              <Button variant="secondary" className="gap-2" onClick={() => setBulkPaymentOpen(true)}>
                <CreditCard className="h-4 w-4" />
                Pagar {selectedIds.size} ({formatCurrency(selectedTotalAReceber)})
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Comissão
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-xl">
                <DialogHeader>
                  <DialogTitle>Registrar Comissão</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Consultor *</Label>
                    <Select
                      value={formData.consultor_id}
                      onValueChange={(value) => setFormData({ ...formData, consultor_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o consultor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Input
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Ex: Venda projeto João Silva"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor_base">Valor Base (R$) *</Label>
                      <Input
                        id="valor_base"
                        type="number"
                        step="0.01"
                        value={formData.valor_base}
                        onChange={(e) => setFormData({ ...formData, valor_base: e.target.value })}
                        placeholder="0,00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="percentual">Percentual (%)</Label>
                      <Input
                        id="percentual"
                        type="number"
                        step="0.1"
                        value={formData.percentual_comissao}
                        onChange={(e) => setFormData({ ...formData, percentual_comissao: e.target.value })}
                      />
                    </div>
                  </div>

                  {formData.valor_base && formData.percentual_comissao && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Valor da Comissão:</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(
                          (parseFloat(formData.valor_base) * parseFloat(formData.percentual_comissao)) / 100
                        )}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mês Referência</Label>
                      <Select
                        value={formData.mes_referencia.toString()}
                        onValueChange={(value) => setFormData({ ...formData, mes_referencia: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MESES.map((m) => (
                            <SelectItem key={m.value} value={m.value.toString()}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Ano</Label>
                      <Select
                        value={formData.ano_referencia.toString()}
                        onValueChange={(value) => setFormData({ ...formData, ano_referencia: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {anos.map((a) => (
                            <SelectItem key={a} value={a.toString()}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      Cancelar
                    </Button>
                  <Button type="submit" disabled={salvarComissao.isPending}>
                      {salvarComissao.isPending && <Spinner size="sm" className="mr-2" />}
                      Registrar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="lista" className="mt-0">
          <SectionCard icon={DollarSign} title="Comissões" variant="neutral">
              {/* Filters */}
              <ComissoesFilters
                filterMes={filterMes}
                setFilterMes={setFilterMes}
                filterAno={filterAno}
                setFilterAno={setFilterAno}
                filterVendedor={filterVendedor}
                setFilterVendedor={setFilterVendedor}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterCliente={filterCliente}
                setFilterCliente={setFilterCliente}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                vendedores={vendedores}
                clientes={clientes}
                anos={anos}
                onClearFilters={clearFilters}
              />

              {/* Table */}
              <div className="mt-6">
              {filteredComissoes.length === 0 ? (
                  <EmptyState
                    icon={DollarSign}
                    title="Nenhuma comissão encontrada"
                    description="Não há comissões para o período selecionado."
                    action={{ label: "Nova Comissão", onClick: () => setDialogOpen(true), icon: Plus }}
                  />
                ) : (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedIds.size === filteredComissoes.length && filteredComissoes.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Comissão</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead className="text-right">A Receber</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedComissoes.map((comissao) => {
                        const valorPago = calcularValorPago(comissao);
                        const saldoRestante = calcularSaldoRestante(comissao);
                        return (
                          <TableRow key={comissao.id} className={selectedIds.has(comissao.id) ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(comissao.id)}
                                onCheckedChange={() => toggleSelect(comissao.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{comissao.consultores?.nome}</TableCell>
                            <TableCell>
                              <div>
                                <p className="truncate max-w-48" title={comissao.descricao}>{comissao.descricao}</p>
                                {comissao.projetos?.codigo && (
                                  <p className="text-xs text-muted-foreground">{comissao.projetos.codigo}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(comissao.valor_comissao)}
                            </TableCell>
                            <TableCell className="text-right text-success">{formatCurrency(valorPago)}</TableCell>
                            <TableCell className="text-right font-medium text-warning">
                              {saldoRestante > 0 ? formatCurrency(saldoRestante) : "-"}
                            </TableCell>
                            <TableCell className="text-center">{getStatusBadge(comissao.status)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {comissao.status !== "pago" && saldoRestante > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
                                    title="Pagar individual"
                                    onClick={() => {
                                      setSelectedComissao(comissao);
                                      setPayDirectOpen(true);
                                    }}
                                  >
                                    <DollarSign className="h-4 w-4 text-success" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
                                  onClick={() => {
                                    setSelectedComissao(comissao);
                                    setPagamentosDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" onClick={() => handleDelete(comissao.id)}>
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
                )}
                {filteredComissoes.length > 0 && (
                  <TablePagination
                    totalItems={filteredComissoes.length}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                  />
                )}
              </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="relatorios" className="mt-0">
          <ComissoesReports
            comissoes={filteredComissoes}
            allComissoes={allComissoes as Comissao[]}
            vendedores={vendedores}
            formatCurrency={formatCurrency}
          />
        </TabsContent>
      </Tabs>

      {/* Pagamentos Dialog */}
      {selectedComissao && (
        <PagamentosComissaoDialog
          open={pagamentosDialogOpen}
          onOpenChange={setPagamentosDialogOpen}
          comissao={selectedComissao}
          onUpdate={handleRefresh}
        />
      )}

      {/* Bulk Payment Dialog */}
      <BulkPaymentDialog
        open={bulkPaymentOpen}
        onOpenChange={(open) => {
          setBulkPaymentOpen(open);
          if (!open) setSelectedIds(new Set());
        }}
        comissoes={selectedComissoes}
        onUpdate={() => {
          handleRefresh();
          setSelectedIds(new Set());
        }}
      />

      {/* Individual Pay Direct Dialog */}
      {selectedComissao && (
        <PagamentosComissaoDialog
          open={payDirectOpen}
          onOpenChange={setPayDirectOpen}
          comissao={selectedComissao}
          onUpdate={handleRefresh}
          initialShowForm
        />
      )}
    </div>
  );
}
