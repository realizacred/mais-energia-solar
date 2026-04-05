/**
 * ProposalFinancialSection — Financial analysis with animated chart.
 * Página pública — exceção RB-02 documentada.
 * RB-17: sem console.log
 */

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp } from "lucide-react";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps, CenarioData } from "./types";

interface Props extends LandingSectionProps {
  activeCenario: CenarioData | null;
}

export function ProposalFinancialSection({ snapshot: s, versaoData, activeCenario }: Props) {
  const economiaMensal = versaoData.economia_mensal ?? s.economiaMensal ?? 0;
  const valorTotal = activeCenario?.preco_final ?? versaoData.valor_total ?? 0;
  const paybackMeses = activeCenario?.payback_meses ?? versaoData.payback_meses ?? s.paybackMeses ?? 0;
  const economiaAnual = economiaMensal * 12;
  const contaAtual = economiaMensal * 1.2;
  const contaDepois = Math.max(50, contaAtual - economiaMensal);
  const percentualEconomia = contaAtual > 0 ? Math.round((economiaMensal / contaAtual) * 100) : 80;

  // Animated bar chart
  const [barVisible, setBarVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barRef.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setBarVisible(true);
    }, { threshold: 0.3 });
    obs.observe(barRef.current);
    return () => obs.disconnect();
  }, []);

  // Simple bar data (5 years projected)
  const bars = Array.from({ length: 5 }, (_, i) => ({
    year: i + 1,
    economia: economiaAnual * Math.pow(1.06, i),
  }));
  const maxBar = Math.max(...bars.map(b => b.economia));

  return (
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 800,
            fontSize: "1.1rem", color: "#1B3A8C", margin: 0, textTransform: "uppercase",
          }}>
            ECONOMIA PROJETADA
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        {/* Economia badge */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{
            background: "#16A34A", color: "#fff", padding: "6px 20px", borderRadius: 20,
            fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "0.9rem",
          }}>
            {percentualEconomia}% DE ECONOMIA
          </span>
        </div>

        {/* Before/After bar comparison */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, justifyContent: "center", marginBottom: 24 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#1B3A8C", fontSize: "0.85rem", margin: 0 }}>
              R$ {Math.round(contaAtual).toLocaleString("pt-BR")}<span style={{ fontSize: "0.7em", fontWeight: 500 }}>/mês</span>
            </p>
            <div style={{
              width: 80, height: 120, background: "linear-gradient(180deg, #1E40AF, #3B82F6)",
              borderRadius: "8px 8px 0 0", marginTop: 8,
            }} />
            <p style={{ fontSize: "0.7rem", color: "#64748B", margin: "4px 0 0", fontWeight: 600 }}>ANTES</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F07B24", fontSize: "0.85rem", margin: 0 }}>
              R$ {Math.round(contaDepois).toLocaleString("pt-BR")}<span style={{ fontSize: "0.7em", fontWeight: 500 }}>/mês</span>
            </p>
            <div style={{
              width: 80, height: 40, background: "linear-gradient(180deg, #EA580C, #F97316)",
              borderRadius: "8px 8px 0 0", marginTop: 8,
            }} />
            <p style={{ fontSize: "0.7rem", color: "#64748B", margin: "4px 0 0", fontWeight: 600 }}>DEPOIS</p>
          </div>
        </div>

        {/* Annual projections */}
        <StaggerContainer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <StaggerItem>
            <div style={{
              background: "#fff", borderRadius: 12, padding: "20px", textAlign: "center",
              border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0, fontWeight: 600 }}>EM 1 ANO</p>
              <p style={{ fontSize: "0.7rem", color: "#94A3B8", margin: "2px 0 8px" }}>Economia Anual</p>
              <p style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                fontSize: "1.4rem", color: "#1B3A8C", margin: 0,
              }}>
                R$ {Math.round(economiaAnual).toLocaleString("pt-BR")}
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div style={{
              background: "#fff", borderRadius: 12, padding: "20px", textAlign: "center",
              border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <p style={{ fontSize: "0.75rem", color: "#64748B", margin: 0, fontWeight: 600 }}>EM 5 ANOS</p>
              <p style={{ fontSize: "0.7rem", color: "#94A3B8", margin: "2px 0 8px" }}>Retorno Total</p>
              <p style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                fontSize: "1.4rem", color: "#16A34A", margin: 0,
              }}>
                R$ {Math.round(bars.reduce((a, b) => a + b.economia, 0)).toLocaleString("pt-BR")}
              </p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Animated bar chart */}
        <div ref={barRef} style={{
          marginTop: 24, background: "#fff", borderRadius: 12,
          padding: "20px", border: "1px solid #E2E8F0",
        }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, justifyContent: "center", height: 160 }}>
            {bars.map((bar, i) => {
              const heightPct = (bar.economia / maxBar) * 100;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <span style={{ fontSize: "0.6rem", color: "#64748B", fontWeight: 600, marginBottom: 4 }}>
                    {formatBRLInteger(bar.economia)}
                  </span>
                  <motion.div
                    style={{
                      width: "100%", maxWidth: 60, borderRadius: "6px 6px 0 0",
                      background: i < 2 ? "linear-gradient(180deg, #1E40AF, #3B82F6)" : "linear-gradient(180deg, #EA580C, #F97316)",
                    }}
                    initial={{ height: 0 }}
                    animate={barVisible ? { height: `${heightPct}%` } : { height: 0 }}
                    transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
                  />
                  <span style={{ fontSize: "0.65rem", color: "#64748B", fontWeight: 600, marginTop: 4 }}>
                    Ano {bar.year}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
