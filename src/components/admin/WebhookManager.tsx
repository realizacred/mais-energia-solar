import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, ExternalLink, Copy } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useWebhookConfigs, useCreateWebhook, useToggleWebhook, useDeleteWebhook } from "@/hooks/useWebhookConfig";

export default function WebhookManager() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ nome: "", url: "" });
  const { toast } = useToast();

  const webhookEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead`;

  const { data: webhooks = [], isLoading: loading } = useWebhookConfigs();
  const createMut = useCreateWebhook();
  const toggleMut = useToggleWebhook();
  const deleteMut = useDeleteWebhook();

  const handleCreate = () => {
    if (!formData.nome.trim() || !formData.url.trim()) {
      toast({ title: "Erro", description: "Preencha todos os campos.", variant: "destructive" });
      return;
    }
    createMut.mutate({ nome: formData.nome.trim(), url: formData.url.trim(), eventos: ["INSERT", "UPDATE"] }, {
      onSuccess: () => {
        toast({ title: "Webhook criado!", description: "O webhook foi configurado com sucesso." });
        setFormData({ nome: "", url: "" });
        setIsDialogOpen(false);
      },
      onError: () => toast({ title: "Erro", description: "Não foi possível criar o webhook.", variant: "destructive" }),
    });
  };

  const handleToggle = (id: string, ativo: boolean) => {
    toggleMut.mutate({ id, ativo: !ativo });
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast({ title: "Webhook removido!" }),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "URL copiada para a área de transferência." });
  };

  if (loading) {
    return (
      <SectionCard icon={Webhook} title="Webhooks & Integrações" variant="neutral">
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={Webhook}
      title="Webhooks & Integrações"
      description="Configure webhooks para integrar com n8n, Zapier, Make ou outros serviços de automação."
      variant="neutral"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[90vw] max-w-lg">
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
              <Button onClick={handleCreate} disabled={createMut.isPending} className="w-full">
                {createMut.isPending ? <Spinner size="sm" /> : null}
                Salvar Webhook
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
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
          <EmptyState
            icon={Webhook}
            title="Nenhum webhook configurado"
            description="Adicione um webhook para integrar com serviços externos."
            action={{ label: "Novo Webhook", onClick: () => setIsDialogOpen(true), icon: Plus }}
          />
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
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
          </div>
        )}
      </div>
    </SectionCard>
  );
}
