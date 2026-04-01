/**
 * PublicPaymentSection.tsx
 * Redesigned payment options for the public proposal page.
 * - À Vista card highlighted at top
 * - Financiamentos grouped by bank in accordions
 * - Bug fix: À Vista entrada = 0
 */

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, TrendingUp, Zap, Building2, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatters";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import { cn } from "@/lib/utils";

type CenarioData = {
  id: string;
  ordem: number;
  nome: string;
  tipo: string;
  is_default: boolean;
  preco_final: number;
  entrada_valor: number;
  num_parcelas: number;
  valor_parcela: number;
  taxa_juros_mensal: number;
  cet_anual: number;
  payback_meses: number;
  tir_anual: number;
  roi_25_anos: number;
  economia_primeiro_ano: number;
};

interface PublicPaymentSectionProps {
  cenarios: CenarioData[];
  selectedCenario: string | null;
  onSelectCenario: (id: string) => void;
}

/** Detect if a cenário is "à vista" */
function isAvista(c: CenarioData): boolean {
  return /avista|à vista|a_vista/i.test(`${c.tipo} ${c.nome}`) || c.num_parcelas <= 1;
}

/** Extract bank name from cenário nome, e.g. "Santander 24x" → "Santander" */
function extractBanco(nome: string): string {
  // Remove trailing parcela info like "12x", "24x", etc.
  const cleaned = nome.replace(/\s*\d+x\s*$/i, "").trim();
  return cleaned || nome;
}

export default function PublicPaymentSection({
  cenarios,
  selectedCenario,
  onSelectCenario,
}: PublicPaymentSectionProps) {
  const [expandedBanco, setExpandedBanco] = useState<string | null>(null);

  const { avista, bancoGroups } = useMemo(() => {
    const avistaList = cenarios.filter(isAvista);
    const financiamentos = cenarios.filter(c => !isAvista(c));

    // Group by bank
    const groups: Record<string, CenarioData[]> = {};
    for (const c of financiamentos) {
      const banco = extractBanco(c.nome);
      if (!groups[banco]) groups[banco] = [];
      groups[banco].push(c);
    }
    // Sort each group by num_parcelas
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.num_parcelas - b.num_parcelas);
    }

    return {
      avista: avistaList[0] ?? null,
      bancoGroups: Object.entries(groups),
    };
  }, [cenarios]);

  if (cenarios.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 pb-4 space-y-4">
      <h3 className="text-base font-semibold text-center text-foreground">
        Escolha a melhor opção para você
      </h3>

      {/* ── À VISTA — Highlighted card ── */}
      {avista && (
        <Card
          className={cn(
            "cursor-pointer transition-all border-2",
            selectedCenario === avista.id
              ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
              : "border-border hover:border-primary/40 bg-card"
          )}
          style={{ boxShadow: selectedCenario === avista.id ? undefined : "var(--shadow-sm)" }}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
          onClick={() => onSelectCenario(avista.id)}
        >
          <CardContent className="p-5 relative">
            {avista.is_default && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                ★ RECOMENDADO
              </span>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium tracking-wide">
                  À Vista
                </p>
                <p className="text-2xl font-bold tracking-tight text-primary mt-1">
                  {formatBRL(avista.preco_final)}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Pagamento único
                </p>
              </div>

              {selectedCenario === avista.id && (
                <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
              )}
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/50">
              <MetricItem
                icon={<Clock className="h-3.5 w-3.5" />}
                value={Number.isFinite(avista.payback_meses) ? `${avista.payback_meses}m` : "—"}
                label="Payback"
              />
              <MetricItem
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                value={Number.isFinite(avista.tir_anual) ? `${avista.tir_anual.toFixed(1)}%` : "—"}
                label="TIR"
              />
              <MetricItem
                icon={<Zap className="h-3.5 w-3.5" />}
                value={Number.isFinite(avista.roi_25_anos) ? formatBRL(avista.roi_25_anos) : "—"}
                label="ROI 25a"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FINANCIAMENTOS — Grouped by bank ── */}
      {bancoGroups.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">Financiamento Bancário</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {bancoGroups.map(([banco, items]) => {
            const isExpanded = expandedBanco === banco;
            const hasSelected = items.some(i => i.id === selectedCenario);

            return (
              <Card
                key={banco}
                className={cn(
                  "transition-all border overflow-hidden",
                  hasSelected ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                )}
                style={{ boxShadow: "var(--shadow-sm)" }}
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
              >
                {/* Accordion trigger */}
                <button
                  type="button"
                  onClick={() => setExpandedBanco(isExpanded ? null : banco)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted shrink-0">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{banco}</p>
                      <p className="text-xs text-muted-foreground">
                        {items.length} {items.length === 1 ? "opção" : "opções"}
                        {items[0].taxa_juros_mensal > 0 && (
                          <> · {formatTaxaMensal(items[0].taxa_juros_mensal)} a.m.</>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {/* Expanded options */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Header row */}
                    <div className="grid grid-cols-4 px-4 py-2 bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase">
                      <span>Parcelas</span>
                      <span>Valor/mês</span>
                      <span>Entrada</span>
                      <span className="text-right">Total</span>
                    </div>

                    {items.map(item => {
                      const isSelected = selectedCenario === item.id;
                      const totalFinanciado = item.num_parcelas * item.valor_parcela + (item.entrada_valor ?? 0);

                      return (
                        <div key={item.id}>
                          <div
                            className={cn(
                              "grid grid-cols-4 px-4 py-3 cursor-pointer border-t border-border/50 transition-colors items-center",
                              isSelected ? "bg-primary/10" : "hover:bg-muted/30"
                            )}
                            onClick={() => onSelectCenario(item.id)}
                          >
                            <span className="text-sm font-medium text-foreground flex items-center gap-2">
                              {item.num_parcelas}x
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                            </span>
                            <span className="text-sm text-foreground">
                              {formatBRL(item.valor_parcela)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {(item.entrada_valor ?? 0) > 0 ? formatBRL(item.entrada_valor) : "—"}
                            </span>
                            <span className="text-sm text-muted-foreground text-right">
                              {formatBRL(totalFinanciado)}
                            </span>
                          </div>

                          {/* Expanded detail for selected */}
                          {isSelected && (
                            <div className="px-4 py-3 bg-primary/5 border-t border-primary/10">
                              <div className="grid grid-cols-3 gap-3">
                                <MetricItem
                                  icon={<Clock className="h-3.5 w-3.5" />}
                                  value={Number.isFinite(item.payback_meses) ? `${item.payback_meses}m` : "—"}
                                  label="Payback"
                                />
                                <MetricItem
                                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                                  value={Number.isFinite(item.tir_anual) ? `${item.tir_anual.toFixed(1)}%` : "—"}
                                  label="TIR"
                                />
                                <MetricItem
                                  icon={<Zap className="h-3.5 w-3.5" />}
                                  value={Number.isFinite(item.roi_25_anos) ? formatBRL(item.roi_25_anos) : "—"}
                                  label="ROI 25a"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricItem({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center text-muted-foreground mb-0.5">{icon}</div>
      <p className="text-xs font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
