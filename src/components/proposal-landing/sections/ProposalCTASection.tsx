/**
 * ProposalCTASection — Final CTA with accept form and WhatsApp.
 * Página pública — exceção RB-02 documentada.
 * RB-17: sem console.log
 */

import { motion } from "framer-motion";
import { Phone, CheckCircle2, MessageCircle } from "lucide-react";
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
    width: "100%", background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10,
    padding: "12px 16px", color: "#fff", fontSize: "0.88rem",
    outline: "none", fontFamily: "Open Sans, sans-serif",
  };

  return (
    <AnimatedSection style={{ padding: "3rem 1rem", background: "linear-gradient(135deg, #1B3A8C 0%, #0F2563 100%)" }}>
      <div style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", color: "#fff" }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            marginBottom: 8,
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.2)" }} />
            <h2 style={{
              fontFamily: "Montserrat, sans-serif", fontWeight: 900,
              fontSize: "1.3rem", margin: 0, textTransform: "uppercase",
            }}>
              APROVEITE ESSA OPORTUNIDADE!
            </h2>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.2)" }} />
          </div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", marginBottom: 24 }}>
            Preencha seus dados para aceitar a proposta
          </p>
        </motion.div>

        {/* Accept form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          <input
            placeholder="Seu nome completo *"
            value={acceptForm.nome}
            onChange={e => onAcceptFormChange({ ...acceptForm, nome: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="CPF ou CNPJ (opcional)"
            value={acceptForm.documento}
            onChange={e => onAcceptFormChange({ ...acceptForm, documento: e.target.value })}
            style={inputStyle}
          />
          <textarea
            placeholder="Observações (opcional)"
            value={acceptForm.obs}
            rows={2}
            onChange={e => onAcceptFormChange({ ...acceptForm, obs: e.target.value })}
            style={{ ...inputStyle, resize: "none" }}
          />
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onAccept}
            disabled={submitting || !acceptForm.nome.trim()}
            style={{
              background: "#16A34A", color: "#fff", border: "none", borderRadius: 10,
              padding: "14px 32px", fontFamily: "Montserrat, sans-serif", fontWeight: 800,
              fontSize: "1rem", cursor: acceptForm.nome.trim() ? "pointer" : "not-allowed",
              opacity: acceptForm.nome.trim() ? 1 : 0.5,
              boxShadow: "0 4px 16px rgba(22,163,74,0.3)",
              display: "flex", alignItems: "center", gap: 8,
              textTransform: "uppercase",
            }}
          >
            <CheckCircle2 style={{ width: 18, height: 18 }} />
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
                background: "#25D366", color: "#fff", border: "none", borderRadius: 10,
                padding: "14px 24px", fontFamily: "Montserrat, sans-serif", fontWeight: 700,
                fontSize: "0.9rem", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
              }}
            >
              <MessageCircle style={{ width: 18, height: 18 }} />
              FALAR NO WHATSAPP
            </motion.a>
          )}
        </div>

        {/* Reject link */}
        <button
          onClick={onReject}
          style={{
            background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
            cursor: "pointer", fontSize: "0.8rem", marginTop: 16,
            fontFamily: "Open Sans, sans-serif", textDecoration: "underline",
          }}
        >
          Não tenho interesse
        </button>

        {/* Consultor info */}
        {consultorNome && (
          <div style={{ marginTop: 20, padding: "12px 20px", background: "rgba(255,255,255,0.06)", borderRadius: 10 }}>
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              Consultor responsável: <strong style={{ color: "#fff" }}>{consultorNome}</strong>
            </p>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
