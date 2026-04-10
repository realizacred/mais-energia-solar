/**
 * ProposalEquipmentSection — Equipment showcase.
 * Página pública — exceção RB-02 documentada.
 */

import { Wrench, Shield } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalEquipmentSection({ snapshot: s }: LandingSectionProps) {
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
            EQUIPAMENTOS
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        <StaggerContainer style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {s.itens.map((item, idx) => (
            <StaggerItem key={item.id}>
              <div style={{
                borderRadius: 14, overflow: "hidden",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0",
              }}>
                {/* Header */}
                <div style={{
                  background: "linear-gradient(135deg, #1B3A8C 0%, #2451B3 100%)",
                  color: "#fff", padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", background: "#F07B24",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "0.8rem",
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>
                    {item.categoria === "modulo" || item.categoria === "modulos" ? "Módulo Fotovoltaico" :
                     item.categoria === "inversor" || item.categoria === "inversores" ? "Inversor Solar" :
                     item.descricao || item.categoria}
                  </span>
                </div>
                {/* Body */}
                <div style={{ padding: "14px 16px" }}>
                  {[
                    { label: "Fabricante", value: item.fabricante },
                    { label: "Modelo", value: item.modelo },
                    { label: "Potência", value: item.potencia_w > 0 ? `${item.potencia_w}W` : null },
                    { label: "Quantidade", value: String(item.quantidade) },
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} style={{
                      display: "flex", justifyContent: "space-between", padding: "8px 0",
                      borderBottom: "1px solid #F1F5F9",
                    }}>
                      <span style={{ color: "#64748B", fontSize: "0.82rem" }}>{row.label}</span>
                      <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#1B3A8C", fontSize: "0.85rem" }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Included services */}
        {s.servicos.filter(sv => sv.incluso_no_preco).length > 0 && (
          <div style={{ marginTop: 20, padding: "16px 20px", background: "#F0FDF4", borderRadius: 12, border: "1px solid #BBF7D0" }}>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#16A34A", fontSize: "0.85rem", margin: "0 0 8px" }}>
              ✓ Inclusos na proposta:
            </p>
            {s.servicos.filter(sv => sv.incluso_no_preco).map(sv => (
              <p key={sv.id} style={{ color: "#16A34A", fontSize: "0.8rem", margin: "4px 0", paddingLeft: 12 }}>
                • {sv.descricao}
              </p>
            ))}
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
