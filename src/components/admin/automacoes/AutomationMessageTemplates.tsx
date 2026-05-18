import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Save, Plus, Trash2, Edit2, Zap } from "lucide-react";
import { useAutomationMessageTemplates, useSaveAutomationMessageTemplate } from "@/hooks/useAutomationMessageTemplates";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { VariablesHelper } from "../wa-templates/VariablesHelper";

const GATILHOS = [
  { value: "projeto_movido", label: "Projeto Movido (Funil)" },
  { value: "proposta_gerada", label: "Proposta Gerada" },
  { value: "projeto_criado", label: "Projeto Criado (Lead)" },
];

const CANAIS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sistema", label: "Sistema (In-App)" },
];

export function AutomationMessageTemplates() {
  const { toast } = useToast();
  const { data: templates = [], isLoading } = useAutomationMessageTemplates();
  const saveMutation = useSaveAutomationMessageTemplate();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [form, setForm] = useState({
    gatilho: "projeto_movido",
    canal: "whatsapp",
    template: "",
    ativo: true
  });

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setForm({
      gatilho: template.gatilho,
      canal: template.canal,
      template: template.template,
      ativo: template.ativo
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setForm({
      gatilho: "projeto_movido",
      canal: "whatsapp",
      template: "",
      ativo: true
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync(editingTemplate ? { ...form, id: editingTemplate.id } : form);
      toast({ title: "Sucesso", description: "Template salvo com sucesso." });
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao salvar template.", variant: "destructive" });
    }
  };

  const handleToggle = async (template: any, checked: boolean) => {
    try {
      await saveMutation.mutateAsync({ id: template.id, ativo: checked });
    } catch (error) {
      toast({ title: "Erro", description: "Falha ao atualizar status.", variant: "destructive" });
    }
  };

  const handleInsertVariable = (variable: string) => {
    setForm(prev => ({ ...prev, template: prev.template + variable }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Mensagens Automáticas</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Personalize as mensagens enviadas automaticamente pelo sistema.
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gatilho</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">
                    {GATILHOS.find(g => g.value === template.gatilho)?.label || template.gatilho}
                  </TableCell>
                  <TableCell className="capitalize">{template.canal}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={template.ativo} 
                      onCheckedChange={(checked) => handleToggle(template, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum template configurado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>
              Defina o gatilho e a mensagem que será enviada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gatilho</Label>
                <Select 
                  value={form.gatilho} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, gatilho: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GATILHOS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select 
                  value={form.canal} 
                  onValueChange={(v) => setForm(prev => ({ ...prev, canal: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAIS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template da Mensagem</Label>
              <Textarea 
                value={form.template}
                onChange={(e) => setForm(prev => ({ ...prev, template: e.target.value }))}
                placeholder="Olá {nome_cliente}! Seu projeto solar está em andamento..."
                className="min-h-[150px]"
              />
              <VariablesHelper onInsert={handleInsertVariable} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
