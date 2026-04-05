/**
 * ProposalSecuritySection — Trust & guarantee signals.
 * Página pública — exceção RB-02 documentada.
 * RB-17: sem console.log
 */

import { Shield, ClipboardCheck, Wifi, Wrench } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalSecuritySection(_props: LandingSectionProps) {
  const items = [
    {
      icon: <Shield style={{ width: 24, height: 24, color: "#1B3A8C" }} />,
      title: "Engenharia Certificada",
      desc: "Projeto elaborado por engenheiro habilitado com ART/CREA",
    },
    {
      icon: <ClipboardCheck style={{ width: 24, height: 24, color: "#1B3A8C" }} />,
      title: "Homologação Completa",
      desc: "Cuidamos de todo o processo junto à concessionária",
    },
    {
      icon: <Wrench style={{ width: 24, height: 24, color: "#1B3A8C" }} />,
      title: "Garantia Total",
      desc: "Garantia de 25 anos nos módulos e 12 anos no inversor",
    },
    {
      icon: <Wifi style={{ width: 24, height: 24, color: "#1B3A8C" }} />,
      title: "Monitoramento 24/7",
      desc: "Acompanhe a geração do seu sistema em tempo real pelo app",
    },
  ];

  return (
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#fff" }}>
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
            SEGURANÇA E GARANTIAS
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        <StaggerContainer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {items.map((item, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "#F8FAFC", borderRadius: 14, padding: "20px 16px",
                border: "1px solid #E2E8F0",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "rgba(27,58,140,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{
                    fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                    fontSize: "0.85rem", color: "#1B3A8C", margin: 0,
                  }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "4px 0 0", lineHeight: 1.4 }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
