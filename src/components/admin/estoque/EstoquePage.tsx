import { useState, useMemo } from "react";
import { Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Search, Plus, Filter } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  useEstoqueSaldos,
  useEstoqueMovimentos,
  useCreateEstoqueItem,
  useCreateMovimento,
  useUpdateEstoqueItem,
  ESTOQUE_CATEGORIAS,
  ESTOQUE_UNIDADES,
  CATEGORIA_LABELS,
  TIPO_MOVIMENTO_LABELS,
  type EstoqueSaldo,
} from "@/hooks/useEstoque";
import { FormModalTemplate, FormSection, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function EstoquePage() {
  const [tab, setTab] = useState("itens");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [movTipoFilter, setMovTipoFilter] = useState("all");

  // Dialogs
  const [itemDialog, setItemDialog] = useState(false);
  const [movDialog, setMovDialog] = useState<"entrada" | "saida" | null>(null);

  const { data: saldos = [], isLoading: loadingSaldos } = useEstoqueSaldos();
  const { data: movimentos = [], isLoading: loadingMov } = useEstoqueMovimentos(
    movTipoFilter !== "all" ? { tipo: movTipoFilter } : undefined
  );

  // Stats
  const totalItens = saldos.filter((s) => s.ativo).length;
  const lowStockCount = saldos.filter((s) => s.ativo && s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0).length;
  const totalValue = saldos.reduce((sum, s) => sum + s.estoque_atual * s.custo_medio, 0);

  // Filtered items
  const filteredSaldos = useMemo(() => {
    let result = saldos.filter((s) => s.ativo);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.nome.toLowerCase().includes(q) || s.sku?.toLowerCase().includes(q));
    }
    if (catFilter !== "all") result = result.filter((s) => s.categoria === catFilter);
    if (lowStockOnly) result = result.filter((s) => s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0);
    return result;
  }, [saldos, search, catFilter, lowStockOnly]);

  // Filtered movements
  const filteredMov = useMemo(() => {
    if (!search) return movimentos;
    const q = search.toLowerCase();
    return movimentos.filter((m) => m.item_nome?.toLowerCase().includes(q));
  }, [movimentos, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Estoque"
        description="Controle de materiais elétricos e estruturais"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setMovDialog("saida")}>
              <ArrowUpCircle className="h-4 w-4 mr-1.5" />
              Saída
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovDialog("entrada")}>
              <ArrowDownCircle className="h-4 w-4 mr-1.5" />
              Entrada
            </Button>
            <Button size="sm" onClick={() => setItemDialog(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Item
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Package} label="Itens ativos" value={totalItens} color="primary" />
        <StatCard icon={AlertTriangle} label="Estoque baixo" value={lowStockCount} color={lowStockCount > 0 ? "destructive" : "success"} />
        <StatCard icon={ArrowDownCircle} label="Entradas (mês)" value={movimentos.filter((m) => m.tipo === "entrada").length} color="success" />
        <StatCard
          icon={Package}
          label="Valor em estoque"
          value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          color="info"
        />
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <SectionCard variant="red" icon={AlertTriangle} title={`${lowStockCount} iten${lowStockCount > 1 ? "s" : ""} com estoque baixo`}>
          <div className="flex flex-wrap gap-2">
            {saldos
              .filter((s) => s.ativo && s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0)
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
          </TabsList>
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="w-48" />
            {tab === "itens" && (
              <>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="w-36 h-9 text-xs">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {ESTOQUE_CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={lowStockOnly ? "destructive" : "outline"}
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Baixo
                </Button>
              </>
            )}
            {tab === "movimentos" && (
              <Select value={movTipoFilter} onValueChange={setMovTipoFilter}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <TabsContent value="itens" className="mt-4">
          {loadingSaldos ? (
            <InlineLoader context="data_load" />
          ) : filteredSaldos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum item encontrado"
              description={search ? "Tente outro termo de busca." : "Cadastre seu primeiro item de estoque."}
              action={!search ? { label: "Novo Item", onClick: () => setItemDialog(true), icon: Plus } : undefined}
            />
          ) : (
            <ItemsTable items={filteredSaldos} />
          )}
        </TabsContent>

        <TabsContent value="movimentos" className="mt-4">
          {loadingMov ? (
            <InlineLoader context="data_load" />
          ) : filteredMov.length === 0 ? (
            <EmptyState
              icon={ArrowDownCircle}
              title="Nenhum movimento"
              description="Registre entradas e saídas para controlar o estoque."
            />
          ) : (
            <MovementsTable movements={filteredMov} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ItemFormDialog open={itemDialog} onOpenChange={setItemDialog} />
      <MovementFormDialog open={!!movDialog} tipo={movDialog || "entrada"} onOpenChange={() => setMovDialog(null)} saldos={saldos} />
    </div>
  );
}

// ─── Items Table ────────────────────────────────────────

function ItemsTable({ items }: { items: EstoqueSaldo[] }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Estoque</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Mínimo</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Custo Médio</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.estoque_minimo > 0 && item.estoque_atual <= item.estoque_minimo;
            return (
              <tr key={item.item_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-foreground">{item.nome}</div>
                  {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[item.categoria] || item.categoria}</Badge>
                </td>
                <td className={`p-3 text-right font-semibold ${isLow ? "text-destructive" : "text-foreground"}`}>
                  {item.estoque_atual} {item.unidade}
                </td>
                <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                  {item.estoque_minimo} {item.unidade}
                </td>
                <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                  R$ {Number(item.custo_medio).toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  {isLow ? (
                    <Badge variant="destructive" className="text-[10px]">Baixo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-success border-success/30">OK</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Movements Table ────────────────────────────────────

function MovementsTable({ movements }: { movements: any[] }) {
  const tipoStyles: Record<string, string> = {
    entrada: "bg-success/10 text-success",
    saida: "bg-destructive/10 text-destructive",
    ajuste: "bg-warning/10 text-warning",
    transferencia: "bg-info/10 text-info",
  };

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Tipo</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Qtd</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Custo Un.</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Obs</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
              </td>
              <td className="p-3 font-medium text-foreground">{m.item_nome}</td>
              <td className="p-3 text-center">
                <Badge className={`text-[10px] ${tipoStyles[m.tipo] || ""}`}>
                  {TIPO_MOVIMENTO_LABELS[m.tipo] || m.tipo}
                </Badge>
              </td>
              <td className="p-3 text-right font-semibold">
                {m.tipo === "saida" ? "-" : "+"}{m.quantidade}
              </td>
              <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                {m.custo_unitario ? `R$ ${Number(m.custo_unitario).toFixed(2)}` : "—"}
              </td>
              <td className="p-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                {m.observacao || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Item Form Dialog ───────────────────────────────────

function ItemFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [nome, setNome] = useState("");
  const [sku, setSku] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [unidade, setUnidade] = useState("UN");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");

  const createItem = useCreateEstoqueItem();

  const handleSubmit = () => {
    if (!nome.trim()) return;
    createItem.mutate(
      {
        nome: nome.trim(),
        sku: sku.trim() || null,
        categoria,
        unidade,
        estoque_minimo: Number(estoqueMinimo) || 0,
        ativo: true,
      } as any,
      {
        onSuccess: () => {
          onOpenChange(false);
          setNome("");
          setSku("");
          setCategoria("geral");
          setUnidade("UN");
          setEstoqueMinimo("0");
        },
      }
    );
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title="Novo Item de Estoque"
      onSubmit={handleSubmit}
      submitLabel="Cadastrar"
      saving={createItem.isPending}
      disabled={!nome.trim()}
      asForm
    >
      <FormGrid>
        <div>
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cabo solar 6mm²" />
        </div>
        <div>
          <Label>SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Código interno" />
        </div>
      </FormGrid>
      <FormGrid>
        <div>
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTOQUE_CATEGORIAS.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unidade</Label>
          <Select value={unidade} onValueChange={setUnidade}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ESTOQUE_UNIDADES.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormGrid>
      <div>
        <Label>Estoque mínimo (alerta)</Label>
        <Input type="number" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} min="0" />
      </div>
    </FormModalTemplate>
  );
}

// ─── Movement Form Dialog ───────────────────────────────

function MovementFormDialog({
  open,
  tipo,
  onOpenChange,
  saldos,
}: {
  open: boolean;
  tipo: "entrada" | "saida";
  onOpenChange: () => void;
  saldos: EstoqueSaldo[];
}) {
  const [itemId, setItemId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [observacao, setObservacao] = useState("");

  const createMov = useCreateMovimento();

  const handleSubmit = () => {
    if (!itemId || !quantidade || Number(quantidade) <= 0) return;
    createMov.mutate(
      {
        item_id: itemId,
        tipo,
        quantidade: Number(quantidade),
        custo_unitario: tipo === "entrada" && custoUnitario ? Number(custoUnitario) : null,
        origem: tipo === "entrada" ? "purchase" : "project",
        observacao: observacao.trim() || null,
      },
      {
        onSuccess: () => {
          onOpenChange();
          setItemId("");
          setQuantidade("");
          setCustoUnitario("");
          setObservacao("");
        },
      }
    );
  };

  const activeItems = saldos.filter((s) => s.ativo);

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={() => onOpenChange()}
      title={tipo === "entrada" ? "Registrar Entrada" : "Registrar Saída"}
      onSubmit={handleSubmit}
      submitLabel={tipo === "entrada" ? "Confirmar Entrada" : "Confirmar Saída"}
      saving={createMov.isPending}
      disabled={!itemId || !quantidade || Number(quantidade) <= 0}
      asForm
    >
      <div>
        <Label>Item *</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
          <SelectContent>
            {activeItems.map((s) => (
              <SelectItem key={s.item_id} value={s.item_id}>
                {s.nome} ({s.estoque_atual} {s.unidade})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormGrid>
        <div>
          <Label>Quantidade *</Label>
          <Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min="0.01" step="0.01" />
        </div>
        {tipo === "entrada" && (
          <div>
            <Label>Custo unitário (R$)</Label>
            <Input type="number" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} min="0" step="0.01" />
          </div>
        )}
      </FormGrid>
      <div>
        <Label>Observação</Label>
        <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="NF, projeto, motivo..." />
      </div>
    </FormModalTemplate>
  );
}

export default EstoquePage;
