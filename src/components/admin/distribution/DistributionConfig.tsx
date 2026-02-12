import { useState } from "react";
import { Plus, Trash2, Settings, RotateCcw, MapPin, Users, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useDistributionRules, useDistributionLog, type DistributionRule } from "@/hooks/useDistribution";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_LABELS: Record<string, { label: string; icon: typeof RotateCcw; description: string }> = {
  round_robin: { label: "Round Robin", icon: RotateCcw, description: "Distribui sequencialmente entre consultores ativos" },
  manual: { label: "Manual", icon: Users, description: "Admin atribui manualmente cada lead" },
  regiao: { label: "Por Região", icon: MapPin, description: "Distribui com base no estado/cidade do lead" },
};

export function DistributionConfig() {
  const { rules, loading, upsertRule, deleteRule } = useDistributionRules();
  const logQuery = useDistributionLog(30);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<DistributionRule | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Distribuição de Leads</h2>
            <p className="text-sm text-muted-foreground">Configure regras de distribuição automática</p>
          </div>
        </div>
        <Button onClick={() => { setEditingRule(null); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Regra
        </Button>
      </div>

      {/* Active Rules */}
      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent></Card>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <RotateCcw className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-base font-semibold">Nenhuma regra configurada</p>
            <p className="text-sm text-muted-foreground">Crie uma regra para distribuir leads automaticamente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((rule) => {
            const tipo = TIPO_LABELS[rule.tipo] || TIPO_LABELS.manual;
            const TipoIcon = tipo.icon;
            return (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <TipoIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{rule.nome}</p>
                          <Badge variant={rule.ativo ? "default" : "secondary"}>
                            {rule.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{tipo.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setEditingRule(rule); setShowCreate(true); }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Distribution Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Distribuições</CardTitle>
          <CardDescription>Últimas 30 atribuições realizadas</CardDescription>
        </CardHeader>
        <CardContent>
          {logQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (logQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma distribuição registrada ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(logQuery.data || []).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {log.lead?.nome || "Lead"}{" "}
                      {log.lead?.lead_code && <span className="text-muted-foreground">({log.lead.lead_code})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      → {log.consultor?.nome || "Consultor"} · {log.motivo}
                    </p>
                  </div>
                  {log.distribuido_em && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(log.distribuido_em), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <RuleDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        rule={editingRule}
        onSave={async (data) => {
          await upsertRule(data);
          setShowCreate(false);
        }}
      />
    </div>
  );
}

function RuleDialog({
  open, onOpenChange, rule, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule: DistributionRule | null;
  onSave: (data: Partial<DistributionRule> & { nome: string; tipo: string }) => Promise<void>;
}) {
  const [nome, setNome] = useState(rule?.nome || "");
  const [tipo, setTipo] = useState(rule?.tipo || "round_robin");
  const [ativo, setAtivo] = useState(rule?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      await onSave({ id: rule?.id, nome: nome.trim(), tipo, ativo, config: {} });
    } finally {
      setSaving(false);
    }
  };

  // Reset form when rule changes
  useState(() => {
    setNome(rule?.nome || "");
    setTipo(rule?.tipo || "round_robin");
    setAtivo(rule?.ativo ?? true);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regra" : "Nova Regra de Distribuição"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da regra</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Round Robin Principal" />
          </div>
          <div>
            <Label>Tipo de distribuição</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round Robin</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="regiao">Por Região</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Ativa</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={saving || !nome.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
