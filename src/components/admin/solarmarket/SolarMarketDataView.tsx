import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Eye, Users, FolderOpen, FileText, Search, Loader2,
  RefreshCw, Phone, Mail, ExternalLink, ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
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

const PAGE_SIZE = 50;

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

function PayloadViewer({ data }: { data: any }) {
  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return <p className="text-sm text-muted-foreground italic">Sem dados adicionais</p>;
  }

  return (
    <div className="space-y-1.5">
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return null;
        const isObject = typeof value === "object";
        return (
          <div key={key} className="flex gap-2 text-sm">
            <span className="font-medium text-muted-foreground min-w-[120px] shrink-0">{key}:</span>
            <span className="text-foreground break-all">
              {isObject ? JSON.stringify(value, null, 2) : String(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function SolarMarketDataView() {
  const [activeSubTab, setActiveSubTab] = useState("clients");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Real totals from count queries
  const [totalClients, setTotalClients] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalProposals, setTotalProposals] = useState(0);

  // Data
  const [clients, setClients] = useState<SmClient[]>([]);
  const [projects, setProjects] = useState<SmProject[]>([]);
  const [proposals, setProposals] = useState<SmProposal[]>([]);

  // "Load more" state
  const [hasMoreClients, setHasMoreClients] = useState(false);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [hasMoreProposals, setHasMoreProposals] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<"client" | "project" | "proposal">("client");
  const [detailData, setDetailData] = useState<any>(null);

  // Related data for detail
  const [relatedProjects, setRelatedProjects] = useState<SmProject[]>([]);
  const [relatedProposals, setRelatedProposals] = useState<SmProposal[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // ── Fetch totals (counts) ──
  const fetchTotals = useCallback(async () => {
    const [cRes, pRes, prRes] = await Promise.all([
      supabase.from("solar_market_clients").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("solar_market_projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("solar_market_proposals").select("id", { count: "exact", head: true }),
    ]);
    setTotalClients(cRes.count ?? 0);
    setTotalProjects(pRes.count ?? 0);
    setTotalProposals(prRes.count ?? 0);
  }, []);

  useEffect(() => { fetchTotals(); }, [fetchTotals]);

  const fetchClients = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
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
      setHasMoreClients(items.length === PAGE_SIZE);
    } catch (err) {
      console.error("Erro buscando clientes SM:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, clients.length]);

  const fetchProjects = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = append ? projects.length : 0;
      let query = supabase
        .from("solar_market_projects")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (search) {
        query = query.or(`status.ilike.%${search}%,sm_project_id.eq.${Number(search) || 0}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data as SmProject[]) || [];
      if (append) {
        setProjects(prev => [...prev, ...items]);
      } else {
        setProjects(items);
      }
      setHasMoreProjects(items.length === PAGE_SIZE);
    } catch (err) {
      console.error("Erro buscando projetos SM:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, projects.length]);

  const fetchProposals = useCallback(async (append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const offset = append ? proposals.length : 0;
      let query = supabase
        .from("solar_market_proposals")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (search) {
        query = query.or(`status.ilike.%${search}%,sm_proposal_id.eq.${Number(search) || 0}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data as SmProposal[]) || [];
      if (append) {
        setProposals(prev => [...prev, ...items]);
      } else {
        setProposals(items);
      }
      setHasMoreProposals(items.length === PAGE_SIZE);
    } catch (err) {
      console.error("Erro buscando propostas SM:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, proposals.length]);

  useEffect(() => {
    if (activeSubTab === "clients") fetchClients();
    else if (activeSubTab === "projects") fetchProjects();
    else if (activeSubTab === "proposals") fetchProposals();
  }, [activeSubTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on search change
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeSubTab === "clients") fetchClients();
      else if (activeSubTab === "projects") fetchProjects();
      else fetchProposals();
    }, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    if (activeSubTab === "clients") fetchClients(true);
    else if (activeSubTab === "projects") fetchProjects(true);
    else fetchProposals(true);
  };

  const hasMore = activeSubTab === "clients" ? hasMoreClients
    : activeSubTab === "projects" ? hasMoreProjects
    : hasMoreProposals;

  const openClientDetail = async (client: SmClient) => {
    setDetailType("client");
    setDetailData(client);
    setDetailOpen(true);
    setLoadingRelated(true);

    try {
      const [projRes, propRes] = await Promise.all([
        supabase
          .from("solar_market_projects")
          .select("*")
          .eq("sm_client_id", client.sm_client_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("solar_market_proposals")
          .select("*")
          .eq("sm_client_id", client.sm_client_id)
          .order("created_at", { ascending: false }),
      ]);

      setRelatedProjects((projRes.data as SmProject[]) || []);
      setRelatedProposals((propRes.data as SmProposal[]) || []);
    } catch (err) {
      console.error("Erro buscando dados relacionados:", err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const openProjectDetail = async (project: SmProject) => {
    setDetailType("project");
    setDetailData(project);
    setDetailOpen(true);
    setLoadingRelated(true);

    try {
      const { data } = await supabase
        .from("solar_market_proposals")
        .select("*")
        .eq("sm_project_id", project.sm_project_id)
        .order("created_at", { ascending: false });

      setRelatedProposals((data as SmProposal[]) || []);
      setRelatedProjects([]);
    } catch (err) {
      console.error("Erro buscando propostas:", err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const openProposalDetail = (proposal: SmProposal) => {
    setDetailType("proposal");
    setDetailData(proposal);
    setDetailOpen(true);
    setRelatedProjects([]);
    setRelatedProposals([]);
    setLoadingRelated(false);
  };

  const handleRefresh = () => {
    fetchTotals();
    if (activeSubTab === "clients") fetchClients();
    else if (activeSubTab === "projects") fetchProjects();
    else fetchProposals();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-primary" />
              Dados Sincronizados
            </CardTitle>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="clients" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Clientes ({totalClients})
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Projetos ({totalProjects})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Propostas ({totalProposals})
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* ── Clients ──────── */}
                <TabsContent value="clients">
                  {clients.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum cliente sincronizado</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">ID SM</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Atualizado</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clients.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="font-mono text-xs">{c.sm_client_id}</TableCell>
                              <TableCell className="font-medium">{c.name || "—"}</TableCell>
                              <TableCell className="text-sm">
                                {c.phone ? (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {c.phone}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {c.email ? (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {c.email}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(c.updated_at)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => openClientDetail(c)} title="Ver detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Projects ──────── */}
                <TabsContent value="projects">
                  {projects.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhum projeto sincronizado</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70px]">ID Projeto</TableHead>
                            <TableHead className="w-[70px]">ID Cliente</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Atualizado</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projects.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.sm_project_id}</TableCell>
                              <TableCell className="font-mono text-xs">{p.sm_client_id}</TableCell>
                              <TableCell>
                                {p.status ? <Badge variant="outline">{p.status}</Badge> : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{formatDate(p.updated_at)}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => openProjectDetail(p)} title="Ver detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Proposals ──────── */}
                <TabsContent value="proposals">
                  {proposals.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">Nenhuma proposta sincronizada</p>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[70px]">ID Proposta</TableHead>
                            <TableHead className="w-[70px]">ID Projeto</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Gerada em</TableHead>
                            <TableHead>PDF</TableHead>
                            <TableHead className="w-[50px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {proposals.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-mono text-xs">{p.sm_proposal_id}</TableCell>
                              <TableCell className="font-mono text-xs">{p.sm_project_id}</TableCell>
                              <TableCell>
                                {p.status ? <Badge variant="outline">{p.status}</Badge> : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDate(p.generated_at)}
                              </TableCell>
                              <TableCell>
                                {p.link_pdf ? (
                                  <a
                                    href={p.link_pdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1 text-xs"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    PDF
                                  </a>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => openProposalDetail(p)} title="Ver detalhes">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                {/* ── Load More ── */}
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="gap-2">
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                      Carregar mais
                    </Button>
                  </div>
                )}
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Detail Dialog ──────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailType === "client" && <><Users className="h-5 w-5 text-primary" />Detalhes do Cliente</>}
              {detailType === "project" && <><FolderOpen className="h-5 w-5 text-primary" />Detalhes do Projeto</>}
              {detailType === "proposal" && <><FileText className="h-5 w-5 text-primary" />Detalhes da Proposta</>}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh] pr-4">
            {detailType === "client" && detailData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID SolarMarket</span>
                    <p className="font-mono text-sm">{detailData.sm_client_id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Nome</span>
                    <p className="text-sm font-medium">{detailData.name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Telefone</span>
                    <p className="text-sm">{detailData.phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">E-mail</span>
                    <p className="text-sm">{detailData.email || "—"}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Dados Completos (payload)</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <PayloadViewer data={detailData.payload} />
                  </div>
                </div>

                {loadingRelated ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <>
                    {relatedProjects.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Projetos ({relatedProjects.length})
                          </h4>
                          <div className="space-y-2">
                            {relatedProjects.map((p) => (
                              <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded p-2">
                                <span className="font-mono text-xs">Projeto #{p.sm_project_id}</span>
                                {p.status && <Badge variant="outline" className="text-xs">{p.status}</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {relatedProposals.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Propostas ({relatedProposals.length})
                          </h4>
                          <div className="space-y-2">
                            {relatedProposals.map((p) => (
                              <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded p-2">
                                <span className="font-mono text-xs">Proposta #{p.sm_proposal_id}</span>
                                {p.status && <Badge variant="outline" className="text-xs">{p.status}</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {detailType === "project" && detailData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID Projeto</span>
                    <p className="font-mono text-sm">{detailData.sm_project_id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ID Cliente</span>
                    <p className="font-mono text-sm">{detailData.sm_client_id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="text-sm">{detailData.status || "—"}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Dados Completos (payload)</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <PayloadViewer data={detailData.payload} />
                  </div>
                </div>

                {loadingRelated ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : relatedProposals.length > 0 ? (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Propostas ({relatedProposals.length})
                      </h4>
                      <div className="space-y-2">
                        {relatedProposals.map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-muted/30 rounded p-2">
                            <span className="font-mono text-xs">Proposta #{p.sm_proposal_id}</span>
                            {p.status && <Badge variant="outline" className="text-xs">{p.status}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            )}

            {detailType === "proposal" && detailData && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">ID Proposta</span>
                    <p className="font-mono text-sm">{detailData.sm_proposal_id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">ID Projeto</span>
                    <p className="font-mono text-sm">{detailData.sm_project_id}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <p className="text-sm">{detailData.status || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Gerada em</span>
                    <p className="text-sm">{formatDate(detailData.generated_at)}</p>
                  </div>
                  {detailData.acceptance_date && (
                    <div>
                      <span className="text-xs text-muted-foreground">Aceita em</span>
                      <p className="text-sm">{formatDate(detailData.acceptance_date)}</p>
                    </div>
                  )}
                  {detailData.expiration_date && (
                    <div>
                      <span className="text-xs text-muted-foreground">Expira em</span>
                      <p className="text-sm">{formatDate(detailData.expiration_date)}</p>
                    </div>
                  )}
                </div>

                {detailData.link_pdf && (
                  <a
                    href={detailData.link_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ver PDF da Proposta
                  </a>
                )}

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-2">Dados Completos (payload)</h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <PayloadViewer data={detailData.payload} />
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
