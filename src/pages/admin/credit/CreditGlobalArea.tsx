import { useState, useEffect, useMemo, useCallback } from "react";
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
  MoreVertical,
  Check,
  ChevronRight,
  ChevronLeft,
  Send,
  Calculator,
  ExternalLink,
  BarChart3,
  FileDown,
  Download,
  Printer,
  CalendarDays,
  FileSpreadsheet,
  RefreshCw
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
import { formatDistanceToNow, isWithinInterval, startOfDay, endOfDay, differenceInDays, startOfMonth, format, subDays } from "date-fns";
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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreditBankChecklist } from "@/hooks/useCreditConfigs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import * as XLSX from 'xlsx';

/**
 * Tabelas: analise_credito, credit_analysis_events, analise_credito_documentos, profiles, deals, leads
 * Hooks: useCreditDomain, useCreditConfigs, useCreditMetrics
 * Substitui: nenhum (evolução do existente)
 */

const getEosStatusColor = (status: string) => {
  const map: Record<string, string> = {
    em_andamento: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    em_analise: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    pre_aprovada: "bg-teal-500/10 text-teal-500 border-teal-500/20",
    formalizacao: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    paga: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    recusada: "bg-destructive/10 text-destructive border-destructive/20",
    cancelada: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    simulacao: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  };
  return map[status] || "bg-slate-500/10 text-slate-500 border-slate-500/20";
};

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
      dateRange: { from: startOfMonth(new Date()), to: new Date() } as DateRange,
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
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'request_docs' | 'reassign' | 'eos_integrate' | 'view_details' | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [targetManagerId, setTargetManagerId] = useState("");
  const [pendingDocs, setPendingDocs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationOptions, setSimulationOptions] = useState<any[]>([]);
  const [isSendingToEos, setIsSendingToEos] = useState(false);

  useEffect(() => {
    if (selectedAnalysis?.simulacao_resultado) {
      const results = selectedAnalysis.simulacao_resultado;
      setSimulationOptions(Array.isArray(results) ? results : (results.opcoes || []));
    } else {
      setSimulationOptions([]);
    }
  }, [selectedAnalysis]);

  const { data: eosDetails, isLoading: isLoadingEosDetails, refetch: refetchEosDetails } = useQuery({
    queryKey: ["eos-details", selectedAnalysis?.eos_proposta_protocolo],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      const { data, error } = await supabase.functions.invoke('eos-detalhe-proposta', {
        body: { 
          protocolo: selectedAnalysis.eos_proposta_protocolo,
          tenant_id: profile?.tenant_id
        }
      });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAnalysis?.eos_proposta_protocolo && actionType === 'view_details',
  });

  const { data: checklist } = useCreditBankChecklist(selectedAnalysis?.bank_config_id || undefined);
  
  const filteredChecklist = useMemo(() => {
    if (!checklist || !selectedAnalysis) return [];
    return checklist.filter(item => 
      item.applicable_to === 'both' || item.applicable_to === selectedAnalysis.tipo_pessoa
    );
  }, [checklist, selectedAnalysis]);

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
        const docNames = pendingDocs.map(id => checklist?.find(c => c.id === id)?.document_type_name).filter(Boolean);
        updatePayload.observacoes = `${actionNotes}\n\nDocumentos Pendentes:\n- ${docNames.join('\n- ')}`;
      } else if (actionType === 'reassign') {
        updatePayload.responsavel_id = targetManagerId;
      }

      if (['aprovado', 'aprovada', 'reprovado', 'reprovada'].includes(selectedAnalysis.status) && actionType !== 'reassign') {
        toast({ title: "Esta análise já foi finalizada", variant: "destructive" });
        return;
      }

      const { error: updateError } = await supabase
        .from("analise_credito")
        .update(updatePayload)
        .eq("id", selectedAnalysis.id);
      
      if (updateError) throw updateError;

      await supabase.from("credit_analysis_events").insert({
        tenant_id: selectedAnalysis.tenant_id,
        analise_id: selectedAnalysis.id,
        event_type: actionType === 'reassign' ? 'manager_reassigned' : 'status_changed',
        actor_id: currentUser?.id,
        status_anterior: selectedAnalysis.status,
        status_novo: newStatus,
        payload: { notes: actionNotes, ...updatePayload, pendingDocs },
        correlation_id,
        idempotency_key: `${actionType}_${selectedAnalysis.id}_${Date.now()}`
      } as any);

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
      setPendingDocs([]);
    } catch (error: any) {
      toast({ title: "Erro ao processar ação", description: error.message, variant: "destructive" });
    }
  };

  const handleEosSimulate = async (analysis: any) => {
    setIsSimulating(true);
    setSimulationOptions([]);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      const { data, error } = await supabase.functions.invoke('eos-simular', {
        body: {
          analise_id: analysis.id,
          tenant_id: profile?.tenant_id
        }
      });

      if (error) throw error;
      
      // EOS returns an array of options directly
      const options = Array.isArray(data) ? data : (data.opcoes || []);
      setSimulationOptions(options);
      
      if (options.length > 0) {
        toast({ title: "Simulação EOS concluída", description: `${options.length} opções de prazo encontradas.` });
      } else {
        toast({ title: "Atenção", description: "Nenhuma opção de parcelamento retornada pela EOS.", variant: "destructive" });
      }
      
      queryClient.invalidateQueries({ queryKey: ["admin-credit-analyses"] });
    } catch (error: any) {
      toast({ title: "Erro na simulação", description: error.message, variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleEosSend = async (analysis: any, option?: any) => {
    setIsSendingToEos(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      const { data, error } = await supabase.functions.invoke('eos-enviar-proposta', {
        body: {
          analise_id: analysis.id,
          tenant_id: profile?.tenant_id,
          opcao_escolhida: option
        }
      });

      if (error) throw error;
      toast({ title: "Proposta enviada para EOS", description: `Protocolo: ${data.id || data.protocolo}` });
      queryClient.invalidateQueries({ queryKey: ["admin-credit-analyses"] });
      setActionType(null);
    } catch (error: any) {
      toast({ title: "Erro no envio", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingToEos(false);
    }
  };

  const handleSyncEos = async () => {
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      const { data, error } = await supabase.functions.invoke('eos-listar-propostas', {
        body: { tenant_id: profile?.tenant_id }
      });
      if (error) throw error;
      toast({ title: "Sincronização concluída", description: `${data.syncCount} propostas atualizadas.` });
      queryClient.invalidateQueries({ queryKey: ["admin-credit-analyses"] });
    } catch (error: any) {
      toast({ title: "Erro na sincronização", description: error.message, variant: "destructive" });
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredAnalyses?.map(a => ({
      Cliente: a.deal?.title || a.lead?.nome,
      Consultor: a.consultor?.nome || 'Sistema',
      Banco: a.banco,
      Valor: a.valor_solicitado,
      Prazo: a.prazo_meses,
      Status: a.status,
      "Data": a.created_at
    })) || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalhado");
    XLSX.writeFile(wb, `relatorio_credito_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredAnalyses = useMemo(() => {
    return analyses?.filter(a => {
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
    }) || [];
  }, [analyses, filters]);

  const myQueue = useMemo(() => {
    return filteredAnalyses?.filter(a => 
      a.responsavel_id === user?.id && 
      ['aguardando_analise', 'aguardando_documentos'].includes(a.status)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [filteredAnalyses, user]);

  const metricsData = useMemo(() => {
    const total = filteredAnalyses.length;
    const approved = filteredAnalyses.filter(a => ['aprovado_interno', 'aprovada', 'aprovado'].includes(a.status)).length;
    const rejected = filteredAnalyses.filter(a => ['reprovado', 'reprovada'].includes(a.status)).length;
    const inAnalysis = filteredAnalyses.filter(a => ['aguardando_analise', 'em_analise', 'aguardando_documentos'].includes(a.status)).length;
    
    const ticketMedio = total > 0 ? filteredAnalyses.reduce((acc, a) => acc + (a.valor_solicitado || 0), 0) / total : 0;
    const approvalRate = (approved + rejected) > 0 ? (approved / (approved + rejected)) * 100 : 0;

    const timelineMap: Record<string, any> = {};
    filteredAnalyses.forEach(a => {
      const month = format(new Date(a.created_at), 'MMM/yy', { locale: ptBR });
      if (!timelineMap[month]) timelineMap[month] = { month, aprovadas: 0, reprovadas: 0, total: 0 };
      timelineMap[month].total += 1;
      if (['aprovado_interno', 'aprovada', 'aprovado'].includes(a.status)) timelineMap[month].aprovadas += 1;
      if (['reprovado', 'reprovada'].includes(a.status)) timelineMap[month].reprovadas += 1;
    });

    const banksMap: Record<string, any> = {};
    filteredAnalyses.forEach(a => {
      const bank = a.banco || 'Não Definido';
      if (!banksMap[bank]) banksMap[bank] = { name: bank, value: 0 };
      banksMap[bank].value += 1;
    });

    return {
      total,
      approved,
      rejected,
      inAnalysis,
      ticketMedio,
      approvalRate,
      timeline: Object.values(timelineMap),
      banks: Object.values(banksMap)
    };
  }, [filteredAnalyses]);

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500 print:p-0">
      <div className="flex justify-between items-end print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Credit Operations
          </h1>
          <p className="text-muted-foreground">Monitoramento e gestão centralizada de solicitações de crédito.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSyncEos}>
            <RefreshCw className="h-4 w-4" /> Sincronizar EOS
          </Button>
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
                <label className="text-xs font-medium uppercase text-muted-foreground">Período</label>
                <div className="grid gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !filters.dateRange && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4" />
                        {filters.dateRange?.from ? (
                          filters.dateRange.to ? (
                            <>{format(filters.dateRange.from, "LLL dd, y")} - {format(filters.dateRange.to, "LLL dd, y")}</>
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
                onClick={() => setFilters({ managerId: "all", status: "all", consultantId: "all", bank: "all", dateRange: undefined, search: "" })}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <StatCard title="Aguardando Análise" value={metrics?.pendingJobs || 0} icon={Clock} color="text-yellow-500" />
        <StatCard title="Aprovados (Mês)" value={metrics?.approvedThisMonth || 0} icon={TrendingUp} color="text-green-500" />
        <StatCard title="Taxa de Aprovação" value={`${metrics?.approvalRate || 0}%`} icon={CheckCircle2} color="text-blue-500" />
        <StatCard title="Tempo Médio (Dias)" value={metrics?.avgResponseTime || 0} icon={Activity} color="text-purple-500" />
      </div>

      <Tabs defaultValue="my-queue" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-[900px] mb-4 print:hidden">
          <TabsTrigger value="my-queue">Minha Fila</TabsTrigger>
          <TabsTrigger value="analyses">Global de Análises</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="jobs">Orquestração</TabsTrigger>
          <TabsTrigger value="logs">Logs Operacionais</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-6">
          <Card className="print:border-0 print:shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 print:hidden">
              <CardTitle>Relatórios de Crédito</CardTitle>
              <div className="flex gap-2">
                <Button onClick={exportToExcel} variant="outline" size="sm" className="gap-2"><FileSpreadsheet className="h-4 w-4"/> Excel</Button>
                <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2"><Printer className="h-4 w-4"/> PDF</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <StatCard title="Total Solicitações" value={filteredAnalyses?.length || 0} icon={CreditCard} color="text-primary"/>
                <StatCard title="Aprovadas" value={filteredAnalyses?.filter(a => ['aprovado', 'aprovada', 'aprovado_interno'].includes(a.status)).length} icon={CheckCircle2} color="text-green-500"/>
                <StatCard title="Reprovadas" value={filteredAnalyses?.filter(a => ['reprovado', 'reprovada'].includes(a.status)).length} icon={XCircle} color="text-red-500"/>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Aprovadas', value: filteredAnalyses?.filter(a => ['aprovado', 'aprovada', 'aprovado_interno'].includes(a.status)).length || 0 },
                    { name: 'Reprovadas', value: filteredAnalyses?.filter(a => ['reprovado', 'reprovada'].includes(a.status)).length || 0 },
                    { name: 'Em análise', value: filteredAnalyses?.filter(a => !['aprovado', 'aprovada', 'reprovado', 'reprovada', 'cancelada'].includes(a.status)).length || 0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <TableHead>Status EOS</TableHead>
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
                      <TableCell>
                        {analysis.eos_proposta_protocolo ? (
                          <Badge variant="outline" className={cn("capitalize", getEosStatusColor(analysis.eos_status))}>
                            {analysis.eos_status?.replace('_', ' ') || 'Pendente'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                            <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('view_details'); }}>
                              <FileSearch className="h-4 w-4 mr-2" /> Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('reassign'); }}>
                              <UserPlus className="h-4 w-4 mr-2" /> Reatribuir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('request_docs'); }}>
                              <FileSearch className="h-4 w-4 mr-2" /> Solicitar Docs
                            </DropdownMenuItem>
                            {analysis.banco?.toLowerCase().includes('eos') && (
                              <DropdownMenuItem onClick={() => { setSelectedAnalysis(analysis); setActionType('eos_integrate'); }} className="text-primary">
                                <Calculator className="h-4 w-4 mr-2" /> Simulação EOS
                              </DropdownMenuItem>
                            )}
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
      <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className={cn("sm:max-w-[425px]", (actionType === 'eos_integrate' || actionType === 'view_details') && "sm:max-w-[600px]")}>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && "Confirmar Aprovação Interna"}
              {actionType === 'reject' && "Registrar Reprovação"}
              {actionType === 'request_docs' && "Solicitar Documentação Adicional"}
              {actionType === 'reassign' && "Reatribuir Gerente"}
              {actionType === 'eos_integrate' && "Simulação EOS Financiamento Solar"}
              {actionType === 'view_details' && "Detalhes da Análise"}
            </DialogTitle>
            <DialogDescription>
              {selectedAnalysis?.deal?.title || selectedAnalysis?.lead?.nome} - {formatBRL(selectedAnalysis?.valor_solicitado || 0)}
              {actionType === 'eos_integrate' && " - Utilize esta ferramenta para obter as condições reais de financiamento da EOS."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {actionType === 'view_details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cliente</label>
                    <p className="text-sm font-medium">{selectedAnalysis?.deal?.title || selectedAnalysis?.lead?.nome}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Status Interno</label>
                    <Badge variant={getStatusVariant(selectedAnalysis?.status)}>{selectedAnalysis?.status}</Badge>
                  </div>
                </div>

                {selectedAnalysis?.eos_proposta_protocolo && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-primary flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" /> Integração EOS
                      </h4>
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => refetchEosDetails()}>
                        <RefreshCw className={cn("h-3 w-3 mr-1", isLoadingEosDetails && "animate-spin")} />
                        Atualizar da EOS
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-muted-foreground">Protocolo</label>
                        <p className="text-sm font-mono">{selectedAnalysis.eos_proposta_protocolo}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase text-muted-foreground">Status EOS</label>
                        <Badge variant="outline" className={cn("capitalize text-[10px]", getEosStatusColor(selectedAnalysis.eos_status))}>
                          {selectedAnalysis.eos_status?.replace('_', ' ') || 'Sincronizando...'}
                        </Badge>
                      </div>
                    </div>

                    {eosDetails?.ficha && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-white rounded border border-border/50">
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase text-muted-foreground">Financiador</label>
                          <p className="text-xs font-medium">{eosDetails.ficha.financiador}</p>
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase text-muted-foreground">Parcela</label>
                          <p className="text-xs font-medium">{formatBRL(eosDetails.ficha.parcela)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase text-muted-foreground">CET</label>
                          <p className="text-xs font-medium">{eosDetails.ficha.cet}% a.a.</p>
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase text-muted-foreground">Prazo</label>
                          <p className="text-xs font-medium">{eosDetails.ficha.tempoFinanciado} meses</p>
                        </div>
                      </div>
                    )}

                    {eosDetails?.documentos && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Documentos na EOS</label>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-2">
                          {eosDetails.documentos.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-border/40 text-xs">
                              <span className="font-medium">{doc.label}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                  "text-[9px] h-4", 
                                  doc.status === 'Entregue' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                )}>
                                  {doc.status}
                                </Badge>
                                {doc.status !== 'Entregue' && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.onchange = async (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          toast({ title: "Enviando documento...", description: file.name });
                                          const reader = new FileReader();
                                          reader.onload = async () => {
                                            try {
                                              const base64 = (reader.result as string).split(',')[1];
                                              const { error } = await supabase.functions.invoke('eos-enviar-documento', {
                                                body: {
                                                  analise_id: selectedAnalysis.id,
                                                  tipo_documento: doc.tipoDocumento,
                                                  file_name: file.name,
                                                  file_content: base64
                                                }
                                              });
                                              if (error) throw error;
                                              toast({ title: "Sucesso", description: "Documento enviado para EOS." });
                                              refetchEosDetails();
                                            } catch (err: any) {
                                              toast({ title: "Erro no envio", description: err.message, variant: "destructive" });
                                            }
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      };
                                      input.click();
                                    }}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium">Ações Rápidas</label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActionType('approve')} className="text-emerald-600 border-emerald-100 bg-emerald-50/50">
                      Aprovar Interno
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActionType('reject')} className="text-destructive border-red-100 bg-red-50/50">
                      Reprovar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setActionType('request_docs')}>
                      Solicitar Docs
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {actionType === 'reassign' && (
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
            )}

            {actionType === 'request_docs' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Documentos Faltantes</label>
                  <ScrollArea className="h-[200px] border rounded-md p-2">
                    <div className="space-y-2">
                      {filteredChecklist.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded transition-colors">
                          <Checkbox 
                            id={item.id} 
                            checked={pendingDocs.includes(item.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setPendingDocs(p => [...p, item.id]);
                              else setPendingDocs(p => p.filter(id => id !== item.id));
                            }}
                          />
                          <label htmlFor={item.id} className="text-xs leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                            {item.document_type_name}
                            {item.is_required && <span className="text-destructive ml-1">*</span>}
                          </label>
                        </div>
                      ))}
                      {filteredChecklist.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum item de checklist configurado para este banco.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}

            {actionType === 'eos_integrate' && (
              <div className="space-y-6">
                {!simulationOptions || simulationOptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4 border-2 border-dashed rounded-lg bg-muted/20">
                    <Calculator className="h-12 w-12 text-primary/40" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Nenhuma simulação ativa</p>
                      <p className="text-xs text-muted-foreground">Clique abaixo para buscar taxas reais na EOS.</p>
                    </div>
                    <Button 
                      onClick={() => handleEosSimulate(selectedAnalysis)} 
                      disabled={isSimulating}
                      className="gap-2"
                    >
                      {isSimulating ? (
                        <> <RefreshCw className="h-4 w-4 animate-spin" /> Processando... </>
                      ) : (
                        <> <Send className="h-4 w-4" /> Simular Taxas Reais </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Opções de Parcelamento EOS
                      </h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px]" 
                        onClick={() => handleEosSimulate(selectedAnalysis)}
                        disabled={isSimulating}
                      >
                        <RefreshCw className={cn("h-3 w-3 mr-1", isSimulating && "animate-spin")} />
                        Recarregar
                      </Button>
                    </div>
                    
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="h-9 text-[11px]">Prazo</TableHead>
                            <TableHead className="h-9 text-[11px]">Parcela</TableHead>
                            <TableHead className="h-9 text-[11px] text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(Array.isArray(simulationOptions) ? simulationOptions : []).map((opt, i) => (
                            <TableRow key={i} className="hover:bg-muted/30">
                              <TableCell className="py-2 font-medium">{opt.prazo}x</TableCell>
                              <TableCell className="py-2">{formatBRL(opt.parcela)}</TableCell>
                              <TableCell className="py-2 text-right">
                                <Button 
                                  size="sm" 
                                  className="h-7 text-[10px] px-2"
                                  onClick={() => handleEosSend(selectedAnalysis, opt)}
                                  disabled={isSendingToEos}
                                >
                                  Escolher
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      * Taxas e parcelas sujeitas a alteração pela financeira no momento da formalização.
                    </p>
                  </div>
                )}
              </div>
            )}

            {(actionType === 'reject' || actionType === 'request_docs' || actionType === 'approve') && (
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
              disabled={(actionType === 'reject' && !actionNotes) || (actionType === 'reassign' && !targetManagerId)}
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
          <UserIcon className="h-3 w-3" /> Consultor: {analysis.consultor?.[0]?.nome || analysis.consultor?.nome || "N/A"}
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
              {analysis.banco?.toLowerCase().includes('eos') && (
                <DropdownMenuItem onClick={() => onAction('eos_integrate')} className="text-primary">
                  <Calculator className="h-4 w-4 mr-2" /> Simulação EOS
                </DropdownMenuItem>
              )}
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
