import { useState, useEffect } from "react";
import { Eye, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProposalViewsCardProps {
  propostaId: string;
}

export function ProposalViewsCard({ propostaId }: ProposalViewsCardProps) {
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<any[]>([]);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => {
    loadViews();
  }, [propostaId]);

  const loadViews = async () => {
    setLoading(true);
    const { data, count } = await (supabase as any)
      .from("proposta_views")
      .select("id, ip_address, user_agent, created_at", { count: "exact" })
      .eq("proposta_id", propostaId)
      .order("created_at", { ascending: false })
      .limit(10);

    setViews(data || []);
    setTotalViews(count || 0);
    setLoading(false);
  };

  if (loading) return <Skeleton className="h-24 rounded-xl" />;

  return (
    <Card className="border-border/60">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Visualizações</p>
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {totalViews} views
          </span>
        </div>

        {views.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma visualização registrada.</p>
        ) : (
          <div className="space-y-1.5">
            {views.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                {v.ip_address && <span className="text-[10px]">• {v.ip_address}</span>}
              </div>
            ))}
            {totalViews > 10 && (
              <p className="text-[10px] text-muted-foreground">... e mais {totalViews - 10} visualizações</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
