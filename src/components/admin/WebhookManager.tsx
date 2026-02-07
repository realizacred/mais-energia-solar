import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, Loader2, ExternalLink, Copy } from "lucide-react";

interface WebhookConfig {
  id: string;
  nome: string;
  url: string;
  ativo: boolean;
  eventos: string[];
  created_at: string;
}

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nome: "", url: "" });
  const { toast } = useToast();

  const webhookEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead`;

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from("webhook_config")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error("Erro ao buscar webhooks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.nome.trim() || !formData.url.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("webhook_config").insert({
        nome: formData.nome.trim(),
        url: formData.url.trim(),
        eventos: ["INSERT", "UPDATE"],
      });

      if (error) throw error;

      toast({ title: "Webhook criado!", description: "O webhook foi configurado com sucesso." });
      setFormData({ nome: "", url: "" });
      setIsDialogOpen(false);
      fetchWebhooks();
    } catch (error) {
      console.error("Erro ao criar webhook:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o webhook.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from("webhook_config")
        .update({ ativo: !ativo })
        .eq("id", id);

      if (error) throw error;
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ativo: !ativo } : w))
      );
    } catch (error) {
      console.error("Erro ao atualizar webhook:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("webhook_config").delete().eq("id", id);
      if (error) throw error;
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Webhook removido!" });
    } catch (error) {
      console.error("Erro ao excluir webhook:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "URL copiada para a área de transferência." });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-primary" />
            <CardTitle className="text-brand-blue">Webhooks & Integrações</CardTitle>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: n8n, Zapier, Make"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL do Webhook</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Configure webhooks para integrar com n8n, Zapier, Make ou outros serviços de automação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Endpoint Info */}
        <div className="p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm font-medium mb-2">Endpoint para receber eventos:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background p-2 rounded border truncate">
              {webhookEndpoint}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(webhookEndpoint)}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Este endpoint recebe eventos automaticamente quando leads são criados ou atualizados.
          </p>
        </div>

        {/* Webhooks Table */}
        {webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum webhook configurado</p>
            <p className="text-sm">Adicione um webhook para integrar com serviços externos.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Eventos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="font-medium">{webhook.nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-48">
                      <span className="truncate text-sm text-muted-foreground">
                        {webhook.url}
                      </span>
                      <a
                        href={webhook.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.eventos.map((evento) => (
                        <Badge key={evento} variant="secondary" className="text-xs">
                          {evento}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={webhook.ativo}
                      onCheckedChange={() => handleToggle(webhook.id, webhook.ativo)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(webhook.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
