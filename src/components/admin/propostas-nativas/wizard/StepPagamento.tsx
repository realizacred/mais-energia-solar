import { useState, useMemo } from "react";
import { Plus, Trash2, CreditCard, Building2, ChevronRight, Calendar, TrendingUp, DollarSign, X, Search, Info } from "lucide-react";
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
import { VARIABLES_CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, type VariableCategory } from "@/lib/variablesCatalog";

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
}

const DEFAULT_PARCELAS = [12, 24, 36, 48];

export function StepPagamento({
  opcoes, onOpcoesChange, bancos, loadingBancos, precoFinal,
  ucs = [], premissas, potenciaKwp = 0, irradiacao = 0,
}: StepPagamentoProps) {
  const [activeTab, setActiveTab] = useState<"pagamento" | "fluxo">("pagamento");
  const [showGastosModal, setShowGastosModal] = useState(false);
  const [showFluxoModal, setShowFluxoModal] = useState(false);
  const [showVariaveisModal, setShowVariaveisModal] = useState(false);
  const [fluxoFinanciamento, setFluxoFinanciamento] = useState("sem_financiamento");

  // ─── Bank groups with auto-generated options
  const [bancoGroups, setBancoGroups] = useState<BancoGroup[]>(() =>
    bancos.map(b => ({
      banco: b,
      opcoes: DEFAULT_PARCELAS
        .filter(p => p <= b.max_parcelas)
        .map(parcelas => {
          const vf = precoFinal;
          return {
            id: crypto.randomUUID(),
            banco_id: b.id,
            banco_nome: b.nome,
            entrada: 0,
            num_parcelas: parcelas,
            taxa_mensal: b.taxa_mensal,
            carencia_meses: 2,
            valor_financiado: vf,
            valor_parcela: calcParcela({ valor_financiado: vf, entrada: 0, num_parcelas: parcelas, taxa_mensal: b.taxa_mensal, tipo: "financiamento", carencia_meses: 2 }),
          };
        }),
    }))
  );

  const [selectedBancoIdx, setSelectedBancoIdx] = useState(0);

  // Sync bank groups when bancos load
  useMemo(() => {
    if (bancos.length > 0 && bancoGroups.length === 0) {
      setBancoGroups(bancos.map(b => ({
        banco: b,
        opcoes: DEFAULT_PARCELAS
          .filter(p => p <= b.max_parcelas)
          .map(parcelas => ({
            id: crypto.randomUUID(),
            banco_id: b.id,
            banco_nome: b.nome,
            entrada: 0,
            num_parcelas: parcelas,
            taxa_mensal: b.taxa_mensal,
            carencia_meses: 2,
            valor_financiado: precoFinal,
            valor_parcela: calcParcela({ valor_financiado: precoFinal, entrada: 0, num_parcelas: parcelas, taxa_mensal: b.taxa_mensal, tipo: "financiamento", carencia_meses: 2 }),
          })),
      })));
    }
  }, [bancos]);

  // ─── Derived metrics (simplified calc engine)
  const prem = premissas || { inflacao_energetica: 9.5, perda_eficiencia_anual: 0.5, vpl_taxa_desconto: 10, imposto: 0, inflacao_ipca: 4.5, sobredimensionamento: 0, troca_inversor_anos: 15, troca_inversor_custo: 30 };
  const geracaoAnualBase = potenciaKwp * (irradiacao || 4.5) * 365 * 0.8; // simplified
  const ucGeradora = ucs.find(u => u.is_geradora) || ucs[0];
  const tarifaBase = ucGeradora?.tarifa_distribuidora || 1.10;
  const custoDisp = ucGeradora?.custo_disponibilidade_valor || 54.81;

  // Economy calc
  const economiaAtual = ucGeradora ? (ucGeradora.consumo_mensal * tarifaBase) : (geracaoAnualBase / 12 * tarifaBase);
  const economiaNova = custoDisp;
  const economiaMensal = Math.max(0, economiaAtual - economiaNova);
  const economiaPercent = economiaAtual > 0 ? (economiaMensal / economiaAtual * 100) : 75;

  // ─── Cash flow table (25 years)
  const fluxoCaixaData = useMemo(() => {
    const rows: { ano: number; geracao: number; tarifa: number; economia: number; investimento: number; fluxoCaixa: number }[] = [];
    let acumulado = 0;
    const degradacao = (prem.perda_eficiencia_anual || 0.5) / 100;
    const inflacao = (prem.inflacao_energetica || 9.5) / 100;
    const geracaoBase = geracaoAnualBase || 4761;

    // Find financing option for selected
    let investAno0 = precoFinal;
    let investAno1 = 0;
    if (fluxoFinanciamento !== "sem_financiamento") {
      const parts = fluxoFinanciamento.split("|");
      if (parts.length >= 2) {
        const bIdx = parseInt(parts[0]);
        const oIdx = parseInt(parts[1]);
        const group = bancoGroups[bIdx];
        if (group && group.opcoes[oIdx]) {
          const op = group.opcoes[oIdx];
          const totalFinanciado = op.valor_parcela * op.num_parcelas + op.entrada;
          investAno0 = op.entrada + (op.num_parcelas <= 12 ? op.valor_parcela * op.num_parcelas : op.valor_parcela * 12);
          investAno1 = op.num_parcelas > 12 ? op.valor_parcela * Math.min(12, op.num_parcelas - 12) : 0;
        }
      }
    }

    for (let ano = 0; ano <= 25; ano++) {
      const geracao = geracaoBase * Math.pow(1 - degradacao, ano);
      const tarifa = tarifaBase * Math.pow(1 + inflacao, ano);
      const economia = (geracao / 12) * tarifa * 12 * (economiaPercent / 100);
      const investimento = ano === 0 ? -investAno0 : ano === 1 ? -investAno1 : 0;
      acumulado += economia + investimento;
      rows.push({ ano, geracao, tarifa, economia, investimento, fluxoCaixa: acumulado });
    }
    return rows;
  }, [precoFinal, fluxoFinanciamento, bancoGroups, geracaoAnualBase, tarifaBase, prem, economiaPercent]);

  // Payback calculation
  const paybackInfo = useMemo(() => {
    const row = fluxoCaixaData.find(r => r.fluxoCaixa >= 0);
    const paybackAnos = row ? row.ano : 25;
    // Interpolate months
    let paybackMeses = 0;
    if (row && row.ano > 0) {
      const prev = fluxoCaixaData[row.ano - 1];
      if (prev && prev.fluxoCaixa < 0) {
        const frac = Math.abs(prev.fluxoCaixa) / (row.fluxoCaixa - prev.fluxoCaixa);
        paybackMeses = Math.round(frac * 12);
      }
    }

    // TIR simplified (Newton-Raphson approximation)
    const cashflows = fluxoCaixaData.map(r => r.economia + r.investimento);
    let tir = 0.1;
    for (let iter = 0; iter < 50; iter++) {
      let npv = 0, dnpv = 0;
      for (let t = 0; t < cashflows.length; t++) {
        const d = Math.pow(1 + tir, t);
        npv += cashflows[t] / d;
        dnpv -= t * cashflows[t] / (d * (1 + tir));
      }
      if (Math.abs(dnpv) < 1e-10) break;
      tir -= npv / dnpv;
      if (Math.abs(npv) < 0.01) break;
    }

    // VPL
    const taxa = (prem.vpl_taxa_desconto || 10) / 100;
    const vpl = cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + taxa, t), 0);

    return {
      anos: paybackAnos,
      meses: paybackMeses,
      label: `${paybackAnos} ano${paybackAnos !== 1 ? "s" : ""} e ${paybackMeses} mes${paybackMeses !== 1 ? "es" : ""}`,
      tir: Math.max(0, tir * 100),
      vpl,
    };
  }, [fluxoCaixaData, prem]);

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
    <div className="space-y-0">
      {/* Header Tabs + Metrics */}
      <div className="flex items-center justify-between mb-4">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="pagamento" className="text-xs">Pagamento</TabsTrigger>
            <TabsTrigger value="fluxo" className="text-xs">Fluxo de caixa</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-success" />
            <span className="text-muted-foreground">Economia mensal:</span>
            <span className="font-bold text-success">{formatBRL(economiaMensal)}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{economiaPercent.toFixed(2)}%</Badge>
            <button onClick={() => setShowGastosModal(true)} className="text-primary underline text-[10px] hover:opacity-80">Ver mais</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Tempo de retorno:</span>
            <span className="font-bold">{paybackInfo.label}</span>
            <button onClick={() => setShowFluxoModal(true)} className="text-primary underline text-[10px] hover:opacity-80">Ver mais</button>
          </div>
        </div>
      </div>

      {/* ─── Tab: Pagamento ─────────────────────────────── */}
      {activeTab === "pagamento" && (
        <div className="flex gap-4">
          {/* Sidebar - Banks */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {bancoGroups.map((g, idx) => (
              <button
                key={g.banco.id}
                onClick={() => setSelectedBancoIdx(idx)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs flex items-center justify-between transition-colors",
                  selectedBancoIdx === idx
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "hover:bg-muted/50 text-muted-foreground border border-transparent"
                )}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  {g.banco.nome}
                </span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">{g.opcoes.length}</Badge>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="w-full text-xs text-primary gap-1 mt-2 h-8">
              <Plus className="h-3 w-3" /> Novo financiamento
            </Button>
          </div>

          {/* Main - Options for selected bank */}
          <div className="flex-1 space-y-3">
            {bancoGroups[selectedBancoIdx]?.opcoes.map((op, idx) => (
              <div key={op.id} className="p-4 rounded-xl border border-border/50 bg-card">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="text-[10px]">Opção {idx + 1}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => removeOpcao(selectedBancoIdx, idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Financiamento</Label>
                    <p className="font-semibold mt-0.5">{formatBRL(op.valor_financiado)}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Entrada</Label>
                    <p className="font-semibold mt-0.5">{formatBRL(op.entrada)}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Parcelas</Label>
                    <p className="font-semibold mt-0.5">{op.num_parcelas}x</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Taxa</Label>
                    <p className="font-semibold mt-0.5">{op.taxa_mensal.toFixed(2)}%</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Carência</Label>
                    <p className="font-semibold mt-0.5">{op.carencia_meses} meses</p>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Valor parcela</Label>
                    <p className="font-bold text-primary mt-0.5">{formatBRL(op.valor_parcela)}</p>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="ghost" size="sm" className="text-xs text-primary gap-1 h-8" onClick={() => addOpcaoToBanco(selectedBancoIdx)}>
              <Plus className="h-3 w-3" /> Adicionar opção
            </Button>
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
            <button className="text-xs font-medium border-b-2 border-primary pb-2 px-3 text-foreground">
              1. Unidade
            </button>
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
                    <td className="py-2 px-3 text-right text-muted-foreground">{row.geracao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">{row.tarifa.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-2 px-3 text-right text-foreground">{row.economia.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
                    <td className={cn("py-2 px-3 text-right font-medium", row.investimento < 0 ? "text-orange-500" : "text-muted-foreground")}>
                      {row.investimento < 0 ? `-${Math.abs(row.investimento).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : row.investimento.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </td>
                    <td className={cn("py-2 px-3 text-right font-semibold", row.fluxoCaixa < 0 ? "text-destructive" : "text-success")}>
                      {row.fluxoCaixa < 0 ? `-${Math.abs(row.fluxoCaixa).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` : row.fluxoCaixa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
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
        <button onClick={() => setShowVariaveisModal(true)} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors">
          <Info className="h-3.5 w-3.5" /> Consultar variáveis da proposta
        </button>
      </div>

      {/* ═══ Modal: Detalhes dos Gastos ═══ */}
      <GastosModal open={showGastosModal} onClose={() => setShowGastosModal(false)} gastosData={gastosData} />

      {/* ═══ Modal: Detalhes do Fluxo de Caixa ═══ */}
      <FluxoCaixaModal open={showFluxoModal} onClose={() => setShowFluxoModal(false)} paybackInfo={paybackInfo} />

      {/* ═══ Modal: Variáveis ═══ */}
      <VariaveisModal open={showVariaveisModal} onClose={() => setShowVariaveisModal(false)} />
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
      <DialogContent className="max-w-lg">
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
      <DialogContent className="max-w-sm">
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
            <span className="font-bold text-warning">{paybackInfo.tir.toFixed(2)}%</span>
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
      <DialogContent className="max-w-3xl max-h-[80vh]">
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
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
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
  if (op.taxa_mensal <= 0) return principal / op.num_parcelas;
  const r = op.taxa_mensal / 100;
  const n = op.num_parcelas;
  const fator = Math.pow(1 + r, n);
  return principal * (r * fator) / (fator - 1);
}
