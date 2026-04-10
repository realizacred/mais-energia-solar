import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaPreContactCardProps {
  nome?: string;
  phone: string;
  onClose: () => void;
  /** Use compact layout for mobile */
  compact?: boolean;
}

export function WaPreContactCard({ nome, phone, onClose, compact }: WaPreContactCardProps) {
  const phoneDigits = phone.replace(/\D/g, "");

  if (compact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-warning/15 to-warning/5 border border-warning/10 flex items-center justify-center">
          <MessageCircle className="h-7 w-7 text-warning/60" />
        </div>
        <h3 className="text-base font-semibold text-foreground/70">Pré-Contato</h3>
        <p className="text-sm text-muted-foreground">
          <strong>{nome}</strong> ainda não iniciou conversa.
        </p>
        <a
          href={`https://wa.me/${phoneDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-success-foreground font-medium rounded-lg hover:bg-success/90 transition-colors"
          onClick={onClose}
        >
          <MessageCircle className="h-4 w-4" />
          Iniciar Conversa
        </a>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-muted/5 to-muted/20 gap-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-warning/15 to-warning/5 border border-warning/10 flex items-center justify-center shadow-lg shadow-warning/5">
        <MessageCircle className="h-9 w-9 text-warning/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground/70">Novo Lead — Pré-Contato</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        <strong>{nome}</strong> ainda não iniciou conversa no WhatsApp.
      </p>
      <p className="text-xs text-muted-foreground">{phone}</p>
      <a
        href={`https://wa.me/${phoneDigits}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-success-foreground font-medium rounded-lg hover:bg-success/90 transition-colors shadow-md"
        onClick={onClose}
      >
        <MessageCircle className="h-4 w-4" />
        Iniciar Conversa no WhatsApp
      </a>
      <Button variant="ghost"
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Fechar
      </Button>
    </div>
  );
}
