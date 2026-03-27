import { useState, useEffect, useMemo } from "react";
import { DollarSign, Pencil, Plus, Trash2, SlidersHorizontal, List, Sparkles, ChevronDown, ChevronUp, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui-kit/inputs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type VendaData, type KitItemRow, type ServicoItem, formatBRL } from "./types";
import { roundCurrency } from "@/lib/formatters";
import { usePricingDefaults } from "./hooks/usePricingDefaults";
import { usePricingConfig } from "./hooks/usePricingConfig";
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
  leadId?: string | null;
}

// ── View Modes ──

type ViewMode = "resumido" | "detalhado";

// ── Component ──

export function StepFinancialCenter({ venda, onVendaChange, itens, servicos, potenciaKwp, leadId }: Props) {
  const instalacaoServico = servicos.find(s => s.categoria === "instalacao");
  const comissaoServico = servicos.find(s => s.categoria === "comissao");

  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("detalhado");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"margem" | "preco">("margem");
  const [editValue, setEditValue] = useState("0");
  const [custosExtras, setCustosExtras] = useState<CustoRow[]>([]);
  // appliedSmartDefaults removed — history no longer auto-applies
  const [instalacaoEnabled, setInstalacaoEnabled] = useState(true);
  const [comissaoEnabled, setComissaoEnabled] = useState(true);
  const [instalacaoQtd, setInstalacaoQtd] = useState(1);
  const [comissaoQtd, setComissaoQtd] = useState(1);
  const [instalacaoCusto, setInstalacaoCusto] = useState(instalacaoServico?.valor || 0);
  const [comissaoCusto, setComissaoCusto] = useState(comissaoServico?.valor || 0);
  const [kitExpanded, setKitExpanded] = useState(false);
  const [kitCustoOverride, setKitCustoOverride] = useState<number | null>(venda.custo_kit_override ?? null);
  const { suggested, loading: loadingHistory } = usePricingDefaults(potenciaKwp);
  const { data: pricingConfig } = usePricingConfig();

  // Apply initial margin from pricing_config (one-time, when venda still has default 20%)
  useEffect(() => {
    if (loadedDefaults || !pricingConfig) return;
    if (venda.margem_percentual === 20 && pricingConfig.margem_minima_percent) {
      console.debug("[StepFinancialCenter] Margem inicial aplicada:", pricingConfig.margem_minima_percent, "| Origem: pricing_config");
      onVendaChange({ ...venda, margem_percentual: pricingConfig.margem_minima_percent });
    }
    setLoadedDefaults(true);
  }, [pricingConfig]);

  // ── Auto-load commission from consultant linked to the lead ──
  const [comissaoLoaded, setComissaoLoaded] = useState(false);
  const [percentualComissaoConsultor, setPercentualComissaoConsultor] = useState<number>(0);
  const [consultorNome, setConsultorNome] = useState<string>("");
  const [comissaoSource, setComissaoSource] = useState<string>("");

  useEffect(() => {
    if (comissaoLoaded || !leadId) return;
    (async () => {
      try {
        // 1. Buscar consultor_id do lead
        const { data: lead } = await supabase
          .from("leads")
          .select("consultor_id, tenant_id")
          .eq("id", leadId)
          .maybeSingle();
        const consultorId = lead?.consultor_id;
        if (!consultorId) {
          console.debug("[Comissão] Lead sem consultor vinculado");
          setComissaoLoaded(true);
          return;
        }

        // 2. Buscar consultor na tabela consultores (SSOT)
        const { data: consultor } = await supabase
          .from("consultores")
          .select("id, nome, user_id, percentual_comissao")
          .eq("id", consultorId)
          .maybeSingle();

        const nome = (consultor as any)?.nome ?? "";
        const consultorPercent = Number((consultor as any)?.percentual_comissao) || 0;
        setConsultorNome(nome);

        // 3. Prioridade: consultor.percentual_comissao > plano atribuído > pricing_config
        if (consultorPercent > 0) {
          setPercentualComissaoConsultor(consultorPercent);
          setComissaoSource("consultor");
          console.debug("[Comissão] Consultor:", nome, "| Percentual:", consultorPercent + "% | Origem: cadastro do consultor");
        } else {
          // Fallback: buscar plano de comissão atribuído via user_pricing_assignments
          const userId = (consultor as any)?.user_id;
          let planPercent = 0;
          if (userId) {
            const { data: assignment } = await supabase
              .from("user_pricing_assignments" as any)
              .select("commission_plan_id")
              .eq("user_id", userId)
              .maybeSingle();
            const planId = (assignment as any)?.commission_plan_id;
            if (planId) {
              const { data: plan } = await supabase
                .from("commission_plans" as any)
                .select("parameters, is_active, name")
                .eq("id", planId)
                .eq("is_active", true)
                .maybeSingle();
              const params = (plan as any)?.parameters;
              planPercent = typeof params === "object" && params !== null
                ? (Number(params.percentual) || Number(params.rate) || 0)
                : 0;
              if (planPercent > 0) {
                setComissaoSource(`plano: ${(plan as any)?.name || "atribuído"}`);
                console.debug("[Comissão] Consultor:", nome, "| Percentual:", planPercent + "% | Origem: plano", (plan as any)?.name);
              }
            }
          }

          if (planPercent > 0) {
            setPercentualComissaoConsultor(planPercent);
          } else {
            // Último fallback: pricing_config.comissao_padrao_percent (via hook)
            const fallback = Number(pricingConfig?.comissao_padrao_percent) || 0;
            if (fallback > 0) {
              setPercentualComissaoConsultor(fallback);
              setComissaoSource("padrão do tenant");
              console.debug("[Comissão] Consultor:", nome, "| Percentual:", fallback + "% | Origem: pricing_config (fallback)");
            } else {
              console.debug("[Comissão] Consultor:", nome, "| Sem percentual configurado");
            }
          }
        }
      } catch (e) {
        console.warn("[Comissão] Erro ao buscar consultor:", e);
      }
      setComissaoLoaded(true);
    })();
  }, [leadId]); // ← SÓ leadId


  // ── Sync Financial Center costs back to VendaData ──
  // This ensures calcPrecoFinal and StepResumo see the correct values
  useEffect(() => {
    const newInstalacao = instalacaoEnabled ? roundCurrency(instalacaoQtd * instalacaoCusto) : 0;
    const newComissao = comissaoEnabled ? roundCurrency(comissaoQtd * comissaoCusto) : 0;
    const newOutros = roundCurrency(custosExtras.filter(c => c.checked).reduce((s, c) => s + roundCurrency(c.quantidade * c.custoUnitario), 0));

    const changed =
      venda.custo_instalacao !== newInstalacao ||
      venda.custo_comissao !== newComissao ||
      venda.custo_outros !== newOutros;

    if (changed) {
      onVendaChange({
        ...venda,
        custo_instalacao: newInstalacao,
        custo_comissao: newComissao,
        custo_outros: newOutros,
      });
    }
  }, [instalacaoEnabled, instalacaoQtd, instalacaoCusto, comissaoEnabled, comissaoQtd, comissaoCusto, custosExtras]);

  // ── Calculations ──

  const custoKit = roundCurrency(itens.reduce((s, i) => s + roundCurrency(i.quantidade * i.preco_unitario), 0));
  const custoKitEfetivo = kitCustoOverride !== null ? kitCustoOverride : custoKit;
  const kitLabel = potenciaKwp > 0 ? `Kit fotovoltaico ${(Number(potenciaKwp) || 0).toFixed(2)} kWp` : "Kit fotovoltaico";

  // Build all cost rows
  const allRows = useMemo<CustoRow[]>(() => {
    const rows: CustoRow[] = [];

    // Kit row (always first, not deletable)
    rows.push({
      id: "kit",
      categoria: "KIT",
      item: kitLabel,
      quantidade: 1,
      custoUnitario: custoKitEfetivo,
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
  }, [custoKitEfetivo, kitLabel, instalacaoQtd, instalacaoCusto, instalacaoEnabled, comissaoQtd, comissaoCusto, comissaoEnabled, custosExtras]);

  const custoTotal = roundCurrency(allRows.filter(r => r.checked).reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const margemPercent = venda.margem_percentual;
  const margemValor = roundCurrency(custoTotal * (margemPercent / 100));
  const precoVenda = roundCurrency(custoTotal + margemValor);
  const precoWp = potenciaKwp > 0 ? roundCurrency(precoVenda / (potenciaKwp * 1000)) : 0;

  // Base price WITHOUT commission — breaks circular dependency
  const custoSemComissao = roundCurrency(
    allRows.filter(r => r.checked && r.id !== "comissao")
      .reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0)
  );
  const precoVendaSemComissao = roundCurrency(custoSemComissao * (1 + margemPercent / 100));

  // Track if user manually changed commission (breaks auto-recalc)
  const [comissaoManualOverride, setComissaoManualOverride] = useState(false);

  // Auto-recalculate commission whenever base price or percentage changes
  useEffect(() => {
    if (!comissaoEnabled || percentualComissaoConsultor <= 0 || !comissaoLoaded) return;
    if (precoVendaSemComissao <= 0) return;
    if (comissaoManualOverride) return; // User took manual control
    const calculado = roundCurrency(precoVendaSemComissao * percentualComissaoConsultor / 100);
    // Only update if difference is significant (avoid loops)
    if (Math.abs(comissaoCusto - calculado) > 0.01) {
      console.debug("[StepFinancialCenter] Comissão recalculada:", formatBRL(calculado), `(${percentualComissaoConsultor}% de ${formatBRL(precoVendaSemComissao)})`);
      setComissaoCusto(calculado);
    }
  }, [precoVendaSemComissao, percentualComissaoConsultor, comissaoEnabled, comissaoLoaded, comissaoManualOverride]);

  // Compute effective percentage based on current comissaoCusto
  const percentualEfetivo = useMemo(() => {
    if (precoVendaSemComissao <= 0) return 0;
    return Math.round((comissaoCusto / precoVendaSemComissao) * 10000) / 100;
  }, [comissaoCusto, precoVendaSemComissao]);


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
    setEditValue((Number(margemPercent) || 0).toFixed(2));
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
                <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">
                  {formatBRL(precoWp)} / Wp
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditModal}>
                <Pencil className="h-3.5 w-3.5 text-primary" />
              </Button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 border-l border-border/40 pl-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Resumido"
                onClick={() => setViewMode("resumido")}
                className={cn("h-8 w-8", viewMode === "resumido" && "bg-primary/10 text-primary")}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Detalhado"
                onClick={() => setViewMode("detalhado")}
                className={cn("h-8 w-8", viewMode === "detalhado" && "bg-primary/10 text-primary")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        {suggested?.margem_percentual != null && (
          <p className="text-xs text-muted-foreground mt-2 px-1">
            💡 Margem média usada recentemente: {Math.round(suggested.margem_percentual * 10) / 10}%
          </p>
        )}
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
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    {row.categoria}
                    {row.id === "comissao" && percentualComissaoConsultor > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline"
                              className="text-[10px] bg-primary/10 text-primary border-primary/30 cursor-help gap-0.5 px-1.5 py-0">
                              {comissaoManualOverride && Math.abs(percentualEfetivo - percentualComissaoConsultor) > 0.01 ? (
                                <span>{percentualComissaoConsultor}% → {percentualEfetivo.toFixed(1)}%</span>
                              ) : (
                                <span>{percentualComissaoConsultor}%</span>
                              )}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] space-y-1">
                            <p className="text-xs font-medium">
                              {consultorNome ? `Comissão — ${consultorNome}` : "Comissão automática"}
                            </p>
                            {comissaoSource && (
                              <p className="text-xs text-muted-foreground">Origem: {comissaoSource}</p>
                            )}
                            {comissaoManualOverride ? (
                              <>
                                <p className="text-xs text-muted-foreground">
                                  Original: {percentualComissaoConsultor}% de {formatBRL(precoVendaSemComissao)} = {formatBRL(precoVendaSemComissao * percentualComissaoConsultor / 100)}
                                </p>
                                <p className="text-xs font-medium text-primary">
                                  Atual: {percentualEfetivo.toFixed(2)}% → {formatBRL(comissaoCusto)}
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {percentualComissaoConsultor}% de {formatBRL(precoVendaSemComissao)} = {formatBRL(precoVendaSemComissao * percentualComissaoConsultor / 100)}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {comissaoManualOverride ? "Valor alterado manualmente." : "Recalcula automaticamente ao alterar valores."}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {row.id === "comissao" && comissaoEnabled && percentualComissaoConsultor === 0 && comissaoLoaded && (
                      <Badge variant="outline"
                        className="text-[10px] bg-muted text-muted-foreground border-border gap-0.5 px-1.5 py-0">
                        <Pencil className="w-2.5 h-2.5" />
                        Manual
                      </Badge>
                    )}
                  </span>

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
                    {isExtra ? (
                      <Input
                        type="number"
                        min={1}
                        value={row.quantidade}
                        onChange={e => updateExtra(row.id, "quantidade", Math.max(1, Number(e.target.value) || 1))}
                        className="h-7 text-xs w-14 mx-auto text-center"
                      />
                    ) : (
                      <Input
                        type="number"
                        min={1}
                        value={row.quantidade}
                        onChange={e => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          if (row.id === "instalacao") setInstalacaoQtd(val);
                          if (row.id === "comissao") setComissaoQtd(val);
                        }}
                        className="h-7 text-xs w-14 mx-auto text-center"
                        disabled={isKit || !row.checked}
                      />
                    )}
                  </div>

                  {viewMode === "resumido" ? (
                    <>
                      <span className="text-right font-medium">
                        {rowTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {(Number(rowPercent) || 0).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-right" onClick={e => e.stopPropagation()}>
                        <CurrencyInput
                          value={row.custoUnitario}
                          onChange={(val) => {
                            if (isKit) {
                              setKitCustoOverride(val);
                              onVendaChange({ ...venda, custo_kit_override: val > 0 ? val : null });
                            } else if (isExtra) {
                              updateExtra(row.id, "custoUnitario", val);
                            } else if (row.id === "instalacao") {
                              setInstalacaoCusto(val);
                            } else if (row.id === "comissao") {
                              setComissaoCusto(val);
                              setComissaoManualOverride(true);
                            }
                          }}
                          prefix=""
                          className="h-7 text-xs w-24 ml-auto text-right"
                        />
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
                        : item.categoria === "bateria" ? "Bateria"
                        : item.categoria === "estrutura" ? "Estrutura"
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
              <span className="text-muted-foreground">Margem (Markup {(Number(margemPercent) || 0).toFixed(2)}%)</span>
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
      <Button
        variant="outline"
        size="sm"
        onClick={addCusto}
        className="text-xs border-dashed gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar Custo
      </Button>

      {/* ── Edit Modal ── */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-[90vw] max-w-md">
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
                setEditValue((Number(margemPercent) || 0).toFixed(2));
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
                setEditValue((Number(precoVenda) || 0).toFixed(2));
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
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button variant="default" onClick={applyEditModal}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// calcPrecoFinal movido para types.ts (SSOT) — re-export para compatibilidade
export { calcPrecoFinal } from "./types";
