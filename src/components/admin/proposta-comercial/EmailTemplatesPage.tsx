import { useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Mail, Copy, MessageCircle, Eye, Variable } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { renderTemplate, SAMPLE_TEMPLATE_VARS, TEMPLATE_VARIABLES_CATALOG } from "@/utils/templateRenderer";
import {
  useEmailTemplatesList,
  useSaveEmailTemplate,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";

const CANAL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ambos", label: "Ambos" },
];

const CANAL_ICON: Record<string, any> = {
  email: Mail,
  whatsapp: MessageCircle,
  ambos: Mail,
};

export function EmailTemplatesPage() {
  const { data: templates = [], isLoading: loading } = useEmailTemplatesList();
  const saveMutation = useSaveEmailTemplate();
  const deleteMutation = useDeleteEmailTemplate();
  const duplicateMutation = useDuplicateEmailTemplate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<EmailTemplate>>({});
  const [showPreview, setShowPreview] = useState(false);

  const startNew = () => {
    setEditingId("new");
    setForm({
      nome: "",
      assunto: "",
      corpo_html: "",
      corpo_texto: "",
      canal: "whatsapp",
      is_default: false,
      ativo: true,
      ordem: templates.length,
    });
    setShowPreview(false);
  };

  const startEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({ ...t });
    setShowPreview(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
    setShowPreview(false);
  };

  const handleSave = async () => {
    if (!form.nome) {
      toast({ title: "Preencha o nome do template", variant: "destructive" });
      return;
    }
    const canal = form.canal || "email";
    if ((canal === "email" || canal === "ambos") && !form.assunto) {
      toast({ title: "Preencha o assunto para templates de email", variant: "destructive" });
      return;
    }

    try {
      const payload: any = {
        nome: form.nome,
        assunto: form.assunto || "",
        corpo_html: form.corpo_html || "",
        corpo_texto: form.corpo_texto || null,
        canal,
        is_default: form.is_default ?? false,
        ativo: form.ativo ?? true,
        ordem: form.ordem ?? 0,
      };

      if (editingId === "new") {
        await saveMutation.mutateAsync({ data: payload });
        toast({ title: "Template criado!" });
      } else {
        await saveMutation.mutateAsync({ id: editingId!, data: payload });
        toast({ title: "Template atualizado!" });
      }
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Template excluído" });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const handleDuplicate = async (t: EmailTemplate) => {
    try {
      await duplicateMutation.mutateAsync({
        nome: `${t.nome} (cópia)`,
        assunto: t.assunto,
        corpo_html: t.corpo_html,
        corpo_texto: t.corpo_texto,
        canal: t.canal,
        is_default: false,
        ativo: false,
        ordem: templates.length,
      });
      toast({ title: "Template duplicado!" });
    } catch (e: any) {
      toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" });
    }
  };

  const copyVariable = (key: string) => {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast({ title: `{{${key}}} copiado!` });
  };

  const currentCanal = form.canal || "email";
  const showCorpoTexto = currentCanal === "whatsapp" || currentCanal === "ambos";
  const showCorpoHtml = currentCanal === "email" || currentCanal === "ambos";
  const previewText = showCorpoTexto
    ? renderTemplate(form.corpo_texto || "", SAMPLE_TEMPLATE_VARS)
    : renderTemplate(form.corpo_html || "", SAMPLE_TEMPLATE_VARS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Templates de Mensagem</h1>
            <p className="text-sm text-muted-foreground">
              Crie templates de WhatsApp e e-mail com variáveis dinâmicas para envio de propostas.
            </p>
          </div>
        </div>
        <Button onClick={startNew} className="gap-1.5" disabled={editingId !== null}>
          <Plus className="h-4 w-4" /> Novo Template
        </Button>
      </div>

      {/* Edit Form */}
      {editingId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Nome do template</Label>
                <Input
                  value={form.nome || ""}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Resumo Solar Padrão"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Canal</Label>
                <Select
                  value={currentCanal}
                  onValueChange={(v) => setForm((f) => ({ ...f, canal: v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {showCorpoHtml && (
              <>
                <div>
                  <Label className="text-xs">Assunto do email (suporta variáveis)</Label>
                  <Input
                    value={form.assunto || ""}
                    onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
                    placeholder="Proposta Solar - {{cliente_nome}}"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Corpo do e-mail (HTML com variáveis)</Label>
                  <Textarea
                    value={form.corpo_html || ""}
                    onChange={(e) => setForm((f) => ({ ...f, corpo_html: e.target.value }))}
                    placeholder={`<p>Olá {{cliente_nome}},</p>\n<p>Segue sua proposta...</p>`}
                    className="min-h-[150px] text-xs font-mono"
                  />
                </div>
              </>
            )}

            {showCorpoTexto && (
              <div>
                <Label className="text-xs">Corpo WhatsApp (texto com emojis e formatação *negrito*)</Label>
                <Textarea
                  value={form.corpo_texto || ""}
                  onChange={(e) => setForm((f) => ({ ...f, corpo_texto: e.target.value }))}
                  placeholder={`🌞 Olá, {{cliente_nome}}!\n\n*Sua proposta solar:*\n🔋 {{potencia_kwp}}kWp\n💵 R$ {{valor_total}}\n\n👉 {{proposta_link}}`}
                  className="min-h-[200px] text-xs"
                />
              </div>
            )}

            {/* Variables Catalog */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Variable className="h-3.5 w-3.5 text-primary" />
                <Label className="text-xs font-semibold">Variáveis disponíveis</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES_CATALOG.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2"
                    onClick={() => copyVariable(v.key)}
                    title={`${v.label} — Ex: ${v.example}`}
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {v.key}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Clique para copiar a variável para a área de transferência.
              </p>
            </div>

            <Separator />

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo ?? true}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
                <Label className="text-xs">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_default ?? false}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_default: v }))}
                />
                <Label className="text-xs">Template padrão</Label>
              </div>
            </div>

            {/* Preview */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs mb-2"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3 w-3" />
                {showPreview ? "Ocultar preview" : "Ver preview"}
              </Button>
              {showPreview && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Preview com dados de exemplo:</p>
                  <pre className="text-xs whitespace-pre-wrap text-foreground leading-relaxed">
                    {previewText || "(vazio)"}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" /> Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 && !editingId ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p className="text-sm">Nenhum template de mensagem criado.</p>
          <Button variant="default" onClick={startNew} className="mt-2">
            Criar primeiro template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const CanalIcon = CANAL_ICON[t.canal] || Mail;
            return (
              <Card key={t.id} className={`border-border/40 ${!t.ativo ? "opacity-50" : ""}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CanalIcon className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-semibold">{t.nome}</p>
                        <Badge variant="outline" className="text-[9px] shrink-0">
                          {t.canal}
                        </Badge>
                        {t.is_default && (
                          <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">
                            Padrão
                          </Badge>
                        )}
                        {!t.ativo && (
                          <Badge variant="destructive" className="text-[9px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      {t.assunto && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          Assunto: {t.assunto}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDuplicate(t)}
                        disabled={editingId !== null}
                        title="Duplicar"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(t)}
                        disabled={editingId !== null}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/60"
                        onClick={() => handleDelete(t.id)}
                        disabled={editingId !== null}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
