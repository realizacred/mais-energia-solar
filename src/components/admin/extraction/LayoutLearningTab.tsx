/**
 * LayoutLearningTab — Aba de Aprendizado de Layouts na Central de Extração.
 * Permite visualizar layouts detectados, analisar campos e criar regras reutilizáveis.
 */
import { useState } from "react";
import { BookOpen, Eye, Search, CheckCircle2, AlertTriangle, XCircle, Brain, Layers, Plus, Trash2, BookOpenCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useLayoutLearningEvents,
  useLayoutLearningStats,
  useUpdateLayoutEventStatus,
  useLayoutLearningRules,
  useSaveLayoutRule,
  useDeleteLayoutRule,
  type LayoutLearningEvent,
  type LayoutLearningRule,
} from "@/hooks/useLayoutLearning";
import { toast } from "sonner";
import { format } from "date-fns";

const LEARNING_STATUS_MAP: Record<string, { label: string; className: string }> = {
  new: { label: "Novo", className: "bg-info/10 text-info border-info/20" },
  analyzing: { label: "Em análise", className: "bg-warning/10 text-warning border-warning/20" },
  learned: { label: "Aprendido", className: "bg-success/10 text-success border-success/20" },
  ignored: { label: "Ignorado", className: "bg-muted text-muted-foreground border-border" },
};

const EXTRACTION_STATUS_MAP: Record<string, { label: string; className: string }> = {
  success: { label: "Sucesso", className: "bg-success/10 text-success border-success/20" },
  partial: { label: "Parcial", className: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Falha", className: "bg-destructive/10 text-destructive border-destructive/20" },
  needs_ocr: { label: "Precisa OCR", className: "bg-info/10 text-info border-info/20" },
};

const EXTRACTION_TYPES = [
  { value: "regex", label: "Regex" },
  { value: "label_proximity", label: "Proximidade de label" },
  { value: "line_match", label: "Linha com palavra-chave" },
  { value: "block_match", label: "Bloco delimitado" },
  { value: "position_hint", label: "Heurística posicional" },
];

export function LayoutLearningTab() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterExtraction, setFilterExtraction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<LayoutLearningEvent | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    rule_name: "",
    field_name: "",
    extraction_type: "regex",
    pattern: "",
    fallback_pattern: "",
    is_required: false,
    notes: "",
  });

  const { data: stats, isLoading: statsLoading } = useLayoutLearningStats();
  const { data: events = [], isLoading } = useLayoutLearningEvents({
    learning_status: filterStatus !== "all" ? filterStatus : undefined,
    extraction_status: filterExtraction !== "all" ? filterExtraction : undefined,
  });
  const updateStatus = useUpdateLayoutEventStatus();
  const { data: rules = [] } = useLayoutLearningRules(
    selectedEvent?.concessionaria_code,
    selectedEvent?.layout_signature
  );
  const saveRule = useSaveLayoutRule();
  const deleteRule = useDeleteLayoutRule();

  const filteredEvents = events.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.concessionaria_nome.toLowerCase().includes(s) ||
      e.concessionaria_code.toLowerCase().includes(s) ||
      e.layout_signature.toLowerCase().includes(s)
    );
  });

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, learning_status: status });
      toast.success(`Status atualizado para "${LEARNING_STATUS_MAP[status]?.label || status}"`);
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSaveRule = async () => {
    if (!selectedEvent || !ruleForm.rule_name || !ruleForm.field_name || !ruleForm.pattern) {
      toast.error("Preencha nome, campo e padrão da regra");
      return;
    }
    try {
      await saveRule.mutateAsync({
        concessionaria_code: selectedEvent.concessionaria_code,
        layout_signature: selectedEvent.layout_signature,
        rule_name: ruleForm.rule_name,
        field_name: ruleForm.field_name,
        extraction_type: ruleForm.extraction_type,
        pattern: ruleForm.pattern,
        fallback_pattern: ruleForm.fallback_pattern || null,
        is_required: ruleForm.is_required,
        notes: ruleForm.notes || null,
      });
      toast.success("Regra salva com sucesso");
      setRuleModalOpen(false);
      setRuleForm({ rule_name: "", field_name: "", extraction_type: "regex", pattern: "", fallback_pattern: "", is_required: false, notes: "" });
    } catch {
      toast.error("Erro ao salvar regra");
    }
  };

  return (
    <div className="space-y-6">
      {/* Explicação */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Como funciona o Aprendizado de Layouts</p>
              <p>Quando uma conta vem em um formato ainda não reconhecido ou com falhas, o sistema registra esse layout para análise.</p>
              <p>Você pode revisar o texto da conta, confirmar os campos encontrados e salvar regras para reaproveitar esse formato nas próximas leituras.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Novos", value: stats?.new_count, icon: Layers, color: "info" },
          { label: "Em análise", value: stats?.analyzing, icon: Search, color: "warning" },
          { label: "Aprendidos", value: stats?.learned, icon: CheckCircle2, color: "success" },
          { label: "Falhas recorrentes", value: stats?.failures, icon: XCircle, color: "destructive" },
          { label: "Total", value: stats?.total, icon: Brain, color: "primary" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className={`border-l-[3px] border-l-${color} bg-card shadow-sm`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${color}/10 text-${color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight text-foreground leading-none">
                  {statsLoading ? <Skeleton className="h-6 w-8" /> : (value ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar concessionária ou assinatura..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status aprendizado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">Novos</SelectItem>
            <SelectItem value="analyzing">Em análise</SelectItem>
            <SelectItem value="learned">Aprendidos</SelectItem>
            <SelectItem value="ignored">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterExtraction} onValueChange={setFilterExtraction}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status extração" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as extrações</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
            <SelectItem value="needs_ocr">Precisa OCR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="Nenhum layout registrado"
          description="Layouts aparecem automaticamente quando faturas com formatos novos ou com falhas são processadas pelo sistema."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Concessionária</TableHead>
                <TableHead className="font-semibold text-foreground">Assinatura</TableHead>
                <TableHead className="font-semibold text-foreground">Aprendizado</TableHead>
                <TableHead className="font-semibold text-foreground">Extração</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Ocorrências</TableHead>
                <TableHead className="font-semibold text-foreground">Última detecção</TableHead>
                <TableHead className="font-semibold text-foreground">Parser</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map(event => {
                const ls = LEARNING_STATUS_MAP[event.learning_status] || { label: event.learning_status, className: "" };
                const es = EXTRACTION_STATUS_MAP[event.extraction_status] || { label: event.extraction_status, className: "" };
                return (
                  <TableRow key={event.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      <div>
                        <p>{event.concessionaria_nome || event.concessionaria_code}</p>
                        <p className="text-xs text-muted-foreground font-mono">{event.concessionaria_code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{event.layout_signature}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${ls.className}`}>{ls.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${es.className}`}>{es.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{event.occurrences_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.last_seen_at), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.parser_used || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedEvent(event)}>
                                <Eye className="w-4 h-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Analisar layout</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Analysis Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={open => !open && setSelectedEvent(null)}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Análise de Layout — {selectedEvent?.concessionaria_nome}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assinatura: {selectedEvent?.layout_signature}
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            {selectedEvent && (
              <div className="p-5 space-y-5">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Concessionária</p>
                    <p className="text-sm font-medium text-foreground">{selectedEvent.concessionaria_nome}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Parser</p>
                    <p className="text-sm font-medium text-foreground">{selectedEvent.parser_used || "Não identificado"} {selectedEvent.parser_version ? `v${selectedEvent.parser_version}` : ""}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Ocorrências</p>
                    <p className="text-sm font-medium text-foreground">{selectedEvent.occurrences_count}x — desde {format(new Date(selectedEvent.first_seen_at), "dd/MM/yy")}</p>
                  </div>
                </div>

                {/* Status actions */}
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground mr-2">Marcar como:</p>
                  {(["analyzing", "learned", "ignored"] as const).map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selectedEvent.learning_status === s ? "default" : "outline"}
                      onClick={() => handleStatusChange(selectedEvent.id, s)}
                      disabled={updateStatus.isPending}
                    >
                      {LEARNING_STATUS_MAP[s].label}
                    </Button>
                  ))}
                </div>

                {/* Fields Found / Missing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success" /> Campos encontrados
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedEvent.required_fields_found_json || []).length > 0
                          ? (selectedEvent.required_fields_found_json as string[]).map(f => (
                            <Badge key={f} variant="outline" className="text-xs bg-success/10 text-success border-success/20">{f}</Badge>
                          ))
                          : <p className="text-xs text-muted-foreground">Nenhum campo registrado</p>
                        }
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" /> Campos faltantes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedEvent.required_fields_missing_json || []).length > 0
                          ? (selectedEvent.required_fields_missing_json as string[]).map(f => (
                            <Badge key={f} variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">{f}</Badge>
                          ))
                          : <p className="text-xs text-muted-foreground">Nenhum campo faltante</p>
                        }
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Warnings / Errors */}
                {((selectedEvent.warnings_json as string[])?.length > 0 || (selectedEvent.errors_json as string[])?.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(selectedEvent.warnings_json as string[])?.length > 0 && (
                      <Card className="border-warning/30">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-warning mb-2">⚠️ Warnings</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {(selectedEvent.warnings_json as string[]).map((w, i) => <li key={i}>• {w}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {(selectedEvent.errors_json as string[])?.length > 0 && (
                      <Card className="border-destructive/30">
                        <CardContent className="p-4">
                          <p className="text-sm font-medium text-destructive mb-2">❌ Erros</p>
                          <ul className="text-xs text-muted-foreground space-y-1">
                            {(selectedEvent.errors_json as string[]).map((e, i) => <li key={i}>• {e}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Text excerpt */}
                {selectedEvent.sample_text_excerpt && (
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-foreground mb-2">📄 Trecho do texto analisado</p>
                      <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {selectedEvent.sample_text_excerpt}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* Existing Rules */}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" /> Regras de extração
                      </p>
                      <Button size="sm" variant="outline" onClick={() => setRuleModalOpen(true)}>
                        <Plus className="w-3 h-3 mr-1" /> Nova regra
                      </Button>
                    </div>
                    {rules.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma regra criada para este layout. Crie regras para melhorar a extração nas próximas faturas.</p>
                    ) : (
                      <div className="space-y-2">
                        {rules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-2 rounded border border-border bg-muted/20">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{rule.rule_name}</p>
                              <p className="text-xs text-muted-foreground">
                                Campo: <span className="font-mono">{rule.field_name}</span> · Tipo: {rule.extraction_type} · Usos: {rule.usage_count}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge variant="outline" className={`text-xs ${rule.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                                {rule.active ? "Ativa" : "Inativa"}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => deleteRule.mutateAsync(rule.id).then(() => toast.success("Regra removida"))}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create Rule Modal */}
      <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
        <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Nova Regra de Extração</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina como extrair um campo específico deste layout
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <Label>Nome da regra</Label>
                <Input value={ruleForm.rule_name} onChange={e => setRuleForm(f => ({ ...f, rule_name: e.target.value }))} placeholder="Ex: Consumo kWh - Energisa v2" />
              </div>
              <div className="space-y-2">
                <Label>Campo alvo</Label>
                <Input value={ruleForm.field_name} onChange={e => setRuleForm(f => ({ ...f, field_name: e.target.value }))} placeholder="Ex: consumo_kwh" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de extração</Label>
                <Select value={ruleForm.extraction_type} onValueChange={v => setRuleForm(f => ({ ...f, extraction_type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTRACTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Padrão (regex ou expressão)</Label>
                <Input value={ruleForm.pattern} onChange={e => setRuleForm(f => ({ ...f, pattern: e.target.value }))} placeholder="Ex: Consumo\s+(\d+[\.,]?\d*)\s*kWh" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Padrão alternativo (fallback)</Label>
                <Input value={ruleForm.fallback_pattern} onChange={e => setRuleForm(f => ({ ...f, fallback_pattern: e.target.value }))} placeholder="Opcional" className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={ruleForm.notes} onChange={e => setRuleForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre quando usar esta regra" rows={2} />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setRuleModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveRule} disabled={saveRule.isPending}>
              {saveRule.isPending ? "Salvando..." : "Salvar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
