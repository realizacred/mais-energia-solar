/**
 * ProposalFinancialSection — Dramatic financial analysis.
 * Página pública — exceção RB-02 documentada.
 *
 * Números vêm de useProposalKPIs (motor canônico). Economia 25 anos usa a
 * série real com inflação e perda de eficiência (não mais linear).
 */

import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, Clock, PiggyBank } from "lucide-react";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps, CenarioData } from "./types";
import { useProposalKPIs } from "../hooks/useProposalKPIs";

interface Props extends LandingSectionProps {
  activeCenario: CenarioData | null;
}

export function ProposalFinancialSection({ snapshot: s, versaoData, activeCenario }: Props) {
  const kpis = useProposalKPIs(s, versaoData, activeCenario ?? null);
  const economiaAnual = kpis.economiaAnual ?? 0;
  const economia25anos = kpis.economia25Anos ?? 0;
  const valorTotal = kpis.valorTotal ?? 0;
  const roi = valorTotal > 0 && economia25anos > 0
    ? Math.round(((economia25anos - valorTotal) / valorTotal) * 100)
    : null;

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

  // Série anual REAL (com inflação) quando disponível; fallback nominal só no extremo.
  const serieAnual = kpis.economiaAnualSerie.length > 0
    ? kpis.economiaAnualSerie
    : Array.from({ length: 25 }, () => economiaAnual);
  const bars = Array.from({ length: 5 }, (_, i) => ({
    year: i + 1,
    economia: serieAnual[i] ?? 0,
  }));
  const maxBar = Math.max(...bars.map(b => b.economia), 1);

  const kpisCards = [
    {
      icon: <DollarSign style={{ width: 22, height: 22 }} />,
      value: economiaAnual > 0 ? formatBRL(economiaAnual) : "—",
      label: "Economia no 1° Ano",
      color: "#16A34A",
      bg: "rgba(22,163,74,0.1)",
    },
    {
      icon: <Clock style={{ width: 22, height: 22 }} />,
      value: kpis.paybackAnosLabel ? `${kpis.paybackAnosLabel} anos` : "—",
      label: "Retorno do Investimento",
      color: "#3B82F6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      icon: <PiggyBank style={{ width: 22, height: 22 }} />,
      value: economia25anos > 0 ? formatBRLInteger(economia25anos) : "—",
      label: "Economia em 25 Anos",
      color: "#F07B24",
      bg: "rgba(240,123,36,0.1)",
    },
    {
      icon: <TrendingUp style={{ width: 22, height: 22 }} />,
      value: roi != null ? `${roi}%` : "—",
      label: "Retorno Sobre Investimento",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.1)",
    },
  ];

  return (
    <AnimatedSection style={{
      padding: "5rem 1.5rem",
      background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
      color: "#fff",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(22,163,74,0.15)", border: "1px solid rgba(22,163,74,0.25)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#4ADE80",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <TrendingUp style={{ width: 13, height: 13 }} />
            RESULTADO FINANCEIRO
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#fff",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Seu dinheiro{" "}
            <span style={{ color: "#4ADE80" }}>trabalhando por você</span>
          </h2>
        </div>

        {/* KPI grid */}
        <StaggerContainer style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}>
          {kpis.map((kpi, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)",
                borderRadius: 16, padding: "24px 18px", textAlign: "center",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: kpi.bg, color: kpi.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  {kpi.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                  fontSize: "1.4rem", color: kpi.color, margin: 0,
                }}>
                  {kpi.value}
                </p>
                <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)", margin: "6px 0 0", fontWeight: 500 }}>
                  {kpi.label}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Bar chart */}
        <div ref={barRef} style={{
          background: "rgba(255,255,255,0.04)", borderRadius: 20,
          padding: "28px 24px", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <p style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 700,
            fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", margin: "0 0 20px",
            textAlign: "center",
          }}>
            Economia Projetada por Ano
          </p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, justifyContent: "center", height: 180 }}>
            {bars.map((bar, i) => {
              const heightPct = (bar.economia / maxBar) * 100;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, maxWidth: 80 }}>
                  <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 6 }}>
                    {formatBRLInteger(bar.economia)}
                  </span>
                  <motion.div
                    style={{
                      width: "100%", borderRadius: "8px 8px 0 0",
                      background: `linear-gradient(180deg, ${i < 2 ? "#3B82F6" : "#F07B24"}, ${i < 2 ? "#1D4ED8" : "#EA580C"})`,
                    }}
                    initial={{ height: 0 }}
                    animate={barVisible ? { height: `${heightPct}%` } : { height: 0 }}
                    transition={{ duration: 0.8, delay: i * 0.12, ease: "easeOut" }}
                  />
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", fontWeight: 600, marginTop: 8 }}>
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
