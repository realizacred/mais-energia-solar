/**
 * ProposalProblemSection — "Sua Conta Atual" before/after comparison.
 * Página pública — exceção RB-02 documentada.
 */

import { motion } from "framer-motion";
import { TrendingUp, Sun } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalProblemSection({ snapshot: s, versaoData }: LandingSectionProps) {
  const consumo = s.consumoTotal || 0;
  const tarifa = s.ucs[0]?.tarifa_distribuidora ?? 0.85;
  const contaAtual = tarifa > 0 && consumo > 0 ? consumo * tarifa : versaoData.economia_mensal * 1.2;
  const contaDepois = Math.max(50, contaAtual - (versaoData.economia_mensal ?? 0));

  return (
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#fff" }}>
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
            SUA CONTA ATUAL
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        {/* Before / After cards */}
        <StaggerContainer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* ANTES */}
          <StaggerItem>
            <div style={{
              background: "linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)",
              borderRadius: 16, padding: "1.5rem", color: "#fff", position: "relative",
              overflow: "hidden", minHeight: 180,
            }}>
              <div style={{
                position: "absolute", top: -20, right: -20, width: 120, height: 120,
                borderRadius: "50%", background: "rgba(255,255,255,0.08)",
              }} />
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginBottom: 16,
              }}>
                <div style={{ width: 30, height: 2, background: "rgba(255,255,255,0.4)" }} />
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.1em" }}>
                  ANTES
                </span>
                <div style={{ width: 30, height: 2, background: "rgba(255,255,255,0.4)" }} />
              </div>
              <p style={{ margin: 0, textAlign: "center" }}>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>R$ </span>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "2.2rem" }}>
                  {Math.round(contaAtual).toLocaleString("pt-BR")}
                </span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>/mês</span>
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "8px 0 0", textAlign: "center" }}>Sua Conta Atual</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12 }}>
                <TrendingUp style={{ width: 14, height: 14, color: "#FCA5A5" }} />
                <span style={{ fontSize: "0.72rem", color: "#FCA5A5" }}>Aumentos na Tarifa</span>
              </div>
            </div>
          </StaggerItem>

          {/* DEPOIS */}
          <StaggerItem>
            <div style={{
              background: "linear-gradient(135deg, #EA580C 0%, #F97316 100%)",
              borderRadius: 16, padding: "1.5rem", color: "#fff", position: "relative",
              overflow: "hidden", minHeight: 180,
            }}>
              <div style={{
                position: "absolute", top: -20, right: -20, width: 120, height: 120,
                borderRadius: "50%", background: "rgba(255,255,255,0.08)",
              }} />
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                marginBottom: 16,
              }}>
                <div style={{ width: 30, height: 2, background: "rgba(255,255,255,0.4)" }} />
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.1em" }}>
                  DEPOIS
                </span>
                <div style={{ width: 30, height: 2, background: "rgba(255,255,255,0.4)" }} />
              </div>
              <p style={{ margin: 0, textAlign: "center" }}>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>R$ </span>
                <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "2.2rem" }}>
                  {Math.round(contaDepois).toLocaleString("pt-BR")}
                </span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>/mês</span>
              </p>
              <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "8px 0 0", textAlign: "center" }}>Após Instalação</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12 }}>
                <Sun style={{ width: 14, height: 14, color: "#FEF08A" }} />
                <span style={{ fontSize: "0.72rem", color: "#FEF08A" }}>Independência Energética</span>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </AnimatedSection>
  );
}
