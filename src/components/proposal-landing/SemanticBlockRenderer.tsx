/**
 * SemanticBlockRenderer.tsx — React components for semantic proposal blocks.
 *
 * Instead of rendering raw HTML via dangerouslySetInnerHTML,
 * semantic blocks render proper React components with CSS var theming.
 *
 * All styles use CSS variables from landingThemes.ts + brandBridge.ts.
 * Página pública — exceção RB-02 documentada.
 */

import type { BlockStyle } from "@/components/admin/proposal-builder/types";

interface SemanticProps {
  variables: Record<string, string>;
  style?: BlockStyle;
}

/* ─── Helper ────────────────────────────────────────── */
function v(vars: Record<string, string>, key: string, fallback = ""): string {
  return vars[key] ?? fallback;
}

function formatNumber(val: string): string {
  if (!val) return "0";
  const num = parseFloat(val.replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) return val;
  return num.toLocaleString("pt-BR");
}

/* ═══════════════════════════════════════════════════════
   HERO BLOCK — Premium header with logo, greeting, KPIs
   ═══════════════════════════════════════════════════════ */
export function ProposalHeroBlock({ variables: vars }: SemanticProps) {
  const logoUrl = v(vars, "empresa_logo_url") || v(vars, "logo_url");
  const logoWhiteUrl = v(vars, "logo_white_url");
  const displayLogo = logoWhiteUrl || logoUrl;
  const empresaNome = v(vars, "empresa_nome", "Energia Solar");
  const clienteNome = v(vars, "cliente_nome", "Cliente");
  const cidade = v(vars, "cliente_cidade") || v(vars, "cidade");
  const estado = v(vars, "cliente_estado") || v(vars, "estado");

  return (
    <div style={{
      background: "var(--hero-bg, linear-gradient(135deg, #1B3A8C, #0D2460))",
      padding: "clamp(48px, 8vw, 80px) 24px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative circles */}
      <div style={{
        position: "absolute", top: -100, right: -100, width: 300, height: 300,
        borderRadius: "50%", background: "var(--hero-overlay, rgba(255,255,255,0.05))",
        border: "1px solid var(--hero-overlay-border, rgba(255,255,255,0.08))",
      }} />
      <div style={{
        position: "absolute", bottom: -60, left: -60, width: 200, height: 200,
        borderRadius: "50%", background: "var(--hero-overlay, rgba(255,255,255,0.03))",
      }} />

      <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Logo — prominent, centered, larger */}
        {displayLogo ? (
          <div style={{
            marginBottom: 28,
            display: "flex",
            justifyContent: "center",
          }}>
            <div style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              borderRadius: 16,
              padding: "16px 32px",
              border: "1px solid rgba(255,255,255,0.15)",
            }}>
              <img
                src={displayLogo}
                alt={empresaNome}
                style={{ height: 56, maxWidth: 260, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: 28,
            display: "flex",
            justifyContent: "center",
          }}>
            <div style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              borderRadius: 16,
              padding: "14px 28px",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
              fontWeight: 800,
              fontSize: "1.2rem",
              color: "var(--hero-text, #fff)",
              letterSpacing: "0.05em",
            }}>
              {empresaNome}
            </div>
          </div>
        )}

        {/* Subtitle */}
        <p style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
          color: "var(--hero-muted, rgba(255,255,255,0.4))",
          fontWeight: 700, margin: "0 0 16px",
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
        }}>
          Proposta Comercial Personalizada
        </p>

        {/* Main heading */}
        <h1 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
          fontWeight: 900,
          color: "var(--hero-text, #fff)",
          margin: "0 0 12px",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
        }}>
          Olá, <span style={{ color: "var(--la, #F07B24)" }}>{clienteNome}</span>!
        </h1>

        {cidade && (
          <p style={{
            fontSize: "1.05rem",
            color: "var(--hero-muted, rgba(255,255,255,0.55))",
            margin: 0, lineHeight: 1.7,
          }}>
            Solução exclusiva de energia solar para{" "}
            <strong style={{ color: "var(--hero-text, rgba(255,255,255,0.8))" }}>
              {cidade}{estado ? `/${estado}` : ""}
            </strong>
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KPI CARDS BLOCK — Key metrics in glass-morphism cards
   ═══════════════════════════════════════════════════════ */
export function ProposalKpisBlock({ variables: vars }: SemanticProps) {
  const kpis = [
    { icon: "⚡", label: "Potência", value: v(vars, "potencia_kwp", "0"), suffix: " kWp", color: "var(--la, #F07B24)" },
    { icon: "💰", label: "Economia/mês", value: `R$ ${v(vars, "economia_mensal", "0")}`, suffix: "", color: "var(--verde, #22C55E)" },
    { icon: "🔋", label: "Geração Mensal", value: v(vars, "geracao_mensal", "0"), suffix: " kWh", color: "var(--la, #F07B24)" },
    { icon: "📅", label: "Retorno", value: v(vars, "payback_meses", "0"), suffix: " meses", color: "var(--verde, #22C55E)" },
  ];

  return (
    <div style={{
      background: "var(--hero-bg, linear-gradient(135deg, #1B3A8C, #0D2460))",
      padding: "0 24px 56px",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 16,
        maxWidth: 900,
        margin: "0 auto",
      }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "24px 20px",
            textAlign: "center",
          }}>
            <p style={{
              fontSize: 10, textTransform: "uppercase", letterSpacing: 2,
              color: "var(--hero-muted, rgba(255,255,255,0.4))",
              margin: "0 0 8px", fontWeight: 700,
            }}>
              {kpi.icon} {kpi.label}
            </p>
            <p style={{
              fontSize: "1.6rem", fontWeight: 900,
              color: kpi.color,
              margin: 0,
              fontFamily: "var(--font-numbers, 'Montserrat', sans-serif)",
            }}>
              {kpi.value}{kpi.suffix}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPARISON — Before vs After
   ═══════════════════════════════════════════════════════ */
export function ProposalComparisonBlock({ variables: vars }: SemanticProps) {
  return (
    <div style={{
      background: "var(--fundo, #F8FAFC)",
      padding: "56px 24px",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
            color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 8px",
          }}>
            Comparativo
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>
            Antes vs Depois da Energia Solar
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}>
          {/* WITHOUT SOLAR */}
          <div style={{
            background: "var(--card-bg, #fff)",
            borderRadius: 16,
            padding: 28,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(239,68,68,0.15)",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, #ef4444, #f97316)",
            }} />
            <p style={{
              fontSize: 12, textTransform: "uppercase", letterSpacing: 2,
              color: "#ef4444", fontWeight: 800, margin: "0 0 20px",
            }}>
              ❌ Sem Solar
            </p>
            <ComparisonItem icon="💸" label="Conta de Luz" value={`R$ ${v(vars, "economia_mensal", "0")}/mês`} color="var(--negative, #ef4444)" />
            <ComparisonItem icon="📈" label="Gasto em 25 anos" value={`R$ ${v(vars, "economia_25_anos", "0")}+`} color="var(--negative, #ef4444)" />
          </div>

          {/* WITH SOLAR */}
          <div style={{
            background: "var(--card-bg, #fff)",
            borderRadius: 16,
            padding: 28,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(34,197,94,0.2)",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, #22C55E, #10B981)",
            }} />
            <p style={{
              fontSize: 12, textTransform: "uppercase", letterSpacing: 2,
              color: "var(--verde, #22C55E)", fontWeight: 800, margin: "0 0 20px",
            }}>
              ✅ Com Solar
            </p>
            <ComparisonItem icon="☀️" label="Economia" value={`${v(vars, "economia_percentual", "90")}% na conta`} color="var(--verde, #22C55E)" />
            <ComparisonItem icon="💰" label="Economia 25 anos" value={`R$ ${v(vars, "economia_25_anos", "0")}`} color="var(--verde, #22C55E)" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparisonItem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <p style={{
          fontSize: 10, color: "var(--cinza, #94A3B8)", margin: 0,
          textTransform: "uppercase", letterSpacing: 1,
        }}>{label}</p>
        <p style={{ fontWeight: 800, color, margin: 0, fontSize: "1.1rem" }}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   EQUIPMENT BLOCK — Modules + Inverter
   ═══════════════════════════════════════════════════════ */
export function ProposalEquipmentBlock({ variables: vars }: SemanticProps) {
  const items = [
    {
      icon: "☀️",
      title: "Módulos Solares",
      subtitle: "Painéis fotovoltaicos",
      gradient: "linear-gradient(135deg, var(--la, #F07B24), #F59E0B)",
      specs: [
        { label: "Fabricante", value: v(vars, "modulo_fabricante", "—") },
        { label: "Quantidade", value: `${v(vars, "modulo_quantidade", "0")} painéis` },
        { label: "Modelo · Potência", value: `${v(vars, "modulo_modelo", "—")} · ${v(vars, "modulo_potencia", v(vars, "modulo_potencia_w", "—"))}`, accent: true },
      ],
    },
    {
      icon: "🔌",
      title: "Inversor Solar",
      subtitle: "Conversão inteligente",
      gradient: "linear-gradient(135deg, var(--az, #1E3A5F), #3B82F6)",
      specs: [
        { label: "Fabricante", value: v(vars, "inversor_fabricante", "—") },
        { label: "Modelo", value: v(vars, "inversor_modelo", "—") },
        { label: "Garantia", value: v(vars, "inversor_garantia", "—"), accent: true },
      ],
    },
  ];

  return (
    <div style={{
      background: "var(--card-bg, #fff)",
      padding: "56px 24px",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
            color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 8px",
          }}>⚙️ Tecnologia</p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>Componentes do Seu Sistema</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{
              background: "var(--fundo, #F8FAFC)",
              border: "1px solid var(--card-border, #E2E8F0)",
              borderRadius: 16,
              padding: 28,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: item.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, color: "#fff", flexShrink: 0,
                }}>{item.icon}</div>
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--body-text, #0F172A)", margin: 0 }}>{item.title}</h3>
                  <p style={{ fontSize: 11, color: "var(--cinza, #94A3B8)", margin: "2px 0 0" }}>{item.subtitle}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {item.specs.map((spec, si) => (
                  <div key={si} style={{
                    background: "var(--card-bg, #fff)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    border: "1px solid var(--card-border, #E2E8F0)",
                    gridColumn: si === item.specs.length - 1 ? "1 / -1" : undefined,
                  }}>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "var(--cinza, #94A3B8)", margin: "0 0 4px", fontWeight: 700 }}>{spec.label}</p>
                    <p style={{
                      fontWeight: 700, margin: 0, fontSize: "0.85rem",
                      color: spec.accent ? "var(--la, #F07B24)" : "var(--body-text, #0F172A)",
                    }}>{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   FINANCIAL BLOCK — Investment, ROI, Payback
   ═══════════════════════════════════════════════════════ */
export function ProposalFinancialBlock({ variables: vars }: SemanticProps) {
  const metrics = [
    { label: "Investimento", value: `R$ ${v(vars, "valor_total", "0")}`, bg: "linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F))", color: "var(--la, #F07B24)" },
    { label: "Economia Anual", value: `R$ ${v(vars, "economia_anual", "0")}`, bg: "linear-gradient(135deg, var(--verde, #22C55E), #16A34A)", color: "#fff" },
    { label: "Payback", value: `${v(vars, "payback_meses", "0")} meses`, bg: "linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F))", color: "var(--la, #F07B24)" },
  ];

  return (
    <div style={{
      background: "var(--fundo, #F8FAFC)",
      padding: "56px 24px",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
            color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 8px",
          }}>📊 Análise Financeira</p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>Retorno do Seu Investimento</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              background: m.bg, borderRadius: 16,
              padding: "28px 24px", textAlign: "center",
            }}>
              <p style={{
                fontSize: 10, textTransform: "uppercase", letterSpacing: 2,
                color: "rgba(255,255,255,0.4)", margin: "0 0 10px", fontWeight: 700,
              }}>{m.label}</p>
              <p style={{
                fontSize: "1.6rem", fontWeight: 900, color: m.color, margin: 0,
                fontFamily: "var(--font-numbers, 'Montserrat', sans-serif)",
              }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GUARANTEES BLOCK — Trust indicators
   ═══════════════════════════════════════════════════════ */
export function ProposalGuaranteesBlock({ variables: vars }: SemanticProps) {
  const guarantees = [
    { icon: "🛡️", title: "Garantia dos Módulos", desc: v(vars, "modulo_garantia", "25 anos de garantia de performance") },
    { icon: "⚡", title: "Garantia do Inversor", desc: v(vars, "inversor_garantia", "10 anos de garantia") },
    { icon: "🔧", title: "Instalação Profissional", desc: "Equipe técnica certificada com experiência comprovada" },
    { icon: "📋", title: "Suporte Completo", desc: "Acompanhamento pós-venda, homologação e monitoramento" },
  ];

  return (
    <div style={{
      background: "var(--card-bg, #fff)",
      padding: "56px 24px",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
            color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 8px",
          }}>🛡️ Segurança</p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>Por Que Confiar na {v(vars, "empresa_nome", "Nossa Empresa")}</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {guarantees.map((g, i) => (
            <div key={i} style={{
              background: "var(--fundo, #F8FAFC)",
              border: "1px solid var(--card-border, #E2E8F0)",
              borderRadius: 16, padding: "24px 20px",
              display: "flex", alignItems: "flex-start", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "var(--info-box-bg, rgba(27,58,140,0.04))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0,
              }}>{g.icon}</div>
              <div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--body-text, #0F172A)", margin: "0 0 4px" }}>{g.title}</h3>
                <p style={{ fontSize: "0.8rem", color: "var(--cinza, #64748B)", margin: 0, lineHeight: 1.5 }}>{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAYMENT BLOCK — Conditions
   ═══════════════════════════════════════════════════════ */
export function ProposalPaymentBlock({ variables: vars }: SemanticProps) {
  return (
    <div style={{
      background: "var(--fundo, #F8FAFC)",
      padding: "56px 24px",
    }}>
      <div style={{
        maxWidth: 600, margin: "0 auto",
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--card-border, #E2E8F0)",
        borderRadius: 16, padding: 32,
        textAlign: "center",
      }}>
        <p style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
          color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 8px",
        }}>💳 Condições</p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "1.4rem", fontWeight: 800,
          color: "var(--body-text, #0F172A)", margin: "0 0 24px",
        }}>Investimento</h2>

        <div style={{
          background: "linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F))",
          borderRadius: 12, padding: "24px 20px", marginBottom: 16,
        }}>
          <p style={{
            fontSize: 10, textTransform: "uppercase", letterSpacing: 2,
            color: "rgba(255,255,255,0.4)", margin: "0 0 8px", fontWeight: 700,
          }}>Valor Total</p>
          <p style={{
            fontSize: "2rem", fontWeight: 900,
            color: "var(--la, #F07B24)", margin: 0,
            fontFamily: "var(--font-numbers, 'Montserrat', sans-serif)",
          }}>R$ {v(vars, "valor_total", "0")}</p>
        </div>

        <p style={{
          fontSize: "0.85rem", color: "var(--cinza, #64748B)",
          lineHeight: 1.6, margin: 0,
        }}>
          Consulte condições de financiamento e parcelamento com seu consultor.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CTA BLOCK — Call to Action
   ═══════════════════════════════════════════════════════ */
export function ProposalCtaBlock({ variables: vars }: SemanticProps) {
  const consultorNome = v(vars, "consultor_nome");
  const consultorTel = v(vars, "consultor_telefone");

  return (
    <div style={{
      background: "var(--cta-bg, linear-gradient(135deg, #0D2460, #1B3A8C))",
      padding: "64px 24px",
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <p style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
          color: "var(--la, #F07B24)", fontWeight: 700, margin: "0 0 16px",
        }}>✅ Próximo Passo</p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "clamp(1.3rem, 4vw, 1.8rem)", fontWeight: 900,
          color: "var(--hero-text, #fff)", margin: "0 0 12px",
        }}>
          Pronto para Economizar?
        </h2>
        <p style={{
          color: "var(--hero-muted, rgba(255,255,255,0.55))",
          fontSize: "0.95rem", margin: "0 0 32px", lineHeight: 1.7,
        }}>
          Aceite sua proposta agora e comece a gerar sua própria energia.
        </p>

        {consultorNome && (
          <p style={{
            color: "var(--hero-muted, rgba(255,255,255,0.5))",
            fontSize: "0.85rem", margin: "0 0 24px",
          }}>
            Consultor: <strong style={{ color: "var(--hero-text, #fff)" }}>{consultorNome}</strong>
            {consultorTel && ` · ${consultorTel}`}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button style={{
            background: "linear-gradient(135deg, var(--la, #F07B24), var(--la2, #E06010))",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "16px 40px",
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontWeight: 800, fontSize: "1rem", cursor: "pointer",
            boxShadow: "0 6px 24px rgba(240,123,36,0.35)",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            ACEITAR PROPOSTA
          </button>
          {consultorTel && (
            <a
              href={`https://wa.me/55${consultorTel.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#25D366", color: "#fff", border: "none", borderRadius: 12,
                padding: "16px 28px",
                fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
                fontWeight: 700, fontSize: "0.95rem", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
              }}
            >
              💬 WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SEMANTIC BLOCK REGISTRY — Maps block type to component
   ═══════════════════════════════════════════════════════ */
export const SEMANTIC_RENDERERS: Record<string, React.FC<SemanticProps>> = {
  proposal_hero: ProposalHeroBlock,
  proposal_kpis: ProposalKpisBlock,
  proposal_comparison: ProposalComparisonBlock,
  proposal_equipment: ProposalEquipmentBlock,
  proposal_financial: ProposalFinancialBlock,
  proposal_guarantees: ProposalGuaranteesBlock,
  proposal_payment: ProposalPaymentBlock,
  proposal_cta: ProposalCtaBlock,
};
