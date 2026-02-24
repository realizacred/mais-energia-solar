import { AlertTriangle, Shield, CheckCircle2, Clock } from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Spinner } from "@/components/ui-kit/Spinner";
import { StatCard, EmptyState } from "@/components/ui-kit";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSlaBreaches } from "@/hooks/useDistribution";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_LABELS: Record<string, string> = {
  primeiro_contato: "Primeiro Contato",
  followup: "Follow-up",
  resposta: "Resposta",
};

export function SlaBreachDashboard() {
  const { data: breaches = [], isLoading } = useSlaBreaches();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleResolve = async (breachId: string) => {
    const { error } = await supabase
      .from("sla_breaches")
      .update({ resolvido: true, resolvido_em: new Date().toISOString() })
      .eq("id", breachId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["sla-breaches"] });
      toast({ title: "Violação resolvida" });
    }
  };

  if (isLoading) {
    return (
      <SectionCard title="Violações de SLA" variant="red"><InlineLoader context="data_load" /></SectionCard>
    );
  }

  const byTipo: Record<string, typeof breaches> = {};
  breaches.forEach((b) => {
    const t = b.tipo || "outro";
    if (!byTipo[t]) byTipo[t] = [];
    byTipo[t].push(b);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Violações de SLA</h2>
          <p className="text-sm text-muted-foreground">
            {breaches.length} violação{breaches.length !== 1 ? "ões" : ""} ativa{breaches.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Total ativas" value={breaches.length} color={breaches.length > 0 ? "destructive" : "muted"} />
        <StatCard icon={Clock} label="Primeiro contato" value={breaches.filter((b) => b.tipo === "primeiro_contato").length} color="warning" />
        <StatCard icon={Shield} label="Follow-up" value={breaches.filter((b) => b.tipo === "followup").length} color="info" />
        <StatCard icon={AlertTriangle} label="Escaladas" value={breaches.filter((b) => b.escalado).length} color="muted" />
      </div>

      {/* Breach List */}
      {breaches.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nenhuma violação de SLA ativa 🎉"
          description="Todos os prazos estão sendo cumpridos."
        />
      ) : (
        <div className="space-y-2">
          {breaches.map((breach) => (
            <SectionCard key={breach.id} variant="red" noPadding>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="destructive" className="text-[10px]">
                        {TIPO_LABELS[breach.tipo] || breach.tipo}
                      </Badge>
                      {breach.escalado && (
                        <Badge variant="outline" className="text-[10px] border-warning text-warning">
                          Escalada
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        Limite: {breach.minutos_limite}min
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">
                      {breach.lead?.nome || "Lead"}{" "}
                      {breach.lead?.lead_code && (
                        <span className="text-muted-foreground font-normal">({breach.lead.lead_code})</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {breach.vendedor?.nome && <span>👤 {breach.vendedor.nome}</span>}
                      {breach.lead?.telefone && <span>📱 {breach.lead.telefone}</span>}
                      {breach.created_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(breach.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 shrink-0"
                    onClick={() => handleResolve(breach.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Resolver
                  </Button>
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
