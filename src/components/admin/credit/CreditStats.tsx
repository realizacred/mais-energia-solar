import { CreditCard, CheckCircle2, ListChecks, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditBankConfig } from "@/hooks/useCreditConfigs";

interface CreditStatsProps {
  banks: CreditBankConfig[];
}

export function CreditStats({ banks }: CreditStatsProps) {
  const activeBanks = banks.filter(b => b.is_active).length;
  const inactiveBanks = banks.length - activeBanks;
  const totalChecklistItems = banks.reduce((acc, b) => acc + (b.checklist_count || 0), 0);
  const requiredDocuments = totalChecklistItems; // Simplificação para o KPI

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bancos Ativos</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeBanks}</div>
          <p className="text-xs text-muted-foreground">Configurados para o tenant</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documentos Exigidos</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{requiredDocuments}</div>
          <p className="text-xs text-muted-foreground">Total em todos os bancos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Checklists</CardTitle>
          <ListChecks className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{banks.length}</div>
          <p className="text-xs text-muted-foreground">Bancos cadastrados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bancos Inativos</CardTitle>
          <Ban className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{inactiveBanks}</div>
          <p className="text-xs text-muted-foreground">Desativados para novos projetos</p>
        </CardContent>
      </Card>
    </div>
  );
}
