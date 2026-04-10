/**
 * ProposalAuthoritySection — Company authority/trust signals.
 * Página pública — exceção RB-02 documentada.
 */

import { Award, MapPin, Zap, Users } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalAuthoritySection({ tenantNome, brand }: LandingSectionProps) {
  const stats = [
    { icon: <Award style={{ width: 28, height: 28, color: "#F07B24" }} />, value: "100+", label: "Projetos Realizados" },
    { icon: <Zap style={{ width: 28, height: 28, color: "#F07B24" }} />, value: "2MW+", label: "Potência Instalada" },
    { icon: <MapPin style={{ width: 28, height: 28, color: "#F07B24" }} />, value: "5+", label: "Estados Atendidos" },
    { icon: <Users style={{ width: 28, height: 28, color: "#F07B24" }} />, value: "98%", label: "Satisfação" },
  ];

  return (
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#1B3A8C" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{
          fontFamily: "Montserrat, sans-serif", fontWeight: 800,
          fontSize: "1.2rem", color: "#fff", margin: "0 0 8px",
        }}>
          POR QUE A {(tenantNome || "NOSSA EMPRESA").toUpperCase()}?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", marginBottom: 24 }}>
          Referência em energia solar com projetos de alta qualidade
        </p>

        <StaggerContainer style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {stats.map((stat, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 16px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: "rgba(240,123,36,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  {stat.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                  fontSize: "1.6rem", color: "#F07B24", margin: 0,
                }}>
                  {stat.value}
                </p>
                <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)", margin: "4px 0 0" }}>
                  {stat.label}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
