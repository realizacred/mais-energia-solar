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
   HERO BLOCK — Benefit-first headline with economy focus
   ═══════════════════════════════════════════════════════ */
export function ProposalHeroBlock({ variables: vars }: SemanticProps) {
  const logoUrl = v(vars, "empresa_logo_url") || v(vars, "logo_url");
  const logoWhiteUrl = v(vars, "logo_white_url");
  const displayLogo = logoWhiteUrl || logoUrl;
  const empresaNome = v(vars, "empresa_nome", "Energia Solar");
  const clienteNome = v(vars, "cliente_nome", "Cliente");
  const economiaMensal = v(vars, "economia_mensal", "0");
  const consultorNome = v(vars, "consultor_nome");

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
        {/* Logo */}
        {displayLogo ? (
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
            <div style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              borderRadius: 16, padding: "16px 32px",
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
          <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
            <div style={{
              background: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              borderRadius: 16, padding: "14px 28px",
              border: "1px solid rgba(255,255,255,0.15)",
              fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
              fontWeight: 800, fontSize: "1.2rem",
              color: "var(--hero-text, #fff)", letterSpacing: "0.05em",
            }}>
              {empresaNome}
            </div>
          </div>
        )}

        {/* Benefit-first headline */}
        <h1 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "clamp(1.6rem, 5vw, 2.6rem)",
          fontWeight: 900,
          color: "var(--hero-text, #fff)",
          margin: "0 0 16px",
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
        }}>
          Economize até{" "}
          <span style={{
            color: "var(--la, #F07B24)",
            display: "inline-block",
            background: "rgba(240,123,36,0.12)",
            padding: "2px 12px",
            borderRadius: 8,
          }}>
            R$ {economiaMensal}/mês
          </span>
          {" "}com energia solar
        </h1>

        <p style={{
          fontSize: "1.1rem",
          color: "var(--hero-muted, rgba(255,255,255,0.6))",
          margin: "0 0 8px", lineHeight: 1.6,
        }}>
          <span style={{ color: "var(--hero-text, rgba(255,255,255,0.85))" }}>{clienteNome}</span>,
          preparamos uma solução exclusiva para você.
        </p>

        {consultorNome && (
          <p style={{
            fontSize: "0.85rem",
            color: "var(--hero-muted, rgba(255,255,255,0.4))",
            margin: "12px 0 0",
          }}>
            Seu consultor: <strong style={{ color: "var(--hero-text, rgba(255,255,255,0.7))" }}>{consultorNome}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PROBLEM BLOCK — Pain points to create urgency
   ═══════════════════════════════════════════════════════ */
export function ProposalProblemBlock({ variables: vars }: SemanticProps) {
  const contaAtual = v(vars, "economia_mensal", "0");
  const problems = [
    {
      icon: "📈",
      title: "Conta de luz cada vez mais cara",
      desc: "A tarifa de energia sobe todos os anos, e sua conta não para de crescer.",
    },
    {
      icon: "💸",
      title: `Você está pagando R$ ${contaAtual}/mês a mais`,
      desc: "Esse dinheiro poderia estar no seu bolso — ou investido no seu negócio.",
    },
    {
      icon: "🔌",
      title: "Totalmente dependente da concessionária",
      desc: "Bandeiras tarifárias, reajustes e cobranças extras sem previsibilidade.",
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
            color: "#ef4444", fontWeight: 700, margin: "0 0 8px",
          }}>
            ⚠️ O Problema
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>
            Sua conta de energia está roubando seu dinheiro
          </h2>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {problems.map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 16,
              background: "var(--fundo, #FEF2F2)",
              border: "1px solid rgba(239,68,68,0.12)",
              borderLeft: "4px solid #ef4444",
              borderRadius: 12, padding: "20px 24px",
            }}>
              <span style={{ fontSize: 28, flexShrink: 0, lineHeight: 1 }}>{p.icon}</span>
              <div>
                <h3 style={{
                  fontSize: "1rem", fontWeight: 700,
                  color: "var(--body-text, #0F172A)", margin: "0 0 4px",
                }}>{p.title}</h3>
                <p style={{
                  fontSize: "0.85rem", color: "var(--cinza, #64748B)",
                  margin: 0, lineHeight: 1.5,
                }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
   SOLUTION BLOCK — Simple explanation of how solar solves the problem
   ═══════════════════════════════════════════════════════ */
export function ProposalSolutionBlock({ variables: vars }: SemanticProps) {
  const potencia = v(vars, "potencia_kwp", "0");
  const economia = v(vars, "economia_mensal", "0");

  const steps = [
    {
      num: "1",
      title: "Instalamos painéis no seu telhado",
      desc: `Um sistema de ${potencia} kWp, dimensionado sob medida para o seu consumo.`,
      icon: "☀️",
    },
    {
      num: "2",
      title: "Você gera sua própria energia",
      desc: "Seu sistema produz energia limpa durante o dia, reduzindo o que você consome da rede.",
      icon: "⚡",
    },
    {
      num: "3",
      title: `Sua conta cai até R$ ${economia}/mês`,
      desc: "O excedente vira crédito. Você paga apenas o custo mínimo da concessionária.",
      icon: "💰",
    },
  ];

  return (
    <div style={{
      background: "var(--fundo, #F8FAFC)",
      padding: "56px 24px",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 3,
            color: "var(--verde, #22C55E)", fontWeight: 700, margin: "0 0 8px",
          }}>
            ✅ A Solução
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
            fontSize: "1.6rem", fontWeight: 800,
            color: "var(--body-text, #0F172A)", margin: 0,
          }}>
            Como funciona na prática
          </h2>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 20,
              background: "var(--card-bg, #fff)",
              border: "1px solid var(--card-border, #E2E8F0)",
              borderRadius: 16, padding: "24px 28px",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "linear-gradient(135deg, var(--verde, #22C55E), #16A34A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, color: "#fff", flexShrink: 0,
                fontWeight: 900,
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: "var(--verde, #22C55E)",
                    background: "rgba(34,197,94,0.08)",
                    padding: "2px 8px", borderRadius: 6,
                  }}>PASSO {step.num}</span>
                </div>
                <h3 style={{
                  fontSize: "1rem", fontWeight: 700,
                  color: "var(--body-text, #0F172A)", margin: "0 0 4px",
                }}>{step.title}</h3>
                <p style={{
                  fontSize: "0.85rem", color: "var(--cinza, #64748B)",
                  margin: 0, lineHeight: 1.5,
                }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
      background: "var(--card-bg, #fff)",
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
            background: "var(--fundo, #FEF2F2)",
            borderRadius: 16, padding: 28,
            position: "relative", overflow: "hidden",
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
            background: "var(--fundo, #F0FDF4)",
            borderRadius: 16, padding: 28,
            position: "relative", overflow: "hidden",
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
              borderRadius: 16, padding: 28,
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
                    borderRadius: 10, padding: "14px 16px",
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
  const empresaNome = v(vars, "empresa_nome", "Nossa Empresa");

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
          }}>Por Que Confiar na {empresaNome}</h2>
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
   CTA BLOCK — Strong call to action
   ═══════════════════════════════════════════════════════ */
export function ProposalCtaBlock({ variables: vars }: SemanticProps) {
  const consultorNome = v(vars, "consultor_nome");
  const consultorTel = v(vars, "consultor_telefone");
  const economia = v(vars, "economia_mensal", "0");

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
        }}>🚀 Próximo Passo</p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "clamp(1.3rem, 4vw, 1.8rem)", fontWeight: 900,
          color: "var(--hero-text, #fff)", margin: "0 0 12px",
        }}>
          Comece a Economizar R$ {economia}/mês Agora
        </h2>
        <p style={{
          color: "var(--hero-muted, rgba(255,255,255,0.55))",
          fontSize: "0.95rem", margin: "0 0 32px", lineHeight: 1.7,
        }}>
          Aceite sua proposta e dê o primeiro passo para reduzir sua conta de luz.
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
            fontWeight: 700, fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 4px 20px rgba(240,123,36,0.35)",
          }}>
            Quero Reduzir Minha Conta Agora
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
   CLOSING BLOCK — Final reinforcement with urgency
   ═══════════════════════════════════════════════════════ */
export function ProposalClosingBlock({ variables: vars }: SemanticProps) {
  const economia = v(vars, "economia_mensal", "0");
  const payback = v(vars, "payback_meses", "0");

  return (
    <div style={{
      background: "var(--card-bg, #fff)",
      padding: "56px 24px",
      borderTop: "1px solid var(--card-border, #E2E8F0)",
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: 20, padding: "6px 16px", marginBottom: 20,
        }}>
          <span style={{ fontSize: 14 }}>🌱</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--verde, #22C55E)" }}>
            Energia limpa e renovável
          </span>
        </div>

        <h2 style={{
          fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
          fontSize: "1.4rem", fontWeight: 800,
          color: "var(--body-text, #0F172A)", margin: "0 0 16px",
        }}>
          Resumindo: economia de R$ {economia}/mês com retorno em {payback} meses
        </h2>

        <p style={{
          fontSize: "0.95rem", color: "var(--cinza, #64748B)",
          lineHeight: 1.7, margin: "0 0 24px", maxWidth: 550, marginLeft: "auto", marginRight: "auto",
        }}>
          Cada dia sem energia solar é dinheiro que você está deixando na mesa.
          Quanto antes começar, mais rápido recupera o investimento.
        </p>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
          maxWidth: 500, margin: "0 auto",
        }}>
          {[
            { icon: "✅", text: "Sem burocracia" },
            { icon: "✅", text: "Instalação rápida" },
            { icon: "✅", text: "Suporte total" },
          ].map((item, i) => (
            <div key={i} style={{
              background: "var(--fundo, #F8FAFC)",
              borderRadius: 10, padding: "12px 8px",
              fontSize: "0.8rem", fontWeight: 600,
              color: "var(--body-text, #0F172A)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {item.icon} {item.text}
            </div>
          ))}
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
  proposal_problem: ProposalProblemBlock,
  proposal_kpis: ProposalKpisBlock,
  proposal_solution: ProposalSolutionBlock,
  proposal_comparison: ProposalComparisonBlock,
  proposal_equipment: ProposalEquipmentBlock,
  proposal_financial: ProposalFinancialBlock,
  proposal_guarantees: ProposalGuaranteesBlock,
  proposal_payment: ProposalPaymentBlock,
  proposal_cta: ProposalCtaBlock,
  proposal_closing: ProposalClosingBlock,
};
