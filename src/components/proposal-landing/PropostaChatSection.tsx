/**
 * PropostaChatSection.tsx
 *
 * Chat de dúvidas com IA na landing page pública da proposta.
 * Página pública — exceção RB-02 documentada.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Send, Loader2 } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PropostaChatSectionProps {
  propostaData: Record<string, string>;
}

const QUICK_BUTTONS = [
  "Como funciona o financiamento?",
  "Qual meu payback?",
  "O que está incluído?",
  "Como funciona a instalação?",
];

export function PropostaChatSection({ propostaData }: PropostaChatSectionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("proposta-chat", {
        body: {
          mensagem: text.trim(),
          historico: messages,
          proposta_data: propostaData,
        },
      });

      if (error) throw error;

      const reply = data?.resposta || "Desculpe, não consegui processar sua pergunta.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, houve um erro ao processar sua pergunta. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, propostaData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <section style={{
      background: "#1B3A8C",
      padding: "2rem 1rem",
      marginBottom: 0,
    }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(240,123,36,0.15)", marginBottom: 12,
          }}>
            <MessageCircle style={{ width: 24, height: 24, color: "#F07B24" }} />
          </div>
          <h2 style={{
            fontFamily: "Montserrat, sans-serif", fontWeight: 800,
            fontSize: "1.3rem", color: "#fff", margin: "0 0 4px",
          }}>
            💬 Tire suas dúvidas com nossa IA
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", margin: 0 }}>
            Conheço todos os detalhes da sua proposta
          </p>
        </div>

        {/* Chat area */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}>
          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              maxHeight: 300, minHeight: 120,
              overflowY: "auto",
              padding: 16,
              display: "flex", flexDirection: "column", gap: 10,
            }}
          >
            {messages.length === 0 && (
              <p style={{
                color: "rgba(255,255,255,0.4)", fontSize: "0.85rem",
                textAlign: "center", margin: "auto 0",
              }}>
                Envie uma pergunta sobre sua proposta
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? "#F07B24" : "#2550C0",
                  color: "#fff",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  padding: "10px 18px", borderRadius: "14px 14px 14px 4px",
                  background: "#2550C0", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Loader2 style={{ width: 16, height: 16, color: "rgba(255,255,255,0.6)", animation: "spin 1s linear infinite" }} />
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>Pensando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick buttons */}
          {messages.length === 0 && (
            <div style={{
              padding: "0 16px 12px",
              display: "flex", flexWrap: "wrap", gap: 6,
            }}>
              {QUICK_BUTTONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 20, padding: "6px 14px",
                    color: "rgba(255,255,255,0.8)", fontSize: "0.75rem",
                    cursor: "pointer", transition: "all 0.2s",
                    fontFamily: "Open Sans, sans-serif",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex", gap: 8,
              padding: "12px 16px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(0,0,0,0.1)",
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              disabled={loading}
              style={{
                flex: 1, background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10, padding: "10px 14px",
                color: "#fff", fontSize: "0.85rem",
                outline: "none", fontFamily: "Open Sans, sans-serif",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "#F07B24", border: "none", borderRadius: 10,
                padding: "10px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: loading || !input.trim() ? 0.5 : 1,
                transition: "opacity 0.2s",
              }}
            >
              <Send style={{ width: 18, height: 18, color: "#fff" }} />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
