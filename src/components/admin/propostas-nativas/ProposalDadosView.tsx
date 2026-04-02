/**
 * ProposalDadosView.tsx
 * 
 * 4-column grid view for proposal data (Sistema | Financeiro | Energia | Pagamento).
 * Used in the "Dados" tab of project detail.
 * SSOT: Uses normalizeProposalSnapshot for safe data access.
 */

import { normalizeProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import { formatBRL } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle, Type, DollarSign, Zap,
} from "lucide-react";

interface ProposalDadosViewProps {
  snapshot: Record<string, unknown> | null;
  valorTotal?: number;
  geracaoMensal?: number;
  economiaMensal?: number;
}

// ─── Data row ───────────────────────────────────────
function DataRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export function ProposalDadosView({
  snapshot,
  valorTotal,
  geracaoMensal,
  economiaMensal,
}: ProposalDadosViewProps) {
  const norm = normalizeProposalSnapshot(snapshot);
  const raw = (snapshot || {}) as Record<string, any>;

  const precoFinal = valorTotal ?? norm.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const geracaoMensalKwh = geracaoMensal ?? norm.geracaoMensalEstimada;
  const geracaoAnual = raw.geracao_anual ? Number(raw.geracao_anual) : (geracaoMensalKwh * 12);

  // Financial
  const custoEquip = norm.custoKit || norm.venda.custo_kit || 0;
  const custoInstalacao = norm.venda.custo_instalacao || 0;
  const desconto = norm.venda.desconto_percentual || 0;
  const tir = norm.tir || raw.tir || 0;
  const vpl = norm.vpl || raw.vpl || 0;
  const paybackMeses = norm.paybackMeses || raw.payback_meses || raw.paybackMeses || 0;

  // Energy
  const consumoMensal = norm.consumoTotal || raw.consumo_mensal || 0;
  const economiaPct = raw.economia_mensal_percent || raw.economiaPct || 0;
  const tarifaDist = raw.tarifa_distribuidora || raw.locTarifaDistribuidora || 0;
  const custoDisp = raw.custo_disponibilidade || raw.custoDemanda || 0;
  const sobredim = norm.premissas.sobredimensionamento || raw.sobredimensionamento || 0;
  const perdaEfic = norm.premissas.perda_eficiencia_anual || 0;
  const inflacaoEnergetica = norm.premissas.inflacao_energetica || 0;

  // Payback display
  const paybackDisplay = (() => {
    if (!paybackMeses || paybackMeses <= 0) return "—";
    const anos = Math.floor(paybackMeses / 12);
    const meses = Math.round(paybackMeses % 12);
    if (anos === 0) return `${meses} meses`;
    if (meses === 0) return `${anos} anos`;
    return `${anos} anos e ${meses} meses`;
  })();

  // System
  const telhado = norm.locTipoTelhado || "—";
  const estrutura = raw.estrutura || raw.locEstrutura || "—";
  const moduloItem = norm.itens.find(i => i.categoria === "modulo" || i.categoria === "modulos");
  const inversorItem = norm.itens.find(i => i.categoria === "inversor" || i.categoria === "inversores");
  const moduloDesc = moduloItem ? `${moduloItem.fabricante} ${moduloItem.modelo}`.trim() || moduloItem.descricao : "—";
  const inversorDesc = inversorItem ? `${inversorItem.fabricante} ${inversorItem.modelo}`.trim() || inversorItem.descricao : "—";
  const qtdModulos = moduloItem?.quantidade || raw.panel_quantity || 0;
  const qtdInversores = inversorItem?.quantidade || raw.inverter_quantity || 0;
  const garantia = raw.garantia || raw.warranty || "—";

  // Pagamento
  const pagOpcoes = norm.pagamentoOpcoes;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
      {/* ── Sistema ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Sistema</h3>
          <div className="space-y-1">
            <DataRow icon={CheckCircle} label="Telhado" value={telhado} />
            <DataRow icon={Type} label="Estrutura" value={estrutura} />
            <DataRow icon={Type} label="Módulo" value={moduloDesc} />
            <DataRow icon={Type} label="Qtd Módulos" value={String(qtdModulos || "—")} />
            <DataRow icon={Type} label="Inversor" value={inversorDesc} />
            <DataRow icon={Type} label="Qtd Inversores" value={String(qtdInversores || "—")} />
            <DataRow icon={Type} label="Garantia" value={String(garantia)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Financeiro ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Financeiro</h3>
          <div className="space-y-1">
            <DataRow icon={DollarSign} label="Custo Equipamento" value={custoEquip > 0 ? formatBRL(custoEquip) : "—"} />
            <DataRow icon={DollarSign} label="Custo Instalação" value={custoInstalacao > 0 ? formatBRL(custoInstalacao) : "—"} />
            <DataRow icon={DollarSign} label="Desconto" value={desconto > 0 ? `${desconto}%` : "—"} />
            <DataRow icon={DollarSign} label="TIR" value={tir > 0 ? `${tir.toFixed(2).replace(".", ",")}%` : "—"} />
            <DataRow icon={DollarSign} label="VPL" value={vpl > 0 ? formatBRL(vpl) : "—"} />
            <DataRow icon={Type} label="Payback" value={paybackDisplay} />
          </div>
        </CardContent>
      </Card>

      {/* ── Energia ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Energia</h3>
          <div className="space-y-1">
            <DataRow icon={Type} label="Consumo Mensal" value={consumoMensal > 0 ? `${consumoMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh` : "—"} />
            <DataRow icon={Type} label="Geração Anual" value={geracaoAnual > 0 ? `${geracaoAnual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh` : "—"} />
            <DataRow icon={Type} label="Economia %" value={economiaPct > 0 ? `${economiaPct.toFixed(2).replace(".", ",")}%` : "—"} />
            <DataRow icon={DollarSign} label="Tarifa Distribuidora" value={tarifaDist > 0 ? `R$ ${tarifaDist.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}` : "—"} />
            <DataRow icon={DollarSign} label="Custo Disponibilidade" value={custoDisp > 0 ? formatBRL(custoDisp) : "—"} />
            <DataRow icon={Type} label="Sobredimensionamento" value={sobredim > 0 ? `${sobredim.toFixed(2).replace(".", ",")}%` : "—"} />
            <DataRow icon={Type} label="Perda Eficiência/Ano" value={perdaEfic > 0 ? `${perdaEfic.toFixed(2).replace(".", ",")}%` : "—"} />
            <DataRow icon={Type} label="Inflação Energética" value={inflacaoEnergetica > 0 ? `${inflacaoEnergetica.toFixed(2).replace(".", ",")}%` : "—"} />
          </div>
        </CardContent>
      </Card>

      {/* ── Pagamento ── */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-3">Pagamento</h3>
          {pagOpcoes.length > 0 ? (
            <div className="space-y-4">
              {pagOpcoes.map((p, i) => {
                const isAVista = p.tipo === "a_vista" || /vista|avista/i.test(p.nome);
                return (
                  <div key={p.id || i} className="space-y-1">
                    <p className="text-xs font-semibold text-primary">{p.nome || (isAVista ? "À vista" : `Opção ${i + 1}`)}</p>
                    <p className="text-sm font-medium text-foreground">
                      {isAVista
                        ? formatBRL(precoFinal)
                        : p.num_parcelas > 0
                          ? `${p.num_parcelas}x de ${formatBRL(p.valor_parcela)}`
                          : formatBRL(precoFinal)
                      }
                    </p>
                    {!isAVista && p.entrada > 0 && (
                      <p className="text-xs text-muted-foreground">Entrada: {formatBRL(p.entrada)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem opções de financiamento</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
