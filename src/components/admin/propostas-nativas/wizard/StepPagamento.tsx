import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CreditCard, Building2, ChevronRight, Calendar, TrendingUp, DollarSign, X, Search, Info, AlertTriangle, Smartphone, FileText, Banknote, Wallet, Check, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type PagamentoOpcao, type BancoFinanciamento, type UCData, type PremissasData, formatBRL, resolveCustoKit } from "./types";
import { formatNumberBR } from "@/lib/formatters";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { calcularPrestacao, calcularEconomiaMensal } from "@/services/paymentComposition/financingMath";
import { FORMA_PAGAMENTO_LABELS, type FormaPagamento } from "@/services/paymentComposition/types";
import { PaymentMethodSelector, type FormaSelected } from "./PaymentMethodSelector";
import { useWizardContext } from "./WizardContext";
import { useBancosCatalog } from "./useWizardDataLoaders";
import { usePrecoFinal } from "@/hooks/usePrecoFinal";
import { usePaymentInterestConfigs } from "@/hooks/usePaymentInterestConfig";

interface BancoOpcao {
  id: string;
  banco_id: string;
  banco_nome: string;
  entrada: number;
  num_parcelas: number;
  taxa_mensal: number;
  carencia_meses: number;
  valor_parcela: number;
  valor_financiado: number;
}

interface BancoGroup {
  banco: BancoFinanciamento;
  opcoes: BancoOpcao[];
}

interface StepPagamentoProps {
  onNext?: () => void;
  onBack?: () => void;
}

const DEFAULT_PARCELAS = [12, 24, 36, 48, 60, 72, 84, 96, 120];

export function StepPagamento({ onNext, onBack }: StepPagamentoProps) {
  const {
    pagamentoOpcoes: opcoes,
    setPagamentoOpcoes: onOpcoesChange,
    itens,
    servicos,
    venda,
    ucs,
    premissas,
    potenciaKwp,
    locIrradiacao: irradiacao
  } = useWizardContext();

  const { bancos, loadingBancos } = useBancosCatalog();
  const { data: formasConfig } = usePaymentInterestConfigs();
  const precoFinal = usePrecoFinal(itens, servicos, venda);

  const [activeTab, setActiveTab] = useState<"pagamento" | "fluxo">("pagamento");
  const [fluxoFinanciamento, setFluxoFinanciamento] = useState("sem_financiamento");
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [bancoGroups, setBancoGroups] = useState<BancoGroup[]>([]);
  const [formasSelecionadas, setFormasSelecionadas] = useState<FormaSelected[]>([]);
  const [valorEntradaGlobal, setValorEntradaGlobal] = useState<number>(0);
  const hydratedRef = useRef(false);

  const calcParcela = useCallback((input: any) => {
    return calcularPrestacao(input.valor_financiado - input.entrada, input.taxa_mensal, input.num_parcelas);
  }, []);

  const buildBancoGroups = useCallback((bankList: BancoFinanciamento[], price: number, selectedIds?: Set<string>): BancoGroup[] =>
    bankList
      .filter(b => !selectedIds || selectedIds.has(b.id))
      .map((b) => ({
        banco: b,
        opcoes: DEFAULT_PARCELAS
          .filter((p) => p <= b.max_parcelas)
          .map((parcelas) => ({
            id: crypto.randomUUID(),
            banco_id: b.id,
            banco_nome: b.nome,
            entrada: valorEntradaGlobal,
            num_parcelas: parcelas,
            taxa_mensal: b.taxa_mensal,
            carencia_meses: 2,
            valor_financiado: price - valorEntradaGlobal,
            valor_parcela: calcParcela({ valor_financiado: price, entrada: valorEntradaGlobal, num_parcelas: parcelas, taxa_mensal: b.taxa_mensal, tipo: "financiamento", carencia_meses: 2 }),
          })),
      })), [valorEntradaGlobal, calcParcela]);

  useEffect(() => {
    if (!loadingBancos && bancos.length > 0 && bancoGroups.length === 0) {
      const groups = buildBancoGroups(bancos, precoFinal);
      setBancoGroups(groups);
      if (groups.length > 0) {
        setSelectedBankIds(new Set([groups[0].banco.id]));
      }
    }
  }, [loadingBancos, bancos, precoFinal, buildBancoGroups, bancoGroups.length]);

  // ── FASE 1: Hidratar formasSelecionadas a partir de pagamentoOpcoes restaurado
  //    OU semear 3 defaults para nova proposta vazia (FASE 2 — Opção A mínima segura).
  //    Roda uma única vez, após configs carregadas. Preserva snapshot existente.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!formasConfig) return;
    const directExisting = (opcoes || []).filter(o => o.tipo === "direto" || !!o.forma_pagamento);
    if (directExisting.length > 0) {
      const restored: FormaSelected[] = directExisting.map(o => {
        const fp = (o.forma_pagamento || "outro") as FormaPagamento;
        const cfg = formasConfig.find(c => c.forma_pagamento === fp);
        return {
          id: o.id || crypto.randomUUID(),
          config_id: cfg?.id || "",
          forma_pagamento: fp,
          nome: o.nome || FORMA_PAGAMENTO_LABELS[fp] || "Pagamento",
          num_parcelas: o.num_parcelas || 1,
          taxa_mensal: o.taxa_mensal || 0,
          juros_responsavel: cfg?.juros_responsavel || "cliente",
          valor_total: o.valor_financiado || precoFinal,
          entrada: o.entrada || 0,
          observacoes: cfg?.observacoes || "",
        };
      });
      setFormasSelecionadas(restored);
      hydratedRef.current = true;
      return;
    }
    if ((opcoes || []).length === 0) {
      const custoKit = resolveCustoKit({
        itens,
        custoKitOverride: venda?.custo_kit_override,
        custoKit: venda?.custo_kit,
      });
      const mk = (fp: FormaPagamento, parcelas: number, entrada: number, observacoes: string): FormaSelected => {
        const cfg = formasConfig.find(c => c.ativo && c.forma_pagamento === fp);
        return {
          id: crypto.randomUUID(),
          config_id: cfg?.id || "",
          forma_pagamento: fp,
          nome: FORMA_PAGAMENTO_LABELS[fp] || fp,
          num_parcelas: parcelas,
          taxa_mensal: cfg?.juros_tipo === "percentual" ? cfg.juros_valor : 0,
          juros_responsavel: cfg?.juros_responsavel || "cliente",
          valor_total: precoFinal,
          entrada,
          observacoes,
        };
      };
      setFormasSelecionadas([
        mk("pix" as FormaPagamento, 1, 0, "À vista"),
        mk("transferencia" as FormaPagamento, 1, custoKit, "Saldo restante no fim da instalação"),
        mk("boleto" as FormaPagamento, 3, custoKit, "Saldo restante em 3 parcelas"),
      ]);
    }
    hydratedRef.current = true;
  }, [formasConfig, opcoes, precoFinal, itens, venda]);

  useEffect(() => {
    // ⚠ Não sobrescrever pagamentoOpcoes antes da hidratação concluir
    if (!hydratedRef.current) return;
    const bancoOpcoes = bancoGroups.flatMap(g => 
      g.opcoes.map(o => ({
        id: o.id,
        nome: `${o.banco_nome} - ${o.num_parcelas}x`,
        tipo: "financiamento" as const,
        valor_financiado: o.valor_financiado,
        entrada: o.entrada,
        taxa_mensal: o.taxa_mensal,
        carencia_meses: o.carencia_meses,
        num_parcelas: o.num_parcelas,
        valor_parcela: o.valor_parcela,
        financiador_id: o.banco_id,
      }))
    );

    const formasOpcoes = formasSelecionadas.map(f => ({
      id: crypto.randomUUID(),
      nome: FORMA_PAGAMENTO_LABELS[f.forma_pagamento] || f.forma_pagamento,
      tipo: "direto" as const,
      valor_financiado: f.valor_total || precoFinal,
      entrada: f.entrada,
      taxa_mensal: f.taxa_mensal,
      carencia_meses: 0,
      num_parcelas: f.num_parcelas,
      valor_parcela: f.num_parcelas > 1 ? calcularPrestacao(f.valor_total || precoFinal, f.taxa_mensal, f.num_parcelas) : (f.valor_total || precoFinal),
      forma_pagamento: f.forma_pagamento,
    }));
    
    onOpcoesChange([...bancoOpcoes, ...formasOpcoes]);
  }, [bancoGroups, precoFinal, formasSelecionadas, onOpcoesChange]);

  const handleNext = useCallback(() => {
    if (formasSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma forma de pagamento.", {
        description: "Adicione ao menos uma opção antes de avançar.",
      });
      return;
    }
    onNext?.();
  }, [formasSelecionadas, onNext]);

  return (
    <div className="space-y-4 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pagamento" className="text-sm">Pagamento</TabsTrigger>
            <TabsTrigger value="fluxo" className="text-sm">Fluxo de caixa</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <PaymentMethodSelector 
        precoFinal={precoFinal} 
        selected={formasSelecionadas} 
        onSelectedChange={setFormasSelecionadas} 
      />

      {(onBack || onNext) && (
        <div className="flex items-center justify-between pt-4 border-t border-border/40 mt-6">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : <div />}
          {onNext && (
            <Button size="sm" onClick={onNext} className="gap-1 text-xs px-6">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
