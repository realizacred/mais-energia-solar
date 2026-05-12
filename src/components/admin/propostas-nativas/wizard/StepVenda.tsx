import { useState, useEffect, useMemo } from "react";
import { DollarSign, Plus, Trash2, Edit2, RotateCcw } from "lucide-react";
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
import { type VendaData, formatBRL, resolveCustoKit } from "./types";
import { roundCurrency } from "@/lib/formatters";
import { usePricingDefaults } from "./hooks/usePricingDefaults";
import { usePricingConfig } from "./hooks/usePricingConfig";
import { useWizardContext } from "./WizardContext";

interface CustoRow {
  id: string;
  categoria: string;
  item: string;
  quantidade: number;
  custoUnitario: number;
  fixo: boolean;
  checked: boolean;
}

interface StepVendaProps {
  onNext?: () => void;
  onBack?: () => void;
}

type ViewMode = "resumido" | "detalhado";

export function StepFinancialCenter({ onNext, onBack }: StepVendaProps) {
  const { 
    venda, 
    handleVendaChange: onVendaChange, 
    itens, 
    servicos, 
    potenciaKwp, 
    selectedLead 
  } = useWizardContext();
  
  const leadId = selectedLead?.id;

  const instalacaoServico = servicos.find(s => s.categoria === "instalacao");
  const comissaoServico = servicos.find(s => s.categoria === "comissao");

  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("detalhado");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState<"margem" | "preco">("margem");
  const [editValue, setEditValue] = useState("0");
  
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
  
  const [instalacaoEnabled, setInstalacaoEnabled] = useState(venda.instalacao_enabled ?? true);
  const [comissaoEnabled, setComissaoEnabled] = useState(venda.comissao_enabled ?? true);
  const [instalacaoQtd, setInstalacaoQtd] = useState(1);
  const [comissaoQtd, setComissaoQtd] = useState(1);
  const [instalacaoCusto, setInstalacaoCusto] = useState(venda.custo_instalacao > 0 ? venda.custo_instalacao : (instalacaoServico?.valor || 0));
  const [comissaoCusto, setComissaoCusto] = useState(venda.custo_comissao > 0 ? venda.custo_comissao : (comissaoServico?.valor || 0));
  const [kitCustoOverride, setKitCustoOverride] = useState<number | null>(venda.custo_kit_override ?? null);
  const [comissaoManualOverride, setComissaoManualOverride] = useState(venda.comissao_manual_override ?? false);
  const { suggested, loading: loadingHistory } = usePricingDefaults(potenciaKwp);
  const { data: pricingConfig } = usePricingConfig();

  const outrosServicos = useMemo(() =>
    servicos.filter(s => s.categoria !== "instalacao" && s.categoria !== "comissao" && s.valor > 0),
    [servicos]
  );
  
  const [servicosEnabledMap, setServicosEnabledMap] = useState<Record<string, boolean>>(venda.servicos_enabled_map ?? {});
  const isServicoEnabled = (id: string) => servicosEnabledMap[id] ?? true;

  useEffect(() => {
    if (loadedDefaults || !pricingConfig) return;
    if (venda.margem_percentual === 20 && pricingConfig.margem_minima_percent) {
      onVendaChange({ ...venda, margem_percentual: pricingConfig.margem_minima_percent });
    }
    setLoadedDefaults(true);
  }, [pricingConfig]);

  useEffect(() => {
    if (loadingHistory) return;
    if (instalacaoCusto > 0) return;
    if (suggested?.custo_instalacao != null && suggested.custo_instalacao > 0) {
      setInstalacaoCusto(suggested.custo_instalacao);
    }
  }, [suggested, loadingHistory, instalacaoCusto]);

  const [comissaoLoaded, setComissaoLoaded] = useState(false);
  const [percentualComissaoConsultor, setPercentualComissaoConsultor] = useState<number>(0);
  const [consultorNome, setConsultorNome] = useState<string>("");

  useEffect(() => {
    if (comissaoLoaded || !leadId) return;
    (async () => {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("consultor_id")
          .eq("id", leadId)
          .maybeSingle();
        const consultorId = lead?.consultor_id;
        if (!consultorId) {
          setComissaoLoaded(true);
          return;
        }

        const { data: consultor } = await supabase
          .from("consultores")
          .select("id, nome, user_id, percentual_comissao")
          .eq("id", consultorId)
          .maybeSingle();

        const nome = (consultor as any)?.nome ?? "";
        const consultorPercent = Number((consultor as any)?.percentual_comissao) || 0;
        setConsultorNome(nome);

        if (consultorPercent > 0) {
          setPercentualComissaoConsultor(consultorPercent);
        } else {
          const userId = (consultor as any)?.user_id;
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
                .select("parameters")
                .eq("id", planId)
                .eq("is_active", true)
                .maybeSingle();
              const params = (plan as any)?.parameters;
              const planPercent = typeof params === "object" && params !== null
                ? (Number(params.percentual) || Number(params.rate) || 0)
                : 0;
              if (planPercent > 0) setPercentualComissaoConsultor(planPercent);
            }
          }
        }
      } catch (e) {
        console.warn("[Comissão] Erro ao buscar consultor:", e);
      }
      setComissaoLoaded(true);
    })();
  }, [leadId, pricingConfig]);

  useEffect(() => {
    const newInstalacao = instalacaoEnabled ? roundCurrency(instalacaoQtd * instalacaoCusto) : 0;
    const newComissao = comissaoEnabled ? roundCurrency(comissaoQtd * comissaoCusto) : 0;
    const servicosOutrosTotal = outrosServicos
      .filter(s => isServicoEnabled(s.id))
      .reduce((s, sv) => s + sv.valor, 0);
    const extrasTotal = custosExtras.filter(c => c.checked).reduce((s, c) => s + roundCurrency(c.quantidade * c.custoUnitario), 0);
    const newOutros = roundCurrency(servicosOutrosTotal + extrasTotal);

    onVendaChange({
      ...venda,
      custo_instalacao: newInstalacao,
      custo_comissao: newComissao,
      custo_outros: newOutros,
      comissao_manual_override: comissaoManualOverride,
      instalacao_enabled: instalacaoEnabled,
      comissao_enabled: comissaoEnabled,
      custos_extras: custosExtras.map(c => ({ id: c.id, item: c.item, quantidade: c.quantidade, custo_unitario: c.custoUnitario, checked: c.checked })),
      servicos_enabled_map: servicosEnabledMap,
      percentual_comissao_consultor: percentualComissaoConsultor,
      consultor_nome_comissao: consultorNome,
    });
  }, [instalacaoEnabled, instalacaoQtd, instalacaoCusto, comissaoEnabled, comissaoQtd, comissaoCusto, custosExtras, outrosServicos, servicosEnabledMap, comissaoManualOverride]);

  const custoKitEfetivo = resolveCustoKit({ itens, custoKitOverride });
  const kitLabel = potenciaKwp > 0 ? `Kit fotovoltaico ${potenciaKwp.toFixed(2)} kWp` : "Kit fotovoltaico";

  const allRows = useMemo<CustoRow[]>(() => {
    const rows: CustoRow[] = [
      { id: "kit", categoria: "KIT", item: kitLabel, quantidade: 1, custoUnitario: custoKitEfetivo, fixo: true, checked: true },
      { id: "instalacao", categoria: "Instalação", item: "Instalação", quantidade: instalacaoQtd, custoUnitario: instalacaoCusto, fixo: true, checked: instalacaoEnabled }
    ];
    outrosServicos.forEach(s => rows.push({ id: `servico-${s.id}`, categoria: "Serviço", item: s.descricao || s.categoria, quantidade: 1, custoUnitario: s.valor, fixo: true, checked: isServicoEnabled(s.id) }));
    rows.push({ id: "comissao", categoria: "Comissão", item: "Comissão", quantidade: comissaoQtd, custoUnitario: comissaoCusto, fixo: true, checked: comissaoEnabled });
    custosExtras.forEach(c => rows.push(c));
    return rows;
  }, [custoKitEfetivo, kitLabel, instalacaoQtd, instalacaoCusto, instalacaoEnabled, comissaoQtd, comissaoCusto, comissaoEnabled, custosExtras, outrosServicos, servicosEnabledMap]);

  const custoTotal = roundCurrency(allRows.filter(r => r.checked).reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const margemPercent = venda.margem_percentual;
  const custoParaMargem = roundCurrency(allRows.filter(r => r.checked && r.id !== "comissao").reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const margemValor = roundCurrency(custoParaMargem * (margemPercent / 100));
  const precoVenda = roundCurrency(custoTotal + margemValor);

  const custoSemComissao = roundCurrency(allRows.filter(r => r.checked && r.id !== "comissao").reduce((s, r) => s + roundCurrency(r.quantidade * r.custoUnitario), 0));
  const precoVendaSemComissao = roundCurrency(custoSemComissao * (1 + margemPercent / 100));

  useEffect(() => {
    if (!comissaoEnabled || percentualComissaoConsultor <= 0 || !comissaoLoaded || precoVendaSemComissao <= 0 || comissaoManualOverride) return;
    const calculado = roundCurrency(precoVendaSemComissao * percentualComissaoConsultor / 100);
    if (Math.abs(comissaoCusto - calculado) > 0.01) setComissaoCusto(calculado);
  }, [precoVendaSemComissao, percentualComissaoConsultor, comissaoEnabled, comissaoLoaded, comissaoManualOverride]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Venda
        </h3>
      </div>
      <div className="p-4 bg-muted/20 rounded-lg border border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Preço Final Sugerido</span>
          <span className="text-lg font-bold text-primary">{formatBRL(precoVenda)}</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Baseado em uma margem de {margemPercent.toFixed(2)}% sobre custos diretos.
        </div>
      </div>
    </div>
  );
}
// Alias if needed
export { StepFinancialCenter as StepVenda };
