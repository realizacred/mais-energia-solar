/**
 * AdminRouteBoundary — Captura erros das rotas lazy do Admin e oferece
 * recuperação SEM reload total da página (Core memory: invalidate, não reload).
 *
 * - Captura crashes de chunk-stale após deploy → oferece "Tentar novamente" que
 *   força React a re-tentar o lazy import sem perder o session state.
 * - Captura crashes runtime de telas → reset de estado + invalidate de queries.
 */
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class AdminRouteBoundaryInner extends React.Component<
  Props & { onReset: () => void },
  State
> {
  constructor(props: Props & { onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AdminRouteBoundary] Crash:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || "");
      const isChunkError =
        msg.includes("dynamically imported module") ||
        msg.includes("Failed to fetch dynamically") ||
        msg.includes("Loading chunk") ||
        msg.includes("MIME type");

      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground font-semibold text-lg">
              {isChunkError
                ? "Nova versão disponível"
                : "Erro ao carregar esta tela"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              {isChunkError
                ? "O sistema foi atualizado. Clique em Tentar novamente para carregar a versão mais recente."
                : this.state.error?.message || "Erro desconhecido"}
            </p>
          </div>
          <Button onClick={this.handleReset} size="sm">
            Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AdminRouteBoundary({ children }: Props) {
  const qc = useQueryClient();
  const handleReset = React.useCallback(() => {
    // Invalida cache para forçar refetch limpo (sem reload total).
    qc.invalidateQueries();
  }, [qc]);
  return (
    <AdminRouteBoundaryInner onReset={handleReset}>
      {children}
    </AdminRouteBoundaryInner>
  );
}
