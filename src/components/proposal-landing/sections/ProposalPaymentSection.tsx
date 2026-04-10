/**
 * ProposalPaymentSection — Payment options with scenario selection.
 * Página pública — exceção RB-02 documentada.
 */

import { CreditCard, Banknote } from "lucide-react";
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
    <AnimatedSection style={{ padding: "2.5rem 1rem", background: "#F8FAFC" }}>
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
            FORMAS DE PAGAMENTO
          </h2>
          <div style={{ flex: 1, height: 1, background: "#E2E8F0" }} />
        </div>

        {cenarios.length > 0 ? (
          <StaggerContainer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {cenarios.map(c => (
              <StaggerItem key={c.id}>
                <button
                  onClick={() => onSelectCenario(c.id)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    border: selectedCenario === c.id ? "2px solid #1B3A8C" : "1px solid #E2E8F0",
                    background: selectedCenario === c.id ? "rgba(27,58,140,0.04)" : "#fff",
                    borderRadius: 14, padding: "18px 16px",
                    boxShadow: selectedCenario === c.id ? "0 4px 16px rgba(27,58,140,0.1)" : "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "all 0.2s",
                  }}
                >
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#1B3A8C", fontSize: "0.9rem", margin: 0 }}>
                    {c.nome}
                  </p>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, color: "#F07B24", fontSize: "1.3rem", margin: "8px 0 4px" }}>
                    {formatBRL(c.preco_final)}
                  </p>
                  {c.num_parcelas > 0 && (
                    <p style={{ fontSize: "0.78rem", color: "#64748B", margin: 0 }}>
                      {c.num_parcelas}x de {formatBRL(c.valor_parcela)}
                    </p>
                  )}
                  {c.entrada_valor > 0 && (
                    <p style={{ fontSize: "0.72rem", color: "#94A3B8", margin: "4px 0 0" }}>
                      Entrada: {formatBRL(c.entrada_valor)}
                    </p>
                  )}
                </button>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : s.pagamentoOpcoes.length > 0 ? (
          <StaggerContainer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {s.pagamentoOpcoes.map(p => (
              <StaggerItem key={p.id}>
                <div style={{
                  background: "#fff", borderRadius: 14, padding: "18px 16px",
                  border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}>
                  <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#1B3A8C", fontSize: "0.85rem", margin: 0 }}>
                    {p.nome}
                  </p>
                  {p.num_parcelas > 0 && (
                    <p style={{ fontSize: "0.8rem", color: "#64748B", margin: "6px 0 0" }}>
                      {p.num_parcelas}x de {formatBRL(p.valor_parcela)}
                    </p>
                  )}
                  {p.entrada > 0 && (
                    <p style={{ fontSize: "0.75rem", color: "#94A3B8", margin: "4px 0 0" }}>
                      Entrada: {formatBRL(p.entrada)}
                    </p>
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "24px", textAlign: "center",
            border: "1px solid #E2E8F0",
          }}>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 900, fontSize: "1.6rem", color: "#1B3A8C", margin: 0 }}>
              {formatBRL(valorTotal)}
            </p>
            <p style={{ fontSize: "0.8rem", color: "#64748B", margin: "4px 0 0" }}>Valor do investimento</p>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
