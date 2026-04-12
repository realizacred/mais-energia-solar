import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Sun, Users, FolderKanban, FileText, RefreshCw, Clock, CheckCircle, XCircle, UserX, UserMinus, Eye, MessageSquare, Edit, Trash2, GitBranch, Settings2, Filter, ArrowRightLeft, AlertTriangle, Loader2, Upload, ExternalLink, Activity } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
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
  useClearSyncLogs,
  useSmMigrationRealtimeSync,
  type SmClient,
  type SmProject,
  type SmProposal,
  type SmFunnel,
  type SmCustomField,
} from "@/hooks/useSolarMarket";
import { useSolarMarketSync } from "@/hooks/useSolarMarketSync";
import { useRealtimeSyncLogs } from "@/hooks/useRealtimeSyncLogs";
import { SmDashboardPanel } from "@/components/admin/solarmarket/SmDashboardPanel";
import { useActiveSmOperation } from "@/hooks/useSmOperationRuns";
import { SmClientDetailDialog } from "@/components/admin/solarmarket/SmClientDetailDialog";
import { SmProjectDetailDialog } from "@/components/admin/solarmarket/SmProjectDetailDialog";
import { SmProposalDetailDialog } from "@/components/admin/solarmarket/SmProposalDetailDialog";
import { SmMigrationToggle } from "@/components/admin/solarmarket/SmMigrationToggle";
import { SmMigrationDrawer } from "@/components/admin/solarmarket/SmMigrationDrawer";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { Input } from "@/components/ui/input";
import { Select as SelectUI, SelectContent as SelectContentUI, SelectItem as SelectItemUI, SelectTrigger as SelectTriggerUI, SelectValue as SelectValueUI } from "@/components/ui/select";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { useResetTenantData } from "@/hooks/useResetTenantData";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

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
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
      </div>
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
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                    {(p as any).has_active_proposal === false && (
                      <Badge variant="outline" className="text-[10px] mt-0.5 bg-muted text-muted-foreground border-border">Sem proposta</Badge>
                    )}
                    {(p as any).has_active_proposal === true && (
                      <Badge variant="outline" className="text-[10px] mt-0.5 bg-success/10 text-success border-success/20">Tem proposta</Badge>
                    )}
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
                    {createdAt ? formatDate(createdAt) : "—"}
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
      </div>
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

function ProposalsTable({ proposals, onSelect, pagination, selectedIds, onToggleSelect, onToggleAll, onMigrate }: {
  proposals: SmProposal[];
  onSelect: (p: SmProposal) => void;
  pagination?: { page: number; pageSize: number; onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void };
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleAll: (displayed: SmProposal[]) => void;
  onMigrate: (proposals: SmProposal[]) => void;
}) {
  const displayed = pagination ? paginate(proposals, pagination.page, pagination.pageSize) : proposals;
  const allDisplayedSelected = displayed.length > 0 && displayed.every(p => selectedIds.has(p.id));
  const hasSelection = selectedIds.size > 0;

  return (
    <SectionCard icon={FileText} title="Propostas" variant="neutral" noPadding
      actions={hasSelection ? (
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
          const selected = proposals.filter(p => selectedIds.has(p.id));
          onMigrate(selected.slice(0, 10));
        }}>
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          Migrar {selectedIds.size > 10 ? "10 de " : ""}{selectedIds.size} selecionada(s)
        </Button>
      ) : undefined}
    >
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10">
              <Checkbox
                checked={allDisplayedSelected}
                onCheckedChange={() => onToggleAll(displayed)}
              />
            </TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Potência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Status Migração</TableHead>
            <TableHead>Migração</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map(pr => (
            <TableRow key={pr.id} className="cursor-pointer" onClick={() => onSelect(pr)}>
              <TableCell onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(pr.id)}
                  onCheckedChange={() => onToggleSelect(pr.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <p className="font-medium">{pr.titulo || "—"}</p>
                  {pr.link_pdf && (
                    <a href={pr.link_pdf} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Ver PDF">
                      <ExternalLink className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                    </a>
                  )}
                </div>
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
                <Badge variant="outline" className="text-[10px]">{pr.status || "—"}</Badge>
              </TableCell>
              <TableCell>
                {pr.migrado_em ? (
                  <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Migrado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                    Pendente
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <SmMigrationToggle proposal={pr} />
              </TableCell>
              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="text-primary hover:text-primary h-7 px-1.5" onClick={() => onMigrate([pr])} title="Migrar">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-secondary hover:text-secondary h-7 px-1.5" onClick={() => onSelect(pr)} title="Detalhes">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
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
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
      </div>
    </SectionCard>
  );
}

function CustomFieldsTable({ fields }: { fields: SmCustomField[] }) {
  return (
    <SectionCard icon={Settings2} title="Campos Customizados" variant="neutral" noPadding>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                <span className="text-xs text-muted-foreground max-w-xs truncate block">
                  {cf.options
                    ? (Array.isArray(cf.options)
                        ? cf.options.map((o: any) =>
                            typeof o === "string" ? o : (o.label || o.name || o.text || o.value || JSON.stringify(o))
                          ).join(", ")
                        : JSON.stringify(cf.options).slice(0, 120))
                    : "—"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </SectionCard>
  );
}

function SyncLogsTable({ logs }: { logs: Array<{ id: string; sync_type: string; status: string; total_fetched: number; total_upserted: number; total_errors: number; started_at: string; error_message?: string | null }> }) {
  return (
    <SectionCard icon={Clock} title="Histórico de Sincronizações" variant="neutral" noPadding>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
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
                ) : log.status === "partial" ? (
                  <Badge className="text-[10px] bg-warning/10 text-warning border-0" title={log.error_message || "Sincronização parcial — execute novamente para continuar"}>
                    <Clock className="h-3 w-3 mr-1" />Parcial
                  </Badge>
                ) : log.status === "completed_with_errors" ? (
                  <Badge className="text-[10px] bg-warning/10 text-warning border-0"><AlertTriangle className="h-3 w-3 mr-1" />Com erros</Badge>
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
      </div>
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
  const [filterProposalStatus, setFilterProposalStatus] = useState("");
  const [filterProposalConsultor, setFilterProposalConsultor] = useState("");
  const [filterMigrationStatus, setFilterMigrationStatus] = useState<"all" | "pending" | "migrated">("all");

  // Reset state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const resetMutation = useResetTenantData();
  const canReset = resetConfirmText === "APAGAR TUDO" && !resetMutation.isPending;

  // Reset migrated only
  const [resetMigratedOpen, setResetMigratedOpen] = useState(false);
  const [resetMigratedText, setResetMigratedText] = useState("");
  const resetMigratedMutation = useResetMigratedData();
  const canResetMigrated = resetMigratedText === "LIMPAR MIGRADOS" && !resetMigratedMutation.isPending;


  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());
  const [migrationDrawerProposals, setMigrationDrawerProposals] = useState<SmProposal[]>([]);
  const [migrationDrawerOpen, setMigrationDrawerOpen] = useState(false);
  const [migrationRunning, setMigrationRunning] = useState(false);

  const toggleProposalSelect = useCallback((id: string) => {
    setSelectedProposalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllProposals = useCallback((displayed: SmProposal[]) => {
    setSelectedProposalIds(prev => {
      const allSelected = displayed.every(p => prev.has(p.id));
      const next = new Set(prev);
      if (allSelected) {
        displayed.forEach(p => next.delete(p.id));
      } else {
        displayed.forEach(p => next.add(p.id));
      }
      return next;
    });
  }, []);

  const openMigrationDrawer = useCallback((proposals: SmProposal[]) => {
    setMigrationDrawerProposals(proposals);
    setMigrationDrawerOpen(true);
  }, []);

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
    setFilterProposalStatus("");
    setFilterProposalConsultor("");
  };

  const { syncAll, syncStage, progress, syncUntilComplete, requestStopFullSync, fullSyncStatus } = useSolarMarketSync();
  // Realtime: all users see sync progress live
  useRealtimeSyncLogs();
  const syncIsRunning = progress.isRunning;
  const { data: isBgSyncActive = false } = useIsBackgroundSyncActive();
  const { data: activeSmRun } = useActiveSmOperation();
  const isAnySyncActive = syncIsRunning || isBgSyncActive;

  // Auto-resume sync after F5/reload if there's an active non-stale run in SSOT
  const hasAutoResumed = useRef(false);
  useEffect(() => {
    if (hasAutoResumed.current) return;
    if (!activeSmRun) return;
    if ((activeSmRun as any)._stale === true) return;
    if (fullSyncStatus.running || syncIsRunning) return;

    hasAutoResumed.current = true;
    syncUntilComplete();
  }, [activeSmRun, fullSyncStatus.running, syncIsRunning, syncUntilComplete]);

  const { session } = useAuth();
  const sessionReady = !!session;

  const { data: clients = [], isLoading: loadingC } = useSmClients(isAnySyncActive, sessionReady);
  const { data: projects = [], isLoading: loadingP } = useSmProjects(isAnySyncActive, sessionReady);
  const { data: proposals = [], isLoading: loadingPr } = useSmProposals(isAnySyncActive, sessionReady);
  const { data: syncLogs = [] } = useSmSyncLogs();
  const { data: funnels = [], isLoading: loadingF } = useSmFunnels();
  const { data: customFields = [], isLoading: loadingCF } = useSmCustomFields();
  const updateClient = useUpdateSmClient();
  const deleteClient = useDeleteSmClient();
  const clearLogs = useClearSyncLogs();
  useSmMigrationRealtimeSync();

  const lastSync = syncLogs[0];

  const pendingProposals = useMemo(() => proposals.filter(p => !p.migrado_em), [proposals]);
  // Projetos sem proposta NÃO devem ser migrados — só fluxo completo (com proposta)
  const pendingProjectsNoProposal: typeof projects = [];
  const migratedProposalsCount = useMemo(() => proposals.filter(p => !!p.migrado_em).length, [proposals]);

  const [migrateAllOpen, setMigrateAllOpen] = useState(false);
  const [syncPipelinesRunning, setSyncPipelinesRunning] = useState(false);
  const [syncPipelinesResult, setSyncPipelinesResult] = useState<{ pipelines: { created: number; existing: number }; stages: { created: number; existing: number }; consultores: { created: number; existing: number } } | null>(null);

  const runSyncPipelines = useCallback(async () => {
    setSyncPipelinesRunning(true);
    setSyncPipelinesResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      let response: Response;
      try {
        response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "sync_pipelines" }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody?.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data?.report) setSyncPipelinesResult(data.report);
      return data;
    } finally {
      setSyncPipelinesRunning(false);
    }
  }, []);

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

  const uniqueProposalStatuses = useMemo(() => {
    const statuses = proposals.map(p => p.status).filter(Boolean) as string[];
    return [...new Set(statuses)].sort();
  }, [proposals]);

  const uniqueProposalConsultores = useMemo(() => {
    const projectIds = new Set(proposals.map(p => p.sm_project_id).filter(Boolean));
    const names = projects
      .filter(p => projectIds.has(p.sm_project_id))
      .map(p => p.responsible?.name)
      .filter(Boolean) as string[];
    return [...new Set(names)].sort();
  }, [proposals, projects]);

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
    if (filterProposalStatus) filteredProposals = filteredProposals.filter(p => p.status === filterProposalStatus);
    if (filterProposalConsultor) {
      // Match consultor via project's responsible
      const projectIdsForConsultor = new Set(
        projects.filter(pr => pr.responsible?.name === filterProposalConsultor).map(pr => pr.sm_project_id)
      );
      filteredProposals = filteredProposals.filter(p => p.sm_project_id && projectIdsForConsultor.has(p.sm_project_id));
    }
    if (filterMigrationStatus === "pending") filteredProposals = filteredProposals.filter(p => !p.migrado_em);
    if (filterMigrationStatus === "migrated") filteredProposals = filteredProposals.filter(p => !!p.migrado_em);

    return { clients: filteredClients, projects: filteredProjects, proposals: filteredProposals };
  }, [clients, projects, proposals, search, filterClientId, filterProjectId, filterCity, filterResponsible, filterProposalStatus, filterProposalConsultor, filterMigrationStatus]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        icon={Sun}
        title="SolarMarket Importação"
        description="Painel de importação, sincronização e migração de dados do SolarMarket"
        actions={
          <div className="flex gap-2 items-center flex-wrap justify-end">
            {lastSync && (
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                Sync: {formatDistanceToNow(new Date(lastSync.started_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
            {fullSyncStatus.running ? (
              <Button onClick={requestStopFullSync} size="sm" variant="outline" className="border-destructive text-destructive gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Parar Sync
              </Button>
            ) : (
              <Button onClick={syncUntilComplete} disabled={syncIsRunning} size="sm">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncIsRunning ? "animate-spin" : ""}`} />
                {syncIsRunning ? "Sincronizando..." : "Sincronizar Tudo"}
              </Button>
            )}
          </div>
        }
      />

      {/* Action Bar — grouped by scope */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sync actions */}
        <div className="flex items-center gap-1.5 border-r border-border pr-3 mr-1">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mr-1">Sync</span>
          <Button
            onClick={() => runSyncPipelines()}
            disabled={syncPipelinesRunning || projects.length === 0}
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-xs"
            title="Sincronize funis e etapas ANTES de migrar propostas"
          >
            {syncPipelinesRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitBranch className="h-3 w-3" />
            )}
            {syncPipelinesRunning ? "Sincronizando..." : "Funis & Etapas"}
          </Button>
          <Button
            onClick={() => syncStage("projects_funnels" as any)}
            disabled={syncIsRunning || projects.length === 0}
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-xs"
            title="Busca dados de funil para cada projeto na API do SolarMarket"
          >
            {syncIsRunning && progress.currentStage === ("projects_funnels" as any) ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GitBranch className="h-3 w-3" />
            )}
            Funis Projetos
          </Button>
        </div>

        {/* Migration actions */}
        <div className="flex items-center gap-1.5 border-r border-border pr-3 mr-1">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mr-1">Migrar</span>
          <Button
            onClick={() => {
              if (migrationRunning) {
                setMigrationDrawerOpen(true);
              } else {
                setMigrateAllOpen(true);
              }
            }}
            disabled={!migrationRunning && pendingProposals.length === 0 && pendingProjectsNoProposal.length === 0}
            size="sm"
            variant={migrationRunning ? "default" : "outline"}
            className={cn("gap-1 h-7 text-xs", migrationRunning && "animate-pulse")}
          >
            {migrationRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {migrationRunning
              ? "Migrando..."
              : `Migrar (${pendingProposals.length + pendingProjectsNoProposal.length})`}
          </Button>
        </div>

        {/* Reset actions */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mr-1">Reset</span>
          <AlertDialog open={resetMigratedOpen} onOpenChange={(v) => { setResetMigratedOpen(v); if (!v) setResetMigratedText(""); }}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs text-warning hover:text-warning border-warning/30 hover:bg-warning/10"
                disabled={isAnySyncActive || migrationRunning}
                title={isAnySyncActive || migrationRunning ? "Bloqueado: migração/sync em andamento" : "Remove apenas dados migrados do SM"}
              >
                <RefreshCw className="h-3 w-3" />
                Migrados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Limpar dados migrados
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning font-medium">
                      Remove clientes, projetos, propostas e deals migrados do SM.
                    </div>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      <li>Clientes, projetos, propostas nativas serão apagados</li>
                      <li>Deals e recebimentos serão removidos</li>
                      <li className="font-medium text-success">✅ Dados do SolarMarket (sync) são MANTIDOS</li>
                      <li className="font-medium text-success">✅ Flags de migração são resetadas para re-migrar</li>
                    </ul>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-reset-migrated" className="text-sm font-medium">
                        Digite <span className="font-mono font-bold text-warning">LIMPAR MIGRADOS</span> para confirmar:
                      </Label>
                      <Input
                        id="confirm-reset-migrated"
                        value={resetMigratedText}
                        onChange={(e) => setResetMigratedText(e.target.value)}
                        placeholder="LIMPAR MIGRADOS"
                        className="font-mono"
                        autoComplete="off"
                        disabled={resetMigratedMutation.isPending}
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetMigratedMutation.isPending}>Cancelar</AlertDialogCancel>
                <Button
                  variant="outline"
                  onClick={() => resetMigratedMutation.mutate()}
                  disabled={!canResetMigrated}
                  className="gap-1.5 border-warning text-warning hover:bg-warning/10"
                >
                  {resetMigratedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Limpando…
                    </>
                  ) : (
                    "Confirmar Limpeza"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) setResetConfirmText(""); }}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-7 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isAnySyncActive || migrationRunning}
                title={isAnySyncActive || migrationRunning ? "Bloqueado: migração/sync em andamento" : "Apaga TODOS os dados (staging + migrados)"}
              >
                <Trash2 className="h-3 w-3" />
                Tudo
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Resetar todos os dados
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive font-medium">
                      ⚠️ AÇÃO IRREVERSÍVEL — Esta ação irá apagar PERMANENTEMENTE:
                    </div>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      <li>Todos os clientes</li>
                      <li>Todos os projetos</li>
                      <li>Todas as propostas</li>
                      <li>Todos os recebimentos e pagamentos</li>
                      <li>Todos os dados sincronizados do SolarMarket</li>
                    </ul>
                    <p className="text-sm text-muted-foreground font-medium">
                      Esta ação NÃO pode ser desfeita.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-reset-sm" className="text-sm font-medium">
                        Digite <span className="font-mono font-bold text-destructive">APAGAR TUDO</span> para confirmar:
                      </Label>
                      <Input
                        id="confirm-reset-sm"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        placeholder="APAGAR TUDO"
                        className="font-mono"
                        autoComplete="off"
                        disabled={resetMutation.isPending}
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetMutation.isPending}>Cancelar</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => resetMutation.mutate()}
                  disabled={!canReset}
                  className="gap-1.5"
                >
                  {resetMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Apagando dados…
                    </>
                  ) : (
                    "Confirmar Reset"
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Migrate All Dialog */}
      <AlertDialog open={migrateAllOpen} onOpenChange={setMigrateAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Migrar tudo para o sistema canônico
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">
                  <strong>PASSO 0:</strong> Funis, etapas e consultores serão sincronizados automaticamente antes da migração.
                </div>
                <p className="text-sm text-foreground font-medium">Serão migrados:</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li><strong>{pendingProposals.length}</strong> propostas pendentes</li>
                  <li><strong>{pendingProjectsNoProposal.length}</strong> projetos sem proposta pendentes</li>
                </ul>
                {migratedProposalsCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Já migrados anteriormente: <strong>{migratedProposalsCount}</strong> (serão ignorados)
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={async () => {
                setMigrateAllOpen(false);
                // PASSO 0: sync pipelines first
                try {
                  await runSyncPipelines();
                } catch {
                  // Best-effort — continue with migration
                }
                openMigrationDrawer(pendingProposals);
              }}
            >
              Confirmar Migração
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync Pipelines Result */}
      {syncPipelinesResult && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success/5 border border-success/20 text-sm">
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
          <span className="text-foreground">
            Funis sincronizados: {syncPipelinesResult.pipelines.created} criados, {syncPipelinesResult.pipelines.existing} existentes
            {" · "}Etapas: {syncPipelinesResult.stages.created} criadas, {syncPipelinesResult.stages.existing} existentes
            {" · "}Consultores: {syncPipelinesResult.consultores.created} criados, {syncPipelinesResult.consultores.existing} existentes
          </span>
        </div>
      )}

      {/* SINGLE Operational Dashboard — all status + metrics in one place */}
      <SmDashboardPanel
        localSyncRunning={syncIsRunning || fullSyncStatus.running}
        localMigrationRunning={migrationRunning}
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v); clearFilters(); setSearch(""); clientsPag.resetPage(); projectsPag.resetPage(); proposalsPag.resetPage(); noProjectPag.resetPage(); noProposalPag.resetPage(); }}>
        <div className="space-y-3">
          {/* Primary tabs row */}
          <TabsList className="overflow-x-auto flex-nowrap h-auto gap-0.5 p-1 w-full justify-start">
            <TabsTrigger value="clientes" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Clientes
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{clients.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="projetos" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              Projetos
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{projects.length}</Badge>
              {filterClientId && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </TabsTrigger>
            <TabsTrigger value="propostas" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Propostas
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{proposals.length}</Badge>
              {filterProjectId && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </TabsTrigger>
            <TabsTrigger value="sem-projeto" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <UserMinus className="h-3.5 w-3.5" />
              Clientes s/ Projeto
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{clientsWithoutProjectsCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="sem-proposta" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <UserX className="h-3.5 w-3.5" />
              Clientes s/ Proposta
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{clientsWithoutProposalsCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="funis" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Funis
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{funnels.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="campos" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              Campos
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{customFields.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="logs" className="shrink-0 whitespace-nowrap text-xs px-3 h-8 gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap">
            {(filterClientId || filterProjectId || filterCity || filterResponsible) && (
              <Button variant="ghost" size="sm" onClick={() => { clearFilters(); clientsPag.resetPage(); projectsPag.resetPage(); }} className="text-xs h-8 px-2 gap-1">
                <XCircle className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
            <SearchInput value={search} onChange={(v) => { setSearch(v); clientsPag.resetPage(); projectsPag.resetPage(); proposalsPag.resetPage(); }} placeholder="Nome, telefone, doc..." className="w-52 h-8" />
            {(tab === "clientes" || tab === "sem-projeto" || tab === "sem-proposta") && (
              <>
                <SelectUI value={filterCity || "__all__"} onValueChange={(v) => { setFilterCity(v === "__all__" ? "" : v); clientsPag.resetPage(); }}>
                  <SelectTriggerUI className="h-8 text-xs w-auto min-w-[140px]">
                    <SelectValueUI placeholder="Todas cidades" />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="__all__">Todas cidades</SelectItemUI>
                    {uniqueCities.map(c => <SelectItemUI key={c} value={c}>{c}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
                <SelectUI value={filterResponsible || "__all__"} onValueChange={(v) => { setFilterResponsible(v === "__all__" ? "" : v); clientsPag.resetPage(); }}>
                  <SelectTriggerUI className="h-8 text-xs w-auto min-w-[160px]">
                    <SelectValueUI placeholder="Todos responsáveis" />
                  </SelectTriggerUI>
                  <SelectContentUI>
                    <SelectItemUI value="__all__">Todos responsáveis</SelectItemUI>
                    {uniqueResponsibles.map(r => <SelectItemUI key={r} value={r}>{r}</SelectItemUI>)}
                  </SelectContentUI>
                </SelectUI>
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
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <SelectUI value={filterMigrationStatus} onValueChange={(v) => { setFilterMigrationStatus(v as any); proposalsPag.resetPage(); }}>
                <SelectTriggerUI className="h-8 text-xs w-auto min-w-[120px]">
                  <SelectValueUI />
                </SelectTriggerUI>
                <SelectContentUI>
                  <SelectItemUI value="all">Todos</SelectItemUI>
                  <SelectItemUI value="pending">Pendentes</SelectItemUI>
                  <SelectItemUI value="migrated">Migrados</SelectItemUI>
                </SelectContentUI>
              </SelectUI>
              <SelectUI value={filterProposalStatus || "__all__"} onValueChange={(v) => { setFilterProposalStatus(v === "__all__" ? "" : v); proposalsPag.resetPage(); }}>
                <SelectTriggerUI className="h-8 text-xs w-auto min-w-[130px]">
                  <SelectValueUI placeholder="Todos status" />
                </SelectTriggerUI>
                <SelectContentUI>
                  <SelectItemUI value="__all__">Todos status</SelectItemUI>
                  {uniqueProposalStatuses.map(s => <SelectItemUI key={s} value={s}>{s}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
              <SelectUI value={filterProposalConsultor || "__all__"} onValueChange={(v) => { setFilterProposalConsultor(v === "__all__" ? "" : v); proposalsPag.resetPage(); }}>
                <SelectTriggerUI className="h-8 text-xs w-auto min-w-[150px]">
                  <SelectValueUI placeholder="Todos consultores" />
                </SelectTriggerUI>
                <SelectContentUI>
                  <SelectItemUI value="__all__">Todos consultores</SelectItemUI>
                  {uniqueProposalConsultores.map(c => <SelectItemUI key={c} value={c}>{c}</SelectItemUI>)}
                </SelectContentUI>
              </SelectUI>
              {(filterProposalStatus || filterProposalConsultor) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterProposalStatus(""); setFilterProposalConsultor(""); proposalsPag.resetPage(); }} className="text-xs h-8 px-2 gap-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
            <Button onClick={() => syncStage("proposals")} disabled={syncIsRunning} size="sm" variant="outline" className="h-7 text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${syncIsRunning ? "animate-spin" : ""}`} />
              Sync Propostas
            </Button>
          </div>
          {loadingPr ? <InlineLoader context="data_load" /> :
            filtered.proposals.length === 0 ? (
              <EmptyState icon={FileText} title="Nenhuma proposta" description="Sincronize para importar propostas." />
            ) : (
              <ProposalsTable proposals={filtered.proposals} onSelect={setSelectedProposal} selectedIds={selectedProposalIds} onToggleSelect={toggleProposalSelect} onToggleAll={toggleAllProposals} onMigrate={openMigrationDrawer} pagination={{ page: proposalsPag.page, pageSize: proposalsPag.pageSize, onPageChange: proposalsPag.setPage, onPageSizeChange: proposalsPag.setPageSize }} />
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
        <TabsContent value="logs" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => clearLogs.mutate()}
              disabled={clearLogs.isPending || syncLogs.length === 0}
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
              Limpar Logs
            </Button>
          </div>
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
      <SmMigrationDrawer
        proposals={migrationDrawerProposals}
        open={migrationDrawerOpen}
        onOpenChange={setMigrationDrawerOpen}
        onRunningChange={setMigrationRunning}
      />
    </div>
  );
}
