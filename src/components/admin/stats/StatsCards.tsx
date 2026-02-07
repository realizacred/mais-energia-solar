import { Users, Zap, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalLeads: number;
  totalKwh: number;
  uniqueEstados: number;
}

export function StatsCards({ totalLeads, totalKwh, uniqueEstados }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:pt-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">{totalLeads}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Total de Leads</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:pt-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {totalKwh.toLocaleString()}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">kWh Total</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-secondary sm:col-span-2 lg:col-span-1">
        <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:pt-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">{uniqueEstados}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Estados</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
