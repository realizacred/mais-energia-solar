import { useState, useMemo, useCallback } from "react";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Clock, CheckCircle, XCircle, UserX, UserMinus, Eye, MessageSquare, Edit, Trash2, GitBranch, Settings2, Filter } from "lucide-react";
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
  useSmFunnels,
  useSmCustomFields,
  useIsBackgroundSyncActive,
  useUpdateSmClient,
  useDeleteSmClient,
  type SmClient,
  type SmProject,
  type SmProposal,
  type SmFunnel,
  type SmCustomField,
} from "@/hooks/useSolarMarket";
import { useSolarMarketSync } from "@/hooks/useSolarMarketSync";
import { SyncProgressBar } from "@/components/admin/solarmarket/SyncProgressBar";
import { SmClientDetailDialog } from "@/components/admin/solarmarket/SmClientDetailDialog";
import { SmProjectDetailDialog } from "@/components/admin/solarmarket/SmProjectDetailDialog";
import { SmProposalDetailDialog } from "@/components/admin/solarmarket/SmProposalDetailDialog";
import { SmMigrationToggle } from "@/components/admin/solarmarket/SmMigrationToggle";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { Input } from "@/components/ui/input";
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from "@/components/ui/select";

// ─── Pagination hook ────────────────────────────────────
function usePagination(defaultSize = 100) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);
  const resetPage = useCallback(() => setPage(1), []);
  return { page, setPage, pageSize, setPageSize, resetPage };
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

// ─── Sub-components (tables) ────────────────────────────

function ClientsTable({ clients, onSelect, onNavigateProjects, pagination }: {
  clients: SmClient[];
  onSelect: (c: SmClient) => void;
  onNavigateProjects: (id: number) => void;
  pagination?: { page: number; pageSize: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void };
}) {
  const displayed = pagination ? paginate(clients, pagination.page, pagination.pageSize) : clients;
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
          {displayed.map(c => (
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
      {pagination && (
        <TablePagination
          totalItems={clients.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </SectionCard>
  );
}

function ProjectsTable({ projects, onSelect, onNavigateProposals, clientsMap, pagination }: {
  projects: SmProject[];
  onSelect: (p: SmProject) => void;
  onNavigateProposals: (id: number) => void;
  clientsMap?: Map<number, SmClient>;
  pagination?: { page: number; pageSize: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void };
}) {
  const displayed = pagination ? paginate(projects, pagination.page, pagination.pageSize) : projects;
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
          {displayed.map(p => {
            const client = clientsMap?.get(p.sm_client_id ?? 0);
            const clientName = client?.name || "—";
            const city = p.city || client?.city;
            const state = p.state || client?.state;
            const createdAt = (p as any).sm_created_at;

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
      {pagination && (
        <TablePagination
          totalItems={projects.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </SectionCard>
  );
}

function ProposalsTable({ proposals, onSelect, pagination }: {
  proposals: SmProposal[];
  onSelect: (p: SmProposal) => void;
  pagination?: { page: number; pageSize: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void };
}) {
  const displayed = pagination ? paginate(proposals, pagination.page, pagination.pageSize) : proposals;
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
             <TableHead>Migração</TableHead>
             <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map(pr => (
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
              <TableCell>
                <SmMigrationToggle proposal={pr} />
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
      {pagination && (
        <TablePagination
          totalItems={proposals.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </SectionCard>
  );
}

function FunnelsTable({ funnels }: { funnels: SmFunnel[] }) {
  return (
    <SectionCard icon={GitBranch} title="Funis" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Funil</TableHead>
            <TableHead>ID SM</TableHead>
            <TableHead>Etapas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {funnels.map(f => {
            const stages = (() => { try { return typeof f.stages === "string" ? JSON.parse(f.stages) : f.stages; } catch { return []; } })();
            return (
              <TableRow key={f.id}>
                <TableCell><p className="font-medium">{f.name || "—"}</p></TableCell>
                <TableCell><span className="text-sm text-muted-foreground">{f.sm_funnel_id}</span></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(stages) && stages.map((s: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{s.name || s.title || `#${i + 1}`}</Badge>
                    ))}
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

function CustomFieldsTable({ fields }: { fields: SmCustomField[] }) {
  return (
    <SectionCard icon={Settings2} title="Campos Customizados" variant="neutral" noPadding>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Chave</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Opções</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(cf => (
            <TableRow key={cf.id}>
              <TableCell><p className="font-medium">{cf.name || "—"}</p></TableCell>
              <TableCell><code className="text-xs text-muted-foreground">{cf.key || "—"}</code></TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{cf.field_type || "—"}</Badge></TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {cf.options ? (Array.isArray(cf.options) ? cf.options.map((o: any) => o.label || o.name || o).join(", ") : JSON.stringify(cf.options).slice(0, 80)) : "—"}
                </span>
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
  const [filterCity, setFilterCity] = useState("");
  const [filterResponsible, setFilterResponsible] = useState("");
  const [selectedClient, setSelectedClient] = useState<SmClient | null>(null);
  const [selectedProject, setSelectedProject] = useState<SmProject | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<SmProposal | null>(null);
  const [filterClientId, setFilterClientId] = useState<number | null>(null);
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);

  // Pagination state per tab
  const clientsPag = usePagination(100);
  const projectsPag = usePagination(100);
  const proposalsPag = usePagination(100);
  const noProjectPag = usePagination(100);
  const noProposalPag = usePagination(100);

  const navigateToProjects = (smClientId: number) => {
    setFilterClientId(smClientId);
    setFilterProjectId(null);
    setSearch("");
    setFilterCity("");
    setFilterResponsible("");
    projectsPag.resetPage();
    setTab("projetos");
  };

  const navigateToProposals = (smProjectId: number) => {
    setFilterProjectId(smProjectId);
    setFilterClientId(null);
    setSearch("");
    setFilterCity("");
    setFilterResponsible("");
    proposalsPag.resetPage();
    setTab("propostas");
  };

  const clearFilters = () => {
    setFilterClientId(null);
    setFilterProjectId(null);
    setFilterCity("");
    setFilterResponsible("");
  };

  const { syncAll, syncStage, progress } = useSolarMarketSync();
  const syncIsRunning = progress.isRunning;
  const { data: isBgSyncActive = false } = useIsBackgroundSyncActive();
  const isAnySyncActive = syncIsRunning || isBgSyncActive;

  const { data: clients = [], isLoading: loadingC } = useSmClients(isAnySyncActive);
  const { data: projects = [], isLoading: loadingP } = useSmProjects(isAnySyncActive);
  const { data: proposals = [], isLoading: loadingPr } = useSmProposals(isAnySyncActive);
  const { data: syncLogs = [] } = useSmSyncLogs();
  const { data: funnels = [], isLoading: loadingF } = useSmFunnels();
  const { data: customFields = [], isLoading: loadingCF } = useSmCustomFields();
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

  // Build lookup map for client names (used by ProjectsTable and filters)
  const clientsLookup = useMemo(() => {
    const map = new Map<number, SmClient>();
    clients.forEach(c => map.set(c.sm_client_id, c));
    return map;
  }, [clients]);

  // Extract unique cities and responsibles for filter dropdowns
  const uniqueCities = useMemo(() => {
    const cities = clients.map(c => [c.city, c.state].filter(Boolean).join("/")).filter(Boolean);
    return [...new Set(cities)].sort();
  }, [clients]);

  const uniqueResponsibles = useMemo(() => {
    const names = clients.map(c => c.responsible?.name).filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const cityFilter = filterCity.toLowerCase();
    const respFilter = filterResponsible.toLowerCase();

    let filteredClients = clients;
    if (q) filteredClients = filteredClients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.document?.includes(q) ||
      c.document_formatted?.includes(q)
    );
    if (cityFilter) filteredClients = filteredClients.filter(c =>
      [c.city, c.state].filter(Boolean).join("/").toLowerCase().includes(cityFilter)
    );
    if (respFilter) filteredClients = filteredClients.filter(c =>
      c.responsible?.name?.toLowerCase().includes(respFilter)
    );

    let filteredProjects = projects;
    if (filterClientId) filteredProjects = filteredProjects.filter(p => p.sm_client_id === filterClientId);
    if (q) filteredProjects = filteredProjects.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      clientsLookup.get(p.sm_client_id ?? 0)?.name?.toLowerCase().includes(q)
    );
    if (cityFilter) filteredProjects = filteredProjects.filter(p =>
      [p.city || clientsLookup.get(p.sm_client_id ?? 0)?.city, p.state || clientsLookup.get(p.sm_client_id ?? 0)?.state].filter(Boolean).join("/").toLowerCase().includes(cityFilter)
    );

    let filteredProposals = proposals;
    if (filterProjectId) filteredProposals = filteredProposals.filter(p => p.sm_project_id === filterProjectId);
    if (q) filteredProposals = filteredProposals.filter(p => p.titulo?.toLowerCase().includes(q));

    return { clients: filteredClients, projects: filteredProjects, proposals: filteredProposals };
  }, [clients, projects, proposals, search, filterClientId, filterProjectId, filterCity, filterResponsible]);

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

      {/* Sync indicator for background sync */}
      {isBgSyncActive && !syncIsRunning && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Sincronização automática em andamento... os contadores atualizam a cada ~10s
        </div>
      )}

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
      <Tabs value={tab} onValueChange={(v) => { setTab(v); clearFilters(); setSearch(""); clientsPag.resetPage(); projectsPag.resetPage(); proposalsPag.resetPage(); noProjectPag.resetPage(); noProposalPag.resetPage(); }}>
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
            <TabsTrigger value="funis" className="text-xs px-2.5 h-7">
              <GitBranch className="h-3 w-3 mr-1" />
              Funis ({funnels.length})
            </TabsTrigger>
            <TabsTrigger value="campos" className="text-xs px-2.5 h-7">
              <Settings2 className="h-3 w-3 mr-1" />
              Campos ({customFields.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs px-2.5 h-7">
              <Clock className="h-3 w-3 mr-1" />
              Logs
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-wrap">
            {(filterClientId || filterProjectId || filterCity || filterResponsible) && (
              <Button variant="ghost" size="sm" onClick={() => { clearFilters(); clientsPag.resetPage(); projectsPag.resetPage(); }} className="text-[11px] h-7 px-2">
                ✕ Limpar filtros
              </Button>
            )}
            <SearchInput value={search} onChange={(v) => { setSearch(v); clientsPag.resetPage(); projectsPag.resetPage(); proposalsPag.resetPage(); }} placeholder="Nome, telefone, doc..." className="w-48 h-8" />
            {(tab === "clientes" || tab === "sem-projeto" || tab === "sem-proposta") && (
              <>
                <select
                  value={filterCity}
                  onChange={(e) => { setFilterCity(e.target.value); clientsPag.resetPage(); }}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="">Todas cidades</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filterResponsible}
                  onChange={(e) => { setFilterResponsible(e.target.value); clientsPag.resetPage(); }}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground"
                >
                  <option value="">Todos responsáveis</option>
                  {uniqueResponsibles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </>
            )}
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
              <ClientsTable clients={filtered.clients} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} pagination={{ page: clientsPag.page, pageSize: clientsPag.pageSize, onPageChange: clientsPag.setPage, onPageSizeChange: clientsPag.setPageSize }} />
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
              <ProjectsTable projects={filtered.projects} onSelect={setSelectedProject} onNavigateProposals={navigateToProposals} clientsMap={clientsLookup} pagination={{ page: projectsPag.page, pageSize: projectsPag.pageSize, onPageChange: projectsPag.setPage, onPageSizeChange: projectsPag.setPageSize }} />
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
              <ProposalsTable proposals={filtered.proposals} onSelect={setSelectedProposal} pagination={{ page: proposalsPag.page, pageSize: proposalsPag.pageSize, onPageChange: proposalsPag.setPage, onPageSizeChange: proposalsPag.setPageSize }} />
            )}
        </TabsContent>

        {/* ─── Sem Projeto Tab ─────────────────────────────── */}
        <TabsContent value="sem-projeto" className="mt-3">
          {loadingC || loadingP ? <InlineLoader context="data_load" /> :
            clientsWithoutProjectsCount === 0 ? (
              <EmptyState icon={CheckCircle} title="Todos os clientes têm projetos" description="Nenhum cliente sem projeto encontrado." />
            ) : (
              <ClientsTable clients={clientsWithoutProjects} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} pagination={{ page: noProjectPag.page, pageSize: noProjectPag.pageSize, onPageChange: noProjectPag.setPage, onPageSizeChange: noProjectPag.setPageSize }} />
            )}
        </TabsContent>

        {/* ─── Sem Proposta Tab ────────────────────────────── */}
        <TabsContent value="sem-proposta" className="mt-3">
          {loadingC || loadingPr ? <InlineLoader context="data_load" /> :
            clientsWithoutProposalsCount === 0 ? (
              <EmptyState icon={CheckCircle} title="Todos os clientes têm propostas" description="Nenhum cliente sem proposta encontrado." />
            ) : (
              <ClientsTable clients={clientsWithoutProposals} onSelect={setSelectedClient} onNavigateProjects={navigateToProjects} pagination={{ page: noProposalPag.page, pageSize: noProposalPag.pageSize, onPageChange: noProposalPag.setPage, onPageSizeChange: noProposalPag.setPageSize }} />
            )}
        </TabsContent>

        {/* ─── Funis Tab ──────────────────────────────────── */}
        <TabsContent value="funis" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => syncStage("funnels")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Funis
            </Button>
          </div>
          {loadingF ? <InlineLoader context="data_load" /> :
            funnels.length === 0 ? (
              <EmptyState icon={GitBranch} title="Nenhum funil" description="Sincronize para importar funis." />
            ) : (
              <FunnelsTable funnels={funnels} />
            )}
        </TabsContent>

        {/* ─── Campos Custom Tab ─────────────────────────────── */}
        <TabsContent value="campos" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => syncStage("custom_fields")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Campos
            </Button>
          </div>
          {loadingCF ? <InlineLoader context="data_load" /> :
            customFields.length === 0 ? (
              <EmptyState icon={Settings2} title="Nenhum campo" description="Sincronize para importar campos customizados." />
            ) : (
              <CustomFieldsTable fields={customFields} />
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
