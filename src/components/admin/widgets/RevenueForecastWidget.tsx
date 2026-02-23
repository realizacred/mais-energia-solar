import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PipelineLead {
  id: string;
  media_consumo: number;
  status_id: string | null;
  created_at: string;
}

interface LeadStatus {
  id: string;
  nome: string;
  probabilidade_peso: number | null;
  cor: string;
}

// Default probability weights per stage order if not configured
const DEFAULT_WEIGHTS: Record<number, number> = {
  1: 10, 2: 25, 3: 40, 4: 60, 5: 75, 6: 100,
};

function estimateValue(consumo: number): number {
  const kwp = Math.round((consumo / 130) * 10) / 10;
  return kwp * 5000;
}

export function RevenueForecastWidget() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [leadsRes, statusRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, media_consumo, status_id, created_at")
          .is("deleted_at", null),
        supabase
          .from("lead_status")
          .select("id, nome, probabilidade_peso, cor")
          .order("ordem"),
      ]);
      if (leadsRes.data) setLeads(leadsRes.data);
      if (statusRes.data) setStatuses(statusRes.data);
      setLoading(false);
    };
    fetch();
  }, []);

  const forecastData = useMemo(() => {
    if (!statuses.length || !leads.length) return [];

    // Build probability map
    const probMap = new Map<string, number>();
    statuses.forEach((s, i) => {
      const prob = s.probabilidade_peso ?? DEFAULT_WEIGHTS[i + 1] ?? 50;
      probMap.set(s.id, prob / 100);
    });

    // Leads without terminal status (Convertido = 100%, Perdido excluded)
    const lostStatus = statuses.find(s => s.nome.toLowerCase().includes("perdido"));

    const activeLeads = leads.filter(l => {
      if (!l.status_id) return true; // New leads
      if (lostStatus && l.status_id === lostStatus.id) return false;
      return true;
    });

    // Group by expected close month (created + avg cycle offset based on probability)
    const now = new Date();
    const months: Record<string, number> = {};

    // Next 6 months
    for (let i = 0; i < 6; i++) {
      const key = format(addMonths(now, i), "yyyy-MM");
      months[key] = 0;
    }

    activeLeads.forEach(l => {
      const prob = l.status_id ? (probMap.get(l.status_id) ?? 0.2) : 0.1;
      const value = estimateValue(l.media_consumo) * prob;

      // Distribute across months based on probability
      // Higher prob = closer to closing
      const monthOffset = Math.max(0, Math.round((1 - prob) * 4));
      const targetMonth = format(addMonths(now, Math.min(monthOffset, 5)), "yyyy-MM");

      if (months[targetMonth] !== undefined) {
        months[targetMonth] += value;
      } else {
        // Fallback to last month
        const lastKey = Object.keys(months).pop()!;
        months[lastKey] += value;
      }
    });

    return Object.entries(months).map(([key, valor]) => ({
      mes: format(new Date(key + "-01"), "MMM/yy", { locale: ptBR }),
      valor: Math.round(valor),
    }));
  }, [leads, statuses]);

  const totalForecast = forecastData.reduce((sum, d) => sum + d.valor, 0);

  if (loading) return null;

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Forecast de Receita</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(totalForecast)}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Previsão baseada no pipeline × probabilidade por etapa (6 meses)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecastData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sem dados suficientes</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecastData}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={v => new Intl.NumberFormat("pt-BR", { notation: "compact", currency: "BRL", style: "currency" }).format(v)}
              />
              <Tooltip
                formatter={(v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)}
                labelFormatter={l => `Mês: ${l}`}
              />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {forecastData.map((_, i) => (
                  <Cell key={i} fill={`hsl(var(--primary) / ${0.4 + (i * 0.1)})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
