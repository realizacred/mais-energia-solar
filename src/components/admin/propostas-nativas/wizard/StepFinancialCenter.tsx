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
import { formatNumberBR } from "@/lib/formatters";
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
  // Restore custos extras from VendaData (persisted) or start empty
  const [custosExtras, setCustosExtras] = useState<CustoRow[]>(() => {
    if (venda.custos_extras && venda.custos_extras.length > 0) {
      return venda.custos_extras.map(e => ({
        id: e.id,
        categoria: "Outros",
        item: e.item,
        quantidade: e.quantidade,
        custoUnitario: e.custo_unitario,
        fixo: false,
        checked: e.checked,
      }));
    }
    return [];
  });
  // Restore toggles from VendaData (persisted across step navigation)
  const [instalacaoEnabled, setInstalacaoEnabled] = useState(venda.instalacao_enabled ?? true);
  const [comissaoEnabled, setComissaoEnabled] = useState(venda.comissao_enabled ?? true);
  const [instalacaoQtd, setInstalacaoQtd] = useState(1);
  const [comissaoQtd, setComissaoQtd] = useState(1);
  // Prefer venda values (persisted across step navigation) over servicos (initial only)
  const [instalacaoCusto, setInstalacaoCusto] = useState(venda.custo_instalacao > 0 ? venda.custo_instalacao : (instalacaoServico?.valor || 0));
  const [comissaoCusto, setComissaoCusto] = useState(venda.custo_comissao > 0 ? venda.custo_comissao : (comissaoServico?.valor || 0));
  const [kitExpanded, setKitExpanded] = useState(false);
  const [kitCustoOverride, setKitCustoOverride] = useState<number | null>(venda.custo_kit_override ?? null);
  // Track if user manually changed commission (breaks auto-recalc) — declared early for sync effect
  const [comissaoManualOverride, setComissaoManualOverride] = useState(venda.comissao_manual_override ?? false);
  const { suggested, loading: loadingHistory } = usePricingDefaults(potenciaKwp);
  const { data: pricingConfig } = usePricingConfig();

  // Other services (not instalacao/comissao) — tracked with local state for toggle
  const outrosServicos = useMemo(() =>
    servicos.filter(s => s.categoria !== "instalacao" && s.categoria !== "comissao" && s.valor > 0),
    [servicos]
  );
  // Restore servicosEnabledMap from VendaData (persisted)
  const [servicosEnabledMap, setServicosEnabledMap] = useState<Record<string, boolean>>(venda.servicos_enabled_map ?? {});
  const isServicoEnabled = (id: string) => servicosEnabledMap[id] ?? true;

  // Apply initial margin from pricing_config (one-time, when venda still has default 20%)
  useEffect(() => {
    if (loadedDefaults || !pricingConfig) return;
    if (venda.margem_percentual === 20 && pricingConfig.margem_minima_percent) {
      onVendaChange({ ...venda, margem_percentual: pricingConfig.margem_minima_percent });
    }
    setLoadedDefaults(true);
  }, [pricingConfig]);

  // Auto-fill instalação from pricing history when still zero
  const [instalacaoDefaultApplied, setInstalacaoDefaultApplied] = useState(false);
  useEffect(() => {
    if (loadingHistory) return;
    // Always try to fill if custo is zero, even in edit mode
    if (instalacaoCusto > 0) {
      setInstalacaoDefaultApplied(true);
      return;
    }
    if (suggested?.custo_instalacao != null && suggested.custo_instalacao > 0) {
      setInstalacaoCusto(suggested.custo_instalacao);
    }
    setInstalacaoDefaultApplied(true);
  }, [suggested, loadingHistory, instalacaoCusto]);

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
            } else {
            }
          }
        }
      } catch (e) {
        console.warn("[Comissão] Erro ao buscar consultor:", e);
      }
      setComissaoLoaded(true);
    })();
  }, [leadId, pricingConfig]); // leadId + pricingConfig para fallback

  // ── Sync Financial Center costs back to VendaData ──
  // This ensures calcPrecoFinal and StepResumo see the correct values
  useEffect(() => {
    const newInstalacao = instalacaoEnabled ? roundCurrency(instalacaoQtd * instalacaoCusto) : 0;
    const newComissao = comissaoEnabled ? roundCurrency(comissaoQtd * comissaoCusto) : 0;
    // Include other services + user-added extras in custo_outros
    const servicosOutrosTotal = outrosServicos
      .filter(s => isServicoEnabled(s.id))
      .reduce((s, sv) => s + sv.valor, 0);
    const extrasTotal = custosExtras.filter(c => c.checked).reduce((s, c) => s + roundCurrency(c.quantidade * c.custoUnitario), 0);
    const newOutros = roundCurrency(servicosOutrosTotal + extrasTotal);

    // Serialize custos extras for persistence
    const custosExtrasSerialized = custosExtras.map(c => ({
      id: c.id,
      item: c.item,
      quantidade: c.quantidade,
      custo_unitario: c.custoUnitario,
      checked: c.checked,
    }));

    const changed =
      venda.custo_instalacao !== newInstalacao ||
      venda.custo_comissao !== newComissao ||
      venda.custo_outros !== newOutros ||
      venda.comissao_manual_override !== comissaoManualOverride ||
      venda.instalacao_enabled !== instalacaoEnabled ||
      venda.comissao_enabled !== comissaoEnabled ||
      JSON.stringify(venda.custos_extras) !== JSON.stringify(custosExtrasSerialized) ||
      JSON.stringify(venda.servicos_enabled_map) !== JSON.stringify(servicosEnabledMap);

    if (changed) {
      onVendaChange({
        ...venda,
        custo_instalacao: newInstalacao,
        custo_comissao: newComissao,
        custo_outros: newOutros,
        comissao_manual_override: comissaoManualOverride,
        instalacao_enabled: instalacaoEnabled,
        comissao_enabled: comissaoEnabled,
        custos_extras: custosExtrasSerialized,
        servicos_enabled_map: servicosEnabledMap,
        percentual_comissao_consultor: percentualComissaoConsultor,
        consultor_nome_comissao: consultorNome,
      });
    }
  }, [instalacaoEnabled, instalacaoQtd, instalacaoCusto, comissaoEnabled, comissaoQtd, comissaoCusto, custosExtras, outrosServicos, servicosEnabledMap, comissaoManualOverride]);

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

    // Other services from StepServicos (projeto, frete, etc.)
    outrosServicos.forEach(s => {
      rows.push({
        id: `servico-${s.id}`,
        categoria: "Serviço",
        item: s.descricao || s.categoria,
        quantidade: 1,
        custoUnitario: s.valor,
        fixo: true,
        checked: isServicoEnabled(s.id),
      });
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
  }, [custoKitEfetivo, kitLabel, instalacaoQtd, instalacaoCusto, instalacaoEnabled, comissaoQtd, comissaoCusto, comissaoEnabled, custosExtras, outrosServicos, servicosEnabledMap]);

  const custoTotal = roundCurrency(allRows.filter(r => r.checked).reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const margemPercent = venda.margem_percentual;
  // Margem aplicada apenas sobre custos SEM comissão (comissão não recebe markup)
  const custoParaMargem = roundCurrency(
    allRows.filter(r => r.checked && r.id !== "comissao")
      .reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0)
  );
  const margemValor = roundCurrency(custoParaMargem * (margemPercent / 100));
  const precoVenda = roundCurrency(custoTotal + margemValor);
  const precoWp = potenciaKwp > 0 ? roundCurrency(precoVenda / (potenciaKwp * 1000)) : 0;

  // Base price WITHOUT commission — breaks circular dependency
  const custoSemComissao = roundCurrency(
    allRows.filter(r => r.checked && r.id !== "comissao")
      .reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0)
  );
  const precoVendaSemComissao = roundCurrency(custoSemComissao * (1 + margemPercent / 100));

  // Auto-recalculate commission whenever base price or percentage changes
  useEffect(() => {
    if (!comissaoEnabled || percentualComissaoConsultor <= 0 || !comissaoLoaded) return;
    if (precoVendaSemComissao <= 0) return;
    if (comissaoManualOverride) return; // User took manual control
    const calculado = roundCurrency(precoVendaSemComissao * percentualComissaoConsultor / 100);
    // Only update if difference is significant (avoid loops)
    if (Math.abs(comissaoCusto - calculado) > 0.01) {
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

  // Per-row margem distribution (comissão não recebe margem)
  const getRowMargem = (row: CustoRow) => {
    if (!row.checked || custoParaMargem === 0 || row.id === "comissao") return 0;
    const rowTotal = row.quantidade * row.custoUnitario;
    return (rowTotal / custoParaMargem) * margemValor;
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
      <div className="rounded-xl border border-border/50 overflow-x-auto">
        {/* Table Header */}
        <div className={cn(
          "grid items-center px-4 py-2.5 bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/20 min-w-[700px]",
          viewMode === "resumido"
            ? "grid-cols-[auto_100px_1fr_60px_100px_80px]"
            : "grid-cols-[auto_100px_1fr_60px_100px_100px_90px_100px]"
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
                    "grid items-center px-4 py-2.5 text-xs transition-opacity min-w-[700px]",
                    !row.checked && "opacity-40",
                    isKit && "cursor-pointer hover:bg-muted/20",
                    viewMode === "resumido"
                      ? "grid-cols-[auto_100px_1fr_60px_100px_80px]"
                      : "grid-cols-[auto_100px_1fr_60px_100px_100px_90px_100px]"
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
                          else if (row.id === "comissao") setComissaoEnabled(!!checked);
                          else if (row.id.startsWith("servico-")) {
                            const svcId = row.id.replace("servico-", "");
                            setServicosEnabledMap(prev => ({ ...prev, [svcId]: !!checked }));
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                        className="h-4 w-4"
                      />
                    )}
                  </div>

                  {/* Categoria */}
                  <span className="text-muted-foreground font-medium">
                    {row.categoria}
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
                      <span className="flex items-center gap-1.5 whitespace-nowrap min-w-0">
                        {row.item}
                        {row.id === "comissao" && consultorNome && (
                          <span className="text-muted-foreground text-[10px] truncate max-w-[120px]" title={consultorNome}>
                            ({consultorNome})
                          </span>
                        )}
                        {/* Commission badge — after text */}
                        {row.id === "comissao" && percentualComissaoConsultor > 0 && (() => {
                          const isOverride = comissaoManualOverride && Math.abs(percentualEfetivo - percentualComissaoConsultor) > 0.01;
                          const isLower = percentualEfetivo < percentualComissaoConsultor - 0.01;
                          const isHigher = percentualEfetivo > percentualComissaoConsultor + 0.01;
                          const badgeBg = isOverride
                            ? (isLower ? "bg-destructive/10 text-destructive border-destructive/30" : isHigher ? "bg-success/10 text-success border-success/30" : "bg-warning/10 text-warning border-warning/30")
                            : "bg-warning/10 text-warning border-warning/30";
                          return (
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline"
                                    className={cn("text-[10px] cursor-help gap-0.5 px-1.5 py-0 shrink-0", badgeBg)}>
                                    {isOverride ? (
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
                                      <p className={cn("text-xs font-medium", isLower ? "text-destructive" : isHigher ? "text-success" : "text-warning")}>
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
                          );
                        })()}
                        {isKit && itens.length > 0 && (
                          kitExpanded
                            ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                        {row.id === "comissao" && comissaoEnabled && percentualComissaoConsultor === 0 && comissaoLoaded && (
                          <Badge variant="outline"
                            className="text-[10px] bg-muted text-muted-foreground border-border gap-0.5 px-1.5 py-0 shrink-0">
                            <Pencil className="w-2.5 h-2.5" />
                            Manual
                          </Badge>
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
                        {formatNumberBR(rowTotal)}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {(Number(rowPercent) || 0).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-right relative flex items-center justify-end" onClick={e => e.stopPropagation()}>
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
                        {/* Reset button — only when commission is manually overridden */}
                        {row.id === "comissao" && comissaoManualOverride && comissaoEnabled && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 absolute -right-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setComissaoManualOverride(false);
                                    if (percentualComissaoConsultor > 0) {
                                      const calculado = roundCurrency(
                                        precoVendaSemComissao * percentualComissaoConsultor / 100
                                      );
                                      setComissaoCusto(calculado);
                                    }
                                  }}
                                >
                                  <RotateCcw className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[280px]">
                                <p className="text-xs font-medium">Restaurar cálculo automático</p>
                                {percentualComissaoConsultor > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Voltará para {formatBRL(roundCurrency(precoVendaSemComissao * percentualComissaoConsultor / 100))} ({percentualComissaoConsultor}%)
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <span className="text-right font-medium">
                        {formatNumberBR(rowTotal)}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {formatNumberBR(rowMargem)}
                      </span>
                      <span className="text-right font-medium">
                        {formatNumberBR(rowVenda)}
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
                            "grid items-center px-4 pl-10 py-2 text-xs text-muted-foreground min-w-[700px]",
                            viewMode === "resumido"
                              ? "grid-cols-[auto_100px_1fr_60px_100px_80px]"
                              : "grid-cols-[auto_100px_1fr_60px_100px_100px_90px_100px]"
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
                {formatNumberBR(margemValor)}
              </span>
              <span className="text-right text-muted-foreground">0,00%</span>
            </div>
          )}

          {/* Total row */}
          <div className={cn(
            "grid items-center px-4 py-3 text-xs font-bold bg-muted/5 min-w-[700px]",
            viewMode === "resumido"
              ? "grid-cols-[auto_100px_1fr_60px_100px_80px]"
              : "grid-cols-[auto_100px_1fr_60px_100px_100px_90px_100px]"
          )}>
            <span className="w-6" />
            <span />
            <span />
            <span />
            {viewMode === "resumido" ? (
              <>
                <span className="text-right text-sm">
                  {formatNumberBR(precoVenda)}
                </span>
                <span className="text-right text-sm">100%</span>
              </>
            ) : (
              <>
                <span />
                <span className="text-right text-sm">
                  {formatNumberBR(custoTotal)}
                </span>
                <span className="text-right text-sm">
                  {formatNumberBR(margemValor)}
                </span>
                <span className="text-right text-sm">
                  {formatNumberBR(precoVenda)}
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
