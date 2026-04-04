import { formatBRL } from "@/lib/formatters";
import { formatTaxaMensal } from "@/services/paymentComposition/financingMath";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NormalizedPagamento } from "@/domain/proposal/normalizeProposalSnapshot";

interface CenarioData {
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
  payback_meses: number;
  tir_anual: number;
  roi_25_anos: number;
  economia_primeiro_ano: number;
}

interface LandingInvestimentoProps {
  valorTotal: number;
  economiaMensal: number;
  paybackMeses: number;
  cenarios: CenarioData[];
  selectedCenario: string | null;
  onSelectCenario: (id: string) => void;
  activeCenario: CenarioData | null;
  pagamentoOpcoes: NormalizedPagamento[];
}

export function LandingInvestimento({
  valorTotal,
  economiaMensal,
  paybackMeses,
  cenarios,
  selectedCenario,
  onSelectCenario,
  activeCenario,
  pagamentoOpcoes,
}: LandingInvestimentoProps) {
  const fadeUp = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6 },
  };

  const hasCenarios = cenarios.length > 0;

  return (
    <section className="py-20 sm:py-28 px-4 bg-[#0d1117] relative">
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        <motion.div {...fadeUp} className="text-center mb-14">
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Investimento
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
            Valor do seu sistema
          </h2>
          <div className="inline-block bg-gradient-to-r from-amber-500/20 to-amber-500/5 border border-amber-500/20 rounded-2xl px-8 py-5">
            <p className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              {formatBRL(valorTotal)}
            </p>
            <p className="text-sm text-white/40 mt-2">Investimento total</p>
          </div>
        </motion.div>

        {/* Cenários */}
        {hasCenarios && (
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="space-y-3 mb-10">
            <p className="text-sm font-semibold text-white/60 text-center mb-4">
              Escolha a melhor opção de pagamento
            </p>
            {cenarios.map(c => {
              const isSelected = selectedCenario === c.id;
              const isAVista = /avista|à vista|a_vista/i.test(`${c.tipo} ${c.nome}`) || c.num_parcelas <= 1;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-2xl border-2 p-5 transition-all cursor-pointer",
                    isSelected
                      ? "border-amber-400/60 bg-amber-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  )}
                  onClick={() => onSelectCenario(c.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{c.nome}</p>
                      <p className="text-xl font-bold text-amber-400 mt-1">{formatBRL(c.preco_final)}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/40 mt-2">
                        {c.entrada_valor > 0 && c.num_parcelas > 1 && !isAVista && (
                          <span>Entrada: {formatBRL(c.entrada_valor)}</span>
                        )}
                        {c.num_parcelas > 1 && <span>{c.num_parcelas}x de {formatBRL(c.valor_parcela)}</span>}
                        {c.taxa_juros_mensal > 0 && <span>Taxa: {formatTaxaMensal(c.taxa_juros_mensal)}</span>}
                        {isAVista && <span>Pagamento à vista</span>}
                      </div>
                    </div>
                    <div className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected ? "border-amber-400 bg-amber-400" : "border-white/20"
                    )}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#0d1117]" />}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{c.payback_meses}m</p>
                        <p className="text-[10px] text-white/40">Payback</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{c.tir_anual?.toFixed(1)}%</p>
                        <p className="text-[10px] text-white/40">TIR anual</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-emerald-400">{formatBRL(c.roi_25_anos)}</p>
                        <p className="text-[10px] text-white/40">ROI 25 anos</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Legacy pagamento opcoes */}
        {!hasCenarios && pagamentoOpcoes.length > 0 && (
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="space-y-3">
            <p className="text-sm font-semibold text-white/60 text-center mb-4">Opções de Pagamento</p>
            {pagamentoOpcoes.map((op, idx) => (
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-sm font-semibold text-white">{op.nome}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-white/40 mt-1">
                  {op.entrada > 0 && op.num_parcelas > 1 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                  {op.num_parcelas > 1 && <span>{op.num_parcelas}x de {formatBRL(op.valor_parcela)}</span>}
                  {op.taxa_mensal > 0 && <span>Taxa: {formatTaxaMensal(op.taxa_mensal)}</span>}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
