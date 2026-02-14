import { Check, Pencil, X, Cpu } from "lucide-react";
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
          <span className="text-xs font-medium text-primary">✨ Sugestão</span>
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

      {/* Comparison */}
      <div className="px-3 py-2 space-y-2">
        {/* Original */}
        <div>
          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Original</p>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 leading-relaxed">
            {originalText}
          </p>
        </div>
        {/* Suggestion */}
        <div>
          <p className="text-[10px] text-primary font-medium mb-0.5">Sugestão</p>
          <p className="text-xs text-foreground bg-primary/10 rounded-lg px-2.5 py-1.5 leading-relaxed border border-primary/15">
            {suggestion}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-primary/10">
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onAccept(suggestion)}
        >
          <Check className="h-3 w-3" />
          Usar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs gap-1"
          onClick={() => onEdit(suggestion)}
        >
          <Pencil className="h-3 w-3" />
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onDismiss}
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}
