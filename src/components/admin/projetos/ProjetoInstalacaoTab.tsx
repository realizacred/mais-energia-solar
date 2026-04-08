import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, ClipboardList, CheckCircle, CheckCircle2,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Camera, X,
  MessageSquare, FileDown, Loader2, Check,
} from "lucide-react";
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
  pendente: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/30" },
  agendado: { label: "Agendado", className: "bg-info/10 text-info border-info/30" },
  em_andamento: { label: "Em andamento", className: "bg-primary/10 text-primary border-primary/30" },
  concluido: { label: "Concluído", className: "bg-success/10 text-success border-success/30" },
  cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

const TIPO_CONFIG: Record<string, {
  label: string;
  desc: string;
  iconBg: string;
  iconColor: string;
  Icon: typeof ClipboardList;
  badgeClass: string;
}> = {
  pre_instalacao: {
    label: "Pré-Instalação Solar",
    desc: "Checklist de preparação: vistoria, agendamento, aprovações e materiais antes da instalação",
    iconBg: "bg-warning/10 group-hover:bg-warning/20",
    iconColor: "text-warning",
    Icon: ClipboardList,
    badgeClass: "bg-warning/10 text-warning border-warning/30",
  },
  pos_instalacao: {
    label: "Pós-Instalação Solar",
    desc: "Checklist de entrega: testes, fotos, treinamento e documentação junto à concessionária",
    iconBg: "bg-success/10 group-hover:bg-success/20",
    iconColor: "text-success",
    Icon: CheckCircle,
    badgeClass: "bg-success/10 text-success border-success/30",
  },
};

export function ProjetoInstalacaoTab({ dealId }: Props) {
  const { data: templates = [], isLoading: loadingTemplates } = useChecklistTemplates();
  const { data: checklists = [], isLoading: loadingChecklists } = useChecklistsByProjeto(dealId);
  const criarChecklist = useCriarChecklist();

  // Gate: verificar se existe proposta aceita/principal
  // Gate RB-22: só permite instalação com proposta ACEITA (status aceita/ganha)
  // is_principal sozinho NÃO é suficiente — propostas migradas podem ser principal sem aceite
  const { data: temPropostaAceita = false } = useQuery({
    queryKey: ["proposta-aceita-gate", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("propostas_nativas")
        .select("id")
        .or(`deal_id.eq.${dealId},projeto_id.eq.${dealId}`)
        .in("status", ["aceita", "accepted", "aprovada", "ganha"])
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!dealId,
    staleTime: 1000 * 60 * 5,
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [finalizarOpen, setFinalizarOpen] = useState<string | null>(null);

  const loading = loadingTemplates || loadingChecklists;

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Determine which templates still need to be started
  const availableTemplates = templates.filter(
    t => !checklists.some(c => c.template_id === t.id && c.status !== "cancelado")
  );

  // Enrich checklists with template info
  const enrichedChecklists = checklists.map(c => {
    const tpl = templates.find(t => t.id === c.template_id);
    return { ...c, tipo: tpl?.tipo || "pre_instalacao", templateNome: tpl?.nome || "Checklist" };
  });

  const handleIniciar = (templateId: string) => {
    criarChecklist.mutate({ projetoId: dealId, templateId });
  };

  return (
    <div className="space-y-6 p-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Instalação</h2>
          <p className="text-xs text-muted-foreground">Gerencie as etapas de pré e pós-instalação</p>
        </div>
      </div>

      {/* ALERTA — sem proposta aceita */}
      {!temPropostaAceita && availableTemplates.length > 0 && checklists.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Nenhuma proposta aceita encontrada. Aceite uma proposta na aba <strong>Propostas</strong> antes de iniciar a instalação.
          </span>
        </div>
      )}

      {/* ALERTA — checklists órfãos sem proposta aceita */}
      {!temPropostaAceita && checklists.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Atenção: existem checklists de instalação mas <strong>não há proposta aceita</strong> neste projeto.
            Aceite uma proposta ou os checklists serão removidos automaticamente ao deletar as propostas.
          </span>
        </div>
      )}

      {/* CARDS DE INICIAR — templates disponíveis */}
      {availableTemplates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableTemplates.map(t => {
            const cfg = TIPO_CONFIG[t.tipo] || TIPO_CONFIG.pre_instalacao;
            const IconComp = cfg.Icon;
            return (
              <button
                key={t.id}
                onClick={() => handleIniciar(t.id)}
                disabled={criarChecklist.isPending || !temPropostaAceita}
                title={!temPropostaAceita ? "É necessário ter uma proposta aceita para iniciar a instalação" : undefined}
                className="flex flex-col items-start gap-3 p-5 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group disabled:opacity-50"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", cfg.iconBg)}>
                  <IconComp className={cn("w-5 h-5", cfg.iconColor)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.descricao || cfg.desc}</p>
                </div>
                <Badge variant="outline" className={cn("text-xs", cfg.badgeClass)}>
                  {criarChecklist.isPending ? "Criando..." : "Iniciar checklist"}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* CHECKLISTS INICIADOS */}
      {enrichedChecklists.length > 0 && (
        <div className="space-y-4">
          {enrichedChecklists.map(checklist => (
            <ChecklistCard
              key={checklist.id}
              checklist={checklist}
              tipo={checklist.tipo}
              dealId={dealId}
              isExpanded={expandedId === checklist.id}
              onToggleExpand={() => setExpandedId(prev => prev === checklist.id ? null : checklist.id)}
              onFinalizar={() => setFinalizarOpen(checklist.id)}
            />
          ))}
        </div>
      )}

      {/* EMPTY STATE — nenhum template e nenhum checklist */}
      {checklists.length === 0 && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-3">
            <ClipboardList className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum checklist disponível</p>
          <p className="text-xs text-muted-foreground mt-1">Configure templates de instalação nas Configurações para começar.</p>
        </div>
      )}

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
  checklist, tipo, dealId, isExpanded, onToggleExpand, onFinalizar,
}: {
  checklist: ChecklistInstalador;
  tipo: string;
  dealId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onFinalizar: () => void;
}) {
  const statusCfg = STATUS_MAP[checklist.status] || STATUS_MAP.pendente;
  const tipoCfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.pre_instalacao;
  const IconComp = tipoCfg.Icon;

  const { items, respostas, arquivos, isLoading } = useChecklistDetail(
    isExpanded ? checklist.id : null,
    isExpanded ? checklist.template_id : null
  );
  const [downloading, setDownloading] = useState(false);

  const totalItems = items.length;
  const doneItems = respostas.filter(r => r.valor_boolean === true).length;
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const isConcluido = checklist.status === "concluido";

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const res = await supabase.functions.invoke("generate-installation-report", {
        body: { checklist_id: checklist.id },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao gerar relatório");

      const html = typeof res.data === "string" ? res.data : await res.data?.text?.() || "";
      if (!html) throw new Error("Relatório vazio");

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Relatorio_Instalacao_${checklist.id.slice(0, 8)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório baixado com sucesso");
    } catch (err) {
      console.error("[download-report]", err);
      toast.error("Falha ao gerar relatório");
    } finally {
      setDownloading(false);
    }
  };

  const progressColor = progress === 100 ? "bg-success" : progress >= 50 ? "bg-primary" : "bg-warning";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div onClick={onToggleExpand} className="w-full text-left cursor-pointer" role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onToggleExpand()}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-md flex items-center justify-center", tipoCfg.iconBg)}>
              <IconComp className={cn("w-4 h-4", tipoCfg.iconColor)} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{tipoCfg.label}</p>
              <p className="text-xs text-muted-foreground">
                Iniciado em {formatDateTime(checklist.created_at, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", statusCfg.className)}>
              {statusCfg.label}
            </Badge>
            {isExpanded && totalItems > 0 && (
              <Badge variant="outline" className={cn(
                "text-xs",
                progress === 100 ? "bg-success/10 text-success border-success/30"
                  : progress >= 50 ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-warning/10 text-warning border-warning/30"
              )}>
                {progress}%
              </Badge>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {isExpanded && totalItems > 0 && (
        <div className="h-1 bg-muted">
          <div className={cn("h-full transition-all duration-500", progressColor)} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-border">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Template sem itens configurados.</p>
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

              {/* Summary + Actions */}
              <div className="flex items-center justify-between p-4 bg-muted/30">
                <span className={cn("text-xs font-bold", doneItems === totalItems ? "text-success" : "text-muted-foreground")}>
                  {doneItems}/{totalItems} concluídos
                </span>
                <div className="flex items-center gap-2">
                  {isConcluido && (
                    <Button variant="outline" size="sm" onClick={handleDownloadReport} disabled={downloading} className="gap-1.5">
                      {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                      Relatório PDF
                    </Button>
                  )}
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
        </div>
      )}
    </div>
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
    <div className={cn("transition-all", checked ? "bg-success/5" : "")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={handleToggle}
          disabled={disabled || toggleItem.isPending}
          className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
            checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-card"
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </button>
        <span className={cn("text-sm flex-1", checked ? "text-muted-foreground line-through" : "text-foreground font-medium")}>
          {item.campo}
        </span>

        <div className="flex items-center gap-1">
          {item.obrigatorio && !checked && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-destructive/10 text-destructive border-destructive/30">
              Obrigatório
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", resposta?.observacao ? "text-primary" : "text-muted-foreground")}
            onClick={() => { setShowObs(!showObs); setObsText(resposta?.observacao || ""); }}
            disabled={disabled}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
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

      {showObs && (
        <div className="px-4 pb-3 space-y-1.5">
          <Textarea
            value={obsText}
            onChange={e => setObsText(e.target.value)}
            placeholder="Observação sobre este item..."
            className="min-h-[60px] text-xs"
            disabled={disabled}
          />
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setShowObs(false)} className="h-7 text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSaveObs} disabled={salvarObs.isPending} className="h-7 text-xs">
              {salvarObs.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      )}

      {!showObs && resposta?.observacao && (
        <div className="px-12 pb-2">
          <p className="text-[11px] text-muted-foreground italic truncate">💬 {resposta.observacao}</p>
        </div>
      )}

      {fotoPaths.length > 0 && (
        <div className="px-12 pb-2">
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
            <p className="text-xs text-muted-foreground mt-0.5">Colha as assinaturas para concluir</p>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assinatura do Instalador</p>
              <SignaturePad ref={sigInstaladorRef} label="" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assinatura do Cliente</p>
              <SignaturePad ref={sigClienteRef} label="" />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={finalizar.isPending}>Cancelar</Button>
          <Button onClick={handleFinalizar} disabled={finalizar.isPending}>
            {finalizar.isPending ? "Finalizando..." : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
