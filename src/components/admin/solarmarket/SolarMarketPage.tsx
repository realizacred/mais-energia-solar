import { useState, useMemo } from "react";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, UserX } from "lucide-react";
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
  type SmProject,
  type SmProposal,
} from "@/hooks/useSolarMarket";
import { useSolarMarketSync } from "@/hooks/useSolarMarketSync";
import { SyncProgressBar } from "@/components/admin/solarmarket/SyncProgressBar";
import { SmClientDetailDialog } from "@/components/admin/solarmarket/SmClientDetailDialog";
import { SmProjectDetailDialog } from "@/components/admin/solarmarket/SmProjectDetailDialog";
import { SmProposalDetailDialog } from "@/components/admin/solarmarket/SmProposalDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Sub-components (tables) ────────────────────────────

function ClientsTable({ clients, onSelect, onNavigateProjects }: {
  clients: SmClient[];
  onSelect: (c: SmClient) => void;
  onNavigateProjects: (id: number) => void;
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Nome</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Telefone</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Cidade/UF</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden xl:table-cell">Responsável</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">ID</th>
            <th className="w-9 p-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(c)}>
              <td className="p-2.5">
                <div className="font-medium text-foreground text-xs truncate max-w-[200px]" title={c.name || ""}>{c.name || "—"}</div>
                <div className="text-[11px] text-muted-foreground truncate max-w-[200px] md:hidden">{c.phone || c.email || ""}</div>
              </td>
              <td className="p-2.5 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">{c.phone || "—"}</td>
              <td className="p-2.5 text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                {[c.city, c.state].filter(Boolean).join("/") || "—"}
              </td>
              <td className="p-2.5 text-muted-foreground text-[11px] hidden xl:table-cell">{c.responsible?.name || "—"}</td>
              <td className="p-2.5 text-right">
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{c.sm_client_id}</Badge>
              </td>
              <td className="p-2.5 text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onNavigateProjects(c.sm_client_id); }}>
                      <FolderKanban className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver projetos</TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsTable({ projects, onSelect, onNavigateProposals }: {
  projects: SmProject[];
  onSelect: (p: SmProject) => void;
  onNavigateProposals: (id: number) => void;
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Projeto</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Cliente</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Cidade/UF</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden xl:table-cell">Criado em</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">ID</th>
            <th className="w-9 p-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => {
            const clientName = (p as any).raw_payload?.client?.name || "—";
            const city = (p as any).raw_payload?.client?.city || p.city;
            const state = (p as any).raw_payload?.client?.state || p.state;
            const createdAt = (p as any).sm_created_at || (p as any).raw_payload?.createdAt;

            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(p)}>
                <td className="p-2.5">
                  <div className="font-medium text-foreground text-xs truncate max-w-[200px]" title={p.name || ""}>{p.name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground md:hidden truncate">{clientName}</div>
                </td>
                <td className="p-2.5 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell truncate max-w-[160px]">{clientName}</td>
                <td className="p-2.5 text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                  {[city, state].filter(Boolean).join("/") || "—"}
                </td>
                <td className="p-2.5 text-muted-foreground text-xs whitespace-nowrap hidden xl:table-cell">
                  {createdAt ? new Date(createdAt).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-2.5 text-right">
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{p.sm_project_id}</Badge>
                </td>
                <td className="p-2.5 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onNavigateProposals(p.sm_project_id); }}>
                        <FileText className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver propostas</TooltipContent>
                  </Tooltip>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProposalsTable({ proposals, onSelect }: {
  proposals: SmProposal[];
  onSelect: (p: SmProposal) => void;
}) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Título</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Potência</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">Valor</th>
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Equipamento</th>
            <th className="text-center p-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Status</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">ID</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map(pr => (
            <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(pr)}>
              <td className="p-2.5">
                <div className="font-medium text-foreground text-xs truncate max-w-[200px]" title={pr.titulo || ""}>{pr.titulo || "—"}</div>
                <div className="text-[11px] text-muted-foreground md:hidden">
                  {pr.potencia_kwp ? `${Number(pr.potencia_kwp).toFixed(1)} kWp` : ""}
                </div>
              </td>
              <td className="p-2.5 text-right text-foreground text-xs whitespace-nowrap hidden md:table-cell">
                {pr.potencia_kwp ? `${Number(pr.potencia_kwp).toFixed(2)} kWp` : "—"}
              </td>
              <td className="p-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                {pr.valor_total ? `R$ ${Number(pr.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
              </td>
              <td className="p-2.5 text-muted-foreground text-[11px] hidden lg:table-cell truncate max-w-[180px]">
                {pr.panel_model ? `${pr.panel_model}${pr.panel_quantity ? ` (${pr.panel_quantity}x)` : ""}` : pr.modulos || "—"}
              </td>
              <td className="p-2.5 text-center hidden md:table-cell">
                <Badge variant="outline" className="text-[10px]">{pr.status || "—"}</Badge>
              </td>
              <td className="p-2.5 text-right">
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{pr.sm_proposal_id}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SyncLogsTable({ logs }: { logs: Array<{ id: string; sync_type: string; status: string; total_fetched: number; total_upserted: number; total_errors: number; started_at: string }> }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-2.5 font-medium text-muted-foreground text-xs">Quando</th>
            <th className="text-center p-2.5 font-medium text-muted-foreground text-xs">Tipo</th>
            <th className="text-center p-2.5 font-medium text-muted-foreground text-xs">Status</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">Encontr.</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">Import.</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-xs">Erros</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: ptBR })}
              </td>
              <td className="p-2.5 text-center">
                <Badge variant="outline" className="text-[10px]">{log.sync_type}</Badge>
              </td>
              <td className="p-2.5 text-center">
                {log.status === "completed" ? (
                  <Badge className="text-[10px] bg-success/10 text-success border-0"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                ) : log.status === "running" ? (
                  <Badge className="text-[10px] bg-warning/10 text-warning border-0"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Rodando</Badge>
                ) : (
                  <Badge className="text-[10px] bg-destructive/10 text-destructive border-0"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
                )}
              </td>
              <td className="p-2.5 text-right text-xs font-medium">{log.total_fetched}</td>
              <td className="p-2.5 text-right text-xs font-medium text-success">{log.total_upserted}</td>
              <td className="p-2.5 text-right text-xs font-medium text-destructive">{log.total_errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Clients Without Proposals ──────────────────────────

function ClientsWithoutProposalsSection({ clients, proposals, onSelect }: {
  clients: SmClient[];
  proposals: SmProposal[];
  onSelect: (c: SmClient) => void;
}) {
  const clientsWithoutProposals = useMemo(() => {
    const clientIdsWithProposals = new Set(proposals.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProposals.has(c.sm_client_id));
  }, [clients, proposals]);

  if (clientsWithoutProposals.length === 0) return null;

  return (
    <SectionCard
      title={`Clientes sem Propostas (${clientsWithoutProposals.length})`}
      icon={UserX}
      className="border-warning/30"
    >
      <div className="rounded-lg border overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium text-muted-foreground text-xs">Nome</th>
              <th className="text-left p-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Telefone</th>
              <th className="text-left p-2 font-medium text-muted-foreground text-xs hidden lg:table-cell">Cidade/UF</th>
              <th className="text-left p-2 font-medium text-muted-foreground text-xs hidden xl:table-cell">Responsável</th>
              <th className="text-right p-2 font-medium text-muted-foreground text-xs">ID</th>
            </tr>
          </thead>
          <tbody>
            {clientsWithoutProposals.map(c => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => onSelect(c)}>
                <td className="p-2">
                  <div className="font-medium text-foreground text-xs truncate max-w-[180px]" title={c.name || ""}>{c.name || "—"}</div>
                </td>
                <td className="p-2 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">{c.phone || "—"}</td>
                <td className="p-2 text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                  {[c.city, c.state].filter(Boolean).join("/") || "—"}
                </td>
                <td className="p-2 text-muted-foreground text-[11px] hidden xl:table-cell">{c.responsible?.name || "—"}</td>
                <td className="p-2 text-right">
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{c.sm_client_id}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function SolarMarketPage() {
  const [tab, setTab] = useState("clientes");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SmClient | null>(null);
  const [selectedProject, setSelectedProject] = useState<SmProject | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<SmProposal | null>(null);
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

  // Compute clients without proposals count
  const clientsWithoutProposalsCount = useMemo(() => {
    const clientIdsWithProposals = new Set(proposals.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProposals.has(c.sm_client_id)).length;
  }, [clients, proposals]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const filteredClients = q ? clients.filter(c => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q)) : clients;

    let filteredProjects = projects;
    if (filterClientId) filteredProjects = filteredProjects.filter(p => p.sm_client_id === filterClientId);
    if (q) filteredProjects = filteredProjects.filter(p => p.name?.toLowerCase().includes(q));

    let filteredProposals = proposals;
    if (filterProjectId) filteredProposals = filteredProposals.filter(p => p.sm_project_id === filterProjectId);
    if (q) filteredProposals = filteredProposals.filter(p => p.titulo?.toLowerCase().includes(q));

    return { clients: filteredClients, projects: filteredProjects, proposals: filteredProposals };
  }, [clients, projects, proposals, search, filterClientId, filterProjectId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        icon={Sun}
        title="SolarMarket"
        description="Dados importados do SolarMarket"
        actions={
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {lastSync && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Sync: {formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
            <Button onClick={() => syncAll()} disabled={syncIsRunning} size="sm">
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
              {syncIsRunning ? "Sincronizando..." : "Sincronizar Tudo"}
            </Button>
          </div>
        }
      />

      {/* Sync Progress */}
      <SyncProgressBar progress={progress} />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <StatCard icon={Users} label="Clientes" value={clients.length} color="primary" />
        <StatCard icon={FolderKanban} label="Projetos" value={projects.length} color="info" />
        <StatCard icon={FileText} label="Propostas" value={proposals.length} color="success" />
        <StatCard icon={UserX} label="Sem Propostas" value={clientsWithoutProposalsCount} color="warning" />
        <StatCard icon={Clock} label="Syncs" value={syncLogs.length} color="secondary" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); clearFilters(); setSearch(""); }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList className="h-8">
            <TabsTrigger value="clientes" className="text-xs px-2.5 h-7">
              <Users className="h-3 w-3 mr-1" />
              Clientes ({clients.length})
            </TabsTrigger>
            <TabsTrigger value="projetos" className="text-xs px-2.5 h-7">
              <FolderKanban className="h-3 w-3 mr-1" />
              Projetos ({filtered.projects.length})
              {filterClientId && <span className="ml-1 text-[10px] text-primary">●</span>}
            </TabsTrigger>
            <TabsTrigger value="propostas" className="text-xs px-2.5 h-7">
              <FileText className="h-3 w-3 mr-1" />
              Propostas ({filtered.proposals.length})
              {filterProjectId && <span className="ml-1 text-[10px] text-primary">●</span>}
            </TabsTrigger>
            <TabsTrigger value="sem-proposta" className="text-xs px-2.5 h-7">
              <UserX className="h-3 w-3 mr-1" />
              Sem Proposta ({clientsWithoutProposalsCount})
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs px-2.5 h-7">
              <Clock className="h-3 w-3 mr-1" />
              Logs
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            {(filterClientId || filterProjectId) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[11px] h-7 px-2">
                ✕ Limpar filtro
              </Button>
            )}
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="w-44 h-8" />
          </div>
        </div>

        {/* ─── Clientes Tab ───────────────────────────────── */}
        <TabsContent value="clientes" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => syncStage("clients")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Clientes
            </Button>
          </div>
          {loadingC ? <InlineLoader context="data_load" /> :
            filtered.clients.length === 0 ? (
              <EmptyState icon={Users} title="Nenhum cliente" description="Sincronize para importar clientes." />
            ) : (
              <ClientsTable clients={filtered.clients} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} />
            )}
        </TabsContent>

        {/* ─── Projetos Tab ───────────────────────────────── */}
        <TabsContent value="projetos" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => syncStage("projects")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Projetos
            </Button>
          </div>
          {loadingP ? <InlineLoader context="data_load" /> :
            filtered.projects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="Nenhum projeto" description="Sincronize para importar projetos." />
            ) : (
              <ProjectsTable projects={filtered.projects} onSelect={setSelectedProject} onNavigateProposals={navigateToProposals} />
            )}
        </TabsContent>

        {/* ─── Propostas Tab ──────────────────────────────── */}
        <TabsContent value="propostas" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => syncStage("proposals")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Propostas
            </Button>
          </div>
          {loadingPr ? <InlineLoader context="data_load" /> :
            filtered.proposals.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhuma proposta" description="Sincronize para importar propostas." />
            ) : (
              <ProposalsTable proposals={filtered.proposals} onSelect={setSelectedProposal} />
            )}
        </TabsContent>

        {/* ─── Sem Proposta Tab ────────────────────────────── */}
        <TabsContent value="sem-proposta" className="mt-3">
          {loadingC || loadingPr ? <InlineLoader context="data_load" /> : (
            <ClientsWithoutProposalsSection clients={clients} proposals={proposals} onSelect={setSelectedClient} />
          )}
          {!loadingC && !loadingPr && clientsWithoutProposalsCount === 0 && (
            <EmptyState icon={CheckCircle} title="Todos os clientes têm propostas" description="Nenhum cliente sem proposta encontrado." />
          )}
        </TabsContent>

        {/* ─── Logs Tab ───────────────────────────────────── */}
        <TabsContent value="logs" className="mt-3">
          {syncLogs.length === 0 ? (
            <EmptyState icon={Clock} title="Nenhuma sincronização" description="Execute a primeira sincronização." />
          ) : (
            <SyncLogsTable logs={syncLogs} />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SmClientDetailDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(v) => { if (!v) setSelectedClient(null); }}
        onSave={async (id, data) => { await updateClient.mutateAsync({ id, data }); }}
        onDelete={async (id) => { await deleteClient.mutateAsync(id); setSelectedClient(null); }}
      />
      <SmProjectDetailDialog
        project={selectedProject}
        open={!!selectedProject}
        onOpenChange={(v) => { if (!v) setSelectedProject(null); }}
      />
      <SmProposalDetailDialog
        proposal={selectedProposal}
        open={!!selectedProposal}
        onOpenChange={(v) => { if (!v) setSelectedProposal(null); }}
      />
    </div>
  );
}
