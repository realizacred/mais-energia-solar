import { Loader2, AlertTriangle, Shield, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <Card><CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent></Card>
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
        <Card className={breaches.length > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${breaches.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {breaches.length}
            </p>
            <p className="text-xs text-muted-foreground">Total Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">
              {breaches.filter((b) => b.tipo === "primeiro_contato").length}
            </p>
            <p className="text-xs text-muted-foreground">Primeiro Contato</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-info">
              {breaches.filter((b) => b.tipo === "followup").length}
            </p>
            <p className="text-xs text-muted-foreground">Follow-up</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {breaches.filter((b) => b.escalado).length}
            </p>
            <p className="text-xs text-muted-foreground">Escaladas</p>
          </CardContent>
        </Card>
      </div>

      {/* Breach List */}
      {breaches.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-8 w-8 text-success mb-3" />
            <p className="text-base font-semibold">Nenhuma violação de SLA ativa 🎉</p>
            <p className="text-sm text-muted-foreground">Todos os prazos estão sendo cumpridos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {breaches.map((breach) => (
            <Card key={breach.id} className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
