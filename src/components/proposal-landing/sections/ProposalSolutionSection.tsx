/**
 * ProposalSolutionSection — System specs showcase with dramatic visuals.
 * Página pública — exceção RB-02 documentada.
 */

import { Sun, Zap, LayoutGrid, BatteryCharging } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalSolutionSection({ snapshot: s, versaoData }: LandingSectionProps) {
  const potKwp = s.potenciaKwp || versaoData.potencia_kwp || 0;
  const geracaoBase = s.geracaoMensalEstimada > 0
    ? s.geracaoMensalEstimada
    : potKwp > 0 ? Math.round(potKwp * 4.5 * 30 * 0.8) : 0;

  const modulos = s.itens.filter(i => i.categoria === "modulo" || i.categoria === "modulos");
  const inversores = s.itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");
  const totalModulos = modulos.reduce((a, m) => a + m.quantidade, 0);
  const totalInversores = inversores.reduce((a, m) => a + m.quantidade, 0);

  const specs = [
    {
      icon: <Zap style={{ width: 28, height: 28 }} />,
      value: `${potKwp.toFixed(2).replace(".", ",")}`,
      suffix: "kWp",
      label: "Potência Instalada",
      color: "#F07B24",
      bg: "rgba(240,123,36,0.1)",
    },
    {
      icon: <BatteryCharging style={{ width: 28, height: 28 }} />,
      value: geracaoBase.toLocaleString("pt-BR"),
      suffix: "kWh/mês",
      label: "Geração Estimada",
      color: "#3B82F6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      icon: <LayoutGrid style={{ width: 28, height: 28 }} />,
      value: `${totalModulos}`,
      suffix: "painéis",
      label: "Módulos Fotovoltaicos",
      color: "#8B5CF6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      icon: <Sun style={{ width: 28, height: 28 }} />,
      value: `${totalInversores}`,
      suffix: totalInversores === 1 ? "inversor" : "inversores",
      label: "Inversor Solar",
      color: "#16A34A",
      bg: "rgba(22,163,74,0.1)",
    },
  ];

  return (
    <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#3B82F6",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <Zap style={{ width: 13, height: 13 }} />
            A SOLUÇÃO
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Seu sistema solar{" "}
            <span style={{ color: "#F07B24" }}>sob medida</span>
          </h2>
          <p style={{ color: "#64748B", fontSize: "1rem", margin: "12px auto 0", maxWidth: 480, lineHeight: 1.6 }}>
            Projetado especificamente para o seu consumo e localização.
          </p>
        </div>

        {/* Specs grid */}
        <StaggerContainer style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
        }}>
          {specs.map((spec, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "#fff", borderRadius: 20, padding: "28px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
                textAlign: "center", position: "relative", overflow: "hidden",
                transition: "all 0.3s",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: spec.color,
                }} />
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: spec.bg, color: spec.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  {spec.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                  fontSize: "1.8rem", color: "#0F172A", margin: 0, lineHeight: 1,
                }}>
                  {spec.value}
                </p>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 600, fontSize: "0.78rem", color: spec.color, margin: "4px 0 0" }}>
                  {spec.suffix}
                </p>
                <p style={{ fontSize: "0.72rem", color: "#94A3B8", margin: "8px 0 0", fontWeight: 500 }}>{spec.label}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
