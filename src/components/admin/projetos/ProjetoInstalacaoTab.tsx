import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Square, ClipboardList, AlertCircle, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

interface Template {
  id: string;
  nome: string;
  tipo: string;
  descricao: string | null;
}

interface TemplateItem {
  id: string;
  campo: string;
  tipo_campo: string;
  obrigatorio: boolean;
  ordem: number;
}

interface ChecklistInstalador {
  id: string;
  status: string;
  fase_atual: string | null;
  data_agendada: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  observacoes: string | null;
  created_at: string;
}

interface Resposta {
  id: string;
  template_item_id: string | null;
  campo: string;
  valor_boolean: boolean | null;
  observacao: string | null;
}

interface Props {
  dealId: string;
}

const STALE_TIME = 1000 * 60 * 5;

export function ProjetoInstalacaoTab({ dealId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [checklists, setChecklists] = useState<ChecklistInstalador[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch templates and existing checklists
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [tRes, cRes] = await Promise.all([
        supabase.from("checklist_templates").select("id, nome, tipo, descricao").eq("ativo", true).order("ordem"),
        supabase.from("checklists_instalador").select("id, status, fase_atual, data_agendada, data_inicio, data_fim, observacoes, created_at").eq("projeto_id", dealId).order("created_at", { ascending: false }),
      ]);
      setTemplates(tRes.data || []);
      setChecklists(cRes.data as ChecklistInstalador[] || []);
      setLoading(false);
    }
    load();
  }, [dealId]);

  // Create a new checklist from template
  const handleCreate = useCallback(async (templateId: string) => {
    setCreating(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.user.id)
        .single();

      const { data, error } = await supabase
        .from("checklists_instalador")
        .insert({
          projeto_id: dealId,
          instalador_id: user.user.id,
          template_id: templateId,
          status: "pendente",
          tenant_id: profile?.tenant_id,
        } as any)
        .select("id, status, fase_atual, data_agendada, data_inicio, data_fim, observacoes, created_at")
        .single();

      if (error) throw error;
      setChecklists(prev => [data as ChecklistInstalador, ...prev]);
      toast({ title: "Checklist criado", description: "Checklist de instalação iniciado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao criar checklist", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [dealId]);

  // Load items + respostas for a checklist
  const loadChecklistItems = useCallback(async (checklistId: string, templateId?: string) => {
    setLoadingItems(true);
    const [itemsRes, respostasRes] = await Promise.all([
      templateId
        ? supabase.from("checklist_template_items").select("id, campo, tipo_campo, obrigatorio, ordem").eq("template_id", templateId).order("ordem")
        : Promise.resolve({ data: [] }),
      supabase.from("checklist_instalador_respostas").select("id, template_item_id, campo, valor_boolean, observacao").eq("checklist_id", checklistId),
    ]);
    setItems(itemsRes.data as TemplateItem[] || []);
    setRespostas(respostasRes.data as Resposta[] || []);
    setLoadingItems(false);
  }, []);

  // Toggle a checklist item
  const toggleItem = useCallback(async (checklistId: string, templateItemId: string, campo: string, currentValue: boolean | null) => {
    const newVal = !currentValue;
    setSaving(true);

    // Check if resposta exists
    const existing = respostas.find(r => r.template_item_id === templateItemId);

    try {
      if (existing) {
        const { error } = await supabase
          .from("checklist_instalador_respostas")
          .update({ valor_boolean: newVal, conforme: newVal } as any)
          .eq("id", existing.id);
        if (error) throw error;
        setRespostas(prev => prev.map(r => r.id === existing.id ? { ...r, valor_boolean: newVal } : r));
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.user?.id || "").single();

        const { data, error } = await supabase
          .from("checklist_instalador_respostas")
          .insert({
            checklist_id: checklistId,
            template_item_id: templateItemId,
            campo,
            fase: "instalacao",
            valor_boolean: newVal,
            conforme: newVal,
            respondido_por: user?.user?.id,
            tenant_id: profile?.tenant_id,
          } as any)
          .select("id, template_item_id, campo, valor_boolean, observacao")
          .single();
        if (error) throw error;
        setRespostas(prev => [...prev, data as Resposta]);
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [respostas]);

  // Expand/collapse a checklist
  const handleExpand = useCallback(async (checklist: ChecklistInstalador) => {
    if (expandedId === checklist.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(checklist.id);

    // Find template_id for this checklist
    const { data } = await supabase
      .from("checklists_instalador")
      .select("template_id")
      .eq("id", checklist.id)
      .single();

    loadChecklistItems(checklist.id, data?.template_id || undefined);
  }, [expandedId, loadChecklistItems]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const STATUS_MAP: Record<string, { label: string; className: string }> = {
    pendente: { label: "Pendente", className: "bg-warning/10 text-warning" },
    em_andamento: { label: "Em andamento", className: "bg-info/10 text-info" },
    concluido: { label: "Concluído", className: "bg-success/10 text-success" },
    cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
  };

  return (
    <div className="space-y-6">
      {/* Create checklist section */}
      {templates.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Iniciar Checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Selecione um template para iniciar o checklist de instalação:
            </p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  disabled={creating}
                  onClick={() => handleCreate(t.id)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.nome}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing checklists */}
      {checklists.length === 0 && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="font-medium">Nenhum checklist disponível</p>
          <p className="text-sm mt-1">Configure templates em Configurações para começar.</p>
        </div>
      )}

      {checklists.length === 0 && templates.length > 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2 text-warning/60" />
          <p className="text-sm">Nenhum checklist iniciado para este projeto.</p>
          <p className="text-xs mt-1">Use os botões acima para iniciar.</p>
        </div>
      )}

      {checklists.map(checklist => {
        const statusCfg = STATUS_MAP[checklist.status] || STATUS_MAP.pendente;
        const isExpanded = expandedId === checklist.id;

        // Calculate progress from respostas when expanded
        const totalItems = items.length;
        const doneItems = respostas.filter(r => r.valor_boolean === true).length;
        const progress = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

        return (
          <Card key={checklist.id} className="border-border/60">
            <button
              onClick={() => handleExpand(checklist)}
              className="w-full text-left"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      Checklist de Instalação
                    </CardTitle>
                    <Badge variant="secondary" className={cn("text-[10px] h-5 px-1.5", statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(checklist.created_at, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
                {isExpanded && totalItems > 0 && (
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        doneItems === totalItems ? "bg-success" : "bg-primary"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </CardHeader>
            </button>

            {isExpanded && (
              <CardContent className="space-y-1 pt-0">
                {loadingItems ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Template sem itens configurados.
                  </p>
                ) : (
                  <>
                    {items.map(item => {
                      const resposta = respostas.find(r => r.template_item_id === item.id);
                      const checked = resposta?.valor_boolean === true;

                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(checklist.id, item.id, item.campo, resposta?.valor_boolean ?? null)}
                          disabled={saving}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left",
                            "hover:bg-muted/50",
                            checked ? "bg-success/5" : "bg-card"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                            checked
                              ? "bg-success border-success text-success-foreground"
                              : "border-border bg-card"
                          )}>
                            {checked && <Check className="h-3 w-3" />}
                          </div>
                          <span className={cn(
                            "text-sm flex-1",
                            checked ? "text-muted-foreground line-through" : "text-foreground font-medium"
                          )}>
                            {item.campo}
                          </span>
                          {item.obrigatorio && !checked && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 border-warning/30 text-warning">
                              Obrigatório
                            </Badge>
                          )}
                        </button>
                      );
                    })}

                    {/* Summary */}
                    <div className="flex items-center justify-between pt-3 px-3">
                      <span className={cn(
                        "text-xs font-bold",
                        doneItems === totalItems ? "text-success" : "text-muted-foreground"
                      )}>
                        {doneItems}/{totalItems} concluídos
                      </span>
                      {doneItems < totalItems && (
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-warning" />
                          <span className="text-[11px] text-warning">
                            {totalItems - doneItems} pendente(s)
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
