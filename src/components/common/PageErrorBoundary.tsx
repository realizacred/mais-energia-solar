import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
  title?: string;
}

/**
 * PageErrorBoundary — fallback amigável para páginas admin.
 * Não tenta quebrar layout do shell; renderiza um card de erro local.
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary]", error, info);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-1">
          {this.props.title ?? "Algo deu errado"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Ocorreu um erro inesperado nesta página. Tente novamente — se persistir,
          recarregue ou contate o suporte.
        </p>
        <Button size="sm" variant="outline" onClick={this.handleReset}>
          Tentar novamente
        </Button>
      </div>
    );
  }
}
