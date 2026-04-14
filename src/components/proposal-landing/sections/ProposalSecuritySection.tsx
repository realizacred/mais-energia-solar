/**
 * ProposalSecuritySection — Trust & guarantee signals with premium layout.
 * Página pública — exceção RB-02 documentada.
 */

import { Shield, ClipboardCheck, Wifi, Wrench, CheckCircle2 } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalSecuritySection(_props: LandingSectionProps) {
  const items = [
    {
      icon: <Shield style={{ width: 26, height: 26 }} />,
      title: "Engenharia Certificada",
      desc: "Projeto elaborado por engenheiro habilitado com ART/CREA registrado",
      color: "#1D4ED8",
    },
    {
      icon: <ClipboardCheck style={{ width: 26, height: 26 }} />,
      title: "Homologação Completa",
      desc: "Cuidamos de todo o processo burocrático junto à concessionária",
      color: "#7C3AED",
    },
    {
      icon: <Wrench style={{ width: 26, height: 26 }} />,
      title: "Garantia Estendida",
      desc: "25 anos nos módulos fotovoltaicos e 12 anos no inversor solar",
      color: "#16A34A",
    },
    {
      icon: <Wifi style={{ width: 26, height: 26 }} />,
      title: "Monitoramento 24/7",
      desc: "Acompanhe a geração do seu sistema em tempo real pelo aplicativo",
      color: "#F07B24",
    },
  ];

  return (
    <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#16A34A",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <CheckCircle2 style={{ width: 13, height: 13 }} />
            GARANTIAS
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Sua tranquilidade é{" "}
            <span style={{ color: "#16A34A" }}>nossa prioridade</span>
          </h2>
        </div>

        <StaggerContainer style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
        }}>
          {items.map((item, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "#fff", borderRadius: 20, padding: "28px 22px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
                position: "relative", overflow: "hidden",
                transition: "all 0.3s",
              }}>
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: item.color,
                }} />
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `${item.color}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16, color: item.color,
                }}>
                  {item.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 800,
                  fontSize: "0.95rem", color: "#0F172A", margin: "0 0 8px",
                }}>
                  {item.title}
                </p>
                <p style={{ fontSize: "0.82rem", color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                  {item.desc}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
