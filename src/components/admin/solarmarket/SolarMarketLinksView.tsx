import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Eye, Link2, Users, Phone, Mail, MapPin, FileText,
  Loader2, RefreshCw, ExternalLink, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadLink {
  id: string;
  lead_id: string;
  sm_client_id: number;
  sm_project_id: number | null;
  link_reason: string;
  created_at: string;
}

interface LeadData {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  estado: string;
  cidade: string;
  lead_code: string | null;
  media_consumo: number;
  consultor: string | null;
  created_at: string;
  status_id: string | null;
}

interface SmClientData {
  sm_client_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  payload: any;
}

interface SmProjectData {
  sm_project_id: number;
  status: string | null;
  payload: any;
}

interface SmProposalData {
  sm_proposal_id: number;
  status: string | null;
  link_pdf: string | null;
  generated_at: string | null;
  payload: any;
}

interface EnrichedLink extends LeadLink {
  lead?: LeadData;
  sm_client?: SmClientData;
  sm_projects?: SmProjectData[];
  sm_proposals?: SmProposalData[];
}

const PAGE_SIZE = 25;

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }); }
  catch { return d; }
}

export function SolarMarketLinksView() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<EnrichedLink[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<EnrichedLink | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchLinks = useCallback(async (targetPage = 1) => {
    if (targetPage === 1) setLoading(true);
    else setIsFetching(true);

    try {
      // Fetch count
      const { count } = await supabase
        .from("lead_links")
        .select("id", { count: "exact", head: true });
      setTotalCount(count ?? 0);

      const from = (targetPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: rawLinks, error } = await supabase
        .from("lead_links")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const linkData = (rawLinks as LeadLink[]) || [];
      if (linkData.length === 0) {
        setLinks([]);
        return;
      }

      // Fetch related leads and SM clients in bulk
      const leadIds = [...new Set(linkData.map((l) => l.lead_id))];
      const smClientIds = [...new Set(linkData.map((l) => l.sm_client_id))];

      const [leadsRes, smClientsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, nome, telefone, estado, cidade, lead_code, media_consumo, consultor, created_at, status_id")
          .in("id", leadIds),
        supabase
          .from("solar_market_clients")
          .select("sm_client_id, name, email, phone, payload")
          .in("sm_client_id", smClientIds),
      ]);

      const leadsMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l]));
      const smClientsMap = new Map((smClientsRes.data || []).map((c: any) => [c.sm_client_id, c]));

      const enriched: EnrichedLink[] = linkData.map((link) => ({
        ...link,
        lead: leadsMap.get(link.lead_id) as LeadData | undefined,
        sm_client: smClientsMap.get(link.sm_client_id) as SmClientData | undefined,
      }));

      setLinks(enriched);
      setPage(targetPage);
    } catch (err) {
      console.error("Erro buscando vínculos:", err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks(1);
  }, [fetchLinks]);

  const openDetail = async (link: EnrichedLink) => {
    setSelectedLink(link);
    setDetailOpen(true);
    setLoadingDetail(true);

    try {
      const [projectsRes, proposalsRes] = await Promise.all([
        supabase
          .from("solar_market_projects")
          .select("sm_project_id, status, payload")
          .eq("sm_client_id", link.sm_client_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("solar_market_proposals")
          .select("sm_proposal_id, status, link_pdf, generated_at, payload")
          .eq("sm_client_id", link.sm_client_id)
          .order("created_at", { ascending: false }),
      ]);

      setSelectedLink((prev) =>
        prev
          ? {
              ...prev,
              sm_projects: (projectsRes.data as SmProjectData[]) || [],
              sm_proposals: (proposalsRes.data as SmProposalData[]) || [],
            }
          : null
      );
    } catch (err) {
      console.error("Erro buscando detalhes do vínculo:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5 text-primary" />
                Leads Vinculados ao SolarMarket
              </CardTitle>
              <CardDescription>
                Vínculos automáticos entre leads do CRM e clientes do SolarMarket (por telefone)
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={() => fetchLinks(1)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {links.length === 0 && totalCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum vínculo encontrado</p>
              <p className="text-xs mt-1">Os vínculos são criados automaticamente durante a sincronização, quando o telefone do lead coincide com o do cliente SolarMarket.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cliente SM</TableHead>
                      <TableHead>Projeto SM</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Vinculado em</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm">{link.lead?.nome || "—"}</p>
                            {link.lead?.lead_code && (
                              <Badge variant="outline" className="text-xs">{link.lead.lead_code}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {link.lead?.telefone || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">{link.sm_client?.name || "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">SM #{link.sm_client_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {link.sm_project_id ? (
                            <Badge variant="secondary" className="font-mono text-xs">#{link.sm_project_id}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem projeto</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{link.link_reason}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(link.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openDetail(link)} title="Ver detalhes completos">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={PAGE_SIZE}
                isFetching={isFetching}
                onGoToPage={(p) => fetchLinks(p)}
                onNextPage={() => fetchLinks(page + 1)}
                onPrevPage={() => fetchLinks(page - 1)}
                hasNextPage={page < totalPages}
                hasPrevPage={page > 1}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Dialog ──────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Vínculo Lead ↔ SolarMarket
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedLink && (
              <div className="space-y-5">
                {/* ── Lead Data ── */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Lead do CRM
                  </h4>
                  {selectedLink.lead ? (
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Nome" value={selectedLink.lead.nome} />
                        <InfoRow label="Código" value={selectedLink.lead.lead_code} />
                        <InfoRow label="Telefone" value={selectedLink.lead.telefone} />
                        <InfoRow label="Consultor" value={selectedLink.lead.consultor} />
                        <InfoRow label="Cidade" value={`${selectedLink.lead.cidade} - ${selectedLink.lead.estado}`} />
                        <InfoRow label="Consumo" value={`${selectedLink.lead.media_consumo} kWh`} />
                        <InfoRow label="Criado em" value={formatDate(selectedLink.lead.created_at)} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Lead não encontrado no sistema</p>
                  )}
                </div>

                <Separator />

                {/* ── SM Client Data ── */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Cliente SolarMarket #{selectedLink.sm_client_id}
                  </h4>
                  {selectedLink.sm_client ? (
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Nome" value={selectedLink.sm_client.name} />
                        <InfoRow label="E-mail" value={selectedLink.sm_client.email} />
                        <InfoRow label="Telefone" value={selectedLink.sm_client.phone} />
                        <InfoRow label="ID SolarMarket" value={String(selectedLink.sm_client.sm_client_id)} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Cliente SM não encontrado</p>
                  )}
                </div>

                {loadingDetail && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}

                {/* ── Projects ── */}
                {!loadingDetail && selectedLink.sm_projects && selectedLink.sm_projects.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Projetos SolarMarket ({selectedLink.sm_projects.length})
                      </h4>
                      {selectedLink.sm_projects.map((proj) => (
                        <div key={proj.sm_project_id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-medium">Projeto #{proj.sm_project_id}</span>
                            {proj.status && <Badge variant="outline">{proj.status}</Badge>}
                          </div>
                          {proj.payload && typeof proj.payload === "object" && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(proj.payload).slice(0, 8).map(([k, v]) => (
                                v != null && (
                                  <div key={k}>
                                    <span className="text-muted-foreground">{k}: </span>
                                    <span className="font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Proposals ── */}
                {!loadingDetail && selectedLink.sm_proposals && selectedLink.sm_proposals.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Propostas SolarMarket ({selectedLink.sm_proposals.length})
                      </h4>
                      {selectedLink.sm_proposals.map((prop) => (
                        <div key={prop.sm_proposal_id} className="p-3 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-sm font-medium">Proposta #{prop.sm_proposal_id}</span>
                            <div className="flex items-center gap-2">
                              {prop.status && <Badge variant="outline">{prop.status}</Badge>}
                              {prop.link_pdf && (
                                <a href={prop.link_pdf} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1 text-xs">
                                  <ExternalLink className="h-3 w-3" />
                                  PDF
                                </a>
                              )}
                            </div>
                          </div>
                          {prop.generated_at && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Gerada em {formatDate(prop.generated_at)}
                            </p>
                          )}
                          {prop.payload && typeof prop.payload === "object" && (
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                              {Object.entries(prop.payload).slice(0, 8).map(([k, v]) => (
                                v != null && (
                                  <div key={k}>
                                    <span className="text-muted-foreground">{k}: </span>
                                    <span className="font-medium">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
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
