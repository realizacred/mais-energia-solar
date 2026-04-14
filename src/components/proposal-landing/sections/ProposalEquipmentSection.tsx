/**
 * ProposalEquipmentSection — Premium equipment showcase.
 * Página pública — exceção RB-02 documentada.
 */

import { Cpu, CheckCircle2, Package } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalEquipmentSection({ snapshot: s }: LandingSectionProps) {
  const getCategoryLabel = (cat: string) => {
    if (cat === "modulo" || cat === "modulos") return "Módulo Fotovoltaico";
    if (cat === "inversor" || cat === "inversores") return "Inversor Solar";
    if (cat === "estrutura" || cat === "estruturas") return "Estrutura de Fixação";
    return cat;
  };

  const getCategoryIcon = (cat: string) => {
    if (cat === "modulo" || cat === "modulos") return "☀️";
    if (cat === "inversor" || cat === "inversores") return "⚡";
    return "🔧";
  };

  return (
    <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#8B5CF6",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <Cpu style={{ width: 13, height: 13 }} />
            TECNOLOGIA
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Equipamentos de{" "}
            <span style={{ color: "#8B5CF6" }}>primeira linha</span>
          </h2>
        </div>

        {/* Equipment cards */}
        <StaggerContainer style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {s.itens.map((item, idx) => (
            <StaggerItem key={item.id}>
              <div style={{
                borderRadius: 20, overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
                border: "1px solid rgba(0,0,0,0.04)",
                background: "#fff",
              }}>
                {/* Header gradient */}
                <div style={{
                  background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
                  color: "#fff", padding: "16px 24px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <span style={{ fontSize: "1.6rem" }}>{getCategoryIcon(item.categoria)}</span>
                  <div>
                    <p style={{
                      fontFamily: "Montserrat, sans-serif", fontWeight: 800,
                      fontSize: "0.95rem", margin: 0,
                    }}>
                      {getCategoryLabel(item.categoria)}
                    </p>
                    <p style={{ fontSize: "0.72rem", opacity: 0.5, margin: "2px 0 0" }}>
                      {item.fabricante} — {item.modelo}
                    </p>
                  </div>
                </div>

                {/* Specs */}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Fabricante", value: item.fabricante },
                      { label: "Modelo", value: item.modelo },
                      { label: "Potência", value: item.potencia_w > 0 ? `${item.potencia_w}W` : null },
                      { label: "Quantidade", value: `${item.quantidade} un.` },
                    ].filter(r => r.value).map(row => (
                      <div key={row.label} style={{
                        padding: "12px 14px", background: "#F8FAFC",
                        borderRadius: 10,
                      }}>
                        <p style={{ fontSize: "0.68rem", color: "#94A3B8", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {row.label}
                        </p>
                        <p style={{
                          fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                          color: "#0F172A", fontSize: "0.9rem", margin: "4px 0 0",
                        }}>
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Included services */}
        {s.servicos.filter(sv => sv.incluso_no_preco).length > 0 && (
          <div style={{
            marginTop: 24, padding: "20px 24px",
            background: "linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)",
            borderRadius: 16, border: "1px solid #BBF7D0",
          }}>
            <p style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              color: "#15803D", fontSize: "0.88rem", margin: "0 0 12px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Package style={{ width: 18, height: 18 }} />
              Inclusos na proposta:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {s.servicos.filter(sv => sv.incluso_no_preco).map(sv => (
                <div key={sv.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 style={{ width: 15, height: 15, color: "#16A34A", flexShrink: 0 }} />
                  <span style={{ color: "#166534", fontSize: "0.82rem" }}>{sv.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
