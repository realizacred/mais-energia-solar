import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, CreditCard, Building2, ChevronRight, Calendar, TrendingUp, DollarSign, X, Search, Info, AlertTriangle, Smartphone, FileText, Banknote, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { type PagamentoOpcao, type BancoFinanciamento, type UCData, type PremissasData, formatBRL } from "./types";
import { formatNumberBR } from "@/lib/formatters";
import { calcularPrestacao } from "@/services/paymentComposition/financingMath";
import { VARIABLES_CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, type VariableCategory } from "@/lib/variablesCatalog";
import { usePaymentInterestConfigs, type PaymentInterestConfig } from "@/hooks/usePaymentInterestConfig";
import { FORMA_PAGAMENTO_LABELS, type FormaPagamento } from "@/services/paymentComposition/types";

const FORMA_ICONS: Record<string, React.ReactNode> = {
  pix: <Smartphone className="h-4 w-4 text-primary" />,
  dinheiro: <Banknote className="h-4 w-4 text-primary" />,
  transferencia: <Wallet className="h-4 w-4 text-primary" />,
  boleto: <FileText className="h-4 w-4 text-primary" />,
  cartao_credito: <CreditCard className="h-4 w-4 text-primary" />,
  cartao_debito: <CreditCard className="h-4 w-4 text-primary" />,
  cheque: <FileText className="h-4 w-4 text-primary" />,
  financiamento: <Building2 className="h-4 w-4 text-primary" />,
  crediario: <Wallet className="h-4 w-4 text-primary" />,
  outro: <DollarSign className="h-4 w-4 text-primary" />,
};

// ─── Types ────────────────────────────────────────────────

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
  opcoes: PagamentoOpcao[];
  onOpcoesChange: (opcoes: PagamentoOpcao[]) => void;
  bancos: BancoFinanciamento[];
  loadingBancos: boolean;
  precoFinal: number;
  // Data for cash flow
  ucs?: UCData[];
  premissas?: PremissasData;
  potenciaKwp?: number;
  irradiacao?: number;
  geracaoMensalKwh?: number;
}

const DEFAULT_PARCELAS = [12, 24, 36, 48];

export function StepPagamento({
  opcoes, onOpcoesChange, bancos, loadingBancos, precoFinal,
  ucs = [], premissas, potenciaKwp = 0, irradiacao = 0, geracaoMensalKwh = 0,
}: StepPagamentoProps) {
  const [activeTab, setActiveTab] = useState<"pagamento" | "fluxo">("pagamento");
  const [showGastosModal, setShowGastosModal] = useState(false);
  const [showFluxoModal, setShowFluxoModal] = useState(false);
  const [showVariaveisModal, setShowVariaveisModal] = useState(false);
  const [fluxoFinanciamento, setFluxoFinanciamento] = useState("sem_financiamento");

  // ─── Bank groups with auto-generated options
  const buildBancoGroups = (bankList: BancoFinanciamento[], price: number): BancoGroup[] =>
    bankList.map((b) => ({
      banco: b,
      opcoes: DEFAULT_PARCELAS
        .filter((p) => p <= b.max_parcelas)
        .map((parcelas) => ({
          id: crypto.randomUUID(),
          banco_id: b.id,
          banco_nome: b.nome,
          entrada: 0,
          num_parcelas: parcelas,
          taxa_mensal: b.taxa_mensal,
          carencia_meses: 2,
          valor_financiado: price,
          valor_parcela: calcParcela({ valor_financiado: price, entrada: 0, num_parcelas: parcelas, taxa_mensal: b.taxa_mensal, tipo: "financiamento", carencia_meses: 2 }),
        })),
    }));

  const mapOpcoesToBancoGroups = (existingOpcoes: PagamentoOpcao[], bankList: BancoFinanciamento[], fallbackPrice: number): BancoGroup[] => {
    const financiamento = existingOpcoes.filter((o) => o.tipo === "financiamento" || o.tipo === "parcelado");
    if (financiamento.length === 0) return buildBancoGroups(bankList, fallbackPrice);

    const byBanco = new Map<string, BancoOpcao[]>();
    financiamento.forEach((op) => {
      const key = op.nome || "Financiamento";
      const list = byBanco.get(key) || [];
      list.push({
        id: op.id,
        banco_id: op.id,
        banco_nome: key,
        entrada: op.entrada,
        num_parcelas: op.num_parcelas,
        taxa_mensal: op.taxa_mensal,
        carencia_meses: op.carencia_meses,
        valor_financiado: op.valor_financiado,
        valor_parcela: op.valor_parcela,
      });
      byBanco.set(key, list);
    });

    return Array.from(byBanco.entries()).map(([nome, opcoesBanco]) => {
      const fromCatalog = bankList.find((b) => b.nome === nome);
      return {
        banco: fromCatalog || {
          id: opcoesBanco[0]?.banco_id || crypto.randomUUID(),
          nome,
          taxa_mensal: opcoesBanco[0]?.taxa_mensal || 0,
          max_parcelas: Math.max(...opcoesBanco.map((o) => o.num_parcelas), 60),
        },
        opcoes: opcoesBanco,
      };
    });
  };

  const flattenBancoGroupsToOpcoes = (groups: BancoGroup[], price: number): PagamentoOpcao[] => {
    const financiamento = groups.flatMap((g) =>
      g.opcoes.map((op) => ({
        id: op.id,
        nome: g.banco.nome,
        tipo: "financiamento" as const,
        valor_financiado: Number.isFinite(op.valor_financiado) ? op.valor_financiado : price,
        entrada: Number.isFinite(op.entrada) ? op.entrada : 0,
        taxa_mensal: Number.isFinite(op.taxa_mensal) ? op.taxa_mensal : 0,
        carencia_meses: Number.isFinite(op.carencia_meses) ? op.carencia_meses : 0,
        num_parcelas: Number.isFinite(op.num_parcelas) ? op.num_parcelas : 0,
        valor_parcela: Number.isFinite(op.valor_parcela) ? op.valor_parcela : 0,
      }))
    );

    return [
      {
        id: "a-vista-default",
        nome: "À Vista",
        tipo: "a_vista",
        valor_financiado: price,
        entrada: price,
        taxa_mensal: 0,
        carencia_meses: 0,
        num_parcelas: 1,
        valor_parcela: price,
      },
      ...financiamento,
    ];
  };

  const [hasUserEditedBancoGroups, setHasUserEditedBancoGroups] = useState(false);
  const [bancoGroups, setBancoGroups] = useState<BancoGroup[]>(() =>
    opcoes.length > 0 ? mapOpcoesToBancoGroups(opcoes, bancos, precoFinal) : buildBancoGroups(bancos, precoFinal)
  );
  const [selectedBancoIdx, setSelectedBancoIdx] = useState(0);
  const [showNovoFinanciamento, setShowNovoFinanciamento] = useState(false);
  // Novo financiamento form state
  const [novoNome, setNovoNome] = useState("");
  const [novoTaxa, setNovoTaxa] = useState("");
  const [novoMaxParcelas, setNovoMaxParcelas] = useState("60");
  const [novoEntradaPercent, setNovoEntradaPercent] = useState(true);
  const [novoEntrada, setNovoEntrada] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [novoCarencia, setNovoCarencia] = useState("0");

  // Sync precoFinal into existing banco groups — update valor_financiado + recalc parcela
  useEffect(() => {
    if (precoFinal <= 0) return;
    setBancoGroups(prev => {
      // If no groups yet, build from scratch
      if (prev.length === 0 && bancos.length > 0) {
        return buildBancoGroups(bancos, precoFinal);
      }
      // Update valor_financiado and recalculate valor_parcela in all existing options
      return prev.map(g => ({
        ...g,
        opcoes: g.opcoes.map(op => {
          const newFinanciado = precoFinal - (op.entrada || 0);
          const vf = Math.max(0, newFinanciado);
          return {
            ...op,
            valor_financiado: precoFinal,
            valor_parcela: calcParcela({
              valor_financiado: vf,
              entrada: op.entrada || 0,
              num_parcelas: op.num_parcelas,
              taxa_mensal: op.taxa_mensal,
              tipo: "financiamento",
              carencia_meses: op.carencia_meses || 0,
            }),
          };
        }),
      }));
    });
  }, [precoFinal, bancos]);

  useEffect(() => {
    onOpcoesChange(flattenBancoGroupsToOpcoes(bancoGroups, precoFinal));
  }, [bancoGroups, precoFinal, onOpcoesChange]);

  // ─── Derived metrics (aligned with calc-engine.ts)
  const prem = premissas || { inflacao_energetica: 9.5, perda_eficiencia_anual: 0.5, vpl_taxa_desconto: 10, imposto: 0, inflacao_ipca: 4.5, sobredimensionamento: 0, troca_inversor_anos: 15, troca_inversor_custo: 30 };
  const geracaoMensalCalculada = potenciaKwp * (irradiacao || 4.5) * 30 * 0.80;
  const geracaoMensalBase = geracaoMensalKwh > 0 ? geracaoMensalKwh : geracaoMensalCalculada;
  const geracaoAnualBase = geracaoMensalBase * 12;
  const ucGeradora = ucs.find(u => u.is_geradora) || ucs[0];
  const tarifaBase = ucGeradora?.tarifa_distribuidora || 1.10;
  const custoDisp = ucGeradora?.custo_disponibilidade_valor || 54.81;

  // Economy calc
  const economiaAtual = ucGeradora ? (ucGeradora.consumo_mensal * tarifaBase) : (geracaoAnualBase / 12 * tarifaBase);
  const economiaNova = custoDisp;
  const economiaMensal = Math.max(0, economiaAtual - economiaNova);
  const economiaPercent = economiaAtual > 0 ? (economiaMensal / economiaAtual * 100) : 75;

  // ─── Cash flow table (25 years) — aligned with calc-engine.ts calcSeries25
  const fluxoCaixaData = useMemo(() => {
    const rows: { ano: number; geracao: number; tarifa: number; economiaBruta: number; custoFioB: number; economiaLiquida: number; custoExtra: number; economia: number; investimento: number; fluxoCaixa: number }[] = [];
    let fluxoAcumulado = 0;
    const degradacaoRate = (prem.perda_eficiencia_anual || 0.5) / 100;
    const inflacaoRate = (prem.inflacao_energetica || 9.5) / 100;
    const geracaoBase = geracaoAnualBase || 4761;
    const trocaInversorAnos = prem.troca_inversor_anos || 15;
    const trocaInversorCustoPct = (prem.troca_inversor_custo || 30) / 100;

    // Find financing option for selected
    let investAno0 = precoFinal;
    let parcelasMensais = 0;
    let parcelasCount = 0;
    if (fluxoFinanciamento !== "sem_financiamento") {
      const parts = fluxoFinanciamento.split("|");
      if (parts.length >= 2) {
        const bIdx = parseInt(parts[0]);
        const oIdx = parseInt(parts[1]);
        const group = bancoGroups[bIdx];
        if (group && group.opcoes[oIdx]) {
          const op = group.opcoes[oIdx];
          investAno0 = op.entrada;
          parcelasMensais = op.valor_parcela;
          parcelasCount = op.num_parcelas;
        }
      }
    }

    // Year 0: investment only
    fluxoAcumulado = -investAno0;
    rows.push({ ano: 0, geracao: 0, tarifa: tarifaBase, economiaBruta: 0, custoFioB: 0, economiaLiquida: 0, custoExtra: 0, economia: 0, investimento: -investAno0, fluxoCaixa: fluxoAcumulado });

    for (let ano = 1; ano <= 25; ano++) {
      // Degradação e inflação conforme calc-engine.ts
      const degradacao = Math.pow(1 - degradacaoRate, ano - 1);
      const inflacao = Math.pow(1 + inflacaoRate, ano - 1);
      const tarifaVigente = Math.round(tarifaBase * inflacao * 100) / 100;
      const geracaoAnual = Math.round(geracaoBase * degradacao * 100) / 100;
      const economiaBruta = Math.round(geracaoAnual * tarifaVigente * 100) / 100;

      // Fio B: use simplified 15% for frontend preview (backend uses full Lei 14.300 escalation)
      const fioBPct = 0.15;
      const custoFioB = Math.round(geracaoAnual * tarifaVigente * 0.28 * fioBPct * 100) / 100;
      const economiaLiquida = Math.round((economiaBruta - custoFioB) * 100) / 100;

      // Troca de inversor
      let custoExtra = 0;
      if (trocaInversorAnos > 0 && ano === trocaInversorAnos) {
        custoExtra = Math.round(precoFinal * trocaInversorCustoPct * 100) / 100;
      }

      // Parcelas de financiamento (distribuídas ao longo dos anos)
      let custoFinanciamento = 0;
      if (parcelasMensais > 0 && parcelasCount > 0) {
        const mesesRestantes = parcelasCount - (ano - 1) * 12;
        if (mesesRestantes > 0) {
          custoFinanciamento = parcelasMensais * Math.min(12, mesesRestantes);
        }
      }

      const fluxo = economiaLiquida - custoExtra - custoFinanciamento;
      fluxoAcumulado += fluxo;

      rows.push({
        ano,
        geracao: geracaoAnual,
        tarifa: tarifaVigente,
        economiaBruta,
        custoFioB,
        economiaLiquida,
        custoExtra,
        economia: economiaLiquida,
        investimento: -(custoExtra + custoFinanciamento),
        fluxoCaixa: Math.round(fluxoAcumulado * 100) / 100,
      });
    }
    return rows;
  }, [precoFinal, fluxoFinanciamento, bancoGroups, geracaoAnualBase, tarifaBase, prem]);

  // Payback calculation — aligned with calc-engine.ts bisection TIR
  const paybackInfo = useMemo(() => {
    const row = fluxoCaixaData.find(r => r.ano > 0 && r.fluxoCaixa >= 0);
    const paybackAnos = row ? row.ano : 25;
    // Interpolate months
    let paybackMeses = 0;
    if (row && row.ano > 0) {
      const prev = fluxoCaixaData.find(r => r.ano === row.ano - 1);
      if (prev && prev.fluxoCaixa < 0) {
        const frac = Math.abs(prev.fluxoCaixa) / (row.fluxoCaixa - prev.fluxoCaixa);
        paybackMeses = Math.round(frac * 12);
      }
    }

    // TIR via bisection — same as calc-engine.ts
    const fluxos = fluxoCaixaData.filter(r => r.ano > 0).map(r => r.economia + r.investimento);
    let lo = -0.5, hi = 5.0;
    for (let iter = 0; iter < 100; iter++) {
      const mid = (lo + hi) / 2;
      let npv = -precoFinal;
      for (let i = 0; i < fluxos.length; i++) {
        npv += fluxos[i] / Math.pow(1 + mid, i + 1);
      }
      if (Math.abs(npv) < 0.01) { lo = mid; hi = mid; break; }
      if (npv > 0) lo = mid; else hi = mid;
    }
    const tir = ((lo + hi) / 2) * 100;

    // VPL — same as calc-engine.ts
    const taxa = (prem.vpl_taxa_desconto || 10) / 100;
    let vpl = -precoFinal;
    for (let i = 0; i < fluxos.length; i++) {
      vpl += fluxos[i] / Math.pow(1 + taxa, i + 1);
    }

    return {
      anos: paybackAnos,
      meses: paybackMeses,
      label: `${paybackAnos} ano${paybackAnos !== 1 ? "s" : ""} e ${paybackMeses} mes${paybackMeses !== 1 ? "es" : ""}`,
      tir: Math.max(0, tir),
      vpl: Math.round(vpl * 100) / 100,
    };
  }, [fluxoCaixaData, prem, precoFinal]);

  // ─── Add option to a bank group
  const addOpcaoToBanco = (bancoIdx: number) => {
    const updated = [...bancoGroups];
    const group = updated[bancoIdx];
    if (!group) return;
    const parcelas = 60;
    const vf = precoFinal;
    group.opcoes.push({
      id: crypto.randomUUID(),
      banco_id: group.banco.id,
      banco_nome: group.banco.nome,
      entrada: 0,
      num_parcelas: parcelas,
      taxa_mensal: group.banco.taxa_mensal,
      carencia_meses: 2,
      valor_financiado: vf,
      valor_parcela: calcParcela({ valor_financiado: vf, entrada: 0, num_parcelas: parcelas, taxa_mensal: group.banco.taxa_mensal, tipo: "financiamento", carencia_meses: 2 }),
    });
    setBancoGroups(updated);
  };

  const removeOpcao = (bancoIdx: number, opcaoIdx: number) => {
    const updated = [...bancoGroups];
    updated[bancoIdx].opcoes.splice(opcaoIdx, 1);
    setBancoGroups(updated);
  };

  // ─── Financing select options for cash flow
  const financiamentoOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: "sem_financiamento", label: "Sem financiamento" },
    ];
    bancoGroups.forEach((g, bi) => {
      g.opcoes.forEach((op, oi) => {
        opts.push({
          value: `${bi}|${oi}`,
          label: `${g.banco.nome} Opção ${oi + 1}: Entrada de ${formatBRL(op.entrada)}, ${op.num_parcelas}x`,
        });
      });
    });
    return opts;
  }, [bancoGroups]);

  // ─── Gastos detail table
  const gastosData = useMemo(() => {
    const atual = economiaAtual;
    const novo = economiaNova;
    return {
      linhas: [
        { label: "Energia Baixa Tensão", atual, novo, children: [
          { label: "Custo de Disponibilidade", atual: null, novo: custoDisp, strike: false, indent: true },
          { label: "Consumo Faturado", atual: null, novo: 0, strike: true, indent: true },
        ]},
        { label: "Tarifação Energia Compensada BT", atual: 0, novo: 0 },
        { label: "Tarifação Energia Compensada", atual: null, novo: ucGeradora?.imposto_energia || 21.61, strike: true, indent: true },
        { label: "Energia Média Tensão - Ponta", atual: 0, novo: 0 },
        { label: "Energia Média Tensão - Fora Ponta", atual: 0, novo: 0 },
        { label: "Demanda Contratada", atual: 0, novo: 0 },
        { label: "Tarifação Energia Compensada FP", atual: 0, novo: 0 },
        { label: "Tarifação Energia Compensada P", atual: 0, novo: 0 },
        { label: "Imposto Energia Compensada", atual: 0, novo: 0 },
        { label: "Outros Encargos", atual: ucGeradora?.outros_encargos_atual || 0, novo: ucGeradora?.outros_encargos_novo || 0 },
      ],
      totalAtual: atual,
      totalNovo: novo,
      economia: economiaMensal,
    };
  }, [economiaAtual, economiaNova, economiaMensal, custoDisp, ucGeradora]);

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-0 w-full">
      {/* Header Tabs + Metrics — responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pagamento" className="text-sm">Pagamento</TabsTrigger>
            <TabsTrigger value="fluxo" className="text-sm">Fluxo de caixa</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3 sm:gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">Economia:</span>
            <span className="font-bold text-success">{formatBRL(economiaMensal)}</span>
            <Badge className="text-[10px] h-5 px-1.5 bg-success/10 text-success border border-success/30">{(Number(economiaPercent) || 0).toFixed(2)}%</Badge>
            <Button variant="link" size="sm" onClick={() => setShowGastosModal(true)} className="text-primary text-xs p-0 h-auto hover:opacity-80">Ver mais</Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Retorno:</span>
            <span className="font-bold">{paybackInfo.label}</span>
            <Button variant="link" size="sm" onClick={() => setShowFluxoModal(true)} className="text-primary text-xs p-0 h-auto hover:opacity-80">Ver mais</Button>
          </div>
        </div>
      </div>

      {/* ─── Tab: Pagamento ─────────────────────────────── */}
      {activeTab === "pagamento" && (
        <div className="space-y-4">
          {/* ── Info Banner + Admin Payment Methods Preview ── */}
          <FormasPagamentoPreview precoFinal={precoFinal} />

          {/* ── Separator ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">Financiamento Bancário</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          {/* Sidebar - Banks */}
          <div className="space-y-1">
            {bancoGroups.map((g, idx) => (
              <Button
                key={g.banco.id}
                variant="ghost"
                onClick={() => setSelectedBancoIdx(idx)}
                className={cn(
                  "w-full justify-between px-3 py-2.5 h-auto text-sm transition-colors",
                  selectedBancoIdx === idx
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                )}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  {g.banco.nome}
                </span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">{g.opcoes.length}</Badge>
              </Button>
            ))}
            <Button variant="outline" size="sm" className="w-full text-sm gap-1 mt-2 h-9 border-dashed border-primary text-primary hover:bg-primary/10" onClick={() => setShowNovoFinanciamento(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo financiamento
            </Button>
          </div>

          {/* Main - Options for selected bank */}
          <div className="space-y-3 min-w-0">
            {bancoGroups[selectedBancoIdx]?.opcoes.map((op, idx) => (
              <div key={op.id} className="p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="text-xs bg-primary/10 text-primary border border-primary/30 rounded-full px-3 py-0.5 font-semibold">Opção {idx + 1}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeOpcao(selectedBancoIdx, idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Financiamento</Label>
                    <p className="font-semibold mt-0.5">{formatBRL(op.valor_financiado)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Entrada</Label>
                    <p className="font-semibold mt-0.5">{formatBRL(op.entrada)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Parcelas</Label>
                    <p className="font-semibold mt-0.5">{op.num_parcelas}x</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Taxa</Label>
                    <p className="font-semibold mt-0.5">{(Number(op.taxa_mensal) || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Carência</Label>
                    <p className="font-semibold mt-0.5">{op.carencia_meses} meses</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor parcela</Label>
                    <p className="font-bold text-primary mt-0.5">{formatBRL(op.valor_parcela)}</p>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" className="text-sm gap-1 h-9 border-dashed border-primary text-primary hover:bg-primary/10" onClick={() => addOpcaoToBanco(selectedBancoIdx)}>
              <Plus className="h-3.5 w-3.5" /> Adicionar opção
            </Button>
          </div>
        </div>
        </div>
      )}

      {/* ─── Tab: Fluxo de caixa ──────────────────────────── */}
      {activeTab === "fluxo" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Select value={fluxoFinanciamento} onValueChange={setFluxoFinanciamento}>
              <SelectTrigger className="w-80 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {financiamentoOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-tab for UCs */}
          <div className="border-b border-border/30 pb-0">
            <Button variant="ghost" className="text-xs font-medium border-b-2 border-primary pb-2 px-3 text-foreground h-auto rounded-none">
              1. Unidade
            </Button>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 z-10">
                <tr className="text-[10px] uppercase text-muted-foreground tracking-wider">
                  <th className="text-left py-2 px-3 font-medium">Ano</th>
                  <th className="text-right py-2 px-3 font-medium">Geração (kWh)</th>
                  <th className="text-right py-2 px-3 font-medium">Tarifa (R$)</th>
                  <th className="text-right py-2 px-3 font-medium">Economia (R$)</th>
                  <th className="text-right py-2 px-3 font-medium">Investimento (R$)</th>
                  <th className="text-right py-2 px-3 font-medium">Fluxo de Caixa (R$)</th>
                </tr>
              </thead>
              <tbody>
                {fluxoCaixaData.map(row => (
                  <tr key={row.ano} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="py-2 px-3 font-semibold text-foreground">{row.ano}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumberBR(row.geracao)}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{formatNumberBR(row.tarifa)}</td>
                    <td className="py-2 px-3 text-right text-foreground">{formatNumberBR(row.economia)}</td>
                    <td className={cn("py-2 px-3 text-right font-medium", row.investimento < 0 ? "text-warning" : "text-muted-foreground")}>
                      {row.investimento < 0 ? `-${formatNumberBR(Math.abs(row.investimento))}` : formatNumberBR(row.investimento)}
                    </td>
                    <td className={cn("py-2 px-3 text-right font-semibold", row.fluxoCaixa < 0 ? "text-destructive" : "text-success")}>
                      {row.fluxoCaixa < 0 ? `-${formatNumberBR(Math.abs(row.fluxoCaixa))}` : formatNumberBR(row.fluxoCaixa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}

      {/* Footer */}
      <div className="pt-3 border-t border-border/30 mt-4">
        <Button variant="link" onClick={() => setShowVariaveisModal(true)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors h-auto p-0">
          <Info className="h-3.5 w-3.5" /> Consultar variáveis da proposta
        </Button>
      </div>

      {/* ═══ Modal: Detalhes dos Gastos ═══ */}
      <GastosModal open={showGastosModal} onClose={() => setShowGastosModal(false)} gastosData={gastosData} />

      {/* ═══ Modal: Detalhes do Fluxo de Caixa ═══ */}
      <FluxoCaixaModal open={showFluxoModal} onClose={() => setShowFluxoModal(false)} paybackInfo={paybackInfo} />

      {/* ═══ Modal: Variáveis ═══ */}
      <VariaveisModal open={showVariaveisModal} onClose={() => setShowVariaveisModal(false)} />

      {/* ═══ Modal: Novo Financiamento ═══ */}
      <Dialog open={showNovoFinanciamento} onOpenChange={setShowNovoFinanciamento}>
        <DialogContent className="w-[90vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Novo financiamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Tipo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo</Label>
              <Select defaultValue="prestacao">
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prestacao" className="text-xs">Prestação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entrada */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Entrada</Label>
              <div className="flex gap-2">
                <Select value={novoEntradaPercent ? "percent" : "value"} onValueChange={v => setNovoEntradaPercent(v === "percent")}>
                  <SelectTrigger className="h-9 text-xs w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent" className="text-xs">%</SelectItem>
                    <SelectItem value="value" className="text-xs">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={novoEntrada}
                  onChange={e => setNovoEntrada(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-xs flex-1"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Valor da entrada: {formatBRL(
                  novoEntradaPercent
                    ? precoFinal * (parseFloat(novoEntrada) || 0) / 100
                    : parseFloat(novoEntrada) || 0
                )}
              </p>
            </div>

            {/* Taxa Mensal */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Taxa Mensal</Label>
              <div className="relative">
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  value={novoTaxa}
                  onChange={e => setNovoTaxa(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-xs pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Taxa de juros mensal</p>
            </div>

            {/* Prazo */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prazo</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  value={novoPrazo}
                  onChange={e => setNovoPrazo(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">meses</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Prazo do financiamento</p>
            </div>

            {/* Carência */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Carência</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={novoCarencia}
                  onChange={e => setNovoCarencia(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">meses</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Carência do financiamento</p>
            </div>

            {/* Prestação (calculated) */}
            {(() => {
              const entradaVal = novoEntradaPercent
                ? precoFinal * (parseFloat(novoEntrada) || 0) / 100
                : parseFloat(novoEntrada) || 0;
              const parcelas = parseInt(novoPrazo) || 0;
              const taxa = parseFloat(novoTaxa) || 0;
              const principal = Math.max(0, precoFinal - entradaVal);
              const prestacao = calcularPrestacao(principal, taxa, parcelas);
              return (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Prestação</Label>
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-sm font-bold text-primary">{formatBRL(prestacao)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Prestação do financiamento</p>
                </div>
              );
            })()}

            {/* Nome do banco */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome do banco / financeira *</Label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} className="h-9 text-xs" placeholder="Ex: Sicoob" />
            </div>
          </div>

          <Button
            className="w-full mt-2"
            disabled={!novoNome.trim() || !novoPrazo}
            onClick={() => {
              if (!novoNome.trim()) return;
              const entradaVal = novoEntradaPercent
                ? precoFinal * (parseFloat(novoEntrada) || 0) / 100
                : parseFloat(novoEntrada) || 0;
              const parcelas = parseInt(novoPrazo) || parseInt(novoMaxParcelas) || 60;
              const taxa = parseFloat(novoTaxa) || 0;
              const carencia = parseInt(novoCarencia) || 0;
              const principal = Math.max(0, precoFinal - entradaVal);

              const newBanco: BancoFinanciamento = {
                id: crypto.randomUUID(),
                nome: novoNome.trim(),
                taxa_mensal: taxa,
                max_parcelas: parcelas,
              };
              const newGroup: BancoGroup = {
                banco: newBanco,
                opcoes: [{
                  id: crypto.randomUUID(),
                  banco_id: newBanco.id,
                  banco_nome: newBanco.nome,
                  entrada: entradaVal,
                  num_parcelas: parcelas,
                  taxa_mensal: taxa,
                  carencia_meses: carencia,
                  valor_financiado: precoFinal,
                  valor_parcela: calcParcela({
                    valor_financiado: precoFinal,
                    entrada: entradaVal,
                    num_parcelas: parcelas,
                    taxa_mensal: taxa,
                    tipo: "financiamento",
                    carencia_meses: carencia,
                  }),
                }],
              };
              setBancoGroups(prev => [...prev, newGroup]);
              setSelectedBancoIdx(bancoGroups.length);
              setShowNovoFinanciamento(false);
              setNovoNome("");
              setNovoTaxa("");
              setNovoEntrada("");
              setNovoPrazo("");
              setNovoCarencia("0");
            }}
          >
            Gerar Opção
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── FormasPagamentoPreview (read-only admin payment methods) ────
function FormasPagamentoPreview({ precoFinal }: { precoFinal: number }) {
  const { data: formasConfig } = usePaymentInterestConfigs();
  const formasAtivas = useMemo(
    () => (formasConfig ?? []).filter((f) => f.ativo),
    [formasConfig]
  );

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-info/5 border border-info/20">
        <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Formas de pagamento gerenciadas pelo financeiro
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            As condições abaixo são definidas pelo gestor financeiro.
            O cliente escolherá a forma preferida ao aceitar a proposta.
          </p>
        </div>
      </div>

      {/* Active payment methods preview */}
      {formasAtivas.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pagamento Direto — disponível para o cliente
          </p>
          {formasAtivas.map((forma) => (
            <div
              key={forma.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  {FORMA_ICONS[forma.forma_pagamento] ?? <DollarSign className="h-4 w-4 text-primary" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {FORMA_PAGAMENTO_LABELS[forma.forma_pagamento] ?? forma.forma_pagamento}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {forma.juros_tipo === "sem_juros"
                      ? `Até ${forma.parcelas_padrao}x sem juros`
                      : `Até ${forma.parcelas_padrao}x · ${forma.juros_valor}% a.m.`}
                    {forma.observacoes ? ` · ${forma.observacoes}` : ""}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-xs bg-success/10 text-success border-success/30"
              >
                Disponível
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Warning if no forms configured */}
      {formasAtivas.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-muted-foreground">
            Nenhuma forma de pagamento direto configurada.
            Configure em{" "}
            <span className="font-medium text-foreground">
              Admin → Formas de Pagamento
            </span>.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function GastosModal({ open, onClose, gastosData }: {
  open: boolean;
  onClose: () => void;
  gastosData: { linhas: any[]; totalAtual: number; totalNovo: number; economia: number };
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Detalhes dos gastos</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Visualização</Label>
            <Select defaultValue="1">
              <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="text-xs">1. Unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase text-muted-foreground border-b border-border/30">
                <th className="text-left py-2 font-medium">Gastos</th>
                <th className="text-right py-2 font-medium">Atual</th>
                <th className="text-right py-2 font-medium">Novo</th>
              </tr>
            </thead>
            <tbody>
              {gastosData.linhas.map((row, i) => (
                <>
                  <tr key={`row-${i}`} className={cn("border-b border-border/10", row.indent && "text-muted-foreground")}>
                    <td className={cn("py-1.5", row.indent ? "pl-4 text-[10px]" : "text-primary font-medium", row.strike && "line-through")}>{row.label}</td>
                    <td className="py-1.5 text-right">{row.atual !== null && row.atual !== undefined ? formatBRL(row.atual) : ""}</td>
                    <td className="py-1.5 text-right">{formatBRL(row.novo ?? 0)}</td>
                  </tr>
                  {row.children?.map((child: any, ci: number) => (
                    <tr key={`child-${i}-${ci}`} className="text-muted-foreground border-b border-border/10">
                      <td className={cn("py-1 pl-6 text-[10px]", child.strike && "line-through")}>{child.label}</td>
                      <td className="py-1 text-right text-[10px]">{child.atual !== null && child.atual !== undefined ? formatBRL(child.atual) : ""}</td>
                      <td className="py-1 text-right text-[10px]">{formatBRL(child.novo ?? 0)}</td>
                    </tr>
                  ))}
                </>
              ))}
              {/* Totals */}
              <tr className="border-t border-border/40">
                <td className="py-2"></td>
                <td className="py-2 text-right font-medium">{formatBRL(gastosData.totalAtual)}</td>
                <td className="py-2 text-right font-medium">{formatBRL(gastosData.totalNovo)}</td>
              </tr>
              <tr>
                <td className="py-2 text-right font-bold" colSpan={2}>Economia</td>
                <td className="py-2 text-right font-bold text-success">{formatBRL(gastosData.economia)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-sm">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FluxoCaixaModal({ open, onClose, paybackInfo }: {
  open: boolean;
  onClose: () => void;
  paybackInfo: { label: string; tir: number; vpl: number };
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Detalhes do Fluxo de Caixa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Tempo de retorno:</span>
            <span className="font-bold">{paybackInfo.label}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-warning" />
            <span className="text-muted-foreground">Taxa Interna de Retorno:</span>
            <span className="font-bold text-warning">{(Number(paybackInfo.tir) || 0).toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">Valor Presente Líquido:</span>
            <span className="font-bold text-success">{formatBRL(paybackInfo.vpl)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-sm">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VariaveisModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedCategory, setSelectedCategory] = useState<VariableCategory>("customizada");
  const [search, setSearch] = useState("");

  // Map categories used in the photo: Campo Customizado, Cliente, Comercial, Conta de Energia, Custo Customizado, Entrada de Dados, Financeiro, Premissas, Sistema Solar, Séries, Variável Customizada
  const categories: VariableCategory[] = CATEGORY_ORDER;

  const filteredVars = useMemo(() => {
    const vars = VARIABLES_CATALOG.filter(v => v.category === selectedCategory);
    if (!search.trim()) return vars;
    const q = search.toLowerCase();
    return vars.filter(v => v.label.toLowerCase().includes(q) || v.legacyKey.toLowerCase().includes(q) || v.canonicalKey.toLowerCase().includes(q));
  }, [selectedCategory, search]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Variáveis</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-[60vh]">
          {/* Category sidebar */}
          <div className="w-48 flex-shrink-0 space-y-0.5 overflow-y-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "w-full text-left text-xs px-3 py-2 rounded-lg transition-colors",
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Variables table */}
          <div className="flex-1 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
              {search && (
                <Button variant="ghost" size="icon" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-auto w-auto p-0">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(60vh-60px)]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 z-10">
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="text-left py-2 px-2 font-medium">Item ↓</th>
                    <th className="text-left py-2 px-2 font-medium">Chave</th>
                    <th className="text-left py-2 px-2 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVars.map(v => (
                    <tr key={v.canonicalKey} className="border-b border-border/10 hover:bg-muted/20">
                      <td className="py-1.5 px-2 text-primary">{v.label}</td>
                      <td className="py-1.5 px-2 font-mono text-muted-foreground text-[10px]">{v.legacyKey}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">-</td>
                    </tr>
                  ))}
                  {filteredVars.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground">Nenhuma variável encontrada</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-sm">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function calcParcela(op: { valor_financiado: number; entrada: number; num_parcelas: number; taxa_mensal: number; tipo: string; carencia_meses: number }): number {
  const principal = (op.valor_financiado || 0) - (op.entrada || 0);
  if (principal <= 0 || op.num_parcelas <= 0) return 0;
  if (op.tipo === "a_vista") return op.valor_financiado || 0;
  return calcularPrestacao(principal, op.taxa_mensal, op.num_parcelas);
}
