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
  RefreshCw, Phone, Mail, ExternalLink, Calendar,
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

  // Data
  const [clients, setClients] = useState<SmClient[]>([]);
  const [projects, setProjects] = useState<SmProject[]>([]);
  const [proposals, setProposals] = useState<SmProposal[]>([]);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<"client" | "project" | "proposal">("client");
  const [detailData, setDetailData] = useState<any>(null);

  // Related data for detail
  const [relatedProjects, setRelatedProjects] = useState<SmProject[]>([]);
  const [relatedProposals, setRelatedProposals] = useState<SmProposal[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("solar_market_clients")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients((data as SmClient[]) || []);
    } catch (err) {
      console.error("Erro buscando clientes SM:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("solar_market_projects")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (search) {
        query = query.or(`status.ilike.%${search}%,sm_project_id.eq.${Number(search) || 0}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects((data as SmProject[]) || []);
    } catch (err) {
      console.error("Erro buscando projetos SM:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("solar_market_proposals")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (search) {
        query = query.or(`status.ilike.%${search}%,sm_proposal_id.eq.${Number(search) || 0}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProposals((data as SmProposal[]) || []);
    } catch (err) {
      console.error("Erro buscando propostas SM:", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (activeSubTab === "clients") fetchClients();
    else if (activeSubTab === "projects") fetchProjects();
    else if (activeSubTab === "proposals") fetchProposals();
  }, [activeSubTab, fetchClients, fetchProjects, fetchProposals]);

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
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (activeSubTab === "clients") fetchClients();
                  else if (activeSubTab === "projects") fetchProjects();
                  else fetchProposals();
                }}
              >
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
                Clientes ({clients.length})
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Projetos ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="proposals" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Propostas ({proposals.length})
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
              <Eye className="h-5 w-5 text-primary" />
              {detailType === "client" && `Cliente SM #${detailData?.sm_client_id}`}
              {detailType === "project" && `Projeto SM #${detailData?.sm_project_id}`}
              {detailType === "proposal" && `Proposta SM #${detailData?.sm_proposal_id}`}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            {detailData && (
              <div className="space-y-5">
                {/* ── Main Info ── */}
                {detailType === "client" && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Cadastrais</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="Nome" value={detailData.name} />
                      <InfoRow label="E-mail" value={detailData.email} />
                      <InfoRow label="Telefone" value={detailData.phone} />
                      <InfoRow label="Tel. Normalizado" value={detailData.phone_normalized} />
                      <InfoRow label="ID SolarMarket" value={String(detailData.sm_client_id)} />
                      <InfoRow label="Sincronizado em" value={formatDate(detailData.updated_at)} />
                    </div>
                  </div>
                )}

                {detailType === "project" && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados do Projeto</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="ID Projeto" value={String(detailData.sm_project_id)} />
                      <InfoRow label="ID Cliente" value={String(detailData.sm_client_id)} />
                      <InfoRow label="Status" value={detailData.status} />
                      <InfoRow label="Sincronizado em" value={formatDate(detailData.updated_at)} />
                    </div>
                  </div>
                )}

                {detailType === "proposal" && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados da Proposta</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="ID Proposta" value={String(detailData.sm_proposal_id)} />
                      <InfoRow label="ID Projeto" value={String(detailData.sm_project_id)} />
                      <InfoRow label="ID Cliente" value={String(detailData.sm_client_id)} />
                      <InfoRow label="Status" value={detailData.status} />
                      <InfoRow label="Gerada em" value={formatDate(detailData.generated_at)} />
                      <InfoRow label="Aceita em" value={formatDate(detailData.acceptance_date)} />
                      <InfoRow label="Rejeitada em" value={formatDate(detailData.rejection_date)} />
                      <InfoRow label="Expira em" value={formatDate(detailData.expiration_date)} />
                    </div>
                    {detailData.link_pdf && (
                      <a
                        href={detailData.link_pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir PDF da Proposta
                      </a>
                    )}
                  </div>
                )}

                <Separator />

                {/* ── Payload completo ── */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dados Completos (JSON)</h4>
                  <div className="p-3 rounded-lg bg-muted/50 overflow-x-auto">
                    <PayloadViewer data={detailData.payload} />
                  </div>
                </div>

                {/* ── Related data ── */}
                {loadingRelated && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}

                {!loadingRelated && detailType === "client" && relatedProjects.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Projetos ({relatedProjects.length})
                      </h4>
                      <div className="space-y-2">
                        {relatedProjects.map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div>
                              <span className="font-mono text-xs text-muted-foreground">#{p.sm_project_id}</span>
                              {p.status && <Badge variant="outline" className="ml-2">{p.status}</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatDate(p.updated_at)}</span>
                              <Button variant="ghost" size="icon" onClick={() => openProjectDetail(p)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!loadingRelated && (detailType === "client" || detailType === "project") && relatedProposals.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Propostas ({relatedProposals.length})
                      </h4>
                      <div className="space-y-2">
                        {relatedProposals.map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">#{p.sm_proposal_id}</span>
                              {p.status && <Badge variant="outline">{p.status}</Badge>}
                              {p.link_pdf && (
                                <a href={p.link_pdf} target="_blank" rel="noopener noreferrer" className="text-primary">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{formatDate(p.generated_at)}</span>
                              <Button variant="ghost" size="icon" onClick={() => openProposalDetail(p)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
