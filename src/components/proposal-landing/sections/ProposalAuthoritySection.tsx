/**
 * ProposalAuthoritySection — Company trust signals with premium design.
 * Página pública — exceção RB-02 documentada.
 */

import { Award, MapPin, Zap, Users, Shield, Star } from "lucide-react";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

export function ProposalAuthoritySection({ tenantNome, brand }: LandingSectionProps) {
  const stats = [
    { icon: <Award style={{ width: 28, height: 28 }} />, value: "100+", label: "Projetos\nRealizados", color: "#F07B24" },
    { icon: <Zap style={{ width: 28, height: 28 }} />, value: "2MW+", label: "Potência\nInstalada", color: "#3B82F6" },
    { icon: <MapPin style={{ width: 28, height: 28 }} />, value: "5+", label: "Estados\nAtendidos", color: "#8B5CF6" },
    { icon: <Star style={{ width: 28, height: 28 }} />, value: "98%", label: "Clientes\nSatisfeitos", color: "#16A34A" },
  ];

  return (
    <AnimatedSection style={{
      padding: "5rem 1.5rem",
      background: "linear-gradient(165deg, #0B1D3A 0%, #132F5C 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: "-20%", left: "-10%", width: "40vw", height: "40vw",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(240,123,36,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        {brand?.logo_white_url && (
          <img
            src={brand.logo_white_url}
            alt={tenantNome || ""}
            style={{ height: 48, objectFit: "contain", marginBottom: 20, opacity: 0.7 }}
          />
        )}

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(240,123,36,0.15)", border: "1px solid rgba(240,123,36,0.25)",
          borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
          fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F9A855",
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
        }}>
          <Shield style={{ width: 13, height: 13 }} />
          CONFIANÇA
        </span>

        <h2 style={{
          fontFamily: "Montserrat, sans-serif", fontWeight: 900,
          fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#fff",
          margin: "12px 0 0", lineHeight: 1.2,
        }}>
          Por que a{" "}
          <span style={{ color: "#F9A855" }}>{tenantNome || "nossa empresa"}</span>?
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1rem", margin: "12px auto 0", maxWidth: 460 }}>
          Referência em energia solar com projetos de alta qualidade e satisfação total.
        </p>

        {/* Stats grid */}
        <StaggerContainer style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16, marginTop: 40,
        }}>
          {stats.map((stat, i) => (
            <StaggerItem key={i}>
              <div style={{
                background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)",
                borderRadius: 20, padding: "28px 16px",
                border: "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.3s",
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: `${stat.color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", color: stat.color,
                }}>
                  {stat.icon}
                </div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                  fontSize: "2rem", color: stat.color, margin: 0, lineHeight: 1,
                }}>
                  {stat.value}
                </p>
                <p style={{
                  fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", margin: "8px 0 0",
                  whiteSpace: "pre-line", lineHeight: 1.4,
                }}>
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
