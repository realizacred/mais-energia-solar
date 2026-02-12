import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  MessageCircle, 
  Copy, 
  Send, 
  Edit2, 
  Trash2, 
  Check,
  X,
  Loader2,
  Zap,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuickReply {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  emoji: string | null;
  ativo: boolean;
  ordem: number;
}

const CATEGORIA_COLORS: Record<string, string> = {
  "Primeiro Contato": "bg-secondary/10 text-secondary border-secondary/30",
  "Follow-up": "bg-warning/10 text-warning border-warning/30",
  "Comercial": "bg-primary/10 text-primary border-primary/30",
  "Proposta": "bg-primary/10 text-primary border-primary/30",
  "Documentação": "bg-info/10 text-info border-info/30",
  "Acompanhamento": "bg-success/10 text-success border-success/30",
  "Pós-venda": "bg-accent/10 text-accent-foreground border-accent/30",
  "Fechamento": "bg-success/10 text-success border-success/30",
  "Objeções": "bg-warning/10 text-warning border-warning/30",
  "Reativação": "bg-destructive/10 text-destructive border-destructive/30",
  "Instalação": "bg-info/10 text-info border-info/30",
  "Urgência": "bg-destructive/10 text-destructive border-destructive/30",
};

interface WhatsAppTemplatesProps {
  vendedorNome?: string;
  onSendToLead?: (mensagem: string, telefone: string, nome: string) => void;
}

export function WhatsAppTemplates({ vendedorNome = "Consultor", onSendToLead }: WhatsAppTemplatesProps) {
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<QuickReply | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [previewData, setPreviewData] = useState({
    nome: "João",
    telefone: "",
    consumo: "350",
    cidade: "São Paulo",
    potencia: "4.5",
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["wa_quick_replies_vendor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_replies")
        .select("*")
        .eq("ativo", true)
        .order("categoria")
        .order("ordem");
      if (error) throw error;
      return (data || []) as QuickReply[];
    },
  });

  const replaceVariables = (mensagem: string, data: Record<string, string> = {}) => {
    let result = mensagem;
    result = result.replace(/{vendedor}/g, vendedorNome);
    result = result.replace(/{consultor}/g, vendedorNome);
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    });
    return result;
  };

  const copyToClipboard = (template: QuickReply) => {
    const mensagem = replaceVariables(template.conteudo, previewData);
    navigator.clipboard.writeText(mensagem);
    toast({
      title: "Copiado! ✅",
      description: "Mensagem copiada para a área de transferência.",
    });
  };

  const openPreview = (template: QuickReply) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const sendViaWhatsApp = (template: QuickReply, telefone?: string) => {
    const mensagem = replaceVariables(template.conteudo, previewData);
    const encoded = encodeURIComponent(mensagem);
    const phone = telefone || previewData.telefone;
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${encoded}`, "_blank");
  };

  const sendViaAPI = async (template: QuickReply) => {
    const telefone = previewData.telefone.replace(/\D/g, "");
    if (!telefone) {
      toast({
        title: "Telefone obrigatório",
        description: "Informe o número de telefone para enviar via API.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Não autenticado",
          description: "Você precisa estar logado para enviar mensagens.",
          variant: "destructive",
        });
        return;
      }

      const mensagem = replaceVariables(template.conteudo, previewData);

      const response = await supabase.functions.invoke("send-whatsapp-message", {
        body: {
          telefone,
          mensagem,
          tipo: "manual",
        },
      });

      if (response.error) {
        const { parseInvokeError } = await import("@/lib/supabaseFunctionError");
        const parsed = await parseInvokeError(response.error);
        throw new Error(parsed.message);
      }

      const result = response.data;
      if (result.success) {
        toast({
          title: "Mensagem enviada! ✅",
          description: `Enviada para ${previewData.nome} via Evolution API.`,
        });
        setPreviewOpen(false);
      } else {
        throw new Error(result.error || "Falha ao enviar mensagem");
      }
    } catch (error: any) {
      console.error("Error sending WhatsApp via API:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, template) => {
    const cat = template.categoria || "Outros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, QuickReply[]>);

  const getCategoriaColor = (cat: string) =>
    CATEGORIA_COLORS[cat] || "bg-muted text-muted-foreground border-border";

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full w-full min-h-0 overflow-hidden">
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Carregando templates...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full w-full min-h-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            <CardTitle className="text-base">Templates WhatsApp</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {templates.length} templates
          </Badge>
        </div>
        <CardDescription>
          Mensagens prontas para agilizar seu atendimento
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto pr-1 min-h-0">
        {Object.entries(groupedTemplates).map(([categoria, categoryTemplates]) => (
          <div key={categoria} className="space-y-2">
            <Badge variant="outline" className={getCategoriaColor(categoria)}>
              {categoria}
            </Badge>
            <div className="space-y-2">
              {categoryTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {template.emoji && `${template.emoji} `}{template.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {template.conteudo}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(template)}
                        title="Copiar"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-success"
                        onClick={() => openPreview(template)}
                        title="Enviar"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum template cadastrado</p>
            <p className="text-xs mt-1">Templates são gerenciados pelo administrador</p>
          </div>
        )}
      </CardContent>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem</DialogTitle>
            <DialogDescription>
              Preencha os dados e escolha como enviar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg border">
              <label className="text-xs font-medium text-muted-foreground">Telefone do cliente *</label>
              <Input
                placeholder="(11) 99999-9999"
                value={previewData.telefone}
                onChange={(e) => setPreviewData({ ...previewData, telefone: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Obrigatório para envio direto via API
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome do cliente</label>
                <Input
                  value={previewData.nome}
                  onChange={(e) => setPreviewData({ ...previewData, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Consumo (kWh)</label>
                <Input
                  value={previewData.consumo}
                  onChange={(e) => setPreviewData({ ...previewData, consumo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cidade</label>
                <Input
                  value={previewData.cidade}
                  onChange={(e) => setPreviewData({ ...previewData, cidade: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Potência (kWp)</label>
                <Input
                  value={previewData.potencia}
                  onChange={(e) => setPreviewData({ ...previewData, potencia: e.target.value })}
                />
              </div>
            </div>
            {previewTemplate && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm whitespace-pre-wrap">
                  {replaceVariables(previewTemplate.conteudo, previewData)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (previewTemplate) sendViaWhatsApp(previewTemplate);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir WhatsApp Web
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                if (previewTemplate) sendViaAPI(previewTemplate);
              }}
              disabled={isSending || !previewData.telefone}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isSending ? "Enviando..." : "Enviar via API"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
