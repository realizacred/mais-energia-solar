import { Check, X, Cpu, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WritingAssistantPreviewProps {
  originalText: string;
  suggestion: string;
  model: string | null;
  onAccept: (text: string) => void;
  onEdit: (text: string) => void;
  onDismiss: () => void;
}

export function WritingAssistantPreview({
  originalText,
  suggestion,
  model,
  onAccept,
  onEdit,
  onDismiss,
}: WritingAssistantPreviewProps) {
  const modelLabel = model?.includes("lite") ? "flash-lite" : "flash";

  return (
    <div className="mx-1 mb-2 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-primary/10">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-primary">✨ Sugestão da IA</span>
          {model && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5 text-muted-foreground border-border/50">
              <Cpu className="h-2 w-2" />
              {modelLabel}
            </Badge>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onDismiss}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Suggestion text - clickable to apply */}
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 hover:bg-primary/10 transition-colors cursor-pointer group"
        onClick={() => onAccept(suggestion)}
      >
        <p className="text-sm text-foreground leading-relaxed">
          {suggestion}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1.5 group-hover:text-primary transition-colors">
          Clique para substituir o texto · depois envie com Enter ou ícone
        </p>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-primary/10">
        <Button
          size="sm"
          className="h-6 text-[11px] gap-1"
          onClick={() => onAccept(suggestion)}
        >
          <Check className="h-3 w-3" />
          Usar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] gap-1"
          onClick={() => onEdit(suggestion)}
        >
          <ArrowRightLeft className="h-3 w-3" />
          Editar antes
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px]"
          onClick={onDismiss}
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}
