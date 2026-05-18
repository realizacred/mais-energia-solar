import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PaymentComposerBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("[PaymentComposerBoundary]", error);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                Erro ao calcular pagamentos
              </p>
              <p className="text-xs text-destructive/80 mt-1">
                {this.state.error?.message || "Erro inesperado ao processar os itens de pagamento."}
              </p>
              <button
                type="button"
                onClick={this.reset}
                className="mt-2 text-xs text-destructive underline hover:no-underline"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
