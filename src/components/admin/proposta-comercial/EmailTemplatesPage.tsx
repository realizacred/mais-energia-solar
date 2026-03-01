import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Save, X, Mail, Send, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  ativo: boolean;
  ordem: number;
}

export function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<EmailTemplate>>({});

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proposta_email_templates" as any)
      .select("id, nome, assunto, corpo_html, ativo, ordem")
      .order("ordem", { ascending: true });
    setTemplates((data as unknown as EmailTemplate[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const startNew = () => {
    setEditingId("new");
    setForm({
      nome: "",
      assunto: "",
      corpo_html: "",
      ativo: true,
      ordem: templates.length,
    });
  };

  const startEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({ ...t });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
  };

  const handleSave = async () => {
    if (!form.nome || !form.assunto) {
      toast({ title: "Preencha nome e assunto", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        nome: form.nome,
        assunto: form.assunto,
        corpo_html: form.corpo_html || "",
        ativo: form.ativo ?? true,
        ordem: form.ordem ?? 0,
      };

      if (editingId === "new") {
        const { error } = await supabase
          .from("proposta_email_templates" as any)
          .insert(payload);
        if (error) throw error;
        toast({ title: "Modelo de e-mail criado!" });
      } else {
        const { error } = await supabase
          .from("proposta_email_templates" as any)
          .update(payload)
          .eq("id", editingId!);
        if (error) throw error;
        toast({ title: "Modelo atualizado!" });
      }
      cancelEdit();
      loadTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este modelo de e-mail?")) return;
    await supabase.from("proposta_email_templates" as any).delete().eq("id", id);
    toast({ title: "Modelo excluído" });
    loadTemplates();
  };

  const handleDuplicate = async (t: EmailTemplate) => {
    try {
      const { error } = await supabase.from("proposta_email_templates" as any).insert({
        nome: `${t.nome} (cópia)`,
        assunto: t.assunto,
        corpo_html: t.corpo_html,
        ativo: false,
        ordem: templates.length,
      });
      if (error) throw error;
      toast({ title: "Modelo duplicado!" });
      loadTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Modelos de E-mail
          </h1>
          <p className="text-sm text-muted-foreground">
            Crie templates de e-mail com variáveis do catálogo central para envio de propostas.
          </p>
        </div>
        <Button onClick={startNew} className="gap-1.5" disabled={editingId !== null}>
          <Plus className="h-4 w-4" /> Novo Modelo
        </Button>
      </div>

      {/* Edit Form */}
      {editingId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do modelo</Label>
                <Input
                  value={form.nome || ""}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Envio de proposta padrão"
                  className="h-8 text-xs"
                />
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
            <div>
              <Label className="text-xs">Assunto (suporta variáveis)</Label>
              <Input
                value={form.assunto || ""}
                onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
                placeholder="Proposta Solar - {{cliente.nome}}"
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use {"{{grupo.campo}}"} ou [campo] para inserir variáveis.
              </p>
            </div>
            <div>
              <Label className="text-xs">Corpo do e-mail (HTML com variáveis)</Label>
              <Textarea
                value={form.corpo_html || ""}
                onChange={(e) => setForm((f) => ({ ...f, corpo_html: e.target.value }))}
                placeholder={`<p>Olá {{cliente.nome}},</p>\n<p>Segue sua proposta de energia solar...</p>\n<p>Link: {{comercial.proposta_link}}</p>`}
                className="min-h-[200px] text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.ativo ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
              <Label className="text-xs">Ativo</Label>
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
          <p className="text-sm">Nenhum modelo de e-mail criado.</p>
          <Button variant="link" onClick={startNew} className="mt-2">
            Criar primeiro modelo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id} className={`border-border/40 ${!t.ativo ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm font-semibold">{t.nome}</p>
                      {!t.ativo && (
                        <Badge variant="destructive" className="text-[9px]">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Assunto: {t.assunto}
                    </p>
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
          ))}
        </div>
      )}
    </div>
  );
}
