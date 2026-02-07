import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, MapPin, Users, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  vendedor: string | null;
  created_at: string;
  status_id: string | null;
}

interface DashboardChartsProps {
  leads: Lead[];
}

const COLORS = ["#F97316", "#0EA5E9", "#22C55E", "#8B5CF6", "#EC4899", "#F59E0B", "#14B8A6", "#6366F1"];

export default function DashboardCharts({ leads }: DashboardChartsProps) {
  // Leads por mês (últimos 6 meses)
  const leadsByMonth = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const count = leads.filter((lead) => {
        const leadDate = new Date(lead.created_at);
        return isWithinInterval(leadDate, { start, end });
      }).length;

      months.push({
        name: format(date, "MMM", { locale: ptBR }),
        leads: count,
      });
    }
    return months;
  }, [leads]);

  // Leads por estado
  const leadsByState = useMemo(() => {
    const stateCount: Record<string, number> = {};
    leads.forEach((lead) => {
      stateCount[lead.estado] = (stateCount[lead.estado] || 0) + 1;
    });
    
    return Object.entries(stateCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [leads]);

  // Performance por vendedor
  const vendorPerformance = useMemo(() => {
    const vendorData: Record<string, { leads: number; kwh: number }> = {};
    
    leads.forEach((lead) => {
      const vendor = lead.vendedor || "Sem vendedor";
      if (!vendorData[vendor]) {
        vendorData[vendor] = { leads: 0, kwh: 0 };
      }
      vendorData[vendor].leads += 1;
      vendorData[vendor].kwh += lead.media_consumo;
    });

    return Object.entries(vendorData)
      .map(([name, data]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "..." : name,
        leads: data.leads,
        kwh: data.kwh,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6);
  }, [leads]);

  // kWh total por mês
  const kwhByMonth = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      
      const totalKwh = leads
        .filter((lead) => {
          const leadDate = new Date(lead.created_at);
          return isWithinInterval(leadDate, { start, end });
        })
        .reduce((acc, lead) => acc + lead.media_consumo, 0);

      months.push({
        name: format(date, "MMM", { locale: ptBR }),
        kwh: totalKwh,
      });
    }
    return months;
  }, [leads]);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Leads por Mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Leads por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByMonth}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value) => [value, "Leads"]}
                />
                <Bar dataKey="leads" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Leads por Estado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-secondary" />
            Leads por Estado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={leadsByState}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {leadsByState.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, "Leads"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance por Vendedor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-green-600" />
            Performance por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorPerformance} layout="vertical">
                <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value, name) => [value, name === "leads" ? "Leads" : "kWh"]}
                />
                <Legend />
                <Bar dataKey="leads" fill="#0EA5E9" radius={[0, 4, 4, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* kWh Mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            kWh Total por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kwhByMonth}>
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  formatter={(value) => [`${Number(value).toLocaleString()} kWh`, "Total"]}
                />
                <Line 
                  type="monotone" 
                  dataKey="kwh" 
                  stroke="#22C55E" 
                  strokeWidth={2}
                  dot={{ fill: "#22C55E", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
