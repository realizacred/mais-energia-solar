import { useState, useMemo } from "react";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Clock, CheckCircle, XCircle, UserX, UserMinus, Eye, MessageSquare, Edit, Trash2 } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyState } from "@/components/ui-kit";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <SectionCard icon={Users} title="Clientes" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map(c => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => onSelect(c)}>
              <TableCell>
                <div>
                  <p className="font-medium">{c.name || "—"}</p>
                  {(c.document_formatted || c.document) && <p className="text-xs text-muted-foreground">{c.document_formatted || c.document}</p>}
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p>{c.phone_formatted || c.phone || "—"}</p>
                  {(c.email_normalized || c.email) && <p className="text-muted-foreground text-xs">{c.email_normalized || c.email}</p>}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{[c.city, c.state].filter(Boolean).join("/") || "—"}</span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{c.responsible?.name || "—"}</span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="text-secondary hover:text-secondary" onClick={(e) => { e.stopPropagation(); onSelect(c); }}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); onNavigateProjects(c.sm_client_id); }}>
                    <FolderKanban className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function ProjectsTable({ projects, onSelect, onNavigateProposals }: {
  projects: SmProject[];
  onSelect: (p: SmProject) => void;
  onNavigateProposals: (id: number) => void;
}) {
  return (
    <SectionCard icon={FolderKanban} title="Projetos" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projeto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Potência</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(p => {
            const clientName = (p as any).raw_payload?.client?.name || "—";
            const city = (p as any).raw_payload?.client?.city || p.city;
            const state = (p as any).raw_payload?.client?.state || p.state;
            const createdAt = (p as any).sm_created_at || (p as any).raw_payload?.createdAt;

            return (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onSelect(p)}>
                <TableCell>
                  <div>
                    <p className="font-medium">{p.name || "—"}</p>
                    {p.status && <Badge variant="outline" className="text-[10px] mt-0.5">{p.status}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{clientName}</span>
                </TableCell>
                <TableCell>
                  {p.potencia_kwp ? (
                    <Badge variant="secondary" className="gap-1">
                      <Sun className="h-3 w-3" />
                      {p.potencia_kwp} kWp
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{[city, state].filter(Boolean).join("/") || "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {createdAt ? new Date(createdAt).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="text-secondary hover:text-secondary" onClick={(e) => { e.stopPropagation(); onSelect(p); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-primary hover:text-primary" onClick={(e) => { e.stopPropagation(); onNavigateProposals(p.sm_project_id); }}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function ProposalsTable({ proposals, onSelect }: {
  proposals: SmProposal[];
  onSelect: (p: SmProposal) => void;
}) {
  return (
    <SectionCard icon={FileText} title="Propostas" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Potência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Equipamento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.map(pr => (
            <TableRow key={pr.id} className="cursor-pointer" onClick={() => onSelect(pr)}>
              <TableCell>
                <p className="font-medium">{pr.titulo || "—"}</p>
              </TableCell>
              <TableCell>
                {pr.potencia_kwp ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sun className="h-3 w-3" />
                    {Number(pr.potencia_kwp).toFixed(2)} kWp
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {pr.valor_total ? `R$ ${Number(pr.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {pr.panel_model ? `${pr.panel_model}${pr.panel_quantity ? ` (${pr.panel_quantity}x)` : ""}` : pr.modulos || "—"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{pr.status || "—"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" className="text-secondary hover:text-secondary" onClick={(e) => { e.stopPropagation(); onSelect(pr); }}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function SyncLogsTable({ logs }: { logs: Array<{ id: string; sync_type: string; status: string; total_fetched: number; total_upserted: number; total_errors: number; started_at: string }> }) {
  return (
    <SectionCard icon={Clock} title="Histórico de Sincronizações" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Encontr.</TableHead>
            <TableHead className="text-right">Import.</TableHead>
            <TableHead className="text-right">Erros</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(log => (
            <TableRow key={log.id}>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(log.started_at), { addSuffix: true, locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{log.sync_type}</Badge>
              </TableCell>
              <TableCell>
                {log.status === "completed" ? (
                  <Badge className="text-[10px] bg-success/10 text-success border-0"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
                ) : log.status === "running" ? (
                  <Badge className="text-[10px] bg-warning/10 text-warning border-0"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Rodando</Badge>
                ) : (
                  <Badge className="text-[10px] bg-destructive/10 text-destructive border-0"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>
                )}
              </TableCell>
              <TableCell className="text-right text-sm font-medium">{log.total_fetched}</TableCell>
              <TableCell className="text-right text-sm font-medium text-success">{log.total_upserted}</TableCell>
              <TableCell className="text-right text-sm font-medium text-destructive">{log.total_errors}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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

  const { syncAll, syncStage, progress } = useSolarMarketSync();
  const syncIsRunning = progress.isRunning;

  const { data: clients = [], isLoading: loadingC } = useSmClients(syncIsRunning);
  const { data: projects = [], isLoading: loadingP } = useSmProjects(syncIsRunning);
  const { data: proposals = [], isLoading: loadingPr } = useSmProposals(syncIsRunning);
  const { data: syncLogs = [] } = useSmSyncLogs();
  const updateClient = useUpdateSmClient();
  const deleteClient = useDeleteSmClient();

  const lastSync = syncLogs[0];

  const clientsWithoutProposalsCount = useMemo(() => {
    const clientIdsWithProposals = new Set(proposals.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProposals.has(c.sm_client_id)).length;
  }, [clients, proposals]);

  const clientsWithoutProjectsCount = useMemo(() => {
    const clientIdsWithProjects = new Set(projects.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProjects.has(c.sm_client_id)).length;
  }, [clients, projects]);

  const clientsWithoutProjects = useMemo(() => {
    const clientIdsWithProjects = new Set(projects.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProjects.has(c.sm_client_id));
  }, [clients, projects]);

  const clientsWithoutProposals = useMemo(() => {
    const clientIdsWithProposals = new Set(proposals.map(p => p.sm_client_id).filter(Boolean));
    return clients.filter(c => !clientIdsWithProposals.has(c.sm_client_id));
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatCard icon={Users} label="Clientes" value={clients.length} color="primary" />
        <StatCard icon={FolderKanban} label="Projetos" value={projects.length} color="info" />
        <StatCard icon={FileText} label="Propostas" value={proposals.length} color="success" />
        <StatCard icon={UserMinus} label="Sem Projeto" value={clientsWithoutProjectsCount} color="destructive" />
        <StatCard icon={UserX} label="Sem Proposta" value={clientsWithoutProposalsCount} color="warning" />
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
            <TabsTrigger value="sem-projeto" className="text-xs px-2.5 h-7">
              <UserMinus className="h-3 w-3 mr-1" />
              Sem Projeto ({clientsWithoutProjectsCount})
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

        {/* ─── Sem Projeto Tab ─────────────────────────────── */}
        <TabsContent value="sem-projeto" className="mt-3">
          {loadingC || loadingP ? <InlineLoader context="data_load" /> :
            clientsWithoutProjectsCount === 0 ? (
              <EmptyState icon={CheckCircle} title="Todos os clientes têm projetos" description="Nenhum cliente sem projeto encontrado." />
            ) : (
              <ClientsTable clients={clientsWithoutProjects} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} />
            )}
        </TabsContent>

        {/* ─── Sem Proposta Tab ────────────────────────────── */}
        <TabsContent value="sem-proposta" className="mt-3">
          {loadingC || loadingPr ? <InlineLoader context="data_load" /> :
            clientsWithoutProposalsCount === 0 ? (
              <EmptyState icon={CheckCircle} title="Todos os clientes têm propostas" description="Nenhum cliente sem proposta encontrado." />
            ) : (
              <ClientsTable clients={clientsWithoutProposals} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} />
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
