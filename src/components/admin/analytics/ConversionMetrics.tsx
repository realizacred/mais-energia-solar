import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Target, TrendingUp, Calendar, Percent } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  status_id: string | null;
  created_at: string;
}

interface LeadStatus {
  id: string;
  nome: string;
  ordem: number;
}

interface ConversionMetricsProps {
  leads: Lead[];
  statuses: LeadStatus[];
}

export default function ConversionMetrics({ leads, statuses }: ConversionMetricsProps) {
  // Daily leads trend (last 14 days)
  const dailyTrend = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      
      const count = leads.filter((lead) => {
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start, end });
      }).length;

      days.push({
        date: format(date, "dd/MM", { locale: ptBR }),
        leads: count,
      });
    }
    return days;
  }, [leads]);

  // Monthly conversion trend (last 6 months)
  const monthlyConversion = useMemo(() => {
    const closedStatusIds = statuses
      .filter((s) => s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu"))
      .map((s) => s.id);

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const monthLeads = leads.filter((lead) => {
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start, end });
      });

      const total = monthLeads.length;
      const closed = monthLeads.filter((l) => closedStatusIds.includes(l.status_id || "")).length;
      const rate = total > 0 ? Math.round((closed / total) * 100) : 0;

      months.push({
        name: format(date, "MMM", { locale: ptBR }),
        taxa: rate,
        total,
        convertidos: closed,
      });
    }
    return months;
  }, [leads, statuses]);

  // Current month stats
  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    const monthLeads = leads.filter((lead) => {
      const leadDate = new Date(lead.created_at);
      return isWithinInterval(leadDate, { start, end });
    });

    const closedStatusIds = statuses
      .filter((s) => s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu"))
      .map((s) => s.id);

    const closed = monthLeads.filter((l) => closedStatusIds.includes(l.status_id || "")).length;

    return {
      total: monthLeads.length,
      closed,
      rate: monthLeads.length > 0 ? Math.round((closed / monthLeads.length) * 100) : 0,
    };
  }, [leads, statuses]);

  // Average daily leads
  const avgDailyLeads = useMemo(() => {
    const totalLast14Days = dailyTrend.reduce((acc, d) => acc + d.leads, 0);
    return Math.round(totalLast14Days / 14 * 10) / 10;
  }, [dailyTrend]);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{currentMonthStats.total}</p>
              <p className="text-xs text-muted-foreground">Leads (mês)</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Percent className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{currentMonthStats.rate}%</p>
              <p className="text-xs text-muted-foreground">Conversão</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{avgDailyLeads}</p>
              <p className="text-xs text-muted-foreground">Média/dia</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Leads Diários (14 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: "8px", 
                    border: "1px solid hsl(var(--border))",
                    fontSize: "12px"
                  }}
                  formatter={(value) => [value, "Leads"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="hsl(25, 95%, 53%)" 
                  strokeWidth={2}
                  fill="url(#colorLeads)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Conversion Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Percent className="w-4 h-4 text-green-600" />
            Taxa de Conversão Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyConversion}>
                <XAxis 
                  dataKey="name" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: "8px", 
                    border: "1px solid hsl(var(--border))",
                    fontSize: "12px"
                  }}
                  formatter={(value, name) => {
                    if (name === "taxa") return [`${value}%`, "Conversão"];
                    return [value, name === "total" ? "Total" : "Convertidos"];
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="taxa" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(142, 76%, 36%)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
