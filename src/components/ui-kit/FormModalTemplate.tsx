import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui-kit/Spinner";
import type { LucideIcon } from "lucide-react";

/**
 * FormSection — Título de seção §25 (uppercase, tracking-wide, muted).
 * Padrão canônico: nunca usar SectionCard dentro de modais de formulário.
 */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground pt-2">
        {title}
      </p>
      {children}
    </>
  );
}

/**
 * FormDivider — Divisor entre seções §25.
 */
export function FormDivider() {
  return <div className="border-t border-border" />;
}

/**
 * FormGrid — Grid responsivo canônico (2 colunas desktop, 1 mobile).
 */
export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4`}>
      {children}
    </div>
  );
}

interface FormModalTemplateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Subtítulo descritivo abaixo do título (§25 obrigatório) */
  subtitle?: string;
  /** Ícone do header (§25 obrigatório) */
  icon?: LucideIcon;
  /** Conteúdo do formulário (fields, sections) */
  children: React.ReactNode;
  /** Ação de salvar */
  onSubmit: () => void;
  /** Texto do botão principal (default: "Cadastrar") */
  submitLabel?: string;
  /** Texto do botão cancelar (default: "Cancelar") */
  cancelLabel?: string;
  /** Desabilitar botão submit */
  disabled?: boolean;
  /** Mostra spinner no botão */
  saving?: boolean;
  /** Classe CSS extra no DialogContent */
  className?: string;
  /** Se true, envolve children em <form> com onSubmit */
  asForm?: boolean;
}

/**
 * FormModalTemplate — Template canônico SSOT para todos os modais de cadastro/edição.
 *
 * Layout §25:
 * - Header com ícone bg-primary/10 + título + subtítulo
 * - Body com stack flat de fields/sections (sem SectionCard)
 * - Footer com bg-muted/30 (Cancelar / Confirmar)
 *
 * Nenhum modal de cadastro pode ter layout próprio.
 */
export function FormModalTemplate({
  open,
  onOpenChange,
  title,
  subtitle,
  icon: Icon,
  children,
  onSubmit,
  submitLabel = "Cadastrar",
  cancelLabel = "Cancelar",
  disabled = false,
  saving = false,
  className,
  asForm = false,
}: FormModalTemplateProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const footer = (
    <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
        {cancelLabel}
      </Button>
      <Button
        type={asForm ? "submit" : "button"}
        onClick={asForm ? undefined : onSubmit}
        disabled={disabled || saving}
      >
        {saving && <Spinner size="sm" className="mr-2" />}
        {submitLabel}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-[90vw] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] ${className || ""}`}>
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </DialogHeader>
        {asForm ? (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="space-y-4 p-5 overflow-y-auto min-h-0 flex-1">
              {children}
            </div>
            {footer}
          </form>
        ) : (
          <>
            <div className="space-y-4 p-5 overflow-y-auto min-h-0 flex-1">
              {children}
            </div>
            {footer}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
