import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Users, FolderOpen, FileText, Search,
  RefreshCw, Phone, Mail, ExternalLink, ChevronDown, ChevronRight,
  Calendar, Hash,
} from "lucide-react";
import { format } from "date-fns";
import { Spinner } from "@/components/ui-kit/Spinner";
import { ptBR } from "date-fns/locale";

interface SmClient {
  id: string;
  sm_client_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface SmProject {
  id: string;
  sm_project_id: number;
  sm_client_id: number;
  status: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
}

interface SmProposal {
  id: string;
  sm_proposal_id: number;
  sm_project_id: number;
  sm_client_id: number;
  status: string | null;
  generated_at: string | null;
  acceptance_date: string | null;
  rejection_date: string | null;
  expiration_date: string | null;
  link_pdf: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 25;

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

function formatShortDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

// ── Payload key-value display ──
function PayloadGrid({ data, maxItems = 10 }: { data: any; maxItems?: number }) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-3">
      {entries.slice(0, maxItems).map(([key, value]) => (
        <div key={key} className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{key}</p>
          <p className="text-sm font-medium truncate">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </p>
        </div>
      ))}
      {entries.length > maxItems && (
        <p className="text-xs text-muted-foreground col-span-full">
          +{entries.length - maxItems} campos adicionais
        </p>
      )}
    </div>
  );
}

// ── Proposal Card ──
function ProposalCard({ proposal }: { proposal: SmProposal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">Proposta #{proposal.sm_proposal_id}</span>
        </div>
        <div className="flex items-center gap-2">
          {proposal.status && (
            <Badge variant={proposal.status === "accepted" ? "default" : "outline"} className="text-xs">
              {proposal.status}
            </Badge>
          )}
          {proposal.link_pdf && (
            <a
              href={proposal.link_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              PDF
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {proposal.generated_at && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Gerada: {formatShortDate(proposal.generated_at)}
          </span>
        )}
        {proposal.acceptance_date && (
          <span className="text-success">Aceita: {formatShortDate(proposal.acceptance_date)}</span>
        )}
        {proposal.expiration_date && (
          <span>Expira: {formatShortDate(proposal.expiration_date)}</span>
        )}
      </div>

      {proposal.payload && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Dados completos
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <PayloadGrid data={proposal.payload} maxItems={20} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ── Project Card with nested proposals ──
function ProjectCard({ project, proposals }: { project: SmProject; proposals: SmProposal[] }) {
  const [open, setOpen] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);
  const projectProposals = proposals.filter(p => p.sm_project_id === project.sm_project_id);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              <span className="font-mono text-sm font-medium">Projeto #{project.sm_project_id}</span>
              {project.status && (
                <Badge variant="outline" className="text-xs">{project.status}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {projectProposals.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {projectProposals.length} proposta{projectProposals.length > 1 ? "s" : ""}
                </Badge>
              )}
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Atualizado: {formatDate(project.updated_at)}</span>
            </div>

            {project.payload && (
              <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1 text-muted-foreground">
                    {payloadOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Dados do projeto
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <PayloadGrid data={project.payload} maxItems={15} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {projectProposals.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Propostas ({projectProposals.length})
                  </p>
                  {projectProposals.map(prop => (
                    <ProposalCard key={prop.id} proposal={prop} />
                  ))}
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Client Card with nested projects ──
function ClientCard({ client }: { client: SmClient }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<SmProject[]>([]);
  const [proposals, setProposals] = useState<SmProposal[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);

  const loadRelated = async () => {
    if (loaded) return;
    setLoadingRelated(true);
    try {
      const [projRes, propRes] = await Promise.all([
        supabase
          .from("solar_market_projects")
          .select("*")
          .eq("sm_client_id", client.sm_client_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("solar_market_proposals")
          .select("*")
          .eq("sm_client_id", client.sm_client_id)
          .order("created_at", { ascending: false }),
      ]);
      setProjects((projRes.data as SmProject[]) || []);
      setProposals((propRes.data as SmProposal[]) || []);
      setLoaded(true);
    } catch (err) {
      console.error("Erro buscando dados do cliente:", err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleToggle = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) loadRelated();
  };

  return (
    <Collapsible open={open} onOpenChange={handleToggle}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardHeader className="py-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{client.name || "Sem nome"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        SM {client.sm_client_id}
                      </span>
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <Mail className="h-3 w-3" />
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {formatShortDate(client.updated_at)}
                  </span>
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <Separator />

            {/* Client payload */}
            {client.payload && (
              <Collapsible open={payloadOpen} onOpenChange={setPayloadOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground">
                    {payloadOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Dados do cliente
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <PayloadGrid data={client.payload} maxItems={15} />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Loading */}
            {loadingRelated && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}

            {/* Projects */}
            {loaded && !loadingRelated && (
              <>
                {projects.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      Projetos ({projects.length})
                    </p>
                    {projects.map(proj => (
                      <ProjectCard
                        key={proj.id}
                        project={proj}
                        proposals={proposals}
                      />
                    ))}

                    {/* Orphan proposals (not linked to any project) */}
                    {(() => {
                      const projIds = new Set(projects.map(p => p.sm_project_id));
                      const orphans = proposals.filter(p => !projIds.has(p.sm_project_id));
                      if (orphans.length === 0) return null;
                      return (
                        <div className="space-y-2 mt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5" />
                            Propostas sem projeto ({orphans.length})
                          </p>
                          {orphans.map(prop => (
                            <ProposalCard key={prop.id} proposal={prop} />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : proposals.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Propostas ({proposals.length})
                    </p>
                    {proposals.map(prop => (
                      <ProposalCard key={prop.id} proposal={prop} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3">
                    Nenhum projeto ou proposta vinculado a este cliente
                  </p>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ── Main View ──
export function SolarMarketDataView() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<SmClient[]>([]);
  const [search, setSearch] = useState("");
  const [totalClients, setTotalClients] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchClients = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      // Count
      if (!append) {
        let countQ = supabase
          .from("solar_market_clients")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null);
        if (search) {
          countQ = countQ.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }
        const { count } = await countQ;
        setTotalClients(count ?? 0);
      }

      const offset = append ? clients.length : 0;
      let query = supabase
        .from("solar_market_clients")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data as SmClient[]) || [];
      if (append) {
        setClients(prev => [...prev, ...items]);
      } else {
        setClients(items);
      }
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      console.error("Erro buscando clientes SM:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, clients.length]);

  useEffect(() => {
    fetchClients();
  }, []); // eslint-disable-line

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchClients(), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Clientes SolarMarket
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {totalClients} cliente{totalClients !== 1 ? "s" : ""} sincronizado{totalClients !== 1 ? "s" : ""}
              {" · "}Clique para expandir projetos e propostas
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => fetchClients()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => fetchClients(true)} disabled={loadingMore} className="gap-2">
                  {loadingMore ? <Spinner size="sm" /> : <ChevronDown className="h-4 w-4" />}
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
