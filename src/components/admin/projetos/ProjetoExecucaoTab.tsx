import { useState } from "react";
import { useProjetoDetalhe } from "@/contexts/ProjetoDetalheContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Clock, UserCog, AlertCircle, Calendar, CheckCircle2, History, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function ProjetoExecucaoTab() {
  const { deal, projetoId, operacoesHistory, userNamesMap, silentRefresh } = useProjetoDetalhe();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!deal || !projetoId) return null;

  async function handleUpdateField(field: string, value: any) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projetos")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", projetoId);

      if (error) throw error;

      // Log event
      await supabase.from("projeto_operacoes_eventos").insert({
        projeto_id: projetoId,
        tenant_id: (await supabase.from("projetos").select("tenant_id").eq("id", projetoId).single()).data?.tenant_id,
        tipo: field === "proxima_acao" ? "next_action_update" : field === "responsavel_operacional" ? "responsible_change" : "dependency_change",
        payload: { field, value, previous: (deal as any)[field] },
        created_by: user?.id
      });

      toast.success("Informação operacional atualizada");
      silentRefresh();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const responsaveis = ["Engenharia", "Financeiro", "Instalação", "Administrativo", "Concessionária"];
  const dependencias = ["aguardando cliente", "aguardando equipe interna", "aguardando concessionária", "aguardando financeiro", "nenhuma"];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-primary/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Execução Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Responsável Atual</Label>
                <Select 
                  value={deal.responsavel_operacional || "todos"} 
                  onValueChange={(v) => handleUpdateField("responsavel_operacional", v === "todos" ? null : v)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Sem responsável</SelectItem>
                    {responsaveis.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Dependência</Label>
                <Select 
                  value={deal.dependencia_tipo || "nenhuma"} 
                  onValueChange={(v) => handleUpdateField("dependencia_tipo", v === "nenhuma" ? null : v)}
                  disabled={saving}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione a dependência" />
                  </SelectTrigger>
                  <SelectContent>
                    {dependencias.map(d => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Próxima Ação Operacional</Label>
              <div className="flex gap-2">
                <Input 
                  defaultValue={deal.proxima_acao || ""} 
                  placeholder="Ex: Solicitar assinatura, Enviar ART..." 
                  onBlur={(e) => {
                    if (e.target.value !== (deal.proxima_acao || "")) {
                      handleUpdateField("proxima_acao", e.target.value);
                    }
                  }}
                  disabled={saving}
                  className="font-bold text-primary"
                />
                {deal.proxima_acao && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 text-success hover:bg-success/10"
                    onClick={() => handleUpdateField("proxima_acao", null)}
                    disabled={saving}
                    title="Concluir Ação"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Prazo da Ação</Label>
              <Input 
                type="date"
                defaultValue={deal.prazo_acao ? deal.prazo_acao.split('T')[0] : ""}
                onChange={(e) => handleUpdateField("prazo_acao", e.target.value || null)}
                disabled={saving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b bg-muted/30">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Timeline Operacional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {operacoesHistory.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic text-sm">
                  Nenhuma atividade operacional registrada ainda.
                </div>
              ) : (
                operacoesHistory.map((evento) => (
                  <div key={evento.id} className="relative pl-6 pb-6 border-l border-border last:pb-0">
                    <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {evento.tipo === 'next_action_update' ? 'Próxima Ação' : 
                           evento.tipo === 'responsible_change' ? 'Mudança de Responsável' : 
                           evento.tipo === 'dependency_change' ? 'Alteração de Dependência' : evento.tipo}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(evento.created_at)}</span>
                      </div>
                      <div className="text-sm">
                        {evento.tipo === 'responsible_change' ? (
                          <div className="flex items-center gap-2">
                            <span className="line-through text-muted-foreground">{evento.payload.previous || 'Ninguém'}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span className="font-bold text-primary">{evento.payload.value}</span>
                          </div>
                        ) : (
                          <p className="font-medium">{evento.payload.value || 'Campo limpo'}</p>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <UserCog className="h-3 w-3" />
                        Executado por: {evento.created_by ? (userNamesMap.get(evento.created_by) || 'Sistema') : 'Sistema'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-amber-500/5 border-amber-500/20 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Status de Bloqueio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn(
              "p-3 rounded-lg border text-sm font-bold flex items-center gap-3",
              deal.dependencia_tipo ? "bg-amber-500/20 border-amber-500/30 text-amber-700" : "bg-success/10 border-success/20 text-success"
            )}>
              {deal.dependencia_tipo ? (
                <>
                  <Clock className="h-4 w-4 animate-pulse" />
                  AGUARDANDO {deal.dependencia_tipo.toUpperCase()}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  FLUXO DESBLOQUEADO
                </>
              )}
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Projetos com dependências ativas são destacados no Kanban como bloqueados ou em atenção, dependendo do SLA.
            </p>
          </CardContent>
        </Card>
        
        {deal.ultima_mudanca_operacional_at && (
          <Card className="shadow-none bg-muted/20 border-border/40">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground block tracking-tight">Tempo desde última mudança</span>
              <p className="text-lg font-mono font-bold text-foreground">
                {formatDateTime(deal.ultima_mudanca_operacional_at)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
