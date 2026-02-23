import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  UserPlus,
  Calendar,
  Clock,
  ArrowRightLeft,
  RefreshCw,
  Eye,
} from "lucide-react";
import { TemplateSearchBar } from "./wa-templates/TemplateSearchBar";
import { WhatsAppPreview } from "./wa-templates/WhatsAppPreview";
import { VariablesHelper } from "./wa-templates/VariablesHelper";

interface AutomationTemplate {
  id: string;
  nome: string;
  tipo: string;
  gatilho_config: Record<string, any>;
  mensagem: string;
  ativo: boolean;
  ordem: number;
}

interface LeadStatus {
  id: string;
  nome: string;
}

const TIPO_OPTIONS = [
  { value: "boas_vindas", label: "Boas-vindas", icon: UserPlus, color: "bg-success" },
  { value: "mudanca_status", label: "Mudança de Status", icon: ArrowRightLeft, color: "bg-info" },
  { value: "inatividade", label: "Lembrete de Inatividade", icon: Clock, color: "bg-warning" },
  { value: "agendamento", label: "Confirmação de Agendamento", icon: Calendar, color: "bg-secondary" },
];

export function WhatsAppAutomationTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AutomationTemplate | null>(null);
  const [automacoesAtivas, setAutomacoesAtivas] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Search & filter
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formTipo, setFormTipo] = useState("boas_vindas");
  const [formMensagem, setFormMensagem] = useState("");
  const [formGatilhoConfig, setFormGatilhoConfig] = useState<Record<string, any>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesRes, statusesRes, configRes] = await Promise.all([
        supabase.from("whatsapp_automation_templates").select("id, nome, tipo, mensagem, gatilho_config, ativo, ordem, created_at, updated_at").order("ordem"),
        supabase.from("lead_status").select("id, nome").order("ordem"),
        supabase.from("whatsapp_automation_config").select("automacoes_ativas").maybeSingle(),
      ]);

      if (templatesRes.data) {
        setTemplates(templatesRes.data.map(t => ({
          ...t,
          gatilho_config: (typeof t.gatilho_config === 'object' && t.gatilho_config !== null) 
            ? t.gatilho_config as Record<string, any>
            : {}
        })));
      }
      if (statusesRes.data) setStatuses(statusesRes.data);
      if (configRes.data) setAutomacoesAtivas(configRes.data.automacoes_ativas || false);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
    setLoading(false);
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch = !search || t.nome.toLowerCase().includes(search.toLowerCase()) || t.mensagem.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === "todos" || t.tipo === filterTipo;
      return matchSearch && matchTipo;
    });
  }, [templates, search, filterTipo]);

  const handleToggleAutomacoes = async () => {
    const newValue = !automacoesAtivas;
    const { error } = await supabase
      .from("whatsapp_automation_config")
      .update({ automacoes_ativas: newValue })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar configuração", variant: "destructive" });
      return;
    }

    setAutomacoesAtivas(newValue);
    toast({
      title: newValue ? "Automações ativadas" : "Automações desativadas",
      description: newValue ? "As mensagens automáticas serão enviadas" : "Nenhuma mensagem automática será enviada",
    });
  };

  const handleToggleTemplate = async (template: AutomationTemplate) => {
    const { error } = await supabase
      .from("whatsapp_automation_templates")
      .update({ ativo: !template.ativo })
      .eq("id", template.id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao atualizar template", variant: "destructive" });
      return;
    }

    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, ativo: !t.ativo } : t))
    );
  };

  const handleEditTemplate = (template: AutomationTemplate) => {
    setEditingTemplate(template);
    setFormNome(template.nome);
    setFormTipo(template.tipo);
    setFormMensagem(template.mensagem);
    setFormGatilhoConfig(template.gatilho_config || {});
    setShowPreview(true);
    setIsDialogOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setFormNome("");
    setFormTipo("boas_vindas");
    setFormMensagem("");
    setFormGatilhoConfig({});
    setShowPreview(false);
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    const data = {
      nome: formNome,
      tipo: formTipo,
      mensagem: formMensagem,
      gatilho_config: formGatilhoConfig,
      ordem: editingTemplate?.ordem || templates.length + 1,
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from("whatsapp_automation_templates")
        .update(data)
        .eq("id", editingTemplate.id);

      if (error) {
        toast({ title: "Erro", description: "Falha ao atualizar template", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("whatsapp_automation_templates").insert(data);

      if (error) {
        toast({ title: "Erro", description: "Falha ao criar template", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Sucesso", description: editingTemplate ? "Template atualizado" : "Template criado" });
    setIsDialogOpen(false);
    fetchData();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    const { error } = await supabase.from("whatsapp_automation_templates").delete().eq("id", id);

    if (error) {
      toast({ title: "Erro", description: "Falha ao excluir template", variant: "destructive" });
      return;
    }

    toast({ title: "Template excluído" });
    fetchData();
  };

  const getTipoInfo = (tipo: string) => {
    return TIPO_OPTIONS.find((t) => t.value === tipo) || TIPO_OPTIONS[0];
  };

  const handleInsertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newMsg = formMensagem.substring(0, start) + variable + formMensagem.substring(end);
      setFormMensagem(newMsg);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      setFormMensagem(formMensagem + variable);
    }
  };

  const renderGatilhoConfig = () => {
    switch (formTipo) {
      case "boas_vindas":
        return (
          <div className="space-y-2">
            <Label>Delay (minutos)</Label>
            <Input
              type="number"
              min="0"
              value={formGatilhoConfig.delay_minutos || 0}
              onChange={(e) =>
                setFormGatilhoConfig({ ...formGatilhoConfig, delay_minutos: parseInt(e.target.value) || 0 })
              }
              placeholder="0 = envio imediato"
            />
            <p className="text-xs text-muted-foreground">Tempo de espera antes de enviar a mensagem</p>
          </div>
        );

      case "mudanca_status":
        return (
          <div className="space-y-2">
            <Label>Status de destino</Label>
            <Select
              value={formGatilhoConfig.status_destino || ""}
              onValueChange={(v) => setFormGatilhoConfig({ ...formGatilhoConfig, status_destino: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.nome}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Mensagem será enviada quando lead chegar neste status</p>
          </div>
        );

      case "inatividade":
        return (
          <div className="space-y-2">
            <Label>Dias sem contato</Label>
            <Input
              type="number"
              min="1"
              value={formGatilhoConfig.dias_sem_contato || 3}
              onChange={(e) =>
                setFormGatilhoConfig({ ...formGatilhoConfig, dias_sem_contato: parseInt(e.target.value) || 3 })
              }
            />
            <p className="text-xs text-muted-foreground">Após quantos dias sem contato enviar o lembrete</p>
          </div>
        );

      case "agendamento":
        return (
          <div className="space-y-2">
            <Label>Horas antes do agendamento</Label>
            <Input
              type="number"
              min="1"
              value={formGatilhoConfig.horas_antes || 24}
              onChange={(e) =>
                setFormGatilhoConfig({ ...formGatilhoConfig, horas_antes: parseInt(e.target.value) || 24 })
              }
            />
            <p className="text-xs text-muted-foreground">Quantas horas antes enviar o lembrete</p>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Automações de WhatsApp</CardTitle>
              <CardDescription>Configure mensagens automáticas para diferentes gatilhos</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={automacoesAtivas} onCheckedChange={handleToggleAutomacoes} />
              <span className="text-sm font-medium">
                {automacoesAtivas ? "Automações ativas" : "Automações desativadas"}
              </span>
            </div>
            <Button onClick={handleNewTemplate} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Novo Template
            </Button>
          </div>
        </div>
        {/* Search & Filter */}
        <div className="mt-4">
          <TemplateSearchBar
            search={search}
            onSearchChange={setSearch}
            filterTipo={filterTipo}
            onFilterTipoChange={setFilterTipo}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>{search || filterTipo !== "todos" ? "Nenhum template encontrado com esses filtros" : "Nenhum template de automação configurado"}</p>
            {!search && filterTipo === "todos" && (
              <Button variant="outline" className="mt-4" onClick={handleNewTemplate}>
                Criar primeiro template
              </Button>
            )}
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const tipoInfo = getTipoInfo(template.tipo);
            const TipoIcon = tipoInfo.icon;

            return (
              <div
                key={template.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  template.ativo ? "bg-card" : "bg-muted/50 opacity-60"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Switch checked={template.ativo} onCheckedChange={() => handleToggleTemplate(template)} />
                  <div className={`p-2 rounded-lg ${tipoInfo.color} text-primary-foreground`}>
                    <TipoIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{template.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {tipoInfo.label}
                      </Badge>
                      {template.tipo === "inatividade" && (
                        <span className="text-xs text-muted-foreground">
                          {template.gatilho_config?.dias_sem_contato || 3} dias
                        </span>
                      )}
                      {template.tipo === "agendamento" && (
                        <span className="text-xs text-muted-foreground">
                          {template.gatilho_config?.horas_antes || 24}h antes
                        </span>
                      )}
                      {template.tipo === "mudanca_status" && (
                        <span className="text-xs text-muted-foreground">
                          → {template.gatilho_config?.status_destino || "Qualquer"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-md">
                      {template.mensagem}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Dialog para criar/editar template */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template de Automação"}</DialogTitle>
            <DialogDescription>
              Configure quando e qual mensagem será enviada automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left: Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do template</Label>
                <Input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Boas-vindas ao novo lead"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de gatilho</Label>
                <Select value={formTipo} onValueChange={setFormTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {renderGatilhoConfig()}

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  ref={textareaRef}
                  value={formMensagem}
                  onChange={(e) => setFormMensagem(e.target.value)}
                  placeholder="Digite a mensagem..."
                  rows={5}
                />
                <VariablesHelper onInsert={handleInsertVariable} />
              </div>
            </div>

            {/* Right: Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              {showPreview && <WhatsAppPreview message={formMensagem} />}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} disabled={!formNome || !formMensagem}>
              {editingTemplate ? "Salvar" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
