import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, FileText, Loader2, AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface WaSendDocModalProps {
  open: boolean;
  onClose: () => void;
  document: {
    id: string;
    title: string;
    pdf_path?: string;
    storage_path?: string; // Compatibilidade com generated_documents ou document_files
  };
  projectId: string;
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string;
}

export function WaSendDocModal({
  open,
  onClose,
  document,
  projectId,
  clienteId,
  clienteNome,
  clienteTelefone: initialTelefone,
}: WaSendDocModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [instance, setInstance] = useState<any>(null);
  const [checkingInstance, setCheckingInstance] = useState(true);
  const [message, setMessage] = useState("");
  const [telefone, setTelefone] = useState(initialTelefone || "");
  const [sending, setSending] = useState(false);

  // Carregar instância conectada e dados do cliente se faltarem
  useEffect(() => {
    if (!open) return;

    async function loadData() {
      setCheckingInstance(true);
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user?.id)
          .maybeSingle();

        if (!profile?.tenant_id) return;

        // Buscar instância ativa
        const { data: instances } = await supabase
          .from("wa_instances")
          .select("id, nome, status, profile_name")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "connected")
          .limit(1);

        if (instances && instances.length > 0) {
          setInstance(instances[0]);
        }

        // Pré-preencher mensagem
        const docTitle = document.title;
        const msg = `Olá ${clienteNome || "cliente"}! 👋\n\nSegue o documento referente ao seu projeto solar:\n\n📄 ${docTitle}\n\nQualquer dúvida estou à disposição!`;
        setMessage(msg);
        
        if (initialTelefone) {
          setTelefone(initialTelefone);
        }
      } catch (error) {
        console.error("Erro ao carregar dados para envio:", error);
      } finally {
        setCheckingInstance(false);
      }
    }

    loadData();
  }, [open, user?.id, document.title, clienteNome, initialTelefone]);

  const handleSend = async () => {
    if (!instance) {
      toast({ title: "Nenhuma instância conectada", variant: "destructive" });
      return;
    }

    if (!telefone) {
      toast({ title: "Telefone do destinatário é obrigatório", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      const tenantId = profile?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      // 1. Gerar signed URL do documento (7 dias)
      const storagePath = document.pdf_path || document.storage_path;
      if (!storagePath) throw new Error("Caminho do arquivo não encontrado");

      const { data: signedData, error: signedError } = await supabase.storage
        .from("document-files")
        .createSignedUrl(storagePath, 604800);

      if (signedError || !signedData?.signedUrl) throw signedError || new Error("Erro ao gerar link do documento");
      const signedUrl = signedData.signedUrl;

      // 2. Buscar ou criar conversa do cliente
      let conversationId: string | null = null;
      if (clienteId) {
        const { data: conversation } = await supabase
          .from("wa_conversations")
          .select("id")
          .eq("cliente_id", clienteId)
          .eq("tenant_id", tenantId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        conversationId = conversation?.id || null;
      }

      // Se não tem conversa mas tem telefone, tenta buscar pelo telefone_normalized
      const telDigits = telefone.replace(/\D/g, "");
      if (!conversationId) {
        const { data: convByTel } = await supabase
          .from("wa_conversations")
          .select("id")
          .eq("cliente_telefone", telDigits)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        conversationId = convByTel?.id || null;
      }

      const finalMessage = `${message}\n\nLink: ${signedUrl}`;

      // 3. Enfileirar na wa_outbox via RPC
      const { error: rpcError } = await supabase.rpc("enqueue_wa_outbox_item", {
        p_tenant_id: tenantId,
        p_instance_id: instance.id,
        p_to_number: telDigits,
        p_message: finalMessage,
        p_media_url: signedUrl,
        p_conversation_id: conversationId,
        p_metadata: {
          project_id: projectId,
          document_id: document.id,
          source: "send_doc_modal"
        }
      });

      if (rpcError) throw rpcError;

      // 4. Gravar em wa_messages se tivermos conversationId
      if (conversationId) {
        await supabase.from("wa_messages").insert({
          conversation_id: conversationId,
          message_type: "documento",
          content: message,
          media_url: signedUrl,
          sent_by_user_id: user?.id,
          direction: "out",
          status: "sent"
        } as any);
      }

      toast({ 
        title: "Envio solicitado", 
        description: `O documento está sendo enviado para ${clienteNome || "o cliente"} via WhatsApp ✓` 
      });
      onClose();
    } catch (error: any) {
      console.error("Erro ao enviar WhatsApp:", error);
      toast({ 
        title: "Erro ao enviar", 
        description: error.message || "Ocorreu um erro inesperado", 
        variant: "destructive" 
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-success/10 rounded-lg">
              <MessageCircle className="h-5 w-5 text-success" />
            </div>
            <DialogTitle>Enviar via WhatsApp</DialogTitle>
          </div>
          <DialogDescription>
            Envie o documento selecionado através da instância conectada do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Documento Info */}
          <div className="bg-muted/50 p-4 rounded-xl border border-border/50">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Documento</Label>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-background rounded-lg border border-border/50">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{document.title}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Arquivo PDF</p>
              </div>
            </div>
          </div>

          {/* Destinatário */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Destinatário *</Label>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-muted-foreground font-medium">{clienteNome || "Nome não disponível"}</p>
                <Input
                  placeholder="Número do telefone (DDD + número)"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="bg-muted/30 border-border/50"
                />
              </div>
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Mensagem *</Label>
            <Textarea
              className="min-h-[160px] text-sm leading-relaxed bg-muted/30 border-border/50 focus:ring-primary/20"
              placeholder="Digite sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground italic">
              * O link do documento será anexado automaticamente ao final da mensagem.
            </p>
          </div>

          {/* Status da Instância */}
          <div className="bg-muted/50 p-3 rounded-lg border border-border/50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Instância</span>
              </div>
              
              {checkingInstance ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : instance ? (
                <Badge variant="outline" className="bg-success/5 border-success/20 text-success text-[10px] h-5 gap-1 py-0 px-2">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {instance.nome} — Conectada
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-destructive/5 border-destructive/20 text-destructive text-[10px] h-5 gap-1 py-0 px-2">
                  <AlertCircle className="h-2.5 w-2.5" />
                  Nenhuma conectada
                </Badge>
              )}
            </div>
          </div>

          {!checkingInstance && !instance && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-xs text-warning-foreground font-medium">
                    Nenhuma instância WhatsApp conectada no momento.
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-[10px] border-warning/30 hover:bg-warning/20"
                    onClick={() => {
                      onClose();
                      navigate("/admin/integracoes/whatsapp");
                    }}
                  >
                    Configurar WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button 
            className="bg-success hover:bg-success/90 text-white gap-2 min-w-[140px]"
            onClick={handleSend}
            disabled={sending || !instance || !telefone || checkingInstance}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            {sending ? "Enviando..." : "Enviar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
