import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Plus, Trash2, Settings, Clock } from "lucide-react";
import { useSlaRules, type SlaRule } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function SlaRulesManager() {
  const { rules, loading, upsertRule, deleteRule } = useSlaRules();
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<Partial<SlaRule> | null>(null);

  // Lead statuses
  const { data: statuses } = useQuery({
    queryKey: ["lead-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("lead_status").select("id, nome, ordem").order("ordem");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleSave = async () => {
    if (!editRule?.rule_name) return;
    await upsertRule(editRule as any);
    setEditRule(null);
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Regras de SLA</h3>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditRule({
              rule_name: "",
              max_minutes_to_first_contact: 60,
              max_minutes_to_next_followup: 1440,
              escalation_enabled: true,
              auto_create_task: true,
              task_priority: "P1",
              ativo: true,
            });
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </CardContent></Card>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="empty-state">
            <div className="empty-state-icon"><Settings className="h-6 w-6 text-muted-foreground" /></div>
            <p className="empty-state-title">Nenhuma regra SLA</p>
            <p className="empty-state-description">Configure regras para criação automática de tarefas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const status = statuses?.find((s) => s.id === rule.applies_to);
            return (
              <Card key={rule.id} className="hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{rule.rule_name}</p>
                        <Badge variant={rule.ativo ? "default" : "secondary"} className="text-[10px]">
                          {rule.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                        {rule.escalation_enabled && <Badge variant="outline" className="text-[10px]">Escalonamento</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {status && <span>Status: {status.nome}</span>}
                        <span>1º contato: {rule.max_minutes_to_first_contact}min</span>
                        <span>Follow-up: {Math.round(rule.max_minutes_to_next_followup / 60)}h</span>
                        <span>Prioridade: {rule.task_priority}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditRule(rule); setShowCreate(true); }}>Editar</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <FormModalTemplate
        open={showCreate}
        onOpenChange={(v) => { if (!v) { setEditRule(null); } setShowCreate(v); }}
        title={editRule?.id ? "Editar Regra SLA" : "Nova Regra SLA"}
        submitLabel="Salvar"
        onSubmit={handleSave}
        disabled={!editRule?.rule_name}
      >
          {editRule && (
            <>
              <div className="space-y-2">
                <Label>Nome da Regra *</Label>
                <Input value={editRule.rule_name || ""} onChange={(e) => setEditRule({ ...editRule, rule_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Aplicar quando lead entrar no status</Label>
                <Select value={editRule.applies_to || ""} onValueChange={(v) => setEditRule({ ...editRule, applies_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                  <SelectContent>
                    {(statuses || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormGrid>
                <div className="space-y-2">
                  <Label>1º Contato (min)</Label>
                  <Input type="number" value={editRule.max_minutes_to_first_contact || 60} onChange={(e) => setEditRule({ ...editRule, max_minutes_to_first_contact: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up (min)</Label>
                  <Input type="number" value={editRule.max_minutes_to_next_followup || 1440} onChange={(e) => setEditRule({ ...editRule, max_minutes_to_next_followup: Number(e.target.value) })} />
                </div>
              </FormGrid>
              <div className="space-y-2">
                <Label>Prioridade da Tarefa</Label>
                <Select value={editRule.task_priority || "P1"} onValueChange={(v) => setEditRule({ ...editRule, task_priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - Urgente</SelectItem>
                    <SelectItem value="P1">P1 - Alto</SelectItem>
                    <SelectItem value="P2">P2 - Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.auto_create_task ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, auto_create_task: v })} />
                  <Label>Criar tarefa automaticamente</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.escalation_enabled ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, escalation_enabled: v })} />
                  <Label>Habilitar escalonamento</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.ativo ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, ativo: v })} />
                  <Label>Regra ativa</Label>
                </div>
              </div>
            </>
          )}
      </FormModalTemplate>
    </div>
  );
}
