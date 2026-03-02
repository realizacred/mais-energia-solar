import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
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

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--destructive))",
];

/** KPI Card with left accent border — command center style */
function KpiCard({ 
  icon: Icon, 
  label, 
  value, 
  accentColor = "secondary",
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  accentColor?: "primary" | "success" | "secondary" | "warning" | "destructive";
}) {
  const accentMap = {
    primary: "border-l-primary",
    success: "border-l-success",
    secondary: "border-l-secondary",
    warning: "border-l-warning",
    destructive: "border-l-destructive",
  };
  const iconBgMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    secondary: "bg-secondary/10 text-secondary",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className={`border-l-[3px] ${accentMap[accentColor]} bg-card`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBgMap[accentColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardStats({ leads }: DashboardStatsProps) {
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
      months.push({ name: format(monthDate, "MMM", { locale: ptBR }), leads: count });
    }
    return months;
  }, [leads]);

  const leadsByState = useMemo(() => {
    const stateCount: Record<string, number> = {};
    leads.forEach(lead => { stateCount[lead.estado] = (stateCount[lead.estado] || 0) + 1; });
    return Object.entries(stateCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [leads]);

  const consumptionDistribution = useMemo(() => {
    const ranges = [
      { name: "0-200", min: 0, max: 200, count: 0 },
      { name: "200-400", min: 200, max: 400, count: 0 },
      { name: "400-600", min: 400, max: 600, count: 0 },
      { name: "600-1000", min: 600, max: 1000, count: 0 },
      { name: "1000+", min: 1000, max: Infinity, count: 0 },
    ];
    leads.forEach(lead => {
      const range = ranges.find(r => lead.media_consumo >= r.min && lead.media_consumo < r.max);
      if (range) range.count++;
    });
    return ranges.map(r => ({ name: r.name, leads: r.count }));
  }, [leads]);

  const growthRate = useMemo(() => {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const thisMonth = leadsByMonth[leadsByMonth.length - 1]?.leads || 0;
    const lastMonth = leadsByMonth[leadsByMonth.length - 2]?.leads || 0;
    // Proportional comparison: scale last month to the same elapsed days
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const proportional = lastMonth > 0 ? (lastMonth / daysInLastMonth) * dayOfMonth : 0;
    if (proportional === 0) return thisMonth > 0 ? 100 : 0;
    return Math.round(((thisMonth - proportional) / proportional) * 100);
  }, [leadsByMonth]);

  const totalKwh = leads.reduce((acc, l) => acc + l.media_consumo, 0);
  const uniqueStates = new Set(leads.map(l => l.estado)).size;
  const avgConsumption = leads.length > 0 ? Math.round(totalKwh / leads.length) : 0;

  const tooltipStyle = {
    borderRadius: "8px",
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    color: "hsl(var(--foreground))",
    boxShadow: "var(--shadow-md)",
    fontSize: "12px",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards — Command Center */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard icon={Users} label="Total de leads" value={leads.length} accentColor="secondary" />
        <KpiCard icon={Zap} label="kWh total" value={totalKwh.toLocaleString()} accentColor="success" />
        <KpiCard icon={MapPin} label="Estados" value={uniqueStates} accentColor="secondary" />
        <KpiCard icon={TrendingUp} label="Crescimento" value={`${growthRate > 0 ? "+" : ""}${growthRate}%`} accentColor={growthRate >= 0 ? "success" : "destructive"} />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Leads por mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="leads" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Leads por estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={leadsByState} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {leadsByState.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Consumption Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-muted-foreground" />
            Distribuição de consumo
            <span className="text-xs font-normal text-muted-foreground ml-2">(Média: {avgConsumption} kWh)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={consumptionDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="leads" stroke="hsl(var(--secondary))" strokeWidth={2} dot={{ fill: "hsl(var(--secondary))", strokeWidth: 2 }} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
