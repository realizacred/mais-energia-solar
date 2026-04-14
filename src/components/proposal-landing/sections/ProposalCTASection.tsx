/**
 * ProposalCTASection — Final CTA with accept form — high-conversion design.
 * Página pública — exceção RB-02 documentada.
 */

import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";
import { AnimatedSection } from "./AnimatedSection";
import type { LandingSectionProps, AcceptFormData } from "./types";

interface Props extends LandingSectionProps {
  acceptForm: AcceptFormData;
  onAcceptFormChange: (form: AcceptFormData) => void;
  onAccept: () => void;
  onReject: () => void;
  submitting: boolean;
}

export function ProposalCTASection({
  snapshot: s, consultorNome, consultorTelefone, tenantNome,
  acceptForm, onAcceptFormChange, onAccept, onReject, submitting,
}: Props) {
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)", borderRadius: 14,
    padding: "14px 18px", color: "#fff", fontSize: "0.9rem",
    outline: "none", fontFamily: "'Open Sans', sans-serif",
    transition: "all 0.2s",
  };

  return (
    <AnimatedSection style={{
      padding: "5rem 1.5rem",
      background: "linear-gradient(165deg, #0B1D3A 0%, #132F5C 50%, #1A3B6E 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", top: "-30%", right: "-20%", width: "60vw", height: "60vw",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(240,123,36,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", color: "#fff", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(240,123,36,0.15)", border: "1px solid rgba(240,123,36,0.3)",
            borderRadius: 999, padding: "5px 16px", fontSize: "0.72rem",
            fontFamily: "Montserrat, sans-serif", fontWeight: 700, color: "#F9A855",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16,
          }}>
            <Sparkles style={{ width: 13, height: 13 }} />
            ÚLTIMA ETAPA
          </span>

          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 900,
            fontSize: "clamp(1.4rem, 4vw, 2rem)", margin: "12px 0 0",
            lineHeight: 1.2,
          }}>
            Comece a{" "}
            <span style={{ color: "#F9A855" }}>economizar agora</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", marginBottom: 32, marginTop: 8 }}>
            Preencha seus dados para aceitar a proposta
          </p>
        </motion.div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          <input
            placeholder="Seu nome completo *"
            value={acceptForm.nome}
            onChange={e => onAcceptFormChange({ ...acceptForm, nome: e.target.value })}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = "rgba(240,123,36,0.5)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          />
          <input
            placeholder="CPF ou CNPJ (opcional)"
            value={acceptForm.documento}
            onChange={e => onAcceptFormChange({ ...acceptForm, documento: e.target.value })}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = "rgba(240,123,36,0.5)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          />
          <textarea
            placeholder="Observações (opcional)"
            value={acceptForm.obs}
            rows={2}
            onChange={e => onAcceptFormChange({ ...acceptForm, obs: e.target.value })}
            style={{ ...inputStyle, resize: "none" }}
            onFocus={e => { e.target.style.borderColor = "rgba(240,123,36,0.5)"; }}
            onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
          />
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAccept}
            disabled={submitting || !acceptForm.nome.trim()}
            style={{
              background: acceptForm.nome.trim()
                ? "linear-gradient(135deg, #16A34A, #15803D)"
                : "rgba(255,255,255,0.1)",
              color: "#fff", border: "none", borderRadius: 14,
              padding: "16px 36px", fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "1rem", cursor: acceptForm.nome.trim() ? "pointer" : "not-allowed",
              boxShadow: acceptForm.nome.trim() ? "0 8px 32px rgba(22,163,74,0.3)" : "none",
              display: "flex", alignItems: "center", gap: 10,
              textTransform: "uppercase", letterSpacing: "0.04em",
              transition: "all 0.25s",
            }}
          >
            <CheckCircle2 style={{ width: 20, height: 20 }} />
            {submitting ? "ENVIANDO..." : "ACEITAR PROPOSTA"}
          </motion.button>

          {consultorTelefone && (
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href={`https://wa.me/55${consultorTelefone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#25D366", color: "#fff", border: "none", borderRadius: 14,
                padding: "16px 28px", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                fontSize: "0.95rem", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 8px 32px rgba(37,211,102,0.3)",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              <MessageCircle style={{ width: 20, height: 20 }} />
              WHATSAPP
            </motion.a>
          )}
        </div>

        {/* Reject link */}
        <button
          onClick={onReject}
          style={{
            background: "transparent", border: "none", color: "rgba(255,255,255,0.3)",
            cursor: "pointer", fontSize: "0.78rem", marginTop: 20,
            fontFamily: "'Open Sans', sans-serif", textDecoration: "underline",
          }}
        >
          Não tenho interesse
        </button>

        {/* Consultor */}
        {consultorNome && (
          <div style={{
            marginTop: 28, padding: "14px 22px",
            background: "rgba(255,255,255,0.04)", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)", margin: 0 }}>
              Consultor responsável: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{consultorNome}</strong>
            </p>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
