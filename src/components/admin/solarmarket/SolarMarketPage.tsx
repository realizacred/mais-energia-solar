import { useState, useMemo } from "react";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Search, Clock, CheckCircle, XCircle } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  useSmClients,
  useSmProjects,
  useSmProposals,
  useSmSyncLogs,
  useSyncSolarMarket,
} from "@/hooks/useSolarMarket";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SolarMarketPage() {
  const [tab, setTab] = useState("clientes");
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading: loadingC } = useSmClients();
  const { data: projects = [], isLoading: loadingP } = useSmProjects();
  const { data: proposals = [], isLoading: loadingPr } = useSmProposals();
  const { data: syncLogs = [] } = useSmSyncLogs();
  const syncMutation = useSyncSolarMarket();

  const lastSync = syncLogs[0];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return {
      clients: q ? clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)) : clients,
      projects: q ? projects.filter(p => p.name?.toLowerCase().includes(q)) : projects,
      proposals: q ? proposals.filter(p => p.titulo?.toLowerCase().includes(q)) : proposals,
    };
  }, [clients, projects, proposals, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sun}
        title="SolarMarket"
        description="Importação de clientes, projetos e propostas do SolarMarket"
        actions={
          <div className="flex gap-2 items-center">
            {lastSync && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Última sync: {formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
            <Button
              onClick={() => syncMutation.mutate("full")}
              disabled={syncMutation.isPending}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Tudo"}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Clientes SM" value={clients.length} color="primary" />
        <StatCard icon={FolderKanban} label="Projetos SM" value={projects.length} color="info" />
        <StatCard icon={FileText} label="Propostas SM" value={proposals.length} color="success" />
        <StatCard
          icon={Clock}
          label="Sincronizações"
          value={syncLogs.length}
          color="secondary"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="clientes">Clientes ({clients.length})</TabsTrigger>
            <TabsTrigger value="projetos">Projetos ({projects.length})</TabsTrigger>
            <TabsTrigger value="propostas">Propostas ({proposals.length})</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="w-48" />
        </div>

        {/* Clientes */}
        <TabsContent value="clientes" className="mt-4">
          {loadingC ? <InlineLoader context="data_load" /> :
            filtered.clients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente importado"
                description="Clique em 'Sincronizar Tudo' para importar os clientes do SolarMarket."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">CPF/CNPJ</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">ID SM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.clients.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{c.name || "—"}</td>
                        <td className="p-3 text-muted-foreground hidden sm:table-cell">{c.email || "—"}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{c.phone || "—"}</td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">{c.document || "—"}</td>
                        <td className="p-3 text-right">
                          <Badge variant="outline" className="text-xs font-mono">{c.sm_client_id}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        {/* Projetos */}
        <TabsContent value="projetos" className="mt-4">
          {loadingP ? <InlineLoader context="data_load" /> :
            filtered.projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Nenhum projeto importado"
                description="Clique em 'Sincronizar Tudo' para importar os projetos do SolarMarket."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Projeto</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Potência</th>
                      <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">ID SM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.projects.map(p => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{p.name || "—"}</td>
                        <td className="p-3 text-right text-foreground">
                          {p.potencia_kwp ? `${p.potencia_kwp} kWp` : "—"}
                        </td>
                        <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                          {p.valor ? `R$ ${Number(p.valor).toLocaleString("pt-BR")}` : "—"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">{p.status || "—"}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Badge variant="outline" className="text-xs font-mono">{p.sm_project_id}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        {/* Propostas */}
        <TabsContent value="propostas" className="mt-4">
          {loadingPr ? <InlineLoader context="data_load" /> :
            filtered.proposals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma proposta importada"
                description="Clique em 'Sincronizar Tudo' para importar as propostas do SolarMarket."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Potência</th>
                      <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Valor Total</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Módulos</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.proposals.map(pr => (
                      <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground">{pr.titulo || "—"}</td>
                        <td className="p-3 text-right text-foreground">
                          {pr.potencia_kwp ? `${pr.potencia_kwp} kWp` : "—"}
                        </td>
                        <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                          {pr.valor_total ? `R$ ${Number(pr.valor_total).toLocaleString("pt-BR")}` : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell text-xs max-w-[200px] truncate">
                          {pr.modulos || "—"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">{pr.status || "—"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          {syncLogs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhuma sincronização"
              description="Execute a primeira sincronização para ver os logs."
            />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Encontrados</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Importados</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map(log => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: ptBR })}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs">{log.sync_type}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        {log.status === "completed" ? (
                          <Badge className="text-[10px] bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                        ) : log.status === "running" ? (
                          <Badge className="text-[10px] bg-warning/10 text-warning"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Rodando</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-destructive/10 text-destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">{log.total_fetched}</td>
                      <td className="p-3 text-right font-medium text-success">{log.total_upserted}</td>
                      <td className="p-3 text-right font-medium text-destructive">{log.total_errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
