/**
 * ProjetoDocChecklist — Dynamic tenant-configurable document checklist.
 * §16: No queries in components — all in useProjetoChecklist hook.
 * Fallback: uses legacy deals.doc_checklist if no tenant items configured.
 */
import { useCallback, useRef } from "react";
import { Check, FileText, AlertCircle, Upload, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  useChecklistItems,
  useChecklistStatus,
  useToggleChecklistItem,
  useUploadChecklistArquivo,
  type DocChecklistItem,
  type DocChecklistStatus,
} from "@/hooks/useProjetoChecklist";
import { useDealDocChecklist, useUpdateDealDocChecklist } from "@/hooks/useDealDocChecklist";

// Legacy hardcoded items (fallback when tenant has no items configured)
const LEGACY_ITEMS = [
  { key: "rg_cnh", label: "RG/CNH dos Proprietários", icon: "🪪" },
  { key: "conta_luz", label: "Conta de Luz (Última fatura)", icon: "⚡" },
  { key: "iptu_imovel", label: "IPTU/Documento do Imóvel", icon: "🏠" },
  { key: "fotos", label: "Fotos (Telhado, Padrão, Quadro)", icon: "📷" },
  { key: "autorizacao_art", label: "Autorização Concessionária (ART)", icon: "📋" },
  { key: "contrato_assinado", label: "Contrato Assinado", icon: "✍️" },
];

interface Props {
  dealId: string;
  compact?: boolean;
}

export function ProjetoDocChecklist({ dealId, compact = false }: Props) {
  // Dynamic items
  const { data: items = [], isLoading: loadingItems } = useChecklistItems();
  const { data: statuses = [], isLoading: loadingStatus } = useChecklistStatus(dealId);
  const toggleMutation = useToggleChecklistItem(dealId);
  const uploadMutation = useUploadChecklistArquivo(dealId);

  // Legacy fallback
  const { data: legacyChecklist = {}, isLoading: loadingLegacy } = useDealDocChecklist(dealId);
  const legacyMutation = useUpdateDealDocChecklist();

  const useLegacy = !loadingItems && items.length === 0;
  const isLoading = loadingItems || (useLegacy ? loadingLegacy : loadingStatus);

  // Status lookup map
  const statusMap = new Map<string, DocChecklistStatus>();
  statuses.forEach(s => statusMap.set(s.item_id, s));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingItemRef = useRef<string | null>(null);

  // ─── Handlers ───────────────────────────────────
  const handleToggle = useCallback(async (itemId: string) => {
    const current = statusMap.get(itemId);
    const newVal = !(current?.concluido);
    try {
      await toggleMutation.mutateAsync({ itemId, concluido: newVal });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  }, [statusMap, toggleMutation]);

  const handleLegacyToggle = useCallback(async (key: string) => {
    const newVal = !legacyChecklist[key];
    try {
      await legacyMutation.mutateAsync({ dealId, checklist: { ...legacyChecklist, [key]: newVal } });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  }, [legacyChecklist, dealId, legacyMutation]);

  const handleUploadClick = (itemId: string) => {
    pendingItemRef.current = itemId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const itemId = pendingItemRef.current;
    if (!file || !itemId) return;
    try {
      await uploadMutation.mutateAsync({ itemId, file });
      toast({ title: "Arquivo enviado" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      pendingItemRef.current = null;
    }
  };

  // ─── Computed ───────────────────────────────────
  const dynamicCompleted = items.filter(i => statusMap.get(i.id)?.concluido).length;
  const legacyCompleted = LEGACY_ITEMS.filter(d => legacyChecklist[d.key]).length;
  const completed = useLegacy ? legacyCompleted : dynamicCompleted;
  const total = useLegacy ? LEGACY_ITEMS.length : items.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  // ─── Loading ────────────────────────────────────
  if (isLoading) {
    return compact ? (
      <Skeleton className="h-6 w-full" />
    ) : (
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ─── Compact mode ───────────────────────────────
  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Documentos
          </span>
          <span className={cn("font-bold", completed === total ? "text-success" : "text-muted-foreground")}>
            {completed}/{total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-300", completed === total ? "bg-success" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ─── Full mode ──────────────────────────────────
  return (
    <Card className="border-border/60">
      <CardHeader className="p-3 sm:p-3 pb-1 sm:pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Checklist de Documentos
          </CardTitle>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full",
            completed === total ? "bg-success/10 text-success" : completed > 0 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
          )}>
            {completed}/{total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
          <div
            className={cn("h-full rounded-full transition-all duration-300", completed === total ? "bg-success" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-3 pt-0 sm:pt-0 space-y-0.5">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {useLegacy ? (
          // Legacy mode
          LEGACY_ITEMS.map(item => {
            const checked = !!legacyChecklist[item.key];
            return (
              <button
                key={item.key}
                onClick={() => handleLegacyToggle(item.key)}
                disabled={legacyMutation.isPending}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all text-left hover:bg-muted/50",
                  checked ? "bg-success/5" : "bg-card"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                  checked ? "bg-success border-success text-success-foreground" : "border-border bg-card"
                )}>
                  {checked && <Check className="h-3 w-3" />}
                </div>
                <span className="text-base mr-1">{item.icon}</span>
                <span className={cn("text-sm flex-1", checked ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
                  {item.label}
                </span>
              </button>
            );
          })
        ) : (
          // Dynamic mode
          items.map(item => {
            const status = statusMap.get(item.id);
            const checked = !!status?.concluido;
            const hasFile = !!status?.arquivo_path;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all",
                  "hover:bg-muted/50",
                  checked ? "bg-success/5" : "bg-card"
                )}
              >
                <button
                  onClick={() => handleToggle(item.id)}
                  disabled={toggleMutation.isPending}
                  className="shrink-0"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                    checked ? "bg-success border-success text-success-foreground" : "border-border bg-card"
                  )}>
                    {checked && <Check className="h-3 w-3" />}
                  </div>
                </button>
                <span className="text-base mr-1">{item.icon}</span>
                <span className={cn("text-sm flex-1", checked ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
                  {item.label}
                  {item.obrigatorio && <span className="text-destructive ml-1">*</span>}
                </span>
                {hasFile && (
                  <Paperclip className="h-3.5 w-3.5 text-success shrink-0" />
                )}
                {item.aceita_arquivo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleUploadClick(item.id)}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending && pendingItemRef.current === item.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Upload className="h-3.5 w-3.5" />
                    }
                  </Button>
                )}
              </div>
            );
          })
        )}

        {completed < total && (
          <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-warning/5 border border-warning/20">
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="text-[11px] text-warning">
              {total - completed} documento(s) pendente(s)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
