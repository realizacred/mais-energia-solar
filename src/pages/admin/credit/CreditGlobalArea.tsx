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

  const myQueue = analyses?.filter(a => 
    a.responsavel_id === user?.id && 
    !['aprovado', 'aprovada', 'reprovado', 'reprovada', 'cancelada'].includes(a.status)
  ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [];

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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" /> Filtros Avançados
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Gerente Responsável</label>
                <Select value={filters.managerId} onValueChange={(v) => setFilters(f => ({ ...f, managerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Status</label>
                <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente_documentos">Pendente Documentos</SelectItem>
                    <SelectItem value="em_analise">Em Análise</SelectItem>
                    <SelectItem value="aprovado_interno">Aprovado Interno</SelectItem>
                    <SelectItem value="aprovada">Aprovada Banco</SelectItem>
                    <SelectItem value="reprovada">Reprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Período</label>
                <div className="grid gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateRange?.from ? (
                          filters.dateRange.to ? (
                            <>
                              {format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(filters.dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={filters.dateRange?.from}
                        selected={filters.dateRange}
                        onSelect={(r) => setFilters(f => ({ ...f, dateRange: r }))}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button 
                variant="ghost" 
                className="w-full text-xs" 
                onClick={() => setFilters({
                  managerId: "all",
                  status: "all",
                  consultantId: "all",
                  bank: "all",
                  dateRange: undefined,
                  search: ""
                })}
              >
                Limpar Filtros
              </Button>
            </PopoverContent>
          </Popover>
          <Button className="gap-2 shadow-lg shadow-primary/20">
            <Terminal className="h-4 w-4" /> Console Ops
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Aguardando Análise" value={metrics?.pendingJobs || 0} icon={Clock} color="text-yellow-500" />
        <StatCard title="Aprovados (Mês)" value={metrics?.approvedThisMonth || 0} icon={TrendingUp} color="text-green-500" />
        <StatCard title="Taxa de Aprovação" value={`${metrics?.approvalRate || 0}%`} icon={CheckCircle2} color="text-blue-500" />
        <StatCard title="Tempo Médio (Dias)" value={metrics?.avgResponseTime || 0} icon={Activity} color="text-purple-500" />
      </div>

      <Tabs defaultValue="my-queue" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[800px] mb-4">
          <TabsTrigger value="my-queue" className="relative">
            Minha Fila
            {myQueue.length > 0 && (
              <Badge className="ml-2 bg-primary text-white text-[10px] h-4 w-4 flex items-center justify-center p-0">
                {myQueue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analyses">Global de Análises</TabsTrigger>
          <TabsTrigger value="jobs">Orquestração</TabsTrigger>
          <TabsTrigger value="logs">Logs Operacionais</TabsTrigger>
        </TabsList>

        <TabsContent value="my-queue">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myQueue.map((analysis) => (
              <AnalysisCard 
                key={analysis.id} 
                analysis={analysis} 
                onAction={(type) => {
                  setSelectedAnalysis(analysis);
                  setActionType(type);
                }}
              />
            ))}
            {myQueue.length === 0 && (
              <Card className="col-span-full py-12 border-dashed border-2 bg-muted/20 flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 opacity-20" />
                <p>Nenhuma solicitação aguardando sua análise.</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analyses">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Todas as Análises</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por cliente ou banco..." 
                    className="pl-9" 
                    value={filters.search}
                    onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  />
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
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalyses?.map((analysis) => (
                    <TableRow key={analysis.id} className="group">
                      <TableCell className="font-medium">
                        {analysis.deal?.title || analysis.lead?.nome || "N/A"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {analysis.consultor?.[0]?.nome || "Sistema"}
                      </TableCell>
                      <TableCell>{analysis.banco || "Não definido"}</TableCell>
                      <TableCell className="font-semibold text-primary">
                        {formatBRL(analysis.valor_solicitado || 0)}
                      </TableCell>
                      <TableCell>
                        {analysis.responsavel?.[0]?.nome || (
                          <span className="text-muted-foreground italic text-xs">Não atribuído</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(analysis.status)}>
                          {analysis.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(analysis.created_at), "dd/MM/yy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('reassign'); }}>
                              <UserPlus className="h-4 w-4 mr-2" /> Reatribuir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('request_docs'); }}>
                              <FileSearch className="h-4 w-4 mr-2" /> Solicitar Docs
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Modals */}
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setSelectedAnalysis(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && "Confirmar Aprovação Interna"}
              {actionType === 'reject' && "Registrar Reprovação"}
              {actionType === 'request_docs' && "Solicitar Documentação Adicional"}
              {actionType === 'reassign' && "Reatribuir Gerente"}
            </DialogTitle>
            <DialogDescription>
              {selectedAnalysis?.deal?.title || selectedAnalysis?.lead?.nome} - {formatBRL(selectedAnalysis?.valor_solicitado || 0)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {actionType === 'reassign' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Novo Gerente</label>
                <Select value={targetManagerId} onValueChange={setTargetManagerId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o gerente" /></SelectTrigger>
                  <SelectContent>
                    {managers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Observações / Motivo</label>
                <Textarea 
                  placeholder={actionType === 'reject' ? "Descreva o motivo da reprovação..." : "Adicione notas internas..."}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancelar</Button>
            <Button 
              onClick={handleAction} 
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              disabled={actionType === 'reject' && !actionNotes}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnalysisCard({ analysis, onAction }: { analysis: any, onAction: (type: any) => void }) {
  const daysInQueue = Math.floor((new Date().getTime() - new Date(analysis.created_at).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Card className="hover:border-primary/50 transition-colors shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <Badge variant={getStatusVariant(analysis.status)}>{analysis.status}</Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {daysInQueue} {daysInQueue === 1 ? 'dia' : 'dias'} em fila
          </span>
        </div>
        <CardTitle className="text-md mt-2 leading-tight">
          {analysis.deal?.title || analysis.lead?.nome}
        </CardTitle>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <UserIcon className="h-3 w-3" /> Consultor: {analysis.consultor?.[0]?.nome || "N/A"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center bg-muted/30 p-2 rounded-md">
          <div className="text-xs font-medium">Valor Solicitado</div>
          <div className="text-lg font-bold text-primary">{formatBRL(analysis.valor_solicitado || 0)}</div>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1" onClick={() => onAction('approve')}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => onAction('request_docs')}>
            <FileSearch className="h-3.5 w-3.5" /> Docs
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onClick={() => onAction('reject')}>
                <XCircle className="h-4 w-4 mr-2" /> Reprovar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('reassign')}>
                <UserPlus className="h-4 w-4 mr-2" /> Reatribuir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
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

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('pt-BR');
  } catch (e) {
    return dateStr;
  }
}

function getStatusVariant(status: string): any {
  switch (status) {
    case 'aprovado':
    case 'aprovada':
    case 'aprovado_interno': return 'success';
    case 'em_analise': return 'warning';
    case 'reprovado':
    case 'reprovada': return 'destructive';
    case 'pendente_documentos': return 'outline';
    default: return 'secondary';
  }
}