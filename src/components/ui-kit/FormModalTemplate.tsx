import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui-kit/Spinner";

/**
 * FormSection — Título de seção simples (texto sem card/borda).
 * Padrão canônico: nunca usar SectionCard dentro de modais de formulário.
 */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <p className="text-sm font-semibold text-foreground pt-2">{title}</p>
      {children}
    </>
  );
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
 * Layout fixo:
 * - Header padrão (título + X)
 * - Body com stack flat de fields/sections (sem SectionCard)
 * - Footer padrão (Cancelar / Confirmar)
 *
 * Nenhum modal de cadastro pode ter layout próprio.
 */
export function FormModalTemplate({
  open,
  onOpenChange,
  title,
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

  // body is now rendered inline in the return

  const footer = (
    <DialogFooter>
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
    </DialogFooter>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] ${className || ""}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {asForm ? (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="space-y-4 py-2 overflow-y-auto min-h-0 flex-1">
              {children}
            </div>
            {footer}
          </form>
        ) : (
          <>
            <div className="space-y-4 py-2 overflow-y-auto min-h-0 flex-1">
              {children}
            </div>
            {footer}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
