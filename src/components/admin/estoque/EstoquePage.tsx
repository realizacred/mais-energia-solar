import { useState, useMemo } from "react";
import { useEstoqueRealtime } from "@/hooks/useEstoqueRealtime";
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Plus,
  ScanBarcode, QrCode, ArrowRightLeft, ShieldCheck, Download, Warehouse, Wrench,
  FileText,
} from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { BarcodeScannerDialog } from "./BarcodeScannerDialog";
import { ItemQRCodeDialog } from "./ItemQRCodeDialog";
import { ItemFormDialog } from "./ItemFormDialog";
import { MovementFormDialog } from "./MovementFormDialog";
import { ReservaFormDialog } from "./ReservaFormDialog";
import { TransferDialog } from "./TransferDialog";
import { LocalFormDialog } from "./LocalFormDialog";
import { ItemsTable } from "./ItemsTable";
import { MovementsTable } from "./MovementsTable";
import { ReservasTable } from "./ReservasTable";
import {
  useEstoqueSaldos, useEstoqueMovimentos, useEstoqueReservas,
  ESTOQUE_CATEGORIAS, CATEGORIA_LABELS, type EstoqueSaldo,
} from "@/hooks/useEstoque";
import { useEstoqueCategorias } from "@/hooks/useEstoqueCategorias";
import { generateEstoqueItemsPDF, generateEstoqueMovimentosPDF, generateEstoqueBaixoPDF } from "./estoqueReportPDF";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EstoquePage() {
  const [tab, setTab] = useState("itens");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [subCatFilter, setSubCatFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [movTipoFilter, setMovTipoFilter] = useState("all");
  const [reservaStatusFilter, setReservaStatusFilter] = useState("active");

  // Dialogs
  const [itemDialog, setItemDialog] = useState(false);
  const [itemDialogSku, setItemDialogSku] = useState("");
  const [movDialog, setMovDialog] = useState<"entrada" | "saida" | "ajuste" | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrItem, setQrItem] = useState<EstoqueSaldo | null>(null);
  const [reservaDialog, setReservaDialog] = useState(false);
  const [transferDialog, setTransferDialog] = useState(false);
  const [localDialog, setLocalDialog] = useState(false);

  const { data: saldos = [], isLoading: loadingSaldos } = useEstoqueSaldos();
  const { data: movimentos = [], isLoading: loadingMov } = useEstoqueMovimentos(
    movTipoFilter !== "all" ? { tipo: movTipoFilter } : undefined
  );
  const { data: reservas = [], isLoading: loadingReservas } = useEstoqueReservas(reservaStatusFilter);
  const { data: customCategorias = [] } = useEstoqueCategorias();

  // Merge hardcoded + custom categories for filter
  const allCategoryOptions = useMemo(() => {
    const options: { value: string; label: string }[] = ESTOQUE_CATEGORIAS.map((c) => ({
      value: c,
      label: CATEGORIA_LABELS[c] || c,
    }));
    const parentCats = customCategorias.filter((c) => !c.parent_id && c.ativo);
    parentCats.forEach((c) => {
      if (!options.find((o) => o.value === c.slug)) {
        options.push({ value: c.slug, label: c.nome });
      }
    });
    return options;
  }, [customCategorias]);

  // Subcategories for selected category
  const subCategoryOptions = useMemo(() => {
    if (catFilter === "all") return [];
    const parent = customCategorias.find((c) => c.slug === catFilter && !c.parent_id && c.ativo);
    if (!parent) return [];
    return customCategorias.filter((c) => c.parent_id === parent.id && c.ativo).map((c) => ({
      value: c.slug,
      label: c.nome,
    }));
  }, [catFilter, customCategorias]);

  // Stats
  const activeSaldos = saldos.filter((s) => s.ativo);
  const totalItens = activeSaldos.length;
  const lowStockCount = activeSaldos.filter((s) => s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0).length;
  const totalValue = activeSaldos.reduce((sum, s) => sum + s.estoque_atual * s.custo_medio, 0);
  const totalReservado = activeSaldos.reduce((sum, s) => sum + s.reservado, 0);

  // Filtered items
  const filteredSaldos = useMemo(() => {
    let result = activeSaldos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.nome.toLowerCase().includes(q) || s.sku?.toLowerCase().includes(q) || s.codigo_barras?.toLowerCase().includes(q)
      );
    }
    if (catFilter !== "all") result = result.filter((s) => s.categoria === catFilter);
    if (subCatFilter !== "all") result = result.filter((s) => (s as any).subcategoria === subCatFilter);
    if (lowStockOnly) result = result.filter((s) => s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0);
    return result;
  }, [activeSaldos, search, catFilter, subCatFilter, lowStockOnly]);

  // Filtered movements
  const filteredMov = useMemo(() => {
    if (!search) return movimentos;
    const q = search.toLowerCase();
    return movimentos.filter((m) => m.item_nome?.toLowerCase().includes(q));
  }, [movimentos, search]);

  // CSV export
  const handleExportCSV = () => {
    const rows = [["Item", "SKU", "Categoria", "Unidade", "Estoque", "Mínimo", "Reservado", "Disponível", "Custo Médio", "Valor"]];
    filteredSaldos.forEach((s) => {
      rows.push([
        s.nome, s.sku || "", s.categoria, s.unidade,
        String(s.estoque_atual), String(s.estoque_minimo), String(s.reservado),
        String(s.disponivel), String(s.custo_medio),
        String((s.estoque_atual * s.custo_medio).toFixed(2)),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset subcategory when category changes
  const handleCatChange = (v: string) => {
    setCatFilter(v);
    setSubCatFilter("all");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Estoque"
        description="Controle de materiais — ledger SSOT"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="soft" size="sm" onClick={() => setScannerOpen(true)}>
              <ScanBarcode className="h-4 w-4 mr-1.5" />Scanner
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTransferDialog(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-1.5" />Transferir
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovDialog("ajuste")}>
              <Wrench className="h-4 w-4 mr-1.5" />Ajuste
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovDialog("saida")}>
              <ArrowUpCircle className="h-4 w-4 mr-1.5" />Saída
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovDialog("entrada")}>
              <ArrowDownCircle className="h-4 w-4 mr-1.5" />Entrada
            </Button>
            <Button size="sm" onClick={() => { setItemDialogSku(""); setItemDialog(true); }}>
              <Plus className="h-4 w-4 mr-1.5" />Novo Item
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Package} label="Itens ativos" value={totalItens} color="primary" />
        <StatCard icon={AlertTriangle} label="Estoque baixo" value={lowStockCount} color={lowStockCount > 0 ? "destructive" : "success"} />
        <StatCard icon={ArrowDownCircle} label="Entradas (mês)" value={movimentos.filter((m) => m.tipo === "entrada").length} color="success" />
        <StatCard icon={ShieldCheck} label="Reservado" value={totalReservado} color="warning" />
        <StatCard
          icon={Package} label="Valor total"
          value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          color="info"
        />
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <SectionCard variant="red" icon={AlertTriangle} title={`${lowStockCount} iten${lowStockCount > 1 ? "s" : ""} com estoque baixo`}>
          <div className="flex flex-wrap gap-2">
            {activeSaldos
              .filter((s) => s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0)
              .map((s) => (
                <Badge key={s.item_id} variant="destructive" className="text-xs">
                  {s.nome}: {s.estoque_atual} {s.unidade} (mín: {s.estoque_minimo})
                </Badge>
              ))}
          </div>
        </SectionCard>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="itens">Itens</TabsTrigger>
            <TabsTrigger value="movimentos">Movimentos</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-wrap">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="w-48" />
            {tab === "itens" && (
              <>
                <Select value={catFilter} onValueChange={handleCatChange}>
                  <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {allCategoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subCategoryOptions.length > 0 && (
                  <Select value={subCatFilter} onValueChange={setSubCatFilter}>
                    <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Subcategoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {subCategoryOptions.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant={lowStockOnly ? "destructive" : "outline"} size="sm" className="text-xs gap-1"
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                >
                  <AlertTriangle className="h-3 w-3" />Baixo
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleExportCSV}>
                  <Download className="h-3 w-3" />CSV
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => generateEstoqueItemsPDF(filteredSaldos)}>
                      Lista de Itens
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateEstoqueMovimentosPDF(movimentos)}>
                      Movimentações
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateEstoqueBaixoPDF(saldos)} disabled={lowStockCount === 0}>
                      Itens com Estoque Baixo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setLocalDialog(true)}>
                  <Warehouse className="h-3 w-3" />Depósito
                </Button>
              </>
            )}
            {tab === "movimentos" && (
              <>
                <Select value={movTipoFilter} onValueChange={setMovTipoFilter}>
                  <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      <FileText className="h-3 w-3" />PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => generateEstoqueMovimentosPDF(filteredMov)}>
                      Movimentações Filtradas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {tab === "reservas" && (
              <>
                <Select value={reservaStatusFilter} onValueChange={setReservaStatusFilter}>
                  <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="active">Ativas</SelectItem>
                    <SelectItem value="consumed">Consumidas</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="text-xs" onClick={() => setReservaDialog(true)}>
                  <Plus className="h-3 w-3 mr-1" />Reservar
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="itens" className="mt-4">
          {loadingSaldos ? <InlineLoader context="data_load" /> : filteredSaldos.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum item encontrado"
              description={search ? "Tente outro termo." : "Cadastre seu primeiro item."}
              action={!search ? { label: "Novo Item", onClick: () => setItemDialog(true), icon: Plus } : undefined}
            />
          ) : <ItemsTable items={filteredSaldos} onQrCode={setQrItem} />}
        </TabsContent>

        <TabsContent value="movimentos" className="mt-4">
          {loadingMov ? <InlineLoader context="data_load" /> : filteredMov.length === 0 ? (
            <EmptyState icon={ArrowDownCircle} title="Nenhum movimento" description="Registre entradas e saídas." />
          ) : <MovementsTable movements={filteredMov} />}
        </TabsContent>

        <TabsContent value="reservas" className="mt-4">
          {loadingReservas ? <InlineLoader context="data_load" /> : reservas.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Nenhuma reserva" description="Crie reservas para projetos ou OS."
              action={{ label: "Nova Reserva", onClick: () => setReservaDialog(true), icon: Plus }}
            />
          ) : <ReservasTable reservas={reservas} />}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ItemFormDialog open={itemDialog} onOpenChange={setItemDialog} defaultSku={itemDialogSku} />
      <MovementFormDialog open={!!movDialog} tipo={movDialog || "entrada"} onOpenChange={() => setMovDialog(null)} saldos={saldos} />
      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen}
        onItemNotFound={(sku) => { setItemDialogSku(sku); setItemDialog(true); }} />
      <ItemQRCodeDialog open={!!qrItem} onOpenChange={() => setQrItem(null)} item={qrItem} />
      <ReservaFormDialog open={reservaDialog} onOpenChange={setReservaDialog} saldos={saldos} />
      <TransferDialog open={transferDialog} onOpenChange={setTransferDialog} saldos={saldos} />
      <LocalFormDialog open={localDialog} onOpenChange={setLocalDialog} />
    </div>
  );
}

export default EstoquePage;
