import { useState, useRef, useMemo } from "react";
import { File, FileText, Paperclip, Upload, Trash2, Download, Plus, Loader2, Send, Eye, ChevronDown, Ban } from "lucide-react";
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
import {
  useProjetoArquivos,
  useProjetoDocumentosGerados,
  useDocTemplates,
  useUploadArquivo,
  useDeletarArquivo,
  useGerarDocumento,
  useEnviarParaAssinatura,
  downloadArquivo,
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
};

const SIGNATURE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  sent: { label: "Enviado", color: "bg-warning/10 text-warning border-warning/20" },
  viewed: { label: "Visualizado", color: "bg-info/10 text-info border-info/20" },
  signed: { label: "Assinado ✓", color: "bg-success/10 text-success border-success/20" },
  refused: { label: "Recusado", color: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive border-destructive/20" },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // §16: Queries em hooks — AP-01 resolvido
  const { data: files = [], isLoading: loadingFiles } = useProjetoArquivos(dealId);
  const { data: generatedDocs = [], isLoading: loadingDocs } = useProjetoDocumentosGerados(dealId);
  const { data: templates = [] } = useDocTemplates();

  // Fetch consultor phone if not passed as prop
  const { data: consultorData } = useQuery({
    queryKey: ["projeto-consultor-telefone", dealId],
    queryFn: async () => {
      const { data: projeto } = await supabase
        .from("projetos")
        .select("consultor_id")
        .eq("id", dealId)
        .maybeSingle();
      if (!projeto?.consultor_id) return null;
      const { data: consultor } = await supabase
        .from("consultores")
        .select("nome, telefone")
        .eq("id", projeto.consultor_id)
        .maybeSingle();
      return consultor;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !consultorTelefoneProp && !!dealId,
  });
  const consultorTelefone = consultorTelefoneProp || consultorData?.telefone;
  const consultorNome = consultorData?.nome;

  const uploadMutation = useUploadArquivo(dealId);
  const deleteMutation = useDeletarArquivo(dealId);
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

  const togglePreview = async (doc: GeneratedDocRow) => {
    if (previewDocId === doc.id) {
      setPreviewDocId(null);
      setPreviewUrl(null);
      return;
    }
    const path = doc.pdf_path;
    if (!path) return;
    const { data, error } = await supabase.storage
      .from("document-files")
      .createSignedUrl(path, 3600);
    if (error || !data) {
      toast({ title: "Erro ao abrir preview", variant: "destructive" });
      return;
    }
    setPreviewDocId(doc.id);
    setPreviewUrl(data.signedUrl);
  };

  const previewUpload = async (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    try {
      const tenantId = (await supabase.from("profiles").select("tenant_id").limit(1).single()).data?.tenant_id;
      if (!tenantId) return;
      const path = `${tenantId}/deals/${dealId}/${fileName}`;
      const { data } = await supabase.storage.from("projeto-documentos").createSignedUrl(path, 3600);
      if (!data?.signedUrl) return;
      if (["pdf", "png", "jpg", "jpeg", "webp"].includes(ext || "")) {
        window.open(data.signedUrl, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.download = fileName;
        a.click();
      }
    } catch {
      toast({ title: "Erro ao abrir arquivo", variant: "destructive" });
    }
  };

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

  const loading = loadingFiles || loadingDocs;

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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    uploadMutation.mutate(fileList, {
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  };

  const handleGenerate = () => {
    if (!selectedTemplateId) return;
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

  const handleSendForSignature = async (doc: GeneratedDocRow) => {
    try {
      const { tenantId } = await getCurrentTenantId();
      signMutation.mutate(
        { documentoId: doc.id, tenantId },
        { onSuccess: () => setSignConfirmDoc(null) }
      );
    } catch {
      toast({ title: "Erro ao obter tenant", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-5">
      {/* BLOCO 1: Documentos Gerados */}
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
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOCO 2: Arquivos Anexados */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-warning" />
            Arquivos Anexados
          </h3>
          <div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="gap-1.5">
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadMutation.isPending ? "Enviando..." : "Upload"}
            </Button>
          </div>
        </div>

        {files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Paperclip className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum arquivo</p>
              <p className="text-xs mt-1">Faça upload de documentos relacionados ao projeto</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-card border border-border/40 hover:border-border/70 transition-all cursor-pointer" onClick={() => previewUpload(f.name)}>
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name.replace(/^\d+_/, "")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(f.metadata?.size)} • {f.created_at ? formatDateTime(f.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualizar" onClick={(e) => { e.stopPropagation(); previewUpload(f.name); }}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar" onClick={(e) => { e.stopPropagation(); downloadArquivo(dealId, f.name); }}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(f.name); }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>


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
                <Button onClick={handleGenerate} disabled={!selectedTemplateId || generateMutation.isPending} className="gap-1.5">
                  {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  {generateMutation.isPending ? "Gerando..." : "Gerar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Signature Confirmation Dialog */}
      <AlertDialog open={!!signConfirmDoc} onOpenChange={(open) => !open && setSignConfirmDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Enviar para assinatura eletrônica
            </AlertDialogTitle>
            <AlertDialogDescription>
              O documento <strong>"{signConfirmDoc?.title}"</strong> será enviado para assinatura via ZapSign.
              Os signatários cadastrados receberão um e-mail para assinar digitalmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => signConfirmDoc && handleSendForSignature(signConfirmDoc)}
              disabled={signMutation.isPending}
              className="gap-1.5"
            >
              {signMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {signMutation.isPending ? "Enviando..." : "Enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
