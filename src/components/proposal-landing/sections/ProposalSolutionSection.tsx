/**
 * ProposalSolutionSection — System specs grid.
 * Página pública — exceção RB-02 documentada.
 */

import { Sun, Zap, LayoutGrid } from "lucide-react";
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
      icon: <Sun style={{ width: 24, height: 24, color: "#F07B24" }} />,
      value: `${potKwp.toFixed(2).replace(".", ",")}`,
      suffix: "kWp",
      label: "Potência",
    },
    {
      icon: <Zap style={{ width: 24, height: 24, color: "#F07B24" }} />,
      value: geracaoBase.toLocaleString("pt-BR"),
      suffix: "kWh/mês",
      label: "Geração Média",
    },
    {
      icon: <LayoutGrid style={{ width: 24, height: 24, color: "#F07B24" }} />,
      value: `${totalModulos}`,
      suffix: `Painéis + ${totalInversores > 0 ? "Inversor" : ""}`,
      label: `${totalModulos} Painéis + Inversor`,
    },
  ];

  return (
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Title */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          marginBottom: 24,
        }}>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 800,
            fontSize: "1.1rem", color: "#1B3A8C", margin: 0, textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            SEU SISTEMA SOLAR
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        {/* Specs grid */}
        <StaggerContainer style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {specs.map((spec, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "#fff", borderRadius: 12, padding: "20px 12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid #E2E8F0",
                textAlign: "center",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, background: "rgba(240,123,36,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  {spec.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                  fontSize: "1.5rem", color: "#1B3A8C", margin: 0,
                }}>
                  {spec.value}
                  <span style={{ fontSize: "0.6em", fontWeight: 600, color: "#64748B" }}> {spec.suffix}</span>
                </p>
                <p style={{ fontSize: "0.72rem", color: "#64748B", margin: "4px 0 0" }}>{spec.label}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
