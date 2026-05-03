import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClientLinkedPlants } from "./monitoring-v2/ClientLinkedPlants";
import { ClienteEnergiaTab } from "./clientes/ClienteEnergiaTab";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User, Phone, Mail, MapPin, Zap, DollarSign, Calendar, FileText,
  ExternalLink, Eye, FolderOpen, MessageSquare, Clock, ArrowRight,
  TrendingDown, Send, ChevronRight, Sun,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dateUtils";
import { formatPhoneBR, formatBRL } from "@/lib/formatters";
import {
  useClienteProjetos,
  useClientePropostas,
  useClientePropostaVersoes,
  useClienteConversasWa,
} from "@/hooks/useClienteDetail";

// ── Types ──────────────────────────────────────────────────

interface ClienteData {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf_cnpj: string | null;
  data_nascimento: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  potencia_kwp: number | null;
  valor_projeto: number | null;
  data_instalacao: string | null;
  numero_placas: number | null;
  modelo_inversor: string | null;
  observacoes: string | null;
  lead_id: string | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  identidade_urls: string[] | null;
  comprovante_endereco_urls: string[] | null;
  comprovante_beneficiaria_urls: string[] | null;
  disjuntor_id: string | null;
  transformador_id: string | null;
}

interface ClienteViewDialogProps {
  cliente: ClienteData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ────────────────────────────────────────────────

function getSignedUrl(path: string): Promise<string | null> {
  return supabase.storage
    .from("documentos-clientes")
    .createSignedUrl(path, 3600)
    .then(({ data }) => data?.signedUrl || null);
}

const formatCurrency = (val: number | null) =>
  val ? formatBRL(val) : "—";

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  borderColor = "border-l-primary",
  iconBg = "bg-primary/10 text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  borderColor?: string;
  iconBg?: string;
}) {
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm`}>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-foreground leading-none truncate">
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Document Thumbnail ─────────────────────────────────────

function DocumentThumbnail({ path, onClick }: { path: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

  useEffect(() => {
    getSignedUrl(path)
      .then((signedUrl) => { setUrl(signedUrl); setLoading(false); })
      .catch(() => setLoading(false));
  }, [path]);

  if (loading) {
    return <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center"><Spinner size="sm" /></div>;
  }

  return (
    <Button type="button" variant="ghost" onClick={onClick} className="w-16 h-16 rounded-lg border-2 border-transparent hover:border-primary overflow-hidden transition-colors group relative p-0">
      {isImage && url ? (
        <img src={url} alt="Documento" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
      </div>
    </Button>
  );
}

// ── Status badge helper ────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    rascunho: "bg-muted text-muted-foreground",
    gerando: "bg-warning/10 text-warning border-warning/20",
    gerada: "bg-info/10 text-info border-info/20",
    enviada: "bg-primary/10 text-primary border-primary/20",
    aceita: "bg-success/10 text-success border-success/20",
    recusada: "bg-destructive/10 text-destructive border-destructive/20",
    em_andamento: "bg-primary/10 text-primary border-primary/20",
    concluido: "bg-success/10 text-success border-success/20",
    cancelado: "bg-destructive/10 text-destructive border-destructive/20",
  };
  const cls = colorMap[status] || "bg-muted text-muted-foreground";
  return <Badge variant="outline" className={`text-xs ${cls}`}>{status}</Badge>;
}

// ── Empty State ────────────────────────────────────────────

function TabEmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// ── Main Dialog ────────────────────────────────────────────

export function ClienteViewDialog({ cliente, open, onOpenChange }: ClienteViewDialogProps) {
  const navigate = useNavigate();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Data hooks
  const { data: projetos = [], isLoading: loadingProjetos } = useClienteProjetos(cliente?.id ?? null);
  const { data: propostas = [], isLoading: loadingPropostas } = useClientePropostas(
    cliente?.id ?? null,
    cliente?.lead_id ?? null
  );
  const propostaIds = propostas.map((p) => p.id);
  const { data: versoes = [] } = useClientePropostaVersoes(propostaIds);
  const { data: conversas = [], isLoading: loadingWa } = useClienteConversasWa(cliente?.telefone ?? null);

  if (!cliente) return null;

  const endereco = [cliente.rua, cliente.numero, cliente.complemento, cliente.bairro].filter(Boolean).join(", ");
  const cidadeEstado = [cliente.cidade, cliente.estado].filter(Boolean).join(" - ");
  const googleMapsQuery = [cliente.rua, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(", ");
  const googleMapsUrl = cliente.localizacao || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleMapsQuery)}`;

  const totalDocs =
    (cliente.identidade_urls?.length || 0) +
    (cliente.comprovante_endereco_urls?.length || 0) +
    (cliente.comprovante_beneficiaria_urls?.length || 0);

  const handlePreviewDoc = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) { setPreviewUrl(url); setPreviewOpen(true); }
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">

          {/* HEADER §26 */}
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground truncate">
                {cliente.nome}
              </DialogTitle>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />{formatPhoneBR(cliente.telefone) || cliente.telefone}
                </span>
                {cliente.email && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />{cliente.email}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={
                    cliente.ativo
                      ? "bg-success/10 text-success border-success/20 text-xs"
                      : "bg-muted text-muted-foreground border-border text-xs"
                  }
                >
                  {cliente.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  Cliente desde {formatDate(cliente.created_at)}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* KPI CARDS §27 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 pt-4 shrink-0">
            <KpiCard
              icon={DollarSign}
              label="Valor do projeto"
              value={formatCurrency(cliente.valor_projeto)}
              borderColor="border-l-primary"
              iconBg="bg-primary/10 text-primary"
            />
            <KpiCard
              icon={Zap}
              label="Potência"
              value={cliente.potencia_kwp ? `${cliente.potencia_kwp} kWp` : "—"}
              borderColor="border-l-warning"
              iconBg="bg-warning/10 text-warning"
            />
            <KpiCard
              icon={FolderOpen}
              label="Projetos"
              value={String(projetos.length)}
              borderColor="border-l-info"
              iconBg="bg-info/10 text-info"
            />
            <KpiCard
              icon={FileText}
              label="Propostas"
              value={String(propostas.length)}
              borderColor="border-l-success"
              iconBg="bg-success/10 text-success"
            />
          </div>

          {/* TABS §29 */}
          <Tabs defaultValue="geral" className="flex-1 min-h-0 flex flex-col px-5 pt-3">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="geral" className="flex-1 text-xs">Visão Geral</TabsTrigger>
              <TabsTrigger value="propostas" className="flex-1 text-xs">
                Propostas {propostas.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{propostas.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="projetos" className="flex-1 text-xs">
                Projetos {projetos.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{projetos.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="energia" className="flex-1 text-xs">
                <Sun className="w-3 h-3 mr-1" /> Energia
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex-1 text-xs">
                Docs {totalDocs > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{totalDocs}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1 text-xs">
                WhatsApp {conversas.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{conversas.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 min-h-0 mt-3 pb-4">

              {/* ABA 1 — Visão Geral */}
              <TabsContent value="geral" className="mt-0 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Dados pessoais */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" /> Dados do cliente
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoField label="CPF/CNPJ" value={cliente.cpf_cnpj} />
                      <InfoField label="Data de nascimento" value={cliente.data_nascimento ? formatDate(cliente.data_nascimento + "T12:00:00") : null} />
                      <InfoField label="E-mail" value={cliente.email} />
                      <InfoField label="Telefone" value={cliente.telefone} />
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Endereço
                    </p>
                    <div className="space-y-1.5">
                      {endereco && <p className="text-sm text-foreground">{endereco}</p>}
                      <div className="grid grid-cols-2 gap-3">
                        <InfoField label="Cidade/UF" value={cidadeEstado || null} />
                        <InfoField label="CEP" value={cliente.cep} />
                      </div>
                      {(endereco || cliente.localizacao) && (
                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Ver no Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Projeto solar */}
                {cliente.potencia_kwp && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> Projeto solar
                    </p>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <InfoField label="Potência" value={`${cliente.potencia_kwp} kWp`} />
                        <InfoField label="Placas" value={cliente.numero_placas?.toString() || null} />
                        <InfoField label="Inversor" value={cliente.modelo_inversor} />
                        <InfoField label="Instalação" value={cliente.data_instalacao ? formatDate(cliente.data_instalacao + "T12:00:00") : null} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" /> Observações
                  </p>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground leading-relaxed min-h-[60px]">
                    {cliente.observacoes || "Sem observações"}
                  </div>
                </div>
              </TabsContent>

              {/* ABA 2 — Propostas */}
              <TabsContent value="propostas" className="mt-0">
                {loadingPropostas ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : propostas.length === 0 ? (
                  <TabEmptyState icon={FileText} title="Nenhuma proposta" description="Este cliente não possui propostas vinculadas" />
                ) : (
                  <div className="space-y-2">
                    {propostas.map((p) => {
                      const pVersoes = versoes.filter((v) => v.proposta_id === p.id);
                      const melhorVersao = pVersoes[0];
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => { onOpenChange(false); navigate(`/admin/propostas/${p.id}`); }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{p.titulo || p.codigo}</p>
                              <StatusBadge status={p.status} />
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                              <span>{formatDate(p.created_at)}</span>
                              {melhorVersao?.valor_total && (
                                <span className="font-medium text-foreground">{formatCurrency(melhorVersao.valor_total)}</span>
                              )}
                              {melhorVersao?.potencia_kwp && (
                                <span>{melhorVersao.potencia_kwp} kWp</span>
                              )}
                              {pVersoes.length > 0 && (
                                <span>{pVersoes.length} versão(ões)</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ABA 3 — Projetos */}
              <TabsContent value="projetos" className="mt-0">
                {loadingProjetos ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                  </div>
                ) : projetos.length === 0 ? (
                  <TabEmptyState icon={FolderOpen} title="Nenhum projeto" description="Este cliente não possui projetos vinculados" />
                ) : (
                  <div className="space-y-2">
                    {projetos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { onOpenChange(false); navigate(`/admin/projetos?projeto=${p.id}`); }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{p.codigo}</p>
                            <StatusBadge status={p.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                            <span>{formatDate(p.created_at)}</span>
                            {p.potencia_kwp && <span>{p.potencia_kwp} kWp</span>}
                            {p.valor_total && <span>{formatCurrency(p.valor_total)}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ABA 4 — Energia (UCs + GD + Faturas) */}
              <TabsContent value="energia" className="mt-0 space-y-4">
                <ClienteEnergiaTab clienteId={cliente.id} />
                <ClientLinkedPlants clientId={cliente.id} />
              </TabsContent>

              {/* ABA 5 — Documentos */}
              <TabsContent value="docs" className="mt-0 space-y-4">
                {[
                  { label: "Identidade (RG/CNH)", paths: cliente.identidade_urls || [] },
                  { label: "Comprovante de Endereço", paths: cliente.comprovante_endereco_urls || [] },
                  { label: "Comprovante Beneficiária", paths: cliente.comprovante_beneficiaria_urls || [] },
                ].map((cat) => (
                  <div key={cat.label} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">{cat.label}</h4>
                    {cat.paths.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cat.paths.map((path, idx) => (
                          <DocumentThumbnail key={idx} path={path} onClick={() => handlePreviewDoc(path)} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
                    )}
                  </div>
                ))}
                {totalDocs === 0 && (
                  <TabEmptyState icon={FileText} title="Nenhum documento" description="Nenhum documento foi anexado a este cliente" />
                )}
              </TabsContent>

              {/* ABA 6 — WhatsApp */}
              <TabsContent value="whatsapp" className="mt-0">
                {loadingWa ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1"><Skeleton className="h-4 w-3/4 mb-2" /><Skeleton className="h-3 w-1/2" /></div>
                      </div>
                    ))}
                  </div>
                ) : conversas.length === 0 ? (
                  <TabEmptyState icon={MessageSquare} title="Sem conversas" description="Nenhuma conversa WhatsApp encontrada para este telefone" />
                ) : (
                  <div className="space-y-2">
                    {conversas.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { onOpenChange(false); navigate(`/admin/whatsapp?conversationId=${c.id}`); }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">
                              {c.cliente_nome || cliente.nome}
                            </p>
                            {c.unread_count > 0 && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">
                                {c.unread_count}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.last_message_preview && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.last_message_preview}</p>
                            )}
                            {c.last_message_at && (
                              <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(c.last_message_at)}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

            </ScrollArea>
          </Tabs>

          {/* FOOTER */}
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="p-4 border-b border-border shrink-0">
            <DialogTitle className="text-sm">Documento</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-muted/50 flex items-center justify-center p-4">
            {previewUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(previewUrl) ? (
              <img src={previewUrl} alt="Documento" className="max-w-full max-h-full object-contain" />
            ) : previewUrl ? (
              <iframe src={previewUrl} title="Documento" className="w-full h-full min-h-[500px]" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
