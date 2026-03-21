import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Check, ClipboardList, AlertCircle, Plus, ChevronDown, ChevronUp, Camera, X, MessageSquare, CheckCircle2, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/dateUtils";
import { StorageFileGallery } from "@/components/ui-kit/StorageFileGallery";
import { SignaturePad, type SignaturePadRef } from "@/components/checklist/SignaturePad";
import {
  useChecklistTemplates,
  useChecklistsByProjeto,
  useChecklistDetail,
  useCriarChecklist,
  useToggleItem,
  useSalvarObservacao,
  useUploadFotoItem,
  useFinalizarChecklist,
  type ChecklistInstalador,
} from "@/hooks/useChecklistInstalador";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  dealId: string;
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning" },
  em_andamento: { label: "Em andamento", className: "bg-info/10 text-info" },
  concluido: { label: "Concluído", className: "bg-success/10 text-success" },
  cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
};

export function ProjetoInstalacaoTab({ dealId }: Props) {
  const { data: templates = [], isLoading: loadingTemplates } = useChecklistTemplates();
  const { data: checklists = [], isLoading: loadingChecklists } = useChecklistsByProjeto(dealId);
  const criarChecklist = useCriarChecklist();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finalizarOpen, setFinalizarOpen] = useState<string | null>(null);

  const loading = loadingTemplates || loadingChecklists;

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create checklist section */}
      {templates.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Iniciar Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Selecione um template para iniciar o checklist de instalação:
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => {
                const alreadyExists = checklists.some(
                  c => c.template_id === t.id && c.status !== "cancelado"
                );
                return (
                  <Button
                    key={t.id}
                    variant="outline"
                    size="sm"
                    disabled={criarChecklist.isPending || alreadyExists}
                    onClick={() => criarChecklist.mutate({ projetoId: dealId, templateId: t.id })}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t.nome}
                    {alreadyExists && <span className="text-[10px] text-muted-foreground">(já criado)</span>}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty states */}
      {checklists.length === 0 && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="font-medium">Nenhum checklist disponível</p>
          <p className="text-sm mt-1">Configure templates em Configurações para começar.</p>
        </div>
      )}

      {checklists.length === 0 && templates.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 text-warning/60" />
          <p className="text-sm">Nenhum checklist iniciado para este projeto.</p>
          <p className="text-xs mt-1">Use os botões acima para iniciar.</p>
        </div>
      )}

      {/* Existing checklists */}
      {checklists.map(checklist => (
        <ChecklistCard
          key={checklist.id}
          checklist={checklist}
          dealId={dealId}
          isExpanded={expandedId === checklist.id}
          onToggleExpand={() => setExpandedId(prev => prev === checklist.id ? null : checklist.id)}
          onFinalizar={() => setFinalizarOpen(checklist.id)}
        />
      ))}

      {/* Finalizar dialog */}
      {finalizarOpen && (
        <FinalizarDialog
          checklistId={finalizarOpen}
          projetoId={dealId}
          onClose={() => setFinalizarOpen(null)}
        />
      )}
    </div>
  );
}

/* ── Checklist Card ── */
function ChecklistCard({
  checklist, dealId, isExpanded, onToggleExpand, onFinalizar,
}: {
  checklist: ChecklistInstalador;
  dealId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFinalizar: () => void;
}) {
  const statusCfg = STATUS_MAP[checklist.status] || STATUS_MAP.pendente;
  const { items, respostas, arquivos, isLoading } = useChecklistDetail(
    isExpanded ? checklist.id : null,
    isExpanded ? checklist.template_id : null
  );

  const totalItems = items.length;
  const doneItems = respostas.filter(r => r.valor_boolean === true).length;
  const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
  const isConcluido = checklist.status === "concluido";

  return (
    <Card className="border-border/60">
      <button onClick={onToggleExpand} className="w-full text-left">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Checklist de Instalação</CardTitle>
              <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5", statusCfg.className)}>
                {statusCfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(checklist.created_at, { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          {isExpanded && totalItems > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className={cn("h-full rounded-full transition-all duration-300", doneItems === totalItems ? "bg-success" : "bg-primary")}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </CardHeader>
      </button>

      {isExpanded && (
        <CardContent className="space-y-1 pt-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Template sem itens configurados.</p>
          ) : (
            <>
              {items.map(item => {
                const resposta = respostas.find(r => r.template_item_id === item.id);
                const itemArquivos = arquivos.filter(a => a.resposta_id === resposta?.id);
                return (
                  <ChecklistItemRow
                    key={item.id}
                    checklistId={checklist.id}
                    item={item}
                    resposta={resposta || null}
                    arquivos={itemArquivos}
                    disabled={isConcluido}
                  />
                );
              })}

              {/* Summary + Finalizar */}
              <div className="flex items-center justify-between pt-3 px-3">
                <span className={cn("text-xs font-bold", doneItems === totalItems ? "text-success" : "text-muted-foreground")}>
                  {doneItems}/{totalItems} concluídos
                </span>
                <div className="flex items-center gap-2">
                  {doneItems < totalItems && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-[11px] text-warning">{totalItems - doneItems} pendente(s)</span>
                    </div>
                  )}
                  {!isConcluido && doneItems === totalItems && totalItems > 0 && (
                    <Button size="sm" onClick={onFinalizar} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Finalizar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ── Item Row ── */
function ChecklistItemRow({
  checklistId, item, resposta, arquivos, disabled,
}: {
  checklistId: string;
  item: { id: string; campo: string; obrigatorio: boolean };
  resposta: { id: string; template_item_id: string | null; valor_boolean: boolean | null; observacao: string | null } | null;
  arquivos: { id: string; url: string; nome_arquivo: string }[];
  disabled: boolean;
}) {
  const toggleItem = useToggleItem();
  const salvarObs = useSalvarObservacao();
  const uploadFoto = useUploadFotoItem();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showObs, setShowObs] = useState(false);
  const [obsText, setObsText] = useState(resposta?.observacao || "");
  const checked = resposta?.valor_boolean === true;

  const handleToggle = () => {
    if (disabled) return;
    toggleItem.mutate({
      checklistId,
      templateItemId: item.id,
      campo: item.campo,
      currentValue: resposta?.valor_boolean ?? null,
      existingRespostaId: resposta?.id,
    });
  };

  const handleSaveObs = () => {
    if (!obsText.trim() && !resposta?.observacao) return;
    salvarObs.mutate({
      checklistId,
      templateItemId: item.id,
      campo: item.campo,
      observacao: obsText.trim(),
      existingRespostaId: resposta?.id,
    });
    setShowObs(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !resposta?.id) return;
    uploadFoto.mutate({ checklistId, respostaId: resposta.id, file });
    e.target.value = "";
  };

  const fotoPaths = arquivos.map(a => a.url);

  return (
    <div className={cn("rounded-lg transition-all", checked ? "bg-success/5" : "bg-card")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          onClick={handleToggle}
          disabled={disabled || toggleItem.isPending}
          className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
            checked ? "bg-success border-success text-success-foreground" : "border-border bg-card"
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </button>
        <span className={cn("text-sm flex-1", checked ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
          {item.campo}
        </span>

        <div className="flex items-center gap-1">
          {item.obrigatorio && !checked && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-warning/30 text-warning">Obrigatório</Badge>
          )}
          {/* Observation toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", resposta?.observacao ? "text-primary" : "text-muted-foreground")}
            onClick={() => { setShowObs(!showObs); setObsText(resposta?.observacao || ""); }}
            disabled={disabled}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {/* Photo upload */}
          {resposta?.id && !disabled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadFoto.isPending}
            >
              <Camera className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Observation inline */}
      {showObs && (
        <div className="px-3 pb-2 space-y-1.5">
          <Textarea
            value={obsText}
            onChange={e => setObsText(e.target.value)}
            placeholder="Observação sobre este item..."
            className="min-h-[60px] text-xs"
            disabled={disabled}
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowObs(false)} className="h-7 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveObs} disabled={salvarObs.isPending} className="h-7 text-xs">
              {salvarObs.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {/* Existing observation badge */}
      {!showObs && resposta?.observacao && (
        <div className="px-10 pb-2">
          <p className="text-[11px] text-muted-foreground italic truncate">💬 {resposta.observacao}</p>
        </div>
      )}

      {/* Photos gallery */}
      {fotoPaths.length > 0 && (
        <div className="px-10 pb-2">
          <StorageFileGallery bucket="checklist-assets" filePaths={fotoPaths} />
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

/* ── Finalizar Dialog ── */
function FinalizarDialog({
  checklistId, projetoId, onClose,
}: {
  checklistId: string;
  projetoId: string;
  onClose: () => void;
}) {
  const finalizar = useFinalizarChecklist();
  const sigInstaladorRef = useRef<SignaturePadRef>(null);
  const sigClienteRef = useRef<SignaturePadRef>(null);

  const handleFinalizar = () => {
    const instSig = sigInstaladorRef.current?.getSignatureDataUrl() || null;
    const cliSig = sigClienteRef.current?.getSignatureDataUrl() || null;

    finalizar.mutate(
      { checklistId, projetoId, assinaturaInstaladorUrl: instSig, assinaturaClienteUrl: cliSig },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">Finalizar Checklist</DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Assine para concluir a instalação</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            <SignaturePad ref={sigInstaladorRef} label="Assinatura do Instalador" />
            <SignaturePad ref={sigClienteRef} label="Assinatura do Cliente" />
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={finalizar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleFinalizar} disabled={finalizar.isPending}>
            {finalizar.isPending ? "Finalizando..." : "Finalizar Instalação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
