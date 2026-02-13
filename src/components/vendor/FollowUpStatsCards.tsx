import { useMemo } from "react";
import { differenceInDays } from "date-fns";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Lead {
  id: string;
  ultimo_contato: string | null;
  created_at: string;
}

interface FollowUpStatsCardsProps {
  leads: Lead[];
}

export function FollowUpStatsCards({ leads }: FollowUpStatsCardsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    let urgentes = 0;
    let pendentes = 0;
    let emDia = 0;

    leads.forEach(lead => {
      const lastContactDate = lead.ultimo_contato 
        ? new Date(lead.ultimo_contato) 
        : new Date(lead.created_at);
      
      const daysSinceContact = differenceInDays(now, lastContactDate);

      if (daysSinceContact >= 6) {
        urgentes++;
      } else if (daysSinceContact >= 3) {
        pendentes++;
      } else {
        emDia++;
      }
    });

    return { urgentes, pendentes, emDia };
  }, [leads]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {/* Urgentes (6+ dias) */}
      <Card className="border-l-[3px] border-l-destructive border-border/60">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold">{stats.urgentes}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Urgentes (6+ dias)</p>
          </div>
        </CardContent>
      </Card>

      {/* Pendentes (3+ dias) */}
      <Card className="border-l-[3px] border-l-warning border-border/60">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold">{stats.pendentes}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Pendentes (3+ dias)</p>
          </div>
        </CardContent>
      </Card>

      {/* Em dia */}
      <Card className="border-l-[3px] border-l-success border-border/60">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold">{stats.emDia}</p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Em dia</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
