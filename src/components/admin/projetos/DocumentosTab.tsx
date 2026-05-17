import { useState, useRef, useMemo, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { FileText, Trash2, Download, Plus, Loader2, Send, Eye, Ban } from "lucide-react";
import { SignatureModal, type SignerEntry } from "./SignatureModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { SunLoader } from "@/components/loading/SunLoader";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { FilePreviewModal, type FilePreviewTarget } from "./FilePreviewModal";
import { ProjectDocumentsHub } from "./ProjectDocumentsHub";
import { DocumentSignersPanel } from "./DocumentSignersPanel";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";
import {
  useProjetoDocumentosGerados,
  useDocTemplates,
  useGerarDocumento,
  useEnviarParaAssinatura,
  useDocumentosRealtimeSync,
  downloadGeneratedDoc,
  type GeneratedDocRow,
} from "@/hooks/useProjetoDocumentos";

// ─── Constants ────────────────────────────────────
const DOC_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  generating: { label: "Gerando...", color: "bg-info/10 text-info" },
  generated: { label: "Gerado", color: "bg-success/10 text-success" },
  sent_for_signature: { label: "Aguardando assinatura", color: "bg-warning/10 text-warning" },
  signed: { label: "Assinado ✓", color: "bg-success/10 text-success" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
  substituido: { label: "Substituído", color: "bg-muted text-muted-foreground" },
};

const SIGNATURE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  sent: { label: "Aguardando assinatura", color: "bg-warning/10 text-warning border-warning/20" },
  viewed: { label: "Visualizado", color: "bg-info/10 text-info border-info/20" },
  partially_signed: { label: "Parcialmente assinado", color: "bg-info/10 text-info border-info/20" },
  signed: { label: "Assinado ✓", color: "bg-success/10 text-success border-success/20" },
  refused: { label: "Recusado", color: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/20" },
  delivery_failed: { label: "Falha no envio", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const DOC_CATEGORY_LABELS: Record<string, string> = {
  contrato: "Contratos",
  procuracao: "Procurações",
  proposta: "Propostas",
  termo: "Termos",
  outro: "Outros",
};

/** Fixed display order for categories */
const CATEGORY_ORDER = ["contrato", "procuracao", "proposta", "termo", "outro"];

// ─── Helpers ──────────────────────────────────────
function formatSize(bytes: number | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Props ────────────────────────────────────────
interface DocumentosTabProps {
  dealId: string;
  clienteTelefone?: string;
  consultorTelefone?: string;
}

// ─── Component ────────────────────────────────────
export function DocumentosTab({ dealId, clienteTelefone, consultorTelefone: consultorTelefoneProp }: DocumentosTabProps) {
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [signConfirmDoc, setSignConfirmDoc] = useState<GeneratedDocRow | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cancelDoc, setCancelDoc] = useState<GeneratedDocRow | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelDescricao, setCancelDescricao] = useState("");
  // §16: Queries em hooks — AP-01 resolvido
  const { data: generatedDocsRaw = [], isLoading: loadingDocs } = useProjetoDocumentosGerados(dealId);
  const { data: templates = [] } = useDocTemplates();
  const { data: allProjectDocs } = useProjectDocuments({ dealId });
  
  const generatedDocs = useMemo(() => generatedDocsRaw, [generatedDocsRaw]);
  
  const recibos = useMemo(
    () => (allProjectDocs?.documents || []).filter((d) => d.origem === "recibo"),
    [allProjectDocs?.documents],
  );
  useDocumentosRealtimeSync(dealId);

  // Preview universal (compartilhado entre seção de gerados e Hub via prop)
  const [filePreview, setFilePreview] = useState<FilePreviewTarget | null>(null);

  // Buscar dados do cliente vinculado para validação pré-contrato
  const { data: clienteData } = useQuery({
    queryKey: ["projeto-cliente-validacao", dealId],
    queryFn: async () => {
      // dealId é deals.id — buscar projeto via deal_id (sistema dual: deals ≠ projetos)
      const { data: projeto } = await supabase
        .from("projetos")
        .select("cliente_id")
        .eq("deal_id", dealId)
        .maybeSingle();
      if (!projeto?.cliente_id) return null;
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome, cpf_cnpj, email, rua, numero, bairro, cidade, estado, cep")
        .eq("id", projeto.cliente_id)
        .maybeSingle();
      return cliente;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!dealId,
  });

  // Validação de campos obrigatórios do cliente para contrato
  const clienteMissingFields = useMemo(() => {
    if (!clienteData) return ["Cliente não vinculado ao projeto"];
    const missing: string[] = [];
    if (!clienteData.cpf_cnpj?.trim()) missing.push("CPF/CNPJ");
    if (!clienteData.email?.trim()) missing.push("E-mail");
    if (!clienteData.rua?.trim()) missing.push("Rua");
    if (!clienteData.numero?.trim()) missing.push("Número");
    if (!clienteData.bairro?.trim()) missing.push("Bairro");
    if (!clienteData.cidade?.trim()) missing.push("Cidade");
    if (!clienteData.estado?.trim()) missing.push("Estado");
    if (!clienteData.cep?.trim()) missing.push("CEP");
    return missing;
  }, [clienteData]);

  // Fetch consultor phone if not passed as prop
  const { data: consultorData } = useQuery({
    queryKey: ["projeto-consultor-telefone", dealId],
    queryFn: async () => {
      // dealId is a deals.id — get owner_id (consultor) from the deal
      const { data: deal } = await supabase
        .from("deals")
        .select("owner_id")
        .eq("id", dealId)
        .maybeSingle();
      const consultorId = deal?.owner_id;
      if (!consultorId) {
        // Fallback: try via projeto
        const { data: projeto } = await supabase
          .from("projetos")
          .select("consultor_id")
          .eq("deal_id", dealId)
          .maybeSingle();
        if (!projeto?.consultor_id) return null;
        const { data: consultor } = await supabase
          .from("consultores")
          .select("nome, telefone")
          .eq("id", projeto.consultor_id)
          .maybeSingle();
        return consultor;
      }
      const { data: consultor } = await supabase
        .from("consultores")
        .select("nome, telefone")
        .eq("id", consultorId)
        .maybeSingle();
      return consultor;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !consultorTelefoneProp && !!dealId,
  });
  const consultorTelefone = consultorTelefoneProp || consultorData?.telefone;
  const consultorNome = consultorData?.nome;

  const generateMutation = useGerarDocumento(dealId);
  const signMutation = useEnviarParaAssinatura(dealId);

  const queryClient = useQueryClient();
  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("generated_documents")
        .delete()
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-documentos-generated", dealId] });
      toast({ title: "Documento excluído" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const cancelDocMutation = useMutation({
    mutationFn: async ({ docId, motivo, descricao }: { docId: string; motivo: string; descricao?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("generated_documents")
        .update({ 
          status: "cancelled", 
          motivo_cancelamento: motivo,
          descricao_cancelamento: descricao || null,
          cancelado_at: new Date().toISOString(),
          cancelado_por: user?.id
        } as any)
        .eq("id", docId);
      if (error) throw error;

      // Chama a função para gerar o PDF com a faixa (cancel-document)
      try {
        await supabase.functions.invoke("cancel-document", {
          body: { document_id: docId, motivo }
        });
      } catch (e) {
        console.warn("Falha ao gerar PDF cancelado:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-documentos-generated", dealId] });
      toast({ title: "Documento cancelado" });
      setCancelDoc(null);
      setCancelMotivo("");
      setCancelDescricao("");
    },
    onError: (err: any) => {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    },
  });

  const togglePreview = async (doc: GeneratedDocRow) => {
    if (previewDocId === doc.id) {
      setPreviewDocId(null);
      setPreviewUrl(null);
      return;
    }
    const path = doc.pdf_path;
    if (!path) return;

    try {
      const pathParts = path.split("/");
      const filename = pathParts.pop()!;
      const parentPath = pathParts.join("/");

      // Validação de existência antes de abrir preview
      const { data: files, error: listError } = await supabase.storage
        .from("document-files")
        .list(parentPath, { search: filename });

      if (listError) throw listError;
      const exists = files?.some((f) => f.name === filename);

      if (!exists) {
        toast({
          title: "Arquivo não encontrado",
          description: "O arquivo não existe no servidor. Tente fazer o upload novamente.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.storage
        .from("document-files")
        .createSignedUrl(path, 3600);

      if (error || !data) throw error || new Error("Erro ao gerar URL");

      setPreviewDocId(doc.id);
      setPreviewUrl(data.signedUrl);
    } catch (err: any) {
      toast({
        title: "Erro ao abrir preview",
        description: err.message === "Object not found" ? "Arquivo não encontrado no servidor." : err.message,
        variant: "destructive",
      });
    }
  };

  // previewUpload removido — preview de uploads vive no ProjectDocumentsHub

  const enviarWhatsApp = async (doc: GeneratedDocRow, destinatario: "cliente" | "consultor") => {
    const telefone = destinatario === "cliente" ? clienteTelefone : consultorTelefone;
    if (!telefone) {
      toast({
        title: destinatario === "cliente" ? "Cliente sem telefone cadastrado" : "Consultor sem telefone cadastrado",
        variant: "destructive",
      });
      return;
    }
    let mensagem = `Olá! Segue o documento: ${doc.title}`;
    if (doc.pdf_path) {
      try {
        const { data } = await supabase.storage
          .from("document-files")
          .createSignedUrl(doc.pdf_path, 7 * 24 * 3600);
        if (data?.signedUrl) {
          mensagem += `\n\n${data.signedUrl}`;
        }
      } catch {
        // fire-and-forget per RB-25
      }
    }
    const tel = telefone.replace(/\D/g, "");
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  };

  const loading = loadingDocs;

  // Group generated docs by category, sorted by created_at desc within each group
  const docsByCategory = useMemo(() => {
    const groups: Record<string, GeneratedDocRow[]> = {};
    for (const doc of generatedDocs) {
      const cat = doc.template_categoria || "outro";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    }
    // Sort each group by created_at ascending so #1 is oldest within the category
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return groups;
  }, [generatedDocs]);

  /** Categories in fixed display order */
  const sortedCategories = useMemo(() => {
    const cats = Object.keys(docsByCategory);
    return CATEGORY_ORDER.filter(c => cats.includes(c)).concat(cats.filter(c => !CATEGORY_ORDER.includes(c)));
  }, [docsByCategory]);

  // Upload manual passou para o ProjectDocumentsHub (SSOT canônico)

  const handleGenerate = () => {
    if (!selectedTemplateId) return;
    // Bloquear se dados obrigatórios do cliente estão faltando
    if (clienteMissingFields.length > 0) {
      toast({
        title: "Dados do cliente incompletos",
        description: `Complete os campos: ${clienteMissingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    const tpl = templates.find(t => t.id === selectedTemplateId);
    generateMutation.mutate(
      { templateId: selectedTemplateId, templateNome: tpl?.nome },
      {
        onSuccess: () => {
          setGenerateOpen(false);
          setSelectedTemplateId("");
        },
      }
    );
  };

  const handleSendForSignature = async (signers: SignerEntry[]) => {
    if (!signConfirmDoc) return;
    try {
      const { tenantId } = await getCurrentTenantId();
      signMutation.mutate(
        {
          documentoId: signConfirmDoc.id,
          tenantId,
          signers: signers.map(s => ({
            name: s.name,
            email: s.email,
            cpf: s.cpf || undefined,
            phone: s.phone || undefined,
            role: s.role,
          })),
        },
        { onSuccess: () => setSignConfirmDoc(null) }
      );
    } catch {
      toast({ title: "Erro ao obter tenant", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />
        <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />
        <div className="h-12 w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: Documentos Gerados (workflow de assinatura) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documentos Gerados
          </h3>
          <Button size="sm" onClick={() => setGenerateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Gerar Documento
          </Button>
        </div>

        {generatedDocs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhum documento gerado</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Gerar Documento" para criar a partir de um template</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedCategories.map(cat => {
              const docs = docsByCategory[cat];
              return (
              <div key={cat} className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {DOC_CATEGORY_LABELS[cat] || cat}
                </h4>
                {docs.map((doc, idx) => {
                  const statusCfg = DOC_STATUS_MAP[doc.status] || DOC_STATUS_MAP.draft;
                  const hasDocx = !!doc.docx_filled_path;
                  const hasPdf = !!doc.pdf_path;
                  const sigStatus = doc.signature_status ? SIGNATURE_STATUS_MAP[doc.signature_status] : null;
                  const canSendForSignature = doc.status === "generated" && hasPdf && doc.signature_status !== "signed" && doc.signature_status !== "sent";
                  const isPreviewOpen = previewDocId === doc.id;

                  return (
                    <div key={doc.id} className="space-y-0">
                      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card border border-border/40 hover:border-border/70 transition-all">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            <span className="text-muted-foreground font-mono text-xs">#{idx + 1}</span>{" "}
                            {doc.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {doc.template_name} • {formatDateTime(doc.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {doc.status === "cancelled" && doc.observacao && (
                            <p className="text-[10px] text-destructive mt-0.5">Motivo: {doc.observacao}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                          {/* Eye — inline PDF preview */}
                          {hasPdf && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn("h-7 w-7", isPreviewOpen && "bg-primary/10 text-primary")}
                              title="Visualizar PDF"
                              onClick={() => togglePreview(doc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* PDF download */}
                          {hasPdf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] font-semibold rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"
                              title="Baixar PDF"
                              onClick={() => downloadGeneratedDoc(doc.pdf_path!)}
                            >
                              <Download className="h-3 w-3" />
                              PDF
                            </Button>
                          )}
                          {/* DOCX download */}
                          {hasDocx && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 px-2 text-[11px] font-semibold rounded-md bg-info/10 text-info hover:bg-info/20"
                              title="Baixar DOCX"
                              onClick={() => downloadGeneratedDoc(doc.docx_filled_path!)}
                            >
                              <Download className="h-3 w-3" />
                              DOCX
                            </Button>
                          )}
                          {/* Send for signature */}
                          {canSendForSignature && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              title="Enviar para assinatura"
                              onClick={() => setSignConfirmDoc(doc)}
                              disabled={signMutation.isPending}
                            >
                              {signMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {/* WhatsApp dropdown — send to client or consultor */}
                          {hasPdf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-success hover:text-success"
                                  title="Enviar via WhatsApp"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[180px]">
                                <DropdownMenuItem
                                  onClick={() => enviarWhatsApp(doc, "cliente")}
                                  disabled={!clienteTelefone}
                                  className="gap-2"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Enviar para Cliente
                                  {!clienteTelefone && <span className="text-[10px] text-muted-foreground ml-auto">(sem tel.)</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => enviarWhatsApp(doc, "consultor")}
                                  disabled={!consultorTelefone}
                                  className="gap-2"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Enviar para Consultor
                                  {!consultorTelefone && <span className="text-[10px] text-muted-foreground ml-auto">(sem tel.)</span>}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {/* Cancel document */}
                          {doc.status === "generated" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-warning hover:text-warning"
                              title="Cancelar documento"
                              onClick={() => setCancelDoc(doc)}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            title="Excluir documento"
                            disabled={deleteDocMutation.isPending}
                            onClick={() => {
                              if (confirm("Excluir este documento?")) {
                                deleteDocMutation.mutate(doc.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {sigStatus ? (
                          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 shrink-0", sigStatus.color)}>
                            {sigStatus.label}
                          </Badge>
                        ) : (
                          <Badge className={cn("text-[10px] h-5 px-1.5 border-0 shrink-0", statusCfg.color)}>
                            {statusCfg.label}
                          </Badge>
                        )}
                      </div>
                      {/* Inline PDF preview panel */}
                      {isPreviewOpen && previewUrl && (
                        <div className="mx-3 mb-2 rounded-lg border border-border overflow-hidden bg-muted/30">
                          <iframe
                            src={previewUrl}
                            className="w-full h-[70vh] border-0"
                            title={`Preview: ${doc.title}`}
                          />
                        </div>
                      )}
                      {/* Per-signer status panel — shown while signature flow is in progress */}
                      {(doc.signature_status === "sent" ||
                        doc.signature_status === "viewed" ||
                        doc.signature_status === "partially_signed") && (
                        <DocumentSignersPanel
                          documentId={doc.id}
                          signatureStatus={doc.signature_status}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO 2: Recibos emitidos (espelhados de recibos_emitidos via project_documents) */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-success" />
          Recibos
          {recibos.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">{recibos.length}</Badge>
          )}
        </h3>
        {recibos.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-xs text-muted-foreground">Nenhum recibo emitido para este projeto.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {recibos.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card border border-border/40 hover:border-border/70 transition-all"
              >
                <FileText className="h-4 w-4 text-success shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateTime(r.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={async () => {
                    const { data, error } = await supabase.storage
                      .from(r.bucket)
                      .createSignedUrl(r.storage_path, 3600);
                    if (error || !data) {
                      toast({ title: "Erro ao abrir recibo", description: error?.message, variant: "destructive" });
                      return;
                    }
                    window.open(data.signedUrl, "_blank");
                  }}
                  title="Abrir recibo"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 3: Central documental canônica (project_documents SSOT)
          Engloba: uploads manuais, custom fields, checklist, pós-venda e arquivos legados. */}
      <ProjectDocumentsHub dealId={dealId} />

      <FilePreviewModal target={filePreview} onClose={() => setFilePreview(null)} />

      {/* Generate Document Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Gerar documento</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">Selecione um modelo para gerar o documento com os dados do projeto.</DialogDescription>
            </div>
          </DialogHeader>
          {templates.length === 0 ? (
            <div className="p-5 py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Nenhum modelo de documento cadastrado</p>
              <p className="text-xs text-muted-foreground">Cadastre templates em <strong>Configurações → Documentos</strong> para poder gerar documentos.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 p-5 space-y-4">
                {clienteMissingFields.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-destructive">Dados do cliente incompletos</p>
                      <p className="text-[11px] text-destructive/80 mt-0.5">
                        Preencha antes de gerar: <strong>{clienteMissingFields.join(", ")}</strong>
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Modelo <span className="text-destructive">*</span></Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(
                        templates.reduce<Record<string, typeof templates>>((acc, t) => {
                          const cat = DOC_CATEGORY_LABELS[t.categoria] || t.categoria;
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(t);
                          return acc;
                        }, {})
                      ).map(([cat, tpls]) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                          {tpls.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
                <Button variant="ghost" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={!selectedTemplateId || generateMutation.isPending || clienteMissingFields.length > 0} className="gap-1.5">
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {generateMutation.isPending ? "Gerando..." : "Gerar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Modal with signatories */}
      <SignatureModal
        open={!!signConfirmDoc}
        onClose={() => setSignConfirmDoc(null)}
        doc={signConfirmDoc}
        dealId={dealId}
        onSend={handleSendForSignature}
        isPending={signMutation.isPending}
      />

      {/* Cancel Document Dialog */}
      <Dialog open={!!cancelDoc} onOpenChange={(open) => { if (!open) { setCancelDoc(null); setCancelMotivo(""); setCancelDescricao(""); } }}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 text-warning" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">Cancelar documento</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  O documento "{cancelDoc?.title}" será marcado como cancelado. Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo do cancelamento *</Label>
              <Select value={cancelMotivo} onValueChange={setCancelMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Erro no documento">Erro no documento</SelectItem>
                  <SelectItem value="Condições alteradas">Condições alteradas</SelectItem>
                  <SelectItem value="Cliente solicitou">Cliente solicitou</SelectItem>
                  <SelectItem value="Substituído por nova versão">Substituído por nova versão</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição adicional</Label>
              <Textarea
                value={cancelDescricao}
                onChange={(e) => setCancelDescricao(e.target.value)}
                placeholder="Ex: Valor estava incorreto..."
                rows={3}
              />
            </div>
            <p className="text-[10px] text-destructive font-medium uppercase tracking-wider">
              ⚠ Esta ação não pode ser desfeita
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setCancelDoc(null); setCancelMotivo(""); setCancelDescricao(""); }}>Voltar</Button>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-white"
              disabled={cancelDocMutation.isPending || !cancelMotivo}
              onClick={() => cancelDoc && cancelDocMutation.mutate({ docId: cancelDoc.id, motivo: cancelMotivo, descricao: cancelDescricao })}
            >
              {cancelDocMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Ban className="h-4 w-4 mr-1.5" />}
              Cancelar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
