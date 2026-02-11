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
  Activity
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  vendedores: "Consultores",
  checklists_instalador: "Checklists",
  checklists_instalacao: "Instalações",
  profiles: "Perfis",
  user_roles: "Permissões",
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
        .select("*", { count: "exact" })
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
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Auditoria do Sistema
          </CardTitle>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
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
            <SelectTrigger className="w-full sm:w-[180px]">
              <Database className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as tabelas</SelectItem>
              {Object.entries(TABLE_LABELS).map(([key, label]) => (
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
      </CardHeader>

      <CardContent>
        {/* Stats summary */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span>{totalCount.toLocaleString()} registros encontrados</span>
          {totalPages > 1 && (
            <span>• Página {page + 1} de {totalPages}</span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Data/Hora
                  </div>
                </TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Usuário
                  </div>
                </TableHead>
                <TableHead className="w-[80px] text-center">Detalhes</TableHead>
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro de auditoria encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const action = actionInfo(log.acao);
                  return (
                    <TableRow key={log.id} className="group hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={action.color}>
                          {action.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {TABLE_LABELS[log.tabela] || log.tabela}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                        {log.user_email || "Sistema"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setDetailOpen(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="flex items-center justify-between mt-4">
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

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Detalhes do Registro
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ação</p>
                    <Badge variant="outline" className={actionInfo(selectedLog.acao).color}>
                      {actionInfo(selectedLog.acao).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tabela</p>
                    <p className="text-sm font-medium">{TABLE_LABELS[selectedLog.tabela] || selectedLog.tabela}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Data/Hora</p>
                    <p className="text-sm font-mono">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Usuário</p>
                    <p className="text-sm">{selectedLog.user_email || "Sistema"}</p>
                  </div>
                  {selectedLog.registro_id && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ID do Registro</p>
                      <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{selectedLog.registro_id}</p>
                    </div>
                  )}
                  {selectedLog.ip_address && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">IP</p>
                      <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Dados da Alteração</h4>
                  {renderJsonDiff(selectedLog.dados_anteriores, selectedLog.dados_novos)}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
