import { AlertTriangle, FileX, MapPinOff, Zap, Mail, CreditCard, Home, Save, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MissingDocsConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingItems: string[];
  leadNome: string;
  onSaveAsPending: () => void;
  onBack: () => void;
  isSaving: boolean;
}

function getItemIcon(item: string) {
  const lower = item.toLowerCase();
  if (lower.includes("identidade") || lower.includes("rg") || lower.includes("cnh"))
    return CreditCard;
  if (lower.includes("comprovante") && lower.includes("endereço"))
    return Home;
  if (lower.includes("e-mail") || lower.includes("email"))
    return Mail;
  if (lower.includes("localização"))
    return MapPinOff;
  if (lower.includes("disjuntor") || lower.includes("transformador"))
    return Zap;
  return FileX;
}

export function MissingDocsConfirmModal({
  open,
  onOpenChange,
  missingItems,
  leadNome,
  onSaveAsPending,
  onBack,
  isSaving,
}: MissingDocsConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header §25 */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Documentação Incompleta
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {leadNome} — {missingItems.length} {missingItems.length === 1 ? "item pendente" : "itens pendentes"}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
              <p className="text-sm text-foreground font-medium">
                Não é possível converter em venda sem completar os itens abaixo.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você pode salvar como pendente e completar depois.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Itens faltantes
              </p>
              <div className="space-y-1.5">
                {missingItems.map((item, idx) => {
                  const Icon = getItemIcon(item);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5"
                    >
                      <div className="w-7 h-7 rounded-md bg-destructive/10 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-destructive" />
                      </div>
                      <span className="text-sm text-foreground font-medium">{item}</span>
                      <Badge
                        variant="outline"
                        className="ml-auto text-[10px] bg-destructive/10 text-destructive border-destructive/30"
                      >
                        Pendente
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer §25 */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            disabled={isSaving}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveAsPending}
            disabled={isSaving}
          >
            {isSaving ? (
              "Salvando..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Salvar como Pendente
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
