/**
 * ProposalProblemSection — Dramatic before/after comparison.
 * Página pública — exceção RB-02 documentada.
 *
 * Usa useProposalKPIs (motor canônico) para "antes/depois". Sem fallback
 * de tarifa 0,85 nem fórmula consumo×tarifa crua. Se não dá pra calcular,
 * a seção exibe placeholders neutros.
 */

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, AlertTriangle, Sun, ArrowRight } from "lucide-react";
import { AnimatedSection } from "./AnimatedSection";
import type { LandingSectionProps, CenarioData } from "./types";
import { useProposalKPIs } from "../hooks/useProposalKPIs";

interface Props extends LandingSectionProps {
  activeCenario?: CenarioData | null;
}

export function ProposalProblemSection({ snapshot: s, versaoData, activeCenario }: Props) {
  const kpis = useProposalKPIs(s, versaoData, activeCenario ?? null);
  const contaAtual = kpis.contaAtualMensal ?? 0;
  const economiaMensal = kpis.economiaMensal ?? 0;
  const contaDepois = kpis.contaDepoisMensal ?? Math.max(0, contaAtual - economiaMensal);
  const percentEconomia = kpis.percentEconomiaConta ?? 0;
  const economiaAnual = economiaMensal * 12;
  const hasContaAtual = contaAtual > 0;
  const hasEconomia = economiaMensal > 0;
  return (
    <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#EF4444",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <AlertTriangle style={{ width: 13, height: 13 }} />
            O PROBLEMA
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Sua conta de luz está{" "}
            <span style={{ color: "#EF4444" }}>tirando seu dinheiro</span>
          </h2>
          <p style={{ color: "#64748B", fontSize: "1rem", margin: "12px auto 0", maxWidth: 500, lineHeight: 1.6 }}>
            A cada mês, a tarifa sobe e sua conta pesa mais. Veja a diferença com energia solar:
          </p>
        </div>

        {/* Before/After dramatic comparison */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0,
          alignItems: "stretch",
          maxWidth: 720, margin: "0 auto",
        }}>
          {/* ANTES */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              background: "linear-gradient(160deg, #1E293B 0%, #334155 100%)",
              borderRadius: "20px 0 0 20px", padding: "2.5rem 2rem",
              color: "#fff", position: "relative", overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: -40, right: -40, width: 120, height: 120,
              borderRadius: "50%", background: "rgba(239,68,68,0.1)",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(239,68,68,0.2)", borderRadius: 8,
                padding: "4px 12px", marginBottom: 16,
              }}>
                <TrendingUp style={{ width: 14, height: 14, color: "#FCA5A5" }} />
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.7rem", color: "#FCA5A5", letterSpacing: "0.08em" }}>
                  ANTES
                </span>
              </div>
              <p style={{ margin: 0 }}>
                <span style={{ fontSize: "0.85rem", opacity: 0.5 }}>R$ </span>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                  {hasContaAtual ? Math.round(contaAtual).toLocaleString("pt-BR") : "—"}
                </span>
              </p>
              <p style={{ fontSize: "0.82rem", opacity: 0.5, margin: "4px 0 0" }}>/mês na conta de luz</p>
              {hasContaAtual && (
                <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(239,68,68,0.12)", borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#FCA5A5" }}>
                    💸 Em 25 anos: <strong>R$ {Math.round(contaAtual * 12 * 25).toLocaleString("pt-BR")}</strong> jogados fora
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Arrow connector */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(180deg, #F8FAFC, #F1F5F9)",
            padding: "0 8px", zIndex: 2,
          }}>
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, type: "spring" }}
              style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(135deg, #F07B24, #E56D1A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(240,123,36,0.3)",
              }}
            >
              <ArrowRight style={{ width: 22, height: 22, color: "#fff" }} />
            </motion.div>
          </div>

          {/* DEPOIS */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              background: "linear-gradient(160deg, #052E16 0%, #14532D 100%)",
              borderRadius: "0 20px 20px 0", padding: "2.5rem 2rem",
              color: "#fff", position: "relative", overflow: "hidden",
            }}
          >
            <div style={{
              position: "absolute", top: -40, right: -40, width: 120, height: 120,
              borderRadius: "50%", background: "rgba(34,197,94,0.1)",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(34,197,94,0.2)", borderRadius: 8,
                padding: "4px 12px", marginBottom: 16,
              }}>
                <TrendingDown style={{ width: 14, height: 14, color: "#86EFAC" }} />
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.7rem", color: "#86EFAC", letterSpacing: "0.08em" }}>
                  DEPOIS
                </span>
              </div>
              <p style={{ margin: 0 }}>
                <span style={{ fontSize: "0.85rem", opacity: 0.5 }}>R$ </span>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                  {hasEconomia || contaDepois > 0 ? Math.round(contaDepois).toLocaleString("pt-BR") : "—"}
                </span>
              </p>
              <p style={{ fontSize: "0.82rem", opacity: 0.5, margin: "4px 0 0" }}>/mês com energia solar</p>
              {hasEconomia && (
                <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(34,197,94,0.12)", borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#86EFAC" }}>
                    ✅ Em 25 anos: <strong>R$ {Math.round((kpis.economia25Anos ?? economiaAnual * 25)).toLocaleString("pt-BR")}</strong> de economia
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Economia badge */}
        {percentEconomia > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            style={{ textAlign: "center", marginTop: 32 }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #16A34A, #15803D)",
              color: "#fff", padding: "10px 28px", borderRadius: 999,
              fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1rem",
              boxShadow: "0 4px 20px rgba(22,163,74,0.25)",
            }}>
              <Sun style={{ width: 18, height: 18 }} />
              {percentEconomia}% DE ECONOMIA NA SUA CONTA
            </span>
          </motion.div>
        )}
      </div>
    </AnimatedSection>
  );
}
