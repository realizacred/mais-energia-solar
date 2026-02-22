import { useState, useEffect, useMemo } from "react";
import { DollarSign, Pencil, Plus, Trash2, SlidersHorizontal, List, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";
import { roundCurrency } from "@/lib/formatters";
import { usePricingDefaults } from "./hooks/usePricingDefaults";
import { toast } from "@/hooks/use-toast";

// ── Types ──

interface CustoRow {
  id: string;
  categoria: string;
  item: string;
  quantidade: number;
  custoUnitario: number;
  fixo: boolean; // Kit row can't be deleted
  checked: boolean;
}

interface Props {
  venda: VendaData;
  onVendaChange: (venda: VendaData) => void;
  itens: KitItemRow[];
  servicos: ServicoItem[];
  potenciaKwp: number;
}

// ── View Modes ──

type ViewMode = "resumido" | "detalhado";

// ── Component ──

export function StepFinancialCenter({ venda, onVendaChange, itens, servicos, potenciaKwp }: Props) {
  const instalacaoServico = servicos.find(s => s.categoria === "instalacao");
  const comissaoServico = servicos.find(s => s.categoria === "comissao");

  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("detalhado");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"margem" | "preco">("margem");
  const [editValue, setEditValue] = useState("0");
  const [custosExtras, setCustosExtras] = useState<CustoRow[]>([]);
  const [appliedSmartDefaults, setAppliedSmartDefaults] = useState(false);
  const [instalacaoEnabled, setInstalacaoEnabled] = useState(true);
  const [comissaoEnabled, setComissaoEnabled] = useState(true);
  const [instalacaoQtd, setInstalacaoQtd] = useState(1);
  const [comissaoQtd, setComissaoQtd] = useState(1);
  const [instalacaoCusto, setInstalacaoCusto] = useState(instalacaoServico?.valor || 0);
  const [comissaoCusto, setComissaoCusto] = useState(comissaoServico?.valor || 0);
  const [kitExpanded, setKitExpanded] = useState(false);
  const { suggested, loading: loadingHistory } = usePricingDefaults(potenciaKwp);

  // Load pricing defaults from config
  useEffect(() => {
    if (loadedDefaults) return;
    supabase
      .from("pricing_config")
      .select("margem_minima_percent, comissao_padrao_percent, desconto_maximo_percent")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          if (venda.margem_percentual === 20 && d.margem_minima_percent) {
            onVendaChange({ ...venda, margem_percentual: d.margem_minima_percent });
          }
        }
        setLoadedDefaults(true);
      });
  }, []);

  // Auto-apply smart defaults from pricing history
  useEffect(() => {
    if (appliedSmartDefaults || !suggested || loadingHistory) return;
    
    const isUntouched = venda.custo_comissao === 0 && venda.custo_outros === 0;
    if (!isUntouched) {
      setAppliedSmartDefaults(true);
      return;
    }

    const updates: Partial<VendaData> = {};
    if (suggested.margem_percentual != null) updates.margem_percentual = Math.round(suggested.margem_percentual * 10) / 10;
    if (suggested.custo_comissao != null) updates.custo_comissao = suggested.custo_comissao;
    if (suggested.custo_outros != null) updates.custo_outros = suggested.custo_outros;

    if (Object.keys(updates).length > 0) {
      onVendaChange({ ...venda, ...updates });
      toast({
        title: "💡 Valores pré-preenchidos",
        description: "Baseado na mediana das suas últimas propostas.",
      });
    }
    setAppliedSmartDefaults(true);
  }, [suggested, loadingHistory, appliedSmartDefaults]);

  // ── Calculations ──

  const custoKit = roundCurrency(itens.reduce((s, i) => s + roundCurrency(i.quantidade * i.preco_unitario), 0));
  const kitLabel = potenciaKwp > 0 ? `Kit fotovoltaico ${potenciaKwp.toFixed(2)} kWp` : "Kit fotovoltaico";

  // Build all cost rows
  const allRows = useMemo<CustoRow[]>(() => {
    const rows: CustoRow[] = [];

    // Kit row (always first, not deletable)
    rows.push({
      id: "kit",
      categoria: "KIT",
      item: kitLabel,
      quantidade: 1,
      custoUnitario: custoKit,
      fixo: true,
      checked: true,
    });

    // Instalação
    rows.push({
      id: "instalacao",
      categoria: "Instalação",
      item: "Instalação",
      quantidade: instalacaoQtd,
      custoUnitario: instalacaoCusto,
      fixo: true,
      checked: instalacaoEnabled,
    });

    // Comissão
    rows.push({
      id: "comissao",
      categoria: "Comissão",
      item: "Comissão",
      quantidade: comissaoQtd,
      custoUnitario: comissaoCusto,
      fixo: true,
      checked: comissaoEnabled,
    });

    // User-added extras
    custosExtras.forEach(c => rows.push(c));

    return rows;
  }, [custoKit, kitLabel, instalacaoQtd, instalacaoCusto, instalacaoEnabled, comissaoQtd, comissaoCusto, comissaoEnabled, custosExtras]);

  const custoTotal = roundCurrency(allRows.filter(r => r.checked).reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const margemPercent = venda.margem_percentual;
  const margemValor = roundCurrency(custoTotal * (margemPercent / 100));
  const precoVenda = roundCurrency(custoTotal + margemValor);
  const precoWp = potenciaKwp > 0 ? roundCurrency(precoVenda / (potenciaKwp * 1000)) : 0;

  // Slider range
  const sliderMin = custoTotal;
  const sliderMax = custoTotal * 2 || 50000;

  const handleSliderChange = (value: number[]) => {
    const newPreco = value[0];
    const newMargem = custoTotal > 0 ? ((newPreco - custoTotal) / custoTotal) * 100 : 0;
    onVendaChange({ ...venda, margem_percentual: Math.max(0, Math.round(newMargem * 100) / 100) });
  };

  // ── Edit Modal ──

  const openEditModal = () => {
    setEditMode("margem");
    setEditValue(margemPercent.toFixed(2));
    setShowEditModal(true);
  };

  const applyEditModal = () => {
    const val = parseFloat(editValue) || 0;
    if (editMode === "margem") {
      onVendaChange({ ...venda, margem_percentual: val });
    } else {
      // Preço total → calculate margem
      const newMargem = custoTotal > 0 ? ((val - custoTotal) / custoTotal) * 100 : 0;
      onVendaChange({ ...venda, margem_percentual: Math.max(0, newMargem) });
    }
    setShowEditModal(false);
  };

  // ── Add Cost ──

  const addCusto = () => {
    setCustosExtras(prev => [...prev, {
      id: crypto.randomUUID(),
      categoria: "Outros",
      item: "NovoItem",
      quantidade: 1,
      custoUnitario: 0,
      fixo: false,
      checked: true,
    }]);
  };

  const updateExtra = (id: string, field: keyof CustoRow, value: any) => {
    setCustosExtras(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeExtra = (id: string) => {
    setCustosExtras(prev => prev.filter(c => c.id !== id));
  };

  // Per-row margem distribution
  const getRowMargem = (row: CustoRow) => {
    if (!row.checked || custoTotal === 0) return 0;
    const rowTotal = row.quantidade * row.custoUnitario;
    return (rowTotal / custoTotal) * margemValor;
  };

  const getRowVenda = (row: CustoRow) => {
    if (!row.checked) return 0;
    return row.quantidade * row.custoUnitario + getRowMargem(row);
  };

  const getRowPercent = (row: CustoRow) => {
    if (precoVenda === 0) return 0;
    return (getRowVenda(row) / precoVenda) * 100;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Venda
        </h3>
      </div>

      {/* Price Slider Bar — responsive */}
      <div className="rounded-xl border border-border/50 bg-card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 sm:flex-initial">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Preço de venda</Label>
            <div className="flex-1 sm:w-48 sm:flex-initial">
              <Slider
                value={[precoVenda]}
                onValueChange={handleSliderChange}
                min={sliderMin}
                max={sliderMax}
                step={100}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{formatBRL(precoVenda)}</span>
              {precoWp > 0 && (
                <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
                  {formatBRL(precoWp)} / Wp
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditModal}>
                <Pencil className="h-3.5 w-3.5 text-primary" />
              </Button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 border-l border-border/40 pl-3">
              <button
                onClick={() => setViewMode("resumido")}
                className={cn("p-1.5 rounded", viewMode === "resumido" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
                title="Resumido"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("detalhado")}
                className={cn("p-1.5 rounded", viewMode === "detalhado" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
                title="Detalhado"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Table Header */}
        <div className={cn(
          "grid items-center px-4 py-2.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/20",
          viewMode === "resumido"
            ? "grid-cols-[auto_120px_1fr_80px_120px_100px]"
            : "grid-cols-[auto_120px_1fr_80px_120px_120px_120px_120px]"
        )}>
          <span className="w-6" /> {/* checkbox */}
          <span>Categoria</span>
          <span>Item</span>
          <span className="text-center">Qtd</span>
          {viewMode === "resumido" ? (
            <>
              <span className="text-right">Valores</span>
              <span className="text-right">% do total</span>
            </>
          ) : (
            <>
              <span className="text-right">Custo unitário</span>
              <span className="text-right">Custo total</span>
              <span className="text-right">Margem</span>
              <span className="text-right">Venda</span>
            </>
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/20">
          {allRows.map((row) => {
            const rowTotal = roundCurrency(row.quantidade * row.custoUnitario);
            const rowMargem = roundCurrency(getRowMargem(row));
            const rowVenda = roundCurrency(getRowVenda(row));
            const rowPercent = getRowPercent(row);
            const isKit = row.id === "kit";
            const isExtra = !row.fixo;

            return (
              <div key={row.id}>
                <div
                  className={cn(
                    "grid items-center px-4 py-2.5 text-xs transition-opacity",
                    !row.checked && "opacity-40",
                    isKit && "cursor-pointer hover:bg-muted/20",
                    viewMode === "resumido"
                      ? "grid-cols-[auto_120px_1fr_80px_120px_100px]"
                      : "grid-cols-[auto_120px_1fr_80px_120px_120px_120px_120px]"
                  )}
                  onClick={isKit && itens.length > 0 ? () => setKitExpanded(prev => !prev) : undefined}
                >
                  {/* Checkbox */}
                  <div className="w-6">
                    {!isKit && row.fixo && (
                      <Checkbox
                        checked={row.checked}
                        onCheckedChange={(checked) => {
                          if (row.id === "instalacao") setInstalacaoEnabled(!!checked);
                          if (row.id === "comissao") setComissaoEnabled(!!checked);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    )}
                  </div>

                  {/* Categoria */}
                  <span className="text-muted-foreground font-medium">{row.categoria}</span>

                  {/* Item */}
                  <div>
                    {isExtra ? (
                      <Input
                        value={row.item}
                        onChange={e => updateExtra(row.id, "item", e.target.value)}
                        className="h-7 text-xs w-36"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex items-center gap-1">
                        {row.item}
                        {isKit && itens.length > 0 && (
                          kitExpanded
                            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Qtd */}
                  <div className="text-center" onClick={e => e.stopPropagation()}>
                    {isKit ? (
                      <span>{row.quantidade}</span>
                    ) : isExtra ? (
                      <Input
                        type="number"
                        min={1}
                        value={row.quantidade}
                        onChange={e => updateExtra(row.id, "quantidade", Number(e.target.value) || 1)}
                        className="h-7 text-xs w-14 mx-auto text-center"
                      />
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        value={row.quantidade}
                        onChange={e => {
                          const val = Number(e.target.value) || 1;
                          if (row.id === "instalacao") setInstalacaoQtd(val);
                          if (row.id === "comissao") setComissaoQtd(val);
                        }}
                        className="h-7 text-xs w-14 mx-auto text-center"
                        disabled={!row.checked}
                      />
                    )}
                  </div>

                  {viewMode === "resumido" ? (
                    <>
                      <span className="text-right font-medium">
                        {rowTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {rowPercent.toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-right" onClick={e => e.stopPropagation()}>
                        {isKit ? (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.custoUnitario || ""}
                            className="h-7 text-xs w-24 ml-auto text-right"
                            readOnly
                          />
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.custoUnitario || ""}
                            onChange={e => {
                              const val = Number(e.target.value) || 0;
                              if (isExtra) {
                                updateExtra(row.id, "custoUnitario", val);
                              } else if (row.id === "instalacao") {
                                setInstalacaoCusto(val);
                              } else if (row.id === "comissao") {
                                setComissaoCusto(val);
                              }
                            }}
                            className="h-7 text-xs w-24 ml-auto text-right"
                            disabled={!row.checked}
                          />
                        )}
                      </div>
                      <span className="text-right font-medium">
                        {rowTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {rowMargem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right font-medium">
                        {rowVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </>
                  )}

                  {/* Delete button for extras */}
                  {isExtra && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive/40 hover:text-destructive ml-1"
                      onClick={(e) => { e.stopPropagation(); removeExtra(row.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Kit sub-items (expanded) */}
                {isKit && kitExpanded && itens.length > 0 && (
                  <div className="bg-muted/10 border-t border-border/10">
                    {itens.map((item) => {
                      // Group by categoria for label
                      const catLabel = item.categoria === "modulo" ? "Módulo"
                        : item.categoria === "inversor" ? "Inversor"
                        : item.categoria === "otimizador" ? "Otimizador"
                        : item.categoria === "bateria" ? "Bateria"
                        : item.categoria;

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "grid items-center px-4 pl-10 py-2 text-xs text-muted-foreground",
                            viewMode === "resumido"
                              ? "grid-cols-[auto_120px_1fr_80px_120px_100px]"
                              : "grid-cols-[auto_120px_1fr_80px_120px_120px_120px_120px]"
                          )}
                        >
                          <span className="w-6" />
                          <span className="text-muted-foreground/70 text-[10px] font-medium">{catLabel}</span>
                          <span>{item.fabricante} {item.modelo} {item.potencia_w > 0 ? `${item.potencia_w}W` : ""}</span>
                          <span className="text-center">{item.quantidade}</span>
                          {viewMode === "resumido" ? (
                            <>
                              <span />
                              <span />
                            </>
                          ) : (
                            <>
                              <span />
                              <span />
                              <span />
                              <span />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Margem row (resumido view only, as "Margem (Markup X%)") */}
          {viewMode === "resumido" && (
            <div className={cn(
              "grid items-center px-4 py-2.5 text-xs",
              "grid-cols-[auto_120px_1fr_80px_120px_100px]"
            )}>
              <span className="w-6" />
              <span />
              <span className="text-muted-foreground">Margem (Markup {margemPercent.toFixed(2)}%)</span>
              <span />
              <span className="text-right font-medium">
                {margemValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-right text-muted-foreground">0,00%</span>
            </div>
          )}

          {/* Total row */}
          <div className={cn(
            "grid items-center px-4 py-3 text-xs font-bold bg-muted/5",
            viewMode === "resumido"
              ? "grid-cols-[auto_120px_1fr_80px_120px_100px]"
              : "grid-cols-[auto_120px_1fr_80px_120px_120px_120px_120px]"
          )}>
            <span className="w-6" />
            <span />
            <span />
            <span />
            {viewMode === "resumido" ? (
              <>
                <span className="text-right text-sm">
                  {precoVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-right text-sm">100%</span>
              </>
            ) : (
              <>
                <span />
                <span className="text-right text-sm">
                  {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-right text-sm">
                  {margemValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-right text-sm">
                  {precoVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* + Adicionar Custo */}
      <button
        onClick={addCusto}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar Custo
      </button>

      {/* ── Edit Modal ── */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar valor total</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={editMode === "margem" ? "default" : "outline"}
              className="text-xs h-8"
              onClick={() => {
                setEditMode("margem");
                setEditValue(margemPercent.toFixed(2));
              }}
            >
              Margem
            </Button>
            <Button
              size="sm"
              variant={editMode === "preco" ? "default" : "outline"}
              className="text-xs h-8"
              onClick={() => {
                setEditMode("preco");
                setEditValue(precoVenda.toFixed(2));
              }}
            >
              Preço total do projeto
            </Button>
          </div>

          {/* Input */}
          <div className="relative">
            <Input
              type="number"
              step={0.01}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="pr-8"
            />
            {editMode === "margem" && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={applyEditModal}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Helper to calculate precoFinal from outside */
export function calcPrecoFinal(itens: KitItemRow[], servicos: ServicoItem[], venda: VendaData): number {
  const custoKit = roundCurrency(itens.reduce((s, i) => s + roundCurrency(i.quantidade * i.preco_unitario), 0));
  const custoServicos = roundCurrency(servicos.filter(s => s.incluso_no_preco).reduce((s, i) => s + i.valor, 0));
  const custoBase = roundCurrency(custoKit + custoServicos + venda.custo_comissao + venda.custo_outros);
  const margemValor = roundCurrency(custoBase * (venda.margem_percentual / 100));
  const precoComMargem = roundCurrency(custoBase + margemValor);
  return roundCurrency(precoComMargem - precoComMargem * (venda.desconto_percentual / 100));
}
