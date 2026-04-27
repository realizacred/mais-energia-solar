/**
 * MigrationLayout — wrapper visual compartilhado das 4 telas da Migração SolarMarket.
 *
 * - Full-width (sem max-width travado).
 * - Densidade alta: paddings reduzidos, tipografia compacta.
 * - Header sticky com breadcrumb (voltar), step badge, título e subtítulo.
 * - Slot opcional `actions` para botões à direita do header.
 *
 * Não contém regras de negócio. Apenas layout/composição (RB-04).
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MigrationLayoutProps {
  /** Rótulo curto do step (ex: "Step 2 / 4"). */
  stepLabel?: string;
  /** Título principal da tela. */
  title: string;
  /** Subtítulo / descrição opcional. */
  subtitle?: string;
  /** Link de voltar (ex: "/admin/migracao-solarmarket"). */
  backTo?: string;
  /** Texto do botão voltar (default: "Voltar"). */
  backLabel?: string;
  /** Slot de ações no canto direito do header. */
  actions?: ReactNode;
  /** Conteúdo da tela. */
  children: ReactNode;
  /** Classes extras no container do conteúdo. */
  contentClassName?: string;
}

export function MigrationLayout({
  stepLabel,
  title,
  subtitle,
  backTo,
  backLabel = "Voltar",
  actions,
  children,
  contentClassName,
}: MigrationLayoutProps) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header denso e sticky */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8 py-2.5">
          {backTo && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 mb-1 h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to={backTo}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                {backLabel}
              </Link>
            </Button>
          )}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {stepLabel && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border-primary/20"
                  >
                    {stepLabel}
                  </Badge>
                )}
                <h1 className="text-base sm:text-lg font-semibold text-foreground leading-tight truncate">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo full-width compacto */}
      <main
        className={cn(
          "flex-1 px-4 sm:px-6 lg:px-8 py-4 space-y-4",
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
