import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  temperamentoAnterior: string;
  temperamentoNovo: string;
  urgenciaScore: number;
  sugestaoResposta?: string;
  onUsarSugestao: (texto: string) => void;
  onFechar: () => void;
}

export function RealtimeIntelligenceBanner({
  temperamentoAnterior,
  temperamentoNovo,
  urgenciaScore,
  sugestaoResposta,
  onUsarSugestao,
  onFechar,
}: Props) {
  const isHot = temperamentoNovo === "quente" || temperamentoNovo === "morno";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "p-3 border-b flex items-start gap-3 shrink-0",
        isHot
          ? "bg-destructive/10 border-destructive/20"
          : "bg-primary/10 border-primary/20"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isHot ? "bg-destructive/20" : "bg-primary/20"
        )}
      >
        {isHot ? (
          <Flame className="w-4 h-4 text-destructive" />
        ) : (
          <TrendingUp className="w-4 h-4 text-primary" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-foreground">
            Lead esquentou! 🔥
          </p>
          <Badge
            variant="outline"
            className={
              isHot
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-primary/10 text-primary border-primary/20"
            }
          >
            Urgência {urgenciaScore}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          Temperamento mudou de &ldquo;{temperamentoAnterior}&rdquo; para &ldquo;{temperamentoNovo}&rdquo;
        </p>

        {sugestaoResposta && (
          <div className="bg-card border border-border rounded-lg p-2 mb-2">
            <p className="text-xs text-muted-foreground mb-1">Sugestão de resposta:</p>
            <p className="text-sm text-foreground line-clamp-2">{sugestaoResposta}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {sugestaoResposta && (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onUsarSugestao(sugestaoResposta)}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Usar sugestão
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onFechar}
          >
            Ignorar
          </Button>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onFechar}
      >
        <X className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
