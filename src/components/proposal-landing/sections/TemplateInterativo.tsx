/**
 * TemplateInterativo.tsx — Seção interativa premium para landing page de proposta.
 *
 * Página pública — exceção RB-02 documentada.
 * Paleta própria (não usa design system do admin).
 *
 * Funcionalidades:
 * 1. Galeria de Equipamentos com hover zoom + badge de garantia
 * 2. Simulador de Impacto com slider de inflação energética
 * 3. Galeria de Estrutura (tipo de telhado do snapshot)
 * 4. Animações fluídas com framer-motion (scroll reveal)
 *
 * Motor financeiro: calcFinancialSeries (DA-37). Os números são sagrados.
 */

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Sun, Zap, Shield, Home, TrendingUp, SlidersHorizontal } from "lucide-react";
import { formatBRL, formatBRLInteger } from "@/lib/formatters";
import { calcFinancialSeries, type FinancialSeriesInput } from "@/components/admin/propostas-nativas/wizard/utils/calcFinancialSeries";
import { AnimatedSection, StaggerContainer, StaggerItem } from "./AnimatedSection";
import type { LandingSectionProps } from "./types";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Constants & helpers
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const TELHADO_IMAGES: Record<string, { img: string; label: string }> = {
  ceramico: { img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80", label: "Telhado Cerâmico" },
  metalico: { img: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600&q=80", label: "Telhado Metálico" },
  fibrocimento: { img: "https://images.unsplash.com/photo-1497440001374-f26997328c1b?w=600&q=80", label: "Fibrocimento" },
  laje: { img: "https://images.unsplash.com/photo-1559302504-64aae6ca6548?w=600&q=80", label: "Laje" },
  solo: { img: "https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=600&q=80", label: "Solo" },
  default: { img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80", label: "Estrutura Solar" },
};

const GARANTIAS: Record<string, string> = {
  modulo: "25 anos de garantia",
  modulos: "25 anos de garantia",
  inversor: "10 anos de garantia",
  inversores: "10 anos de garantia",
  estrutura: "15 anos de garantia",
  estruturas: "15 anos de garantia",
};

function resolveTelhado(tipo: string) {
  const key = (tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (key.includes("ceramic") || key.includes("colonial")) return TELHADO_IMAGES.ceramico;
  if (key.includes("metal") || key.includes("trapezoidal") || key.includes("zinco")) return TELHADO_IMAGES.metalico;
  if (key.includes("fibro")) return TELHADO_IMAGES.fibrocimento;
  if (key.includes("laje") || key.includes("concreto")) return TELHADO_IMAGES.laje;
  if (key.includes("solo") || key.includes("ground")) return TELHADO_IMAGES.solo;
  return { ...TELHADO_IMAGES.default, label: tipo || "Estrutura Solar" };
}

function getCategoryIcon(cat: string) {
  if (cat === "modulo" || cat === "modulos") return <Sun style={{ width: 20, height: 20 }} />;
  if (cat === "inversor" || cat === "inversores") return <Zap style={{ width: 20, height: 20 }} />;
  return <Home style={{ width: 20, height: 20 }} />;
}

function getCategoryLabel(cat: string) {
  if (cat === "modulo" || cat === "modulos") return "Módulo Fotovoltaico";
  if (cat === "inversor" || cat === "inversores") return "Inversor Solar";
  if (cat === "estrutura" || cat === "estruturas") return "Estrutura de Fixação";
  return cat;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Equipment Card with hover zoom + badge
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function EquipmentCard({ item }: { item: { id: string; descricao: string; fabricante: string; modelo: string; potencia_w: number; quantidade: number; categoria: string } }) {
  const garantia = GARANTIAS[item.categoria] || "Garantia inclusa";

  return (
    <motion.div
      style={{
        borderRadius: 20, overflow: "hidden", position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.06)",
        background: "#fff",
        cursor: "default",
      }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
      transition={{ duration: 0.25 }}
    >
      {/* Visual header with hover zoom */}
      <motion.div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #334155 100%)",
          height: 160, display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}
        whileHover="hovered"
        initial="idle"
      >
        <motion.div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)",
          }}
          variants={{
            idle: { scale: 1 },
            hovered: { scale: 1.15 },
          }}
          transition={{ duration: 0.4 }}
        />
        <motion.div
          style={{ fontSize: 56, zIndex: 1 }}
          variants={{
            idle: { scale: 1 },
            hovered: { scale: 1.1 },
          }}
          transition={{ duration: 0.3 }}
        >
          {getCategoryIcon(item.categoria)}
        </motion.div>

        {/* Garantia badge — visible on hover */}
        <motion.div
          style={{
            position: "absolute", bottom: 12, right: 12,
            background: "rgba(22,163,74,0.9)", color: "#fff",
            borderRadius: 999, padding: "5px 14px",
            fontSize: "0.68rem", fontWeight: 700,
            fontFamily: "Montserrat, sans-serif",
            display: "flex", alignItems: "center", gap: 5,
            backdropFilter: "blur(8px)",
          }}
          variants={{
            idle: { opacity: 0, y: 8 },
            hovered: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Shield style={{ width: 12, height: 12 }} />
          {garantia}
        </motion.div>
      </motion.div>

      {/* Content */}
      <div style={{ padding: "20px 24px" }}>
        <p style={{
          fontFamily: "Montserrat, sans-serif", fontWeight: 800,
          fontSize: "0.85rem", color: "#0F172A", margin: "0 0 4px",
        }}>
          {getCategoryLabel(item.categoria)}
        </p>
        <p style={{ fontSize: "0.72rem", color: "#64748B", margin: "0 0 16px" }}>
          {item.fabricante} — {item.modelo}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {item.potencia_w > 0 && (
            <div style={{ padding: "10px 12px", background: "#F1F5F9", borderRadius: 10 }}>
              <p style={{ fontSize: "0.62rem", color: "#94A3B8", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Potência</p>
              <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#0F172A", fontSize: "0.85rem", margin: "3px 0 0" }}>{item.potencia_w}W</p>
            </div>
          )}
          <div style={{ padding: "10px 12px", background: "#F1F5F9", borderRadius: 10 }}>
            <p style={{ fontSize: "0.62rem", color: "#94A3B8", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quantidade</p>
            <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#0F172A", fontSize: "0.85rem", margin: "3px 0 0" }}>{item.quantidade} un.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Impact Simulator (Slider + Chart)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

interface SimulatorProps {
  snapshot: LandingSectionProps["snapshot"];
  versaoData: LandingSectionProps["versaoData"];
}

function ImpactSimulator({ snapshot: s, versaoData }: SimulatorProps) {
  const defaultInflacao = s.premissas.inflacao_energetica || 9.5;
  const [inflacao, setInflacao] = useState(defaultInflacao);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInflacao(Number(e.target.value));
  }, []);

  const series = useMemo(() => {
    const input: FinancialSeriesInput = {
      precoFinal: versaoData.valor_total,
      potenciaKwp: versaoData.potencia_kwp || s.potenciaKwp,
      irradiacao: s.locIrradiacao || 4.5,
      geracaoMensalKwh: s.geracaoMensalEstimada,
      consumoTotal: s.consumoTotal,
      tarifaBase: s.premissas.inflacao_energetica > 0 ? (versaoData.economia_mensal / (s.consumoTotal || 1)) : 0.75,
      custoDisponibilidade: 0,
      premissas: {
        inflacao_energetica: inflacao,
        perda_eficiencia_anual: s.premissas.perda_eficiencia_anual || 0.5,
        vpl_taxa_desconto: s.premissas.vpl_taxa_desconto || 10,
        troca_inversor_anos: s.premissas.troca_inversor_anos || 15,
        troca_inversor_custo: s.premissas.troca_inversor_custo || 30,
      },
    };
    return calcFinancialSeries(input);
  }, [inflacao, s, versaoData]);

  // Build simple bar chart data (years 1, 5, 10, 15, 20, 25)
  const chartYears = [1, 5, 10, 15, 20, 25];
  const chartData = chartYears.map(y => ({
    year: y,
    acumulado: series.fluxo_caixa_acumulado_anual[y] ?? 0,
  }));
  const maxVal = Math.max(...chartData.map(d => Math.abs(d.acumulado)), 1);

  return (
    <AnimatedSection style={{
      padding: "5rem 1.5rem",
      background: "linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#3B82F6",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <SlidersHorizontal style={{ width: 13, height: 13 }} />
            SIMULADOR INTERATIVO
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Simule o{" "}
            <span style={{ color: "#3B82F6" }}>impacto da inflação</span>
          </h2>
          <p style={{ color: "#64748B", fontSize: "0.9rem", marginTop: 8, maxWidth: 500, marginInline: "auto" }}>
            Ajuste a inflação energética estimada e veja como sua economia acumulada evolui em 25 anos.
          </p>
        </div>

        {/* Slider */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "28px 32px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)",
          marginBottom: 32,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#0F172A" }}>
              Inflação Energética
            </span>
            <span style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "1.4rem", color: "#3B82F6",
            }}>
              {inflacao.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={3}
            max={20}
            step={0.5}
            value={inflacao}
            onChange={handleSliderChange}
            style={{
              width: "100%", height: 6, borderRadius: 999,
              appearance: "none", outline: "none",
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((inflacao - 3) / 17) * 100}%, #E2E8F0 ${((inflacao - 3) / 17) * 100}%, #E2E8F0 100%)`,
              cursor: "pointer",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>3%</span>
            <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>20%</span>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Economia Mensal", value: formatBRL(series.economia_mensal), color: "#16A34A" },
            { label: "Payback", value: `${(series.payback_meses / 12).toFixed(1).replace(".", ",")} anos`, color: "#3B82F6" },
            { label: "Economia 25 Anos", value: formatBRLInteger(series.economia_anual_valor.reduce((a, b) => a + b, 0)), color: "#F07B24" },
            { label: "TIR", value: `${series.tir.toFixed(1).replace(".", ",")}%`, color: "#8B5CF6" },
          ].map(kpi => (
            <motion.div
              key={kpi.label}
              style={{
                background: "#fff", borderRadius: 16, padding: "20px 18px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
                textAlign: "center",
              }}
              layout
              transition={{ duration: 0.3 }}
            >
              <p style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 800,
                fontSize: "1.3rem", color: kpi.color, margin: 0,
              }}>
                {kpi.value}
              </p>
              <p style={{ fontSize: "0.68rem", color: "#64748B", margin: "4px 0 0", fontWeight: 600 }}>
                {kpi.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Bar Chart — Economia Acumulada */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "28px 32px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <TrendingUp style={{ width: 18, height: 18, color: "#16A34A" }} />
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#0F172A" }}>
              Fluxo de Caixa Acumulado
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 180 }}>
            {chartData.map((d, i) => {
              const isPositive = d.acumulado >= 0;
              const pct = Math.min(Math.abs(d.acumulado) / maxVal, 1) * 100;

              return (
                <div key={d.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <motion.div
                    style={{
                      width: "100%", maxWidth: 52, borderRadius: "8px 8px 0 0",
                      background: isPositive
                        ? "linear-gradient(180deg, #16A34A 0%, #22C55E 100%)"
                        : "linear-gradient(180deg, #EF4444 0%, #F87171 100%)",
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 4)}%` }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
                  />
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <p style={{ fontSize: "0.6rem", color: "#64748B", margin: 0, fontWeight: 600 }}>Ano {d.year}</p>
                    <p style={{
                      fontSize: "0.6rem", margin: "2px 0 0",
                      fontWeight: 700, fontFamily: "Montserrat, sans-serif",
                      color: isPositive ? "#16A34A" : "#EF4444",
                    }}>
                      {formatBRLInteger(d.acumulado)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Structure Gallery
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StructureGallery({ tipoTelhado }: { tipoTelhado: string }) {
  const telhado = resolveTelhado(tipoTelhado);

  return (
    <AnimatedSection style={{ padding: "4rem 1.5rem", background: "#fff" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F59E0B",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <Home style={{ width: 13, height: 13 }} />
            ESTRUTURA
          </span>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.2rem, 3.5vw, 1.8rem)", color: "#0F172A",
            margin: "12px 0 0", lineHeight: 1.2,
          }}>
            Fixação para{" "}
            <span style={{ color: "#F59E0B" }}>{telhado.label}</span>
          </h2>
        </div>

        <motion.div
          style={{
            borderRadius: 24, overflow: "hidden", position: "relative",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={telhado.img}
            alt={`Instalação solar em ${telhado.label}`}
            style={{ width: "100%", height: 340, objectFit: "cover", display: "block" }}
            loading="lazy"
          />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
            padding: "40px 28px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                borderRadius: 12, padding: 10,
              }}>
                <Shield style={{ width: 20, height: 20, color: "#fff" }} />
              </div>
              <div>
                <p style={{
                  fontFamily: "Montserrat, sans-serif", fontWeight: 800,
                  color: "#fff", fontSize: "1rem", margin: 0,
                }}>
                  {telhado.label}
                </p>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", margin: "2px 0 0" }}>
                  Estrutura de fixação dimensionada para sua cobertura
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Main Component
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function TemplateInterativo(props: LandingSectionProps) {
  const { snapshot: s, versaoData } = props;

  return (
    <>
      {/* Section 1: Equipment Gallery */}
      <AnimatedSection style={{ padding: "5rem 1.5rem", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)",
              borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
              fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#8B5CF6",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
            }}>
              <Sun style={{ width: 13, height: 13 }} />
              EQUIPAMENTOS PREMIUM
            </span>
            <h2 style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 900,
              fontSize: "clamp(1.4rem, 4vw, 2.2rem)", color: "#0F172A",
              margin: "12px 0 0", lineHeight: 1.2,
            }}>
              Tecnologia de{" "}
              <span style={{ color: "#8B5CF6" }}>primeira linha</span>
            </h2>
            <p style={{ color: "#64748B", fontSize: "0.9rem", marginTop: 8 }}>
              Passe o mouse sobre cada equipamento para ver os detalhes de garantia.
            </p>
          </div>

          <StaggerContainer
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {s.itens.map((item) => (
              <StaggerItem key={item.id}>
                <EquipmentCard item={item} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </AnimatedSection>

      {/* Section 2: Structure Gallery */}
      {s.locTipoTelhado && (
        <StructureGallery tipoTelhado={s.locTipoTelhado} />
      )}

      {/* Section 3: Impact Simulator */}
      <ImpactSimulator snapshot={s} versaoData={versaoData} />
    </>
  );
}