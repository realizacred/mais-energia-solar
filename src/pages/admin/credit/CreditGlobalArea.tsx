import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  Search,
  Filter,
  ArrowUpRight,
  Activity,
  ShieldAlert,
  Terminal,
  CheckCircle2,
  XCircle,
  FileSearch,
  UserPlus,
  Calendar,
  User as UserIcon,
  Banknote,
  MoreVertical
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
import { formatDistanceToNow, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCreditMetrics } from "@/hooks/useCreditDomain";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useUsuariosList } from "@/hooks/useUsuarios";
import { toast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * REUSED TABLES: analise_credito, credit_analysis_events, analise_credito_documentos, profiles, deals, leads
 * REUSED HOOKS: useCreditMetrics, useAuth, useUsuariosList
 */

export default function CreditGlobalArea() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: metrics } = useCreditMetrics();
  const { data: users } = useUsuariosList(true);
  
  // Persistent Filters State
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("credit-global-filters");
    return saved ? JSON.parse(saved) : {
      managerId: "all",
      status: "all",
      consultantId: "all",
      bank: "all",
      dateRange: undefined as DateRange | undefined,
      search: ""
    };
  });

  useEffect(() => {
    localStorage.setItem("credit-global-filters", JSON.stringify(filters));
  }, [filters]);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["admin-credit-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito")
        .select(`
          *, 
          deal:deals(title), 
          lead:leads(nome), 
          consultor:profiles!analise_credito_criado_por_fkey(nome),
          responsavel:profiles!analise_credito_responsavel_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: operationLogs } = useQuery({
    queryKey: ["credit-operation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_operation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  // Action States
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_docs' | 'reassign' | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [targetManagerId, setTargetManagerId] = useState("");
  const [pendingDocs, setPendingDocs] = useState<string[]>([]);

  const managers = users?.filter(u => u.roles.some(r => ['admin', 'gerente', 'super_admin'].includes(r))) || [];

  const handleAction = async () => {
    if (!selectedAnalysis || !actionType) return;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const correlation_id = crypto.randomUUID();
      
      let newStatus = selectedAnalysis.status;
      let updatePayload: any = { updated_at: new Date().toISOString() };

      if (actionType === 'approve') {
        newStatus = 'aprovado_interno';
        updatePayload.status = newStatus;
      } else if (actionType === 'reject') {
        newStatus = 'reprovado';
        updatePayload.status = newStatus;
        updatePayload.observacoes = actionNotes;
      } else if (actionType === 'request_docs') {
        newStatus = 'pendente_documentos';
        updatePayload.status = newStatus;
        updatePayload.observacoes = actionNotes;
      } else if (actionType === 'reassign') {
        updatePayload.responsavel_id = targetManagerId;
      }

      // 1. Update Analysis
      const { error: updateError } = await supabase
        .from("analise_credito")
        .update(updatePayload)
        .eq("id", selectedAnalysis.id);
      
      if (updateError) throw updateError;

      // 2. Log Event
      await supabase.from("credit_analysis_events").insert({
        tenant_id: selectedAnalysis.tenant_id,
        analise_id: selectedAnalysis.id,
        event_type: actionType === 'reassign' ? 'manager_reassigned' : 'status_changed',
        actor_id: currentUser?.id,
        status_anterior: selectedAnalysis.status,
        status_novo: newStatus,
        payload: { notes: actionNotes, ...updatePayload },
        correlation_id,
        idempotency_key: `${actionType}_${selectedAnalysis.id}_${Date.now()}`
      } as any);

      // 3. Notify Consultant
      await supabase.rpc('create_notification' as any, {
        p_tenant_id: selectedAnalysis.tenant_id,
        p_title: actionType === 'approve' ? "Crédito Aprovado Internamente" : 
                 actionType === 'reject' ? "Crédito Reprovado" :
                 actionType === 'request_docs' ? "Documentos Pendentes" : "Gerente Reatribuído",
        p_message: `A análise para o cliente ${selectedAnalysis.deal?.title || selectedAnalysis.lead?.nome} foi atualizada.`,
        p_type: "credit_request",
        p_severity: actionType === 'approve' ? "success" : actionType === 'reject' ? "error" : "info",
        p_metadata: { analise_id: selectedAnalysis.id },
        p_roles_permitidos: ["vendedor", "consultor", "admin"]
      });

      toast({ title: "Ação realizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["admin-credit-analyses"] });
      setSelectedAnalysis(null);
      setActionType(null);
      setActionNotes("");
    } catch (error: any) {
      toast({ 
        title: "Erro ao processar ação", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const filteredAnalyses = analyses?.filter(a => {
    if (filters.managerId !== "all" && a.responsavel_id !== filters.managerId) return false;
    if (filters.status !== "all" && a.status !== filters.status) return false;
    if (filters.consultantId !== "all" && a.criado_por !== filters.consultantId) return false;
    if (filters.bank !== "all" && a.banco !== filters.bank) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const matchName = (a.deal?.title || a.lead?.nome || "").toLowerCase().includes(search);
      const matchCPF = (a.cpf_cnpj || "").includes(search);
      if (!matchName && !matchCPF) return false;
    }
    if (filters.dateRange?.from && filters.dateRange?.to) {
      const date = new Date(a.created_at);
      if (!isWithinInterval(date, { start: startOfDay(filters.dateRange.from), end: endOfDay(filters.dateRange.to) })) return false;
    }
    return true;
  });

  const myQueue = filteredAnalyses?.filter(a => 
    a.responsavel_id === user?.id && 
    !['aprovado', 'aprovada', 'reprovado', 'reprovada', 'cancelada'].includes(a.status)
  ) || [];

  const stats = {
    total: analyses?.length || 0,
    aguardando: analyses?.filter(a => !['aprovado', 'aprovada', 'reprovado', 'reprovada', 'cancelada'].includes(a.status)).length || 0,
    aprovados: analyses?.filter(a => ['aprovado', 'aprovada', 'aprovado_interno'].includes(a.status)).length || 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Bank Operations Core
          </h1>
          <p className="text-muted-foreground">Governança, observabilidade e orquestração de crédito enterprise.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </Button>
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <Terminal className="h-4 w-4" /> Console Ops
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Análises" value={stats.total} icon={CreditCard} color="text-blue-500" />
        <StatCard title="Em Análise" value={stats.em_analise} icon={Clock} color="text-yellow-500" />
        <StatCard title="Jobs Pendentes" value={metrics?.pendingJobs || 0} icon={Activity} color="text-purple-500" />
        <StatCard title="SLA Vencido" value={metrics?.expiredSLA || 0} icon={ShieldAlert} color="text-red-500" />
        <StatCard title="Aprovados" value={stats.aprovados} icon={TrendingUp} color="text-green-500" />
      </div>

      <Tabs defaultValue="analyses" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] mb-4">
          <TabsTrigger value="analyses">Lista de Análises</TabsTrigger>
          <TabsTrigger value="jobs">Orquestração de Jobs</TabsTrigger>
          <TabsTrigger value="logs">Logs Operacionais</TabsTrigger>
        </TabsList>

        <TabsContent value="analyses">
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
                {/* ... existing table header ... */}
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
    </TabsContent>

    <TabsContent value="jobs">
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg">Fila de Operações Assíncronas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Último Erro</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum job em processamento no momento.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="logs">
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Histórico de Governança
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-3">
              {operationLogs?.map((log) => (
                <div key={log.id} className="text-xs font-mono p-2 border-l-2 border-primary bg-muted/20 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline" className="text-[9px] h-4 uppercase">{log.level}</Badge>
                    <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="font-semibold">{log.message}</p>
                  {log.context && <pre className="text-[10px] opacity-60 overflow-hidden">{JSON.stringify(log.context)}</pre>}
                </div>
              ))}
              {!operationLogs?.length && (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum log operacional registrado.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</div>
);
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR');
  } catch (e) {
    return dateStr;
  }
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
