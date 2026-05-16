import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  Plus, 
  ArrowRight,
  Clock,
  History,
  FileSearch
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreditSimulations } from "@/hooks/useCreditDomain";
import { useAnaliseCredito } from "@/hooks/useAnaliseCredito";
import { formatBRL } from "@/lib/formatters";
import { formatDateTime } from "@/lib/dateUtils";

interface Props {
  projectId: string;
}

export function ProjectCreditTab({ projectId }: Props) {
  const { data: simulations } = useCreditSimulations(projectId);
  const { data: analyses } = useAnaliseCredito(projectId);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Módulo de Crédito
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Nova Simulação
          </Button>
          <Button size="sm" className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Iniciar Análise
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <FileSearch className="h-3.5 w-3.5" /> Simulações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{simulations?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Análises Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analyses?.filter(a => !['aprovada', 'reprovada', 'cancelada'].includes(a.status)).length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
              <History className="h-3.5 w-3.5" /> Última Atualização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold truncate">
              {analyses?.[0] ? formatDateTime(analyses[0].updated_at) : 'Nenhuma atividade'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="simulations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="simulations">Simulações</TabsTrigger>
          <TabsTrigger value="analyses">Análises Reais</TabsTrigger>
        </TabsList>
        
        <TabsContent value="simulations" className="pt-4 space-y-4">
          {simulations?.map((sim) => (
            <SimulationCard key={sim.id} simulation={sim} />
          ))}
          {!simulations?.length && <EmptyState text="Nenhuma simulação registrada." />}
        </TabsContent>

        <TabsContent value="analyses" className="pt-4 space-y-4">
          {analyses?.map((ana) => (
            <AnalysisCard key={ana.id} analysis={ana} />
          ))}
          {!analyses?.length && <EmptyState text="Nenhuma análise iniciada." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SimulationCard({ simulation }: { simulation: any }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{simulation.banco_id ? 'Banco Simulado' : 'Simulação Manual'}</span>
            <Badge variant="outline" className="text-[10px]">{simulation.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatDateTime(simulation.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-primary">{formatBRL(simulation.valor_solicitado || 0)}</p>
          <p className="text-xs text-muted-foreground">{simulation.prazo_meses} meses</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisCard({ analysis }: { analysis: any }) {
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-sm">{analysis.banco || "Banco em definição"}</p>
              <p className="text-[10px] text-muted-foreground">Protocolo: {analysis.protocolo_banco || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {analysis.is_locked && (
              <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-600 border-slate-200">
                <Clock className="h-3 w-3" /> Concluído
              </Badge>
            )}
            <Badge className="font-bold uppercase text-[10px]">{analysis.status}</Badge>
          </div>
        </div>
        <div className="flex justify-between items-end border-t border-border/40 pt-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Valor Solicitado</p>
            <p className="text-lg font-bold text-primary">{formatBRL(analysis.valor_solicitado || 0)}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            Acessar Timeline <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-xl border-2 border-dashed">
      <CreditCard className="h-10 w-10 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
