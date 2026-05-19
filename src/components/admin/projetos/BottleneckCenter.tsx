import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Clock, 
  Construction, 
  FileText, 
  Zap, 
  Truck,
  Building2,
  TrendingDown,
  CircleDollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";
import { differenceInDays } from "date-fns";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
}

export function BottleneckCenter({ projetos, etapas }: Props) {
  const bottlenecks = useMemo(() => {
    const stats = {
      engenharia: { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      documentos: { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      concessionaria: { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      instalacao: { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
    };

    const now = new Date();

    projetos.forEach(p => {
      const etapa = etapas.find(e => e.id === p.etapa_id);
      if (!etapa || etapa.categoria !== 'aberto') return;

      const stageName = etapa.nome.toLowerCase();
      const days = differenceInDays(now, new Date(p.data_entrada_etapa || p.updated_at));
      const value = p.valor_total || 0;

      if (stageName.includes("engenharia") || stageName.includes("projeto técnico")) {
        stats.engenharia.count++;
        stats.engenharia.value += value;
        stats.engenharia.daysTotal += days;
      } else if (stageName.includes("documento") || stageName.includes("contrato") || stageName.includes("assinatura")) {
        stats.documentos.count++;
        stats.documentos.value += value;
        stats.documentos.daysTotal += days;
      } else if (stageName.includes("concessionária") || stageName.includes("vistoria") || stageName.includes("parecer")) {
        stats.concessionaria.count++;
        stats.concessionaria.value += value;
        stats.concessionaria.daysTotal += days;
      } else if (stageName.includes("instalação") || stageName.includes("obra")) {
        stats.instalacao.count++;
        stats.instalacao.value += value;
        stats.instalacao.daysTotal += days;
      }
    });

    const calculateAvg = (s: any) => s.count > 0 ? Math.round(s.daysTotal / s.count) : 0;
    stats.engenharia.avgDays = calculateAvg(stats.engenharia);
    stats.documentos.avgDays = calculateAvg(stats.documentos);
    stats.concessionaria.avgDays = calculateAvg(stats.concessionaria);
    stats.instalacao.avgDays = calculateAvg(stats.instalacao);

    return stats;
  }, [projetos, etapas]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <BottleneckCard 
        title="Engenharia Parada" 
        icon={<Construction className="w-4 h-4 text-blue-500" />} 
        stats={bottlenecks.engenharia}
        color="blue"
      />
      <BottleneckCard 
        title="Docs Travados" 
        icon={<FileText className="w-4 h-4 text-amber-500" />} 
        stats={bottlenecks.documentos}
        color="amber"
      />
      <BottleneckCard 
        title="Concessionária" 
        icon={<Building2 className="w-4 h-4 text-purple-500" />} 
        stats={bottlenecks.concessionaria}
        color="purple"
      />
      <BottleneckCard 
        title="Instalação Atrasada" 
        icon={<Truck className="w-4 h-4 text-orange-500" />} 
        stats={bottlenecks.instalacao}
        color="orange"
      />
    </div>
  );
}

function BottleneckCard({ title, icon, stats, color }: { title: string, icon: React.ReactNode, stats: any, color: string }) {
  if (stats.count === 0) return null;

  const colorClasses: Record<string, string> = {
    blue: "border-l-blue-500 bg-blue-500/5",
    amber: "border-l-amber-500 bg-amber-500/5",
    purple: "border-l-purple-500 bg-purple-500/5",
    orange: "border-l-orange-500 bg-orange-500/5",
  };

  return (
    <Card className={cn("border-border/60 border-l-4 shadow-sm", colorClasses[color])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-background rounded-md shadow-sm border border-border/40">
              {icon}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground">{title}</span>
          </div>
          <Badge variant="secondary" className="font-black text-xs">
            {stats.count}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">Valor em Gargalo</span>
            <span className="text-sm font-black text-foreground">{formatBRL(stats.value)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">Média Parado</span>
            </div>
            <span className={cn(
              "text-xs font-bold tabular-nums",
              stats.avgDays > 10 ? "text-destructive" : stats.avgDays > 5 ? "text-orange-500" : "text-foreground"
            )}>
              {stats.avgDays} dias
            </span>
          </div>

          <div className="w-full bg-background/50 rounded-full h-1 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", 
                color === 'blue' ? 'bg-blue-500' : 
                color === 'amber' ? 'bg-amber-500' : 
                color === 'purple' ? 'bg-purple-500' : 'bg-orange-500'
              )} 
              style={{ width: `${Math.min(100, stats.avgDays * 5)}%` }} 
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
