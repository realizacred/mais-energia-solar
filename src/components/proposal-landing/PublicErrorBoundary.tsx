/**
 * PublicErrorBoundary — Catches runtime crashes in public proposal pages.
 * Prevents white screen by showing a user-friendly error fallback.
 * Página pública — exceção RB-02 documentada.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class PublicErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "Erro desconhecido" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PublicErrorBoundary] Crash na página pública:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F8FAFC",
            padding: 24,
            fontFamily: "'Open Sans', sans-serif",
          }}
        >
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(245,158,11,0.1)", display: "flex",
                alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              }}
            >
              <AlertTriangle style={{ width: 32, height: 32, color: "#F59E0B" }} />
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>
              Não foi possível exibir a proposta
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#64748B", margin: "0 0 24px", lineHeight: 1.5 }}>
              Ocorreu um erro ao carregar os dados da proposta.
              Por favor, tente novamente ou entre em contato com a empresa.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: null })}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 8,
                background: "#1B3A8C", color: "#fff", border: "none",
                fontWeight: 600, fontSize: "0.875rem", cursor: "pointer",
                fontFamily: "'Open Sans', sans-serif",
              }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
