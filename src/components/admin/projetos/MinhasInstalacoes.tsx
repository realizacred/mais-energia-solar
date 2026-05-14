import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { PageHeader } from "@/components/ui-kit";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ChevronRight, Zap } from "lucide-react";
import { SunLoader } from "@/components/loading/SunLoader";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";

interface SimpleProject {
  id: string;
  codigo: string | null;
  projeto_num: number | null;
  nome: string | null;
  valor_total: number | null;
  potencia_kwp: number | null;
  updated_at: string;
}

interface ProjectWithDays extends SimpleProject {
  diasNaEtapa: number;
}

export default function MinhasInstalacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: projetosData, isLoading } = useQuery<SimpleProject[]>({
    queryKey: ["minhas-instalacoes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (simpleSupabase
        .from("projetos")
        .select("id, codigo, projeto_num, nome, valor_total, potencia_kwp, updated_at") as any)
        .eq("responsavel_tecnico_id", user!.id);

      if (error) throw error;
      return (data || []) as SimpleProject[];
    }
  });



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <SunLoader style="spin" size="lg" />
      </div>
    );
  }

  const projetos: SimpleProject[] = (projetosData || []).map((p: any) => ({
    id: p.id,
    codigo: p.codigo,
    projeto_num: p.projeto_num,
    nome: p.nome || "Cliente",
    valor_total: p.valor_total,
    potencia_kwp: p.potencia_kwp,
    updated_at: p.updated_at,
    diasNaEtapa: differenceInDays(new Date(), new Date(p.updated_at))
  })).sort((a, b) => b.diasNaEtapa - a.diasNaEtapa);


  return (
    <div className="space-y-6">
      <PageHeader 
        title="Minhas Instalações" 
        description="Projetos sob sua responsabilidade técnica em fase de execução."
      />

      {projetos.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-muted-foreground">
          <Zap className="h-12 w-12 mb-4 opacity-20" />
          <p>Nenhuma instalação pendente encontrada.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetos.map((p: any) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{p.codigo || `#${p.projeto_num}`}</p>
                      <h3 className="font-bold text-lg leading-tight">{p.nome}</h3>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      Execução
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">Obra em andamento</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{p.diasNaEtapa} {p.diasNaEtapa === 1 ? 'dia' : 'dias'} nesta etapa</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-3">
                      <div className="text-xs">
                        <p className="text-muted-foreground">Potência</p>
                        <p className="font-semibold">{p.potencia_kwp || 0} kWp</p>
                      </div>
                      <div className="text-xs">
                        <p className="text-muted-foreground">Valor</p>
                        <p className="font-semibold">{formatBRL(p.valor_total || 0)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => navigate(`/admin/projetos?projeto=${p.id}`)}>
                      Abrir <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="h-1 w-full bg-muted">
                  <div 
                    className="h-full bg-primary" 
                    style={{ width: `${Math.min(100, (p.diasNaEtapa / 15) * 100)}%` }} 
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
