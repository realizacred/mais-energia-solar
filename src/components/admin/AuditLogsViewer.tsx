import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Calendar,
  User,
  Database,
  ShieldCheck,
  FileText,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { formatIntegerBR } from "@/lib/formatters";

interface AuditLog {
  id: string;
  acao: string;
  tabela: string;
  registro_id: string | null;
  user_id: string | null;
  user_email: string | null;
  dados_anteriores: any;
  dados_novos: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: "Criação", color: "bg-success/10 text-success border-success/20" },
  UPDATE: { label: "Atualização", color: "bg-info/10 text-info border-info/20" },
  DELETE: { label: "Exclusão", color: "bg-destructive/10 text-destructive border-destructive/20" },
  LOGIN: { label: "Login", color: "bg-primary/10 text-primary border-primary/20" },
  LOGOUT: { label: "Logout", color: "bg-muted text-muted-foreground border-border" },
};

/** All tables with audit triggers — keep in sync with migrations */
const TABLE_LABELS: Record<string, string> = {
  leads: "Leads",
  orcamentos: "Orçamentos",
  clientes: "Clientes",
  projetos: "Projetos",
  servicos_agendados: "Serviços",
  recebimentos: "Recebimentos",
  parcelas: "Parcelas",
  pagamentos: "Pagamentos",
  comissoes: "Comissões",
  consultores: "Consultores",
  vendedores: "Consultores (legacy)",
  checklists_instalador: "Checklists Instalador",
  checklists_instalacao: "Checklists Instalação",
  profiles: "Perfis",
  user_roles: "Permissões",
  obras: "Obras",
  vendor_invites: "Convites Fornecedor",
  fio_b_escalonamento: "Fio B Escalonamento",
  config_tributaria_estado: "Config Tributária",
  payback_config: "Config Payback",
  loading_config: "Config Loading",
  deals: "Deals (Pipeline)",
  brand_settings: "Personalização",
  concessionarias: "Concessionárias",
  appointments: "Agendamentos",
};

export function AuditLogsViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTabela, setFilterTabela] = useState("todas");
  const [filterAcao, setFilterAcao] = useState("todas");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("id, acao, tabela, registro_id, user_id, user_email, dados_anteriores, dados_novos, ip_address, user_agent, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      if (filterTabela !== "todas") {
        query = query.eq("tabela", filterTabela);
      }
      if (filterAcao !== "todas") {
        query = query.eq("acao", filterAcao);
      }
      if (searchTerm) {
        query = query.or(`user_email.ilike.%${searchTerm}%,tabela.ilike.%${searchTerm}%`);
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Erro ao buscar audit logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filterTabela, filterAcao, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(0);
  }, [filterTabela, filterAcao, searchTerm]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const actionInfo = (acao: string) => ACTION_LABELS[acao] || { label: acao, color: "bg-muted text-muted-foreground" };

  // KPI counts
  const insertCount = logs.filter(l => l.acao === "INSERT").length;
  const updateCount = logs.filter(l => l.acao === "UPDATE").length;
  const deleteCount = logs.filter(l => l.acao === "DELETE").length;

  const renderJsonDiff = (anterior: any, novo: any) => {
    if (!anterior && !novo) return <p className="text-muted-foreground text-sm">Sem dados</p>;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {anterior && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Dados Anteriores</h4>
            <pre className="text-xs bg-destructive/5 p-3 rounded-lg overflow-auto max-h-64 border border-destructive/10">
              {JSON.stringify(anterior, null, 2)}
            </pre>
          </div>
        )}
        {novo && (
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Dados Novos</h4>
            <pre className="text-xs bg-success/5 p-3 rounded-lg overflow-auto max-h-64 border border-success/10">
              {JSON.stringify(novo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Auditoria do Sistema</h1>
            <p className="text-sm text-muted-foreground">Trilha de auditoria imutável — todas as alterações do sistema</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* §27 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{formatIntegerBR(totalCount)}</p>
              <p className="text-sm text-muted-foreground mt-1">Total de registros</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{insertCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Criações (página)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{updateCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Atualizações (página)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{deleteCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Exclusões (página)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email ou tabela..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterTabela} onValueChange={setFilterTabela}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Database className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as tabelas</SelectItem>
                {Object.entries(TABLE_LABELS)
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={filterAcao} onValueChange={setFilterAcao}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">Registros de Auditoria</CardTitle>
          <span className="text-sm text-muted-foreground">
            {formatIntegerBR(totalCount)} registros
            {totalPages > 1 && ` • Página ${page + 1} de ${totalPages}`}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Data/Hora
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">Ação</TableHead>
                  <TableHead className="font-semibold text-foreground">Tabela</TableHead>
                  <TableHead className="font-semibold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Usuário
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-foreground w-[80px] text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center">
                        <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">Nenhum registro de auditoria encontrado</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde novas ações</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const action = actionInfo(log.acao);
                    return (
                      <TableRow key={log.id} className="group hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => { setSelectedLog(log); setDetailOpen(true); }}>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${action.color}`}>
                            {action.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm text-foreground">
                          {TABLE_LABELS[log.tabela] || log.tabela}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {log.user_email || "Sistema"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                              setDetailOpen(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="gap-1.5"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[90vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Detalhes do Registro
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ação</p>
                    <Badge variant="outline" className={`text-xs ${actionInfo(selectedLog.acao).color}`}>
                      {actionInfo(selectedLog.acao).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tabela</p>
                    <p className="text-sm font-medium text-foreground">{TABLE_LABELS[selectedLog.tabela] || selectedLog.tabela}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
                    <p className="text-sm font-mono text-foreground">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                    <p className="text-sm text-foreground">{selectedLog.user_email || "Sistema"}</p>
                  </div>
                  {selectedLog.registro_id && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ID do Registro</p>
                      <p className="text-xs font-mono bg-muted px-2 py-1 rounded text-foreground">{selectedLog.registro_id}</p>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">IP</p>
                      <p className="text-sm font-mono text-foreground">{selectedLog.ip_address}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Dados da Alteração</h4>
                  {renderJsonDiff(selectedLog.dados_anteriores, selectedLog.dados_novos)}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
