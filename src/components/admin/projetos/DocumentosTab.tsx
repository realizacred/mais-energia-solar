import { useState, useRef, useMemo, useCallback } from "react";
import { AlertTriangle, FileText, Trash2, Download, Plus, Loader2, Send, Eye, Ban, MoreVertical, MessageCircle, FileDown, PenLine } from "lucide-react";
import { SignatureModal, type SignerEntry } from "./SignatureModal";
import { WaSendDocModal } from "./WaSendDocModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters/index";

import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { FilePreviewTarget } from "./FilePreviewModal";
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
  const [waSendDoc, setWaSendDoc] = useState<{ doc: GeneratedDocRow; target: "cliente" | "consultor" } | null>(null);
  
  const { data: generatedDocsRaw = [], isLoading: loadingDocs } = useProjetoDocumentosGerados(dealId);
  const { data: templates = [] } = useDocTemplates();
  const { data: allProjectDocs } = useProjectDocuments({ dealId });
  
  const generatedDocs = useMemo(() => generatedDocsRaw, [generatedDocsRaw]);
  
  useDocumentosRealtimeSync(dealId);

  // Preview universal
  const [filePreview, setFilePreview] = useState<FilePreviewTarget | null>(null);

  // Buscar dados do cliente vinculado para validação pré-contrato
  const { data: clienteData } = useQuery({
    queryKey: ["projeto-cliente-validacao", dealId],
    queryFn: async () => {
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
      const { data: deal } = await supabase
        .from("deals")
        .select("owner_id")
        .eq("id", dealId)
        .maybeSingle();
      const consultorId = deal?.owner_id;
      if (!consultorId) {
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
      const { data, error } = await supabase.storage
        .from("document-files")
        .createSignedUrl(path, 3600);
      if (error || !data) throw error || new Error("Erro ao gerar URL");
      setPreviewDocId(doc.id);
      setPreviewUrl(data.signedUrl);
    } catch (err: any) {
      toast({
        title: "Erro ao abrir preview",
        description: err.message,
        variant: "destructive",
      });
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
      }
    }
    const tel = telefone.replace(/\D/g, "");
    const url = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  };

  const docsByCategory = useMemo(() => {
    const groups: Record<string, GeneratedDocRow[]> = {};
    for (const doc of generatedDocs) {
      const cat = doc.template_categoria || "outro";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    }
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return groups;
  }, [generatedDocs]);

  const sortedCategories = useMemo(() => {
    const cats = Object.keys(docsByCategory);
    return CATEGORY_ORDER.filter(c => cats.includes(c)).concat(cats.filter(c => !CATEGORY_ORDER.includes(c)));
  }, [docsByCategory]);

  const handleGenerate = () => {
    if (!selectedTemplateId) return;
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

  if (loadingDocs) {
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
                    const hasPdf = !!doc.pdf_path;
                    const sigStatus = doc.signature_status ? SIGNATURE_STATUS_MAP[doc.signature_status] : null;
                    const canSendForSignature = doc.status === "generated" && hasPdf && doc.signature_status !== "signed" && doc.signature_status !== "sent" && doc.signature_status !== "partially_signed";
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
                            <div className="flex items-center gap-2">
                              <Badge className={cn("text-[9px] px-1 h-3.5 uppercase tracking-tighter", statusCfg.color)}>
                                {statusCfg.label}
                              </Badge>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(doc.created_at)}
                              </p>
                            </div>
                            {(doc as any).motivo_cancelamento && (
                              <p className="text-[10px] text-destructive mt-0.5 font-medium">
                                Cancelado: {(doc as any).motivo_cancelamento}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
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

                            {hasPdf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                                title="Baixar PDF"
                                onClick={() => downloadGeneratedDoc(doc.pdf_path!)}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {doc.docx_filled_path && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                                title="Baixar DOCX"
                                onClick={() => downloadGeneratedDoc(doc.docx_filled_path!)}
                              >
                                <FileDown className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {hasPdf && doc.status !== "cancelled" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10"
                                    title="Enviar via WhatsApp"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setWaSendDoc({ doc, target: "cliente" })} className="gap-2">
                                    Enviar para Cliente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setWaSendDoc({ doc, target: "consultor" })} className="gap-2">
                                    Enviar para Consultor
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {canSendForSignature && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Enviar para assinatura"
                                onClick={() => setSignConfirmDoc(doc)}
                                disabled={signMutation.isPending}
                              >
                                {signMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {doc.status !== "cancelled" && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        cancelDocMutation.mutate({ 
                                          docId: doc.id, 
                                          motivo: "Substituído por nova versão",
                                          descricao: "Substituição automática"
                                        });
                                        setSelectedTemplateId(doc.template_id);
                                        setTimeout(() => handleGenerate(), 500);
                                      }} 
                                      className="gap-2"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Substituir por nova versão
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => setCancelDoc(doc)} className="gap-2 text-destructive">
                                      <Ban className="h-4 w-4" />
                                      Cancelar documento
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {doc.status === "cancelled" && (doc as any).pdf_cancelado_url && (
                                  <DropdownMenuItem onClick={() => window.open((doc as any).pdf_cancelado_url, "_blank")} className="gap-2">
                                    <Eye className="h-4 w-4" />
                                    Ver PDF cancelado
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuItem 
                                  onClick={() => deleteDocMutation.mutate(doc.id)} 
                                  className="gap-2 text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir documento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {isPreviewOpen && previewUrl && (
                          <div className="mx-3 mt-1 mb-3 p-1 border rounded-lg bg-muted/30 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <iframe
                              src={previewUrl}
                              className="w-full h-[320px] rounded border"
                              title="Preview Documento"
                            />
                          </div>
                        )}

                        {(doc.signature_status === "sent" || doc.signature_status === "partially_signed" || doc.signature_status === "signed") && (
                          <DocumentSignersPanel documentId={doc.id} signatureStatus={doc.signature_status} />
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

      <section className="space-y-3 mt-8">
        <ProjectDocumentsHub dealId={dealId} />
      </section>

      <SignatureModal
        open={!!signConfirmDoc}
        onClose={() => setSignConfirmDoc(null)}
        doc={signConfirmDoc}
        dealId={dealId}
        onSend={handleSendForSignature}
        isPending={signMutation.isPending}
      />

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Novo Documento</DialogTitle>
            <DialogDescription>Selecione um template para gerar o documento preenchido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clienteMissingFields.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Dados faltando no cliente:
                </p>
                <ul className="list-disc pl-4 grid grid-cols-2 gap-x-2">
                  {clienteMissingFields.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending || !selectedTemplateId || clienteMissingFields.length > 0}>
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Gerar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {waSendDoc && (
        <WaSendDocModal
          open={!!waSendDoc}
          onClose={() => setWaSendDoc(null)}
          document={waSendDoc.doc}
          projectId={dealId}
          clienteId={clienteData?.id}
          clienteNome={waSendDoc.target === "cliente" ? clienteData?.nome : consultorData?.nome}
          clienteTelefone={waSendDoc.target === "cliente" ? clienteTelefone : consultorTelefone}
        />
      )}
    </div>
  );
}
