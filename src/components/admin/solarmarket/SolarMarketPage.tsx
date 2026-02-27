import { useState, useMemo } from "react";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Search, Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useSmClients,
  useSmProjects,
  useSmProposals,
  useSmSyncLogs,
  useUpdateSmClient,
  useDeleteSmClient,
  type SmClient,
} from "@/hooks/useSolarMarket";
import { useSolarMarketSync } from "@/hooks/useSolarMarketSync";
import { SyncProgressBar } from "@/components/admin/solarmarket/SyncProgressBar";
import { SmClientDetailDialog } from "@/components/admin/solarmarket/SmClientDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SolarMarketPage() {
  const [tab, setTab] = useState("clientes");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SmClient | null>(null);
  const [filterClientId, setFilterClientId] = useState<number | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);

  const navigateToProjects = (smClientId: number) => {
    setFilterClientId(smClientId);
    setFilterProjectId(null);
    setSearch("");
    setTab("projetos");
  };

  const navigateToProposals = (smProjectId: number) => {
    setFilterProjectId(smProjectId);
    setFilterClientId(null);
    setSearch("");
    setTab("propostas");
  };

  const clearFilters = () => {
    setFilterClientId(null);
    setFilterProjectId(null);
  };

  const { data: clients = [], isLoading: loadingC } = useSmClients();
  const { data: projects = [], isLoading: loadingP } = useSmProjects();
  const { data: proposals = [], isLoading: loadingPr } = useSmProposals();
  const { data: syncLogs = [] } = useSmSyncLogs();
  const { syncAll, syncStage, progress } = useSolarMarketSync();
  const updateClient = useUpdateSmClient();
  const deleteClient = useDeleteSmClient();

  const lastSync = syncLogs[0];
  const syncIsRunning = progress.isRunning;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let filteredClients = q ? clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)) : clients;
    
    let filteredProjects = projects;
    if (filterClientId) filteredProjects = filteredProjects.filter(p => p.sm_client_id === filterClientId);
    if (q) filteredProjects = filteredProjects.filter(p => p.name?.toLowerCase().includes(q));
    
    let filteredProposals = proposals;
    if (filterProjectId) filteredProposals = filteredProposals.filter(p => p.sm_project_id === filterProjectId);
    if (q) filteredProposals = filteredProposals.filter(p => p.titulo?.toLowerCase().includes(q));
    
    return {
      clients: filteredClients,
      projects: filteredProjects,
      proposals: filteredProposals,
    };
  }, [clients, projects, proposals, search, filterClientId, filterProjectId]);

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
              onClick={() => syncAll()}
              disabled={syncIsRunning}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
              {syncIsRunning ? "Sincronizando..." : "Sincronizar Tudo"}
            </Button>
          </div>
        }
      />

      {/* Sync Progress */}
      <SyncProgressBar progress={progress} />

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

      <Tabs value={tab} onValueChange={(v) => { setTab(v); clearFilters(); }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="clientes">Clientes ({clients.length})</TabsTrigger>
            <TabsTrigger value="projetos">
              Projetos ({filtered.projects.length})
              {filterClientId && <span className="ml-1 text-[10px] text-primary">●</span>}
            </TabsTrigger>
            <TabsTrigger value="propostas">
              Propostas ({filtered.proposals.length})
              {filterProjectId && <span className="ml-1 text-[10px] text-primary">●</span>}
            </TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {(filterClientId || filterProjectId) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                Limpar filtro
              </Button>
            )}
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="w-48" />
          </div>
        </div>

        {/* Clientes */}
        <TabsContent value="clientes" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => syncStage("clients")}
              disabled={syncIsRunning}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sincronizar Clientes
            </Button>
          </div>
          {loadingC ? <InlineLoader context="data_load" /> :
            filtered.clients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum cliente importado"
                description="Clique em 'Sincronizar Clientes' para importar."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Telefone</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">CPF/CNPJ</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Cidade/UF</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">ID SM</th>
                      <th className="w-10 p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.clients.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(c)}>
                        <td className="p-3 font-medium text-foreground whitespace-nowrap">{c.name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{c.email || "—"}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{c.phone || "—"}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{c.document || "—"}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {[c.city, c.state].filter(Boolean).join("/") || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">{c.company || "—"}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {c.responsible?.name || "—"}
                        </td>
                        <td className="p-3 text-right">
                          <Badge variant="outline" className="text-xs font-mono">{c.sm_client_id}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); navigateToProjects(c.sm_client_id); }}
                              >
                                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver projetos deste cliente</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        {/* Projetos */}
        <TabsContent value="projetos" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => syncStage("projects")}
              disabled={syncIsRunning}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sincronizar Projetos
            </Button>
          </div>
          {loadingP ? <InlineLoader context="data_load" /> :
            filtered.projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Nenhum projeto importado"
                description="Clique em 'Sincronizar Projetos' para importar."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Projeto</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Cidade/UF</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Responsável</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Criado em</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">ID SM</th>
                      <th className="w-10 p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.projects.map(p => {
                      // Extract client data from raw_payload if available
                      const clientData = (p as any).raw_payload?.client;
                      const clientName = clientData?.name || "—";
                      const clientCity = clientData?.city || p.city;
                      const clientState = clientData?.state || p.state;
                      const responsibleName = (p as any).responsible?.name || (p as any).raw_payload?.responsible?.name || "—";
                      const createdAt = (p as any).sm_created_at || (p as any).raw_payload?.createdAt;

                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium text-foreground whitespace-nowrap">{p.name || "—"}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap text-xs">{clientName}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {[clientCity, clientState].filter(Boolean).join("/") || "—"}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{responsibleName}</td>
                          <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                            {createdAt ? new Date(createdAt).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant="outline" className="text-xs font-mono">{p.sm_project_id}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => navigateToProposals(p.sm_project_id)}
                                >
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver propostas deste projeto</TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </TabsContent>

        {/* Propostas */}
        <TabsContent value="propostas" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => syncStage("proposals")}
              disabled={syncIsRunning}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sincronizar Propostas
            </Button>
          </div>
          {loadingPr ? <InlineLoader context="data_load" /> :
            filtered.proposals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhuma proposta importada"
                description="Clique em 'Sincronizar Propostas' para importar."
              />
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Título</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Potência</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Valor Total</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Painel</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Inversor</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Geração</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Validade</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">ID SM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.proposals.map(pr => (
                      <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium text-foreground whitespace-nowrap">{pr.titulo || "—"}</td>
                        <td className="p-3 text-right text-foreground whitespace-nowrap">
                          {pr.potencia_kwp ? `${Number(pr.potencia_kwp).toFixed(2)} kWp` : "—"}
                        </td>
                        <td className="p-3 text-right text-muted-foreground whitespace-nowrap">
                          {pr.valor_total ? `R$ ${Number(pr.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {pr.panel_model ? `${pr.panel_model}${pr.panel_quantity ? ` (${pr.panel_quantity}x)` : ""}` : pr.modulos || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {pr.inverter_model ? `${pr.inverter_model}${pr.inverter_quantity ? ` (${pr.inverter_quantity}x)` : ""}` : pr.inversores || "—"}
                        </td>
                        <td className="p-3 text-right text-muted-foreground whitespace-nowrap text-xs">
                          {pr.energy_generation ? `${Number(pr.energy_generation).toFixed(0)} kWh/mês` : "—"}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {pr.valid_until ? new Date(pr.valid_until).toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">{pr.status || "—"}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Badge variant="outline" className="text-xs font-mono">{pr.sm_proposal_id}</Badge>
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

      <SmClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(v) => { if (!v) setSelectedClient(null); }}
        onSave={async (id, data) => {
          await updateClient.mutateAsync({ id, data });
        }}
        onDelete={async (id) => {
          await deleteClient.mutateAsync(id);
          setSelectedClient(null);
        }}
      />
    </div>
  );
}
