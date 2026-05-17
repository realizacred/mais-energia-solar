/**
 * ProjetoDocChecklist — Dynamic tenant-configurable document checklist.
 * §16: No queries in components — all in useProjetoChecklist hook.
 * Fallback: uses legacy deals.doc_checklist if no tenant items configured.
 */
import { useCallback, useRef } from "react";
import { Check, FileText, AlertCircle, Upload, Paperclip, Loader2, CreditCard, Zap, Home, Camera, ClipboardList, PenTool, CheckCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import {
  useChecklistItems,
  useChecklistStatus,
  useToggleChecklistItem,
  useUploadChecklistArquivo,
  type DocChecklistItem,
  type DocChecklistStatus,
} from "@/hooks/useProjetoChecklist";
import { useDealDocChecklist, useUpdateDealDocChecklist } from "@/hooks/useDealDocChecklist";
import { useProjectDocuments, useDownloadDocument, type ProjectDocument } from "@/hooks/useProjectDocuments";

// Legacy hardcoded items (fallback when tenant has no items configured)
const LEGACY_ITEMS = [
  { key: "rg_cnh", label: "RG/CNH dos Proprietários", icon: CreditCard, color: "text-blue-500" },
  { key: "conta_luz", label: "Conta de Luz (Última fatura)", icon: Zap, color: "text-yellow-500" },
  { key: "iptu_imovel", label: "IPTU/Documento do Imóvel", icon: Home, color: "text-orange-500" },
  { key: "fotos", label: "Fotos (Telhado, Padrão, Quadro)", icon: Camera, color: "text-purple-500" },
  { key: "autorizacao_art", label: "Autorização Concessionária (ART)", icon: ClipboardList, color: "text-blue-600" },
  { key: "contrato_assinado", label: "Contrato Assinado", icon: PenTool, color: "text-primary" },
];

interface Props {
  dealId: string;
  compact?: boolean;
}

export function ProjetoDocChecklist({ dealId, compact = false }: Props) {
  // Sync with project_documents SSOT
  const { data: canonicalData } = useProjectDocuments({ dealId });
  const canonicalDocs = canonicalData?.documents || [];

  // Dynamic items
  const { data: items = [], isLoading: loadingItems } = useChecklistItems();
  const { data: statuses = [], isLoading: loadingStatus } = useChecklistStatus(dealId);
  const toggleMutation = useToggleChecklistItem(dealId);
  const uploadMutation = useUploadChecklistArquivo(dealId);

  // Legacy fallback
  const { data: legacyChecklist = {}, isLoading: loadingLegacy } = useDealDocChecklist(dealId);
  const legacyMutation = useUpdateDealDocChecklist();
  const downloadMutation = useDownloadDocument();

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
    const files = Array.from(e.target.files || []);
    const itemId = pendingItemRef.current;
    if (files.length === 0 || !itemId) return;
    try {
      await Promise.all(files.map(file => uploadMutation.mutateAsync({ itemId, file })));
      toast({ title: files.length === 1 ? "Arquivo enviado" : `${files.length} arquivos enviados` });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      pendingItemRef.current = null;
    }
  };

  // ─── Computed ───────────────────────────────────
  // Map legacy keys (from LEGACY_ITEMS) to canonical categories (from project_documents)
  const LEGACY_CAT_MAP: Record<string, string> = {
    rg_cnh: "rg_cnh",
    conta_luz: "conta_luz",
    iptu_imovel: "iptu",
    fotos: "fotos_telhado",
    autorizacao_art: "art",
    contrato_assinado: "contrato",
  };

  const isLegacyItemChecked = (key: string) => {
    const isManuallyChecked = !!legacyChecklist[key];
    const canonicalCat = LEGACY_CAT_MAP[key];
    const hasCanonicalDoc = canonicalDocs.some(d => {
      const docCat = d.categoria?.toLowerCase().trim();
      // Handle potential variations like "RG/CNH" vs "rg_cnh"
      return docCat === canonicalCat || 
             (canonicalCat === 'rg_cnh' && (docCat === 'identidade' || docCat === 'rg' || docCat === 'cnh'));
    });
    return isManuallyChecked || hasCanonicalDoc;
  };

  const dynamicCompleted = items.filter(i => statusMap.get(i.id)?.concluido).length;
  const legacyCompleted = LEGACY_ITEMS.filter(d => isLegacyItemChecked(d.key)).length;
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
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="p-4 sm:p-4 pb-2 sm:pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Checklist de Documentos
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {completed} de {total} documentos entregues ({Math.round(progress)}%)
            </p>
          </div>
          <span className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full transition-colors",
            completed === total ? "bg-success/10 text-success" : completed > 0 ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"
          )}>
            {completed}/{total}
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-in-out",
              progress === 100 ? "bg-success" : progress > 40 ? "bg-amber-500" : "bg-orange-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-3 pt-0 sm:pt-0 space-y-0.5">
        <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleFileChange} />

        {useLegacy ? (
          // Legacy mode
          <div className="space-y-1">
            {LEGACY_ITEMS.map(item => {
              const checked = isLegacyItemChecked(item.key);
              const hasCanonicalDoc = canonicalDocs.find(d => {
                const docCat = d.categoria?.toLowerCase().trim();
                const canonicalCat = LEGACY_CAT_MAP[item.key];
                return docCat === canonicalCat || 
                       (canonicalCat === 'rg_cnh' && (docCat === 'identidade' || docCat === 'rg' || docCat === 'cnh'));
              });
              const IconComp = item.icon;
              
              return (
                <div
                  key={item.key}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left group",
                    checked ? "bg-success/10 border-success/10" : "bg-card border-transparent hover:bg-muted/30"
                  )}
                >
                  <button
                    onClick={() => handleLegacyToggle(item.key)}
                    disabled={legacyMutation.isPending}
                    className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      checked ? "bg-success border-success text-success-foreground" : "border-border bg-card"
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </button>
                  <div className={cn("p-1.5 rounded-md bg-muted shrink-0 transition-colors", checked && "bg-success/20")}>
                    <IconComp className={cn("h-4 w-4 shrink-0", checked ? "text-success" : item.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium transition-all", checked ? "text-success/80 line-through" : "text-foreground")}>
                      {item.label}
                    </p>
                    {checked && hasCanonicalDoc?.created_at && (
                      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5 text-success" />
                        Entregue em {formatDateShort(hasCanonicalDoc.created_at)}
                      </p>
                    )}
                  </div>
                  {checked && hasCanonicalDoc ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[10px] text-success hover:text-success hover:bg-success/10 gap-1.5"
                      onClick={() => window.open(hasCanonicalDoc.path, '_blank')}
                    >
                      <Paperclip className="h-3 w-3" />
                      Visualizar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                      onClick={() => handleUploadClick(item.key)}
                    >
                      <Upload className="h-3 w-3" />
                      Anexar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Dynamic mode
          <div className="space-y-1">
            {items.map(item => {
              const status = statusMap.get(item.id);
              const checked = !!status?.concluido;
              const hasFile = !!status?.arquivo_path;
              
              // Map dynamic item types to icons
              const getDynamicIcon = (label: string) => {
                const l = label.toLowerCase();
                if (l.includes("rg") || l.includes("cnh") || l.includes("cpf") || l.includes("identidade")) return CreditCard;
                if (l.includes("luz") || l.includes("energia") || l.includes("fatura")) return Zap;
                if (l.includes("iptu") || l.includes("casa") || l.includes("imovel")) return Home;
                if (l.includes("foto")) return Camera;
                if (l.includes("art") || l.includes("tecnico")) return ClipboardList;
                if (l.includes("contrato") || l.includes("assinatura")) return PenTool;
                return FileText;
              };
              const DynamicIcon = getDynamicIcon(item.label);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all border",
                    checked ? "bg-success/10 border-success/10" : "bg-card border-transparent hover:bg-muted/30",
                    item.obrigatorio && !checked && "border-destructive/20 bg-destructive/5"
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
                  <div className={cn("p-1.5 rounded-md bg-muted shrink-0 transition-colors", checked && "bg-success/20")}>
                    <DynamicIcon className={cn("h-4 w-4 shrink-0", checked ? "text-success" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium", checked ? "text-success/80 line-through" : "text-foreground")}>
                      {item.label}
                      {item.obrigatorio && !checked && <span className="text-destructive ml-1" title="Obrigatório">★</span>}
                    </p>
                    {checked && status?.updated_at && (
                      <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5 text-success" />
                        Concluído em {formatDateShort(status.updated_at)}
                      </p>
                    )}
                  </div>
                  {checked && hasFile ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[10px] text-success hover:text-success hover:bg-success/10 gap-1.5"
                      onClick={() => window.open(status.arquivo_path, '_blank')}
                    >
                      <Paperclip className="h-3 w-3" />
                      Visualizar
                    </Button>
                  ) : item.aceita_arquivo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                      onClick={() => handleUploadClick(item.id)}
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending && pendingItemRef.current === item.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Upload className="h-3 w-3" />
                      }
                      Anexar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
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
