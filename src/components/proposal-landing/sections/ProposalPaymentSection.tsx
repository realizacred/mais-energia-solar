/**
 * ProposalPaymentSection — Payment options with premium card design.
 * Página pública — exceção RB-02 documentada.
 */

import { CreditCard, Check, Star } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps, CenarioData } from "./types";

interface Props extends LandingSectionProps {
  cenarios: CenarioData[];
  selectedCenario: string | null;
  onSelectCenario: (id: string) => void;
}

export function ProposalPaymentSection({ snapshot: s, versaoData, cenarios, selectedCenario, onSelectCenario }: Props) {
  const valorTotal = versaoData.valor_total ?? 0;

  return (
    <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(240,123,36,0.08)", border: "1px solid rgba(240,123,36,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F07B24",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <CreditCard style={{ width: 13, height: 13 }} />
            INVESTIMENTO
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Condições que{" "}
            <span style={{ color: "#F07B24" }}>cabem no seu bolso</span>
          </h2>
        </div>

        {cenarios.length > 0 ? (
          <StaggerContainer style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}>
            {cenarios.map(c => {
              const isSelected = selectedCenario === c.id;
              return (
                <StaggerItem key={c.id}>
                  <button
                    onClick={() => onSelectCenario(c.id)}
                    style={{
                      width: "100%", textAlign: "left", cursor: "pointer",
                      border: isSelected ? "2px solid #F07B24" : "1px solid rgba(0,0,0,0.06)",
                      background: isSelected ? "rgba(240,123,36,0.03)" : "#fff",
                      borderRadius: 20, padding: "28px 24px",
                      boxShadow: isSelected
                        ? "0 8px 32px rgba(240,123,36,0.12)"
                        : "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
                      transition: "all 0.25s",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {c.is_default && (
                      <div style={{
                        position: "absolute", top: 12, right: 12,
                        display: "flex", alignItems: "center", gap: 4,
                        background: "rgba(240,123,36,0.1)", borderRadius: 999,
                        padding: "3px 10px", fontSize: "0.65rem",
                        fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F07B24",
                      }}>
                        <Star style={{ width: 11, height: 11, fill: "#F07B24" }} />
                        RECOMENDADO
                      </div>
                    )}
                    <p style={{
                      fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                      color: "#0F172A", fontSize: "1rem", margin: "0 0 12px",
                    }}>
                      {c.nome}
                    </p>
                    <p style={{
                      fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                      color: "#F07B24", fontSize: "1.8rem", margin: "0 0 4px",
                    }}>
                      {formatBRL(c.preco_final)}
                    </p>
                    {c.num_parcelas > 0 && (
                      <p style={{ fontSize: "0.85rem", color: "#64748B", margin: "0 0 4px" }}>
                        ou {c.num_parcelas}x de <strong style={{ color: "#0F172A" }}>{formatBRL(c.valor_parcela)}</strong>
                      </p>
                    )}
                    {c.entrada_valor > 0 && (
                      <p style={{ fontSize: "0.78rem", color: "#94A3B8", margin: 0 }}>
                        Entrada: {formatBRL(c.entrada_valor)}
                      </p>
                    )}
                    {isSelected && (
                      <div style={{
                        position: "absolute", bottom: 12, right: 12,
                        width: 28, height: 28, borderRadius: "50%",
                        background: "#F07B24", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check style={{ width: 16, height: 16 }} />
                      </div>
                    )}
                  </button>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        ) : s.pagamentoOpcoes.length > 0 ? (
          <StaggerContainer style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}>
            {s.pagamentoOpcoes.map(p => (
              <StaggerItem key={p.id}>
                <div style={{
                  background: "#fff", borderRadius: 20, padding: "28px 24px",
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
                }}>
                  <p style={{
                    fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                    color: "#0F172A", fontSize: "0.95rem", margin: "0 0 8px",
                  }}>
                    {p.nome}
                  </p>
                  {p.num_parcelas > 0 && (
                    <p style={{ fontSize: "0.85rem", color: "#64748B", margin: "0 0 4px" }}>
                      {p.num_parcelas}x de <strong>{formatBRL(p.valor_parcela)}</strong>
                    </p>
                  )}
                  {p.entrada > 0 && (
                    <p style={{ fontSize: "0.78rem", color: "#94A3B8", margin: 0 }}>
                      Entrada: {formatBRL(p.entrada)}
                    </p>
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 20, padding: "40px 32px", textAlign: "center",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
          }}>
            <p style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 900,
              fontSize: "2.2rem", color: "#F07B24", margin: 0,
            }}>
              {formatBRL(valorTotal)}
            </p>
            <p style={{ fontSize: "0.9rem", color: "#64748B", margin: "8px 0 0" }}>Valor do investimento</p>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
