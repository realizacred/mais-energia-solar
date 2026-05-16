import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  Search,
  Filter,
  ArrowUpRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/formatters";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CreditGlobalArea() {
  const { data: analyses, isLoading } = useQuery({
    queryKey: ["admin-credit-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito")
        .select("*, deal:deals(title), lead:leads(nome), criado_por_profile:profiles!analise_credito_criado_por_fkey(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const stats = {
    total: analyses?.length || 0,
    em_analise: analyses?.filter(a => a.status === 'em_analise').length || 0,
    pendentes: analyses?.filter(a => a.status === 'pendente_documentos').length || 0,
    aprovados: analyses?.filter(a => ['aprovado', 'aprovada'].includes(a.status)).length || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão Global de Crédito</h1>
          <p className="text-muted-foreground">Monitoramento de simulações e análises bancárias em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Análises" value={stats.total} icon={CreditCard} color="text-blue-500" />
        <StatCard title="Em Análise" value={stats.em_analise} icon={Clock} color="text-yellow-500" />
        <StatCard title="Pendências" value={stats.pendentes} icon={AlertCircle} color="text-red-500" />
        <StatCard title="Aprovados" value={stats.aprovados} icon={TrendingUp} color="text-green-500" />
      </div>

      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Análises Recentes</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente ou banco..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Att.</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses?.map((analysis) => (
                <TableRow key={analysis.id} className="group">
                  <TableCell className="font-medium">
                    {analysis.deal?.title || analysis.lead?.nome || "N/A"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {analysis.criado_por_profile?.nome || "Sistema"}
                  </TableCell>
                  <TableCell>{analysis.banco || "Não definido"}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatBRL(analysis.valor_solicitado || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(analysis.status)}>
                      {analysis.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(analysis.updated_at), { addSuffix: true, locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="border-border/40">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusVariant(status: string): any {
  switch (status) {
    case 'aprovado':
    case 'aprovada': return 'success';
    case 'em_analise': return 'warning';
    case 'reprovado':
    case 'reprovada': return 'destructive';
    case 'pendente_documentos': return 'outline';
    default: return 'secondary';
  }
}
