import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { Users, Zap, MapPin, TrendingUp, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  created_at: string;
}

interface DashboardStatsProps {
  leads: Lead[];
}

const COLORS = ["hsl(25, 95%, 53%)", "hsl(220, 70%, 35%)", "hsl(142, 76%, 36%)", "hsl(47, 96%, 53%)", "hsl(262, 83%, 58%)", "hsl(346, 77%, 50%)"];

export default function DashboardStats({ leads }: DashboardStatsProps) {
  // Stats by month (last 6 months)
  const leadsByMonth = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      const count = leads.filter(lead => {
        const createdAt = new Date(lead.created_at);
        return isWithinInterval(createdAt, { start, end });
      }).length;
      
      months.push({
        name: format(monthDate, "MMM", { locale: ptBR }),
        leads: count,
      });
    }
    return months;
  }, [leads]);

  // Stats by state
  const leadsByState = useMemo(() => {
    const stateCount: Record<string, number> = {};
    leads.forEach(lead => {
      stateCount[lead.estado] = (stateCount[lead.estado] || 0) + 1;
    });
    
    return Object.entries(stateCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [leads]);

  // Consumption distribution
  const consumptionDistribution = useMemo(() => {
    const ranges = [
      { name: "0-200 kWh", min: 0, max: 200, count: 0 },
      { name: "200-400 kWh", min: 200, max: 400, count: 0 },
      { name: "400-600 kWh", min: 400, max: 600, count: 0 },
      { name: "600-1000 kWh", min: 600, max: 1000, count: 0 },
      { name: "1000+ kWh", min: 1000, max: Infinity, count: 0 },
    ];
    
    leads.forEach(lead => {
      const range = ranges.find(r => lead.media_consumo >= r.min && lead.media_consumo < r.max);
      if (range) range.count++;
    });
    
    return ranges.map(r => ({ name: r.name, leads: r.count }));
  }, [leads]);

  // Growth rate (this month vs last month)
  const growthRate = useMemo(() => {
    const thisMonth = leadsByMonth[leadsByMonth.length - 1]?.leads || 0;
    const lastMonth = leadsByMonth[leadsByMonth.length - 2]?.leads || 0;
    if (lastMonth === 0) return thisMonth > 0 ? 100 : 0;
    return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  }, [leadsByMonth]);

  // Total kWh
  const totalKwh = leads.reduce((acc, l) => acc + l.media_consumo, 0);
  const uniqueStates = new Set(leads.map(l => l.estado)).size;
  const avgConsumption = leads.length > 0 ? Math.round(totalKwh / leads.length) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{leads.length}</p>
              <p className="text-xs text-muted-foreground">Total de Leads</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalKwh.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">kWh Total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{uniqueStates}</p>
              <p className="text-xs text-muted-foreground">Estados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {growthRate > 0 ? "+" : ""}{growthRate}%
              </p>
              <p className="text-xs text-muted-foreground">Crescimento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Leads by Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Leads por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: "8px", 
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}
                />
                <Bar 
                  dataKey="leads" 
                  fill="hsl(25, 95%, 53%)" 
                  radius={[4, 4, 0, 0]}
                  name="Leads"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads by State */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-secondary" />
              Leads por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={leadsByState}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {leadsByState.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Consumption Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Distribuição de Consumo
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Média: {avgConsumption} kWh)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={consumptionDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: "8px", 
                  border: "1px solid hsl(var(--border))"
                }}
              />
              <Line 
                type="monotone" 
                dataKey="leads" 
                stroke="hsl(220, 70%, 35%)" 
                strokeWidth={2}
                dot={{ fill: "hsl(220, 70%, 35%)", strokeWidth: 2 }}
                name="Leads"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
