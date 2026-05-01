/**
 * ProposalHeroSection — Full-screen hero with dramatic gradient and CTA.
 * Página pública — exceção RB-02 documentada.
 *
 * Números vêm de useProposalKPIs (SSOT). Sem fallbacks mentirosos: se o KPI
 * não pôde ser calculado, exibimos "—" em vez de 0/valor inventado.
 */

import { motion } from "framer-motion";
import { Sun, Zap, ArrowDown, TrendingDown } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import type { LandingSectionProps, CenarioData } from "./types";
import { useProposalKPIs } from "../hooks/useProposalKPIs";

interface Props extends LandingSectionProps {
  onScrollDown?: () => void;
  activeCenario?: CenarioData | null;
}

export function ProposalHeroSection({ snapshot: s, versaoData, brand, tenantNome, consultorNome, onScrollDown, activeCenario }: Props) {
  const kpis = useProposalKPIs(s, versaoData, activeCenario ?? null);
  const potKwpLabel = kpis.potenciaKwp != null ? kpis.potenciaKwp.toFixed(1).replace(".", ",") : "—";
  const economiaLabel = kpis.economiaMensal != null ? formatBRL(kpis.economiaMensal) : "—";
  const paybackAnos = kpis.paybackAnosLabel ?? "—";

  return (
    <section style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg, #0B1D3A 0%, #0F2A52 35%, #132F5C 65%, #1A3B6E 100%)",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1.5rem",
    }}>
      {/* Glowing orbs */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%", width: "60vw", height: "60vw",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(240,123,36,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-30%", left: "-15%", width: "50vw", height: "50vw",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", maxWidth: 800, width: "100%" }}>
        {/* Logo */}
        {brand?.logo_white_url || brand?.logo_url ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: 32 }}
          >
            <img
              src={brand.logo_white_url || brand.logo_url!}
              alt={tenantNome || ""}
              style={{ height: 56, maxWidth: 280, objectFit: "contain", filter: brand.logo_white_url ? "none" : "brightness(0) invert(1)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </motion.div>
        ) : tenantNome ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          >
            <Sun style={{ width: 28, height: 28, color: "#F07B24" }} />
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.3rem", color: "#fff", letterSpacing: "-0.02em" }}>
              {tenantNome}
            </span>
          </motion.div>
        ) : null}

        {/* Tag */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{ marginBottom: 20 }}
        >
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(240,123,36,0.15)", border: "1px solid rgba(240,123,36,0.3)",
            borderRadius: 999, padding: "6px 18px", fontSize: "0.78rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F9A855",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            <Zap style={{ width: 14, height: 14 }} />
            PROPOSTA EXCLUSIVA
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.8rem, 6vw, 3.2rem)", color: "#fff",
            margin: 0, lineHeight: 1.15, letterSpacing: "-0.02em",
          }}
        >
          {s.clienteNome || "Cliente"},{" "}
          <span style={{ color: "#F9A855" }}>economize até</span>
          <br />
          <span style={{
            background: "linear-gradient(135deg, #F07B24, #F9A855)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontSize: "clamp(2.2rem, 7vw, 4rem)",
          }}>
            {economiaLabel}
          </span>
          <span style={{ fontSize: "clamp(1rem, 3vw, 1.6rem)", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>/mês</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            fontFamily: "'Open Sans', sans-serif", color: "rgba(255,255,255,0.55)",
            fontSize: "clamp(0.9rem, 2.5vw, 1.15rem)", margin: "16px auto 0",
            maxWidth: 520, lineHeight: 1.6,
          }}
        >
          Sistema fotovoltaico de <strong style={{ color: "rgba(255,255,255,0.85)" }}>{potKwpLabel} kWp</strong> projetado
          sob medida para você. Retorno em <strong style={{ color: "rgba(255,255,255,0.85)" }}>{paybackAnos} anos</strong>.
        </motion.p>

        {/* KPI Pills */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.7 } } }}
          style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 36 }}
        >
          {[
            { icon: <Zap style={{ width: 18, height: 18 }} />, value: `${potKwp.toFixed(1).replace(".", ",")} kWp`, label: "Potência" },
            { icon: <TrendingDown style={{ width: 18, height: 18 }} />, value: formatBRL(economiaMensal), label: "Economia/mês" },
            { icon: <Sun style={{ width: 18, height: 18 }} />, value: `${paybackAnos} anos`, label: "Payback" },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                padding: "12px 20px",
              }}
            >
              <div style={{ color: "#F9A855" }}>{kpi.icon}</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, color: "#fff", fontSize: "1rem", margin: 0, lineHeight: 1.2 }}>
                  {kpi.value}
                </p>
                <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", margin: 0, fontWeight: 500 }}>{kpi.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
        >
          <button
            onClick={onScrollDown}
            style={{
              background: "linear-gradient(135deg, #F07B24, #E56D1A)",
              color: "#fff", border: "none", borderRadius: 14,
              padding: "16px 48px", fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "1.05rem", cursor: "pointer", textTransform: "uppercase",
              letterSpacing: "0.06em",
              boxShadow: "0 8px 32px rgba(240,123,36,0.35), 0 0 0 1px rgba(240,123,36,0.2)",
              transition: "all 0.25s",
            }}
            onMouseOver={e => { (e.target as HTMLElement).style.transform = "translateY(-2px)"; (e.target as HTMLElement).style.boxShadow = "0 12px 40px rgba(240,123,36,0.45), 0 0 0 1px rgba(240,123,36,0.3)"; }}
            onMouseOut={e => { (e.target as HTMLElement).style.transform = "translateY(0)"; (e.target as HTMLElement).style.boxShadow = "0 8px 32px rgba(240,123,36,0.35), 0 0 0 1px rgba(240,123,36,0.2)"; }}
          >
            QUERO MINHA ECONOMIA
          </button>
          {consultorNome && (
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)", margin: 0 }}>
              Consultor: <span style={{ color: "rgba(255,255,255,0.55)" }}>{consultorNome}</span>
            </p>
          )}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)" }}
      >
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
          <ArrowDown style={{ width: 22, height: 22, color: "rgba(255,255,255,0.2)" }} />
        </motion.div>
      </motion.div>
    </section>
  );
}
