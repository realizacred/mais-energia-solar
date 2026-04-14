/**
 * ProposalHeroSection — Hero section with animated counters and CTA.
 * Página pública — exceção RB-02 documentada.
 */

import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Users, ArrowDown } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import type { LandingSectionProps } from "./types";

interface Props extends LandingSectionProps {
  onScrollDown?: () => void;
}

function AnimatedNumber({ end, suffix = "", prefix = "", decimals = 0, duration = 1500 }: {
  end: number; suffix?: string; prefix?: string; decimals?: number; duration?: number;
}) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (!ref.current || animated.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !animated.current) {
        animated.current = true;
        const start = performance.now();
        const diff = end;
        (function step(now: number) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Number((diff * eased).toFixed(decimals)));
          if (t < 1) requestAnimationFrame(step);
        })(performance.now());
      }
    }, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end, duration, decimals]);

  return <span ref={ref}>{prefix}{decimals > 0 ? value.toFixed(decimals).replace(".", ",") : value.toLocaleString("pt-BR")}{suffix}</span>;
}

export function ProposalHeroSection({ snapshot: s, versaoData, brand, tenantNome, consultorNome, onScrollDown }: Props) {
  const potKwp = s.potenciaKwp || versaoData.potencia_kwp || 0;
  const economiaMensal = versaoData.economia_mensal ?? s.economiaMensal ?? 0;
  const valorTotal = versaoData.valor_total ?? 0;
  const paybackMeses = versaoData.payback_meses ?? s.paybackMeses ?? 0;
  const paybackAnos = paybackMeses > 0 ? (paybackMeses / 12).toFixed(1).replace(".", ",") : "—";

  return (
    <section style={{
      background: "linear-gradient(180deg, #E8F0FE 0%, #F8FAFC 100%)",
      position: "relative", overflow: "hidden", padding: "2rem 1rem 3rem",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: -80, right: -80, width: 300, height: 300,
        borderRadius: "50%", background: "rgba(240,123,36,0.06)",
      }} />

      <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
        {/* Logo — prominent with glass container */}
        {brand?.logo_url ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              background: "rgba(255,255,255,0.95)",
              borderRadius: 16,
              padding: "14px 32px",
              marginBottom: 20,
              boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={brand.logo_url}
              alt={tenantNome || ""}
              style={{ height: 52, maxWidth: 240, objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
          </motion.div>
        ) : tenantNome ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-flex",
              background: "rgba(27,58,140,0.1)",
              borderRadius: 12,
              padding: "10px 24px",
              marginBottom: 20,
              border: "1px solid rgba(27,58,140,0.15)",
            }}
          >
            <span style={{ fontFamily: "Montserrat, sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#1B3A8C" }}>{tenantNome}</span>
          </motion.div>
        ) : null}

        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 5vw, 2.2rem)", color: "#1B3A8C",
            margin: 0, lineHeight: 1.2,
          }}>
            Olá, {s.clienteNome || "Cliente"}!
          </h1>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 800,
            fontSize: "clamp(1.1rem, 4vw, 1.6rem)", color: "#1B3A8C",
            margin: "4px 0 0", lineHeight: 1.3,
          }}>
            Sua Proposta de <span style={{ color: "#F07B24" }}>Energia Solar</span>
          </h2>
        </motion.div>

        {/* Divider + subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: 12 }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            color: "#64748B", fontSize: "0.85rem",
          }}>
            <div style={{ width: 40, height: 1, background: "#CBD5E1" }} />
            <span>TRANSFORME SUA CONTA DE LUZ EM <strong style={{ color: "#1B3A8C" }}>ECONOMIA</strong></span>
            <div style={{ width: 40, height: 1, background: "#CBD5E1" }} />
          </div>
        </motion.div>

        {/* KPI Grid */}
        <motion.div
          style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
            marginTop: 24,
          }}
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 0.4 } } }}
        >
          {[
            { value: <AnimatedNumber end={potKwp} decimals={2} />, suffix: " kWp", label: "Potência do Sistema" },
            { value: <><span style={{ fontSize: "0.7em" }}>R$ </span><AnimatedNumber end={economiaMensal} /></>, suffix: "/mês", label: "Economia Estimada" },
            { value: <><span style={{ fontSize: "0.7em" }}>R$ </span><AnimatedNumber end={valorTotal} /></>, suffix: "", label: "Investimento Total" },
            { value: paybackAnos, suffix: " anos", label: "Retorno do Investimento" },
          ].map((kpi, i) => (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              style={{
                background: "#fff", borderRadius: 12, padding: "16px 8px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0",
                textAlign: "center",
              }}
            >
              <p style={{
                fontFamily: "Montserrat, sans-serif", fontWeight: 900,
                fontSize: "clamp(0.9rem, 3vw, 1.4rem)", color: "#1B3A8C", margin: 0,
              }}>
                {typeof kpi.value === "string" ? kpi.value : kpi.value}{kpi.suffix && <span style={{ fontSize: "0.6em", fontWeight: 600 }}>{kpi.suffix}</span>}
              </p>
              <p style={{ fontSize: "0.65rem", color: "#64748B", margin: "4px 0 0", fontWeight: 500 }}>{kpi.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
        >
          <button
            onClick={onScrollDown}
            style={{
              background: "#F07B24", color: "#fff", border: "none", borderRadius: 8,
              padding: "14px 40px", fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "1rem", cursor: "pointer", textTransform: "uppercase",
              letterSpacing: "0.05em", boxShadow: "0 4px 16px rgba(240,123,36,0.3)",
              transition: "all 0.2s",
            }}
          >
            QUERO AVANÇAR
          </button>
        </motion.div>

        {/* Consultor */}
        {consultorNome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Users style={{ width: 14, height: 14, color: "#64748B" }} />
            <span style={{ fontSize: "0.8rem", color: "#64748B" }}>Consultor: <strong style={{ color: "#1B3A8C" }}>{consultorNome}</strong></span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
