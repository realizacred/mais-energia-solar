/**
 * VendorPropostasView — Portal Consultor: Minhas Propostas (Redesign).
 * Layout em tabela densa com agrupamento por cliente e ações compactas.
 */
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProposalCard } from "../leads/ProposalCard";
import { 
  FileText, 
  Send, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  ExternalLink, 
  Copy, 
  MessageCircle, 
  Mail, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Clock,
  Filter
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  useMinhasPropostasConsultor, 
  type PropostaConsultor 
} from "@/hooks/useMinhasPropostasConsultor";
import { formatBRL } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { getOrCreateProposalToken } from "@/services/proposal/proposalDetail.service";
import { getProposalWebUrl, getMaskedPdfUrl } from "@/services/proposal/proposalLinks";
import { ProposalMessageDrawer } from "@/components/admin/projetos/ProposalMessageDrawer";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  gerada: { label: "Gerada", cls: "bg-muted text-muted-foreground border-border" },
  enviada: { label: "Enviada", cls: "bg-info/10 text-info border-info/20" },
  vista: { label: "Visualizada", cls: "bg-warning/10 text-warning border-warning/20" },
  aceita: { label: "Aceita", cls: "bg-success/10 text-success border-success/20" },
  expirada: { label: "Expirada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  recusada: { label: "Recusada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

const STATUS_DOT: Record<string, string> = {
  gerada: 'bg-muted-foreground',
  enviada: 'bg-info',
  vista: 'bg-warning',
  aceita: 'bg-success',
  expirada: 'bg-destructive',
  recusada: 'bg-destructive',
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'aceita':
      return 'border-success/30 bg-success/10 text-success hover:bg-success/15';
    case 'vista':
      return 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/15';
    case 'enviada':
      return 'border-info/30 bg-info/10 text-info hover:bg-info/15';
    case 'expirada':
    case 'recusada':
      return 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15';
    default:
      return 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60';
  }
};


export default function VendorPropostasView({ portal }: Props) {
  const isMobile = useIsMobile();
  const consultorId = portal.vendedor?.id ?? null;
  const { data = [], isLoading, refetch, loadMore, hasMore, loadingMore, totalCount, kpis } = useMinhasPropostasConsultor(consultorId);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todas");

  const filtered = useMemo<PropostaConsultor[]>(() => {
    let result = data;
    
    // Status filter
    if (filterStatus !== "todas") {
      result = result.filter(p => p.status === filterStatus);
    }

    // Search filter
    const q = normalize(search.trim());
    if (q) {
      result = result.filter((p) =>
        [p.codigo, p.titulo, p.cliente_nome, p.proposta_num?.toString()]
          .filter(Boolean)
          .some((v) => normalize(String(v)).includes(q)),
      );
    }

    return result;
  }, [data, search, filterStatus]);

  // const kpis = useMemo(() => computePropostasKpis(data), [data]); // Removido em favor dos KPIs vindos do hook

  const grouped = useMemo(() => {
    const map = new Map<string, PropostaConsultor[]>();
    filtered.forEach((p) => {
      const key = p.lead_id || p.cliente_id || `temp-${p.cliente_nome}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return Array.from(map.values()).map((list) =>
      list.sort((a, b) => (b.versao_numero || 0) - (a.versao_numero || 0)),
    );
  }, [filtered]);

  if (!consultorId || consultorId === "admin") {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
          <p className="text-sm text-muted-foreground">
            Esta área é exclusiva de consultores com perfil vinculado.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <LoadingState message="Carregando propostas..." size="md" />;
  }

  /* if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Não foi possível carregar suas propostas.
        </CardContent>
      </Card>
    );
  } */

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Minhas Propostas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe propostas oficiais geradas para seus leads e clientes.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label="Total" value={totalCount || kpis.total} icon={FileText} accent="primary" />
        <KpiCard label="Enviadas" value={kpis.enviadas} icon={Send} accent="info" />
        <KpiCard label="Visualizadas" value={kpis.visualizadas} icon={Eye} accent="warning" />
        <KpiCard label="Aceitas" value={kpis.aceitas} icon={CheckCircle2} accent="success" />
        <KpiCard label="Expiradas" value={kpis.expiradas} icon={AlertTriangle} accent="destructive" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por cliente, código ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([id, cfg]) => (
                <SelectItem key={id} value={id}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid/Table Toggle based on Screen Size */}
      {grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-2">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground">Nenhuma proposta encontrada</p>
            <p className="text-xs text-muted-foreground">
              Quando o sistema gerar propostas vinculadas a você, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="space-y-4">
          {filtered.map((proposta) => (
            <ProposalCard key={proposta.id} proposta={proposta} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-0">
                  <TableHead className="w-12 h-9 text-[10px] uppercase font-semibold">Visto</TableHead>
                  <TableHead className="w-[280px] h-9 text-[10px] uppercase font-semibold">Cliente</TableHead>
                  <TableHead className="w-32 h-9 text-[10px] uppercase font-semibold">Proposta</TableHead>
                  <TableHead className="h-9 text-[10px] uppercase font-semibold">Potência / Energia</TableHead>
                  <TableHead className="h-9 text-[10px] uppercase font-semibold">Valor</TableHead>
                  <TableHead className="h-9 text-[10px] uppercase font-semibold">Status</TableHead>
                  <TableHead className="h-9 text-[10px] uppercase font-semibold">Validade</TableHead>
                  <TableHead className="text-right h-9 text-[10px] uppercase font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((group) => (
                  <PropostaGroup key={group[0].id} propostas={group} onChanged={refetch} />
                ))}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      )}

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadMore} 
            disabled={loadingMore}
            className="w-full sm:w-auto min-w-[200px] h-10"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              'Carregar mais propostas'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function PropostaGroup({ propostas, onChanged }: { propostas: PropostaConsultor[]; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const main = propostas[0];
  const others = propostas.slice(1);
  const hasOthers = others.length > 0;

  return (
    <>
      <PropostaRow 
        proposta={main} 
        onChanged={onChanged} 
        isMain={true} 
        hasOthers={hasOthers} 
        othersCount={others.length}
        isExpanded={expanded} 
        onToggleExpand={() => setExpanded(!expanded)} 
      />
      {expanded && others.map((p) => (
        <PropostaRow key={p.id} proposta={p} onChanged={onChanged} isSubRow={true} />
      ))}
    </>
  );
}

function PropostaRow({ 
  proposta, 
  onChanged, 
  isMain, 
  hasOthers, 
  othersCount,
  isExpanded, 
  onToggleExpand,
  isSubRow 
}: { 
  proposta: PropostaConsultor; 
  onChanged: () => void;
  isMain?: boolean;
  hasOthers?: boolean;
  othersCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isSubRow?: boolean;
}) {
  const status = STATUS_CONFIG[proposta.status] || { label: proposta.status, cls: "bg-muted text-muted-foreground" };
  
  const codeLabel = proposta.codigo || (proposta.proposta_num ? `PROP-${proposta.proposta_num}` : proposta.titulo) || "—";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valDate = proposta.valido_ate ? new Date(proposta.valido_ate) : null;
  const isExpired = valDate && valDate < today && !["accepted", "aceita"].includes(proposta.status);
  const isNearExpiring = valDate && !isExpired && !["accepted", "aceita"].includes(proposta.status) && (valDate.getTime() - today.getTime()) < (7 * 24 * 60 * 60 * 1000);

  const aberturas = proposta.total_aberturas || 0;

  const visto = ["viewed", "vista"].includes(proposta.status) || ["accepted", "aceita"].includes(proposta.status) || (proposta.total_aberturas && proposta.total_aberturas > 0);

  return (
    <TableRow className={`align-middle transition-colors ${
      ["accepted", "aceita"].includes(proposta.status) ? "bg-green-50/80 border-green-100 hover:bg-green-100/60" : 
      ["sent", "enviada"].includes(proposta.status) ? "bg-blue-50/80 border-blue-100 hover:bg-blue-100/60" :
      ["expired", "rejected", "expirada", "recusada"].includes(proposta.status) ? "bg-red-50/80 border-red-100 hover:bg-red-100/60" :
      visto ? "bg-success/5" : 
      isSubRow ? "bg-muted/20" : 
      "hover:bg-muted/30"
    }`}>

      <TableCell className="py-2 align-middle">
        <Checkbox
          checked={visto}
          disabled
          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary opacity-70"
        />
      </TableCell>

      <TableCell className="py-2 align-middle">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 group/name">
            <span className="truncate font-semibold text-sm text-primary max-w-[240px]" title={proposta.cliente_nome || ""}>
              {proposta.cliente_nome}
            </span>
            {!visto && !isSubRow && (
              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" title="Novo" />
            )}

            {isMain && hasOthers && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 p-0 hover:bg-transparent shrink-0"
                      onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
                    >
                      <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100/50 rounded-full font-medium text-[10px] h-5 px-1.5 transition-colors">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : `+${othersCount} ${othersCount === 1 ? 'opção' : 'opções'}`}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Ver outras {othersCount} versões
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {proposta.titulo && proposta.titulo !== proposta.cliente_nome && (
              <span className="text-[11px] text-muted-foreground truncate leading-tight max-w-[220px]" title={proposta.titulo}>
                {proposta.titulo}
              </span>
            )}
            {proposta.versao_numero && (
              <span className="text-[10px] text-muted-foreground/60 font-medium">
                Versão {proposta.versao_numero}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="py-2 align-middle">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[10px] whitespace-nowrap bg-muted/40 text-muted-foreground border-transparent px-1.5 h-5">
            {codeLabel}
          </Badge>
        </div>
      </TableCell>

      <TableCell className="py-2 align-middle">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            {proposta.potencia_kwp != null ? `${Number(proposta.potencia_kwp).toFixed(2)} kWp` : "—"}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
            <span>{proposta.geracao_mensal != null ? `${Math.round(proposta.geracao_mensal)} kWh geração` : "—"}</span>
            <span className="opacity-40">•</span>
            <span>{proposta.consumo_mensal != null ? `${Math.round(proposta.consumo_mensal)} kWh/mês` : "—"}</span>
          </div>
        </div>
      </TableCell>

      <TableCell className="py-2 align-middle text-sm font-bold text-foreground">
        {proposta.valor_total != null ? formatBRL(Number(proposta.valor_total)) : "—"}
      </TableCell>

      <TableCell className="py-2 align-middle">
        <Badge
          variant="outline"
          className={`gap-1 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(proposta.status)}`}
        >
          <span className={`h-1 w-1 rounded-full ${STATUS_DOT[proposta.status] || 'bg-muted-foreground'}`} />
          {status.label}
        </Badge>
      </TableCell>

      <TableCell className="py-2 align-middle">
        <div className={`flex items-center gap-1 text-[10px] ${
          isExpired ? "text-destructive font-medium" : 
          isNearExpiring ? "text-warning font-medium" : 
          "text-muted-foreground"
        }`}>
          <Clock className="h-3 w-3" />
          {valDate ? valDate.toLocaleDateString("pt-BR") : "—"}
        </div>
      </TableCell>

      <TableCell className="align-middle text-right">
        <div className="flex items-center justify-end gap-1">
          <PropostaRowActions proposta={proposta} />
        </div>
      </TableCell>
    </TableRow>
  );
}


function PropostaRowActions({ proposta }: { proposta: PropostaConsultor }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);

  const handleOpenPublic = async () => {
    setBusy("open");
    try {
      const url = await resolveOfficialUrl(proposta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Não foi possível abrir", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyPdf = async () => {
    if (!proposta.output_pdf_path) {
      toast({ title: "PDF ainda não gerado", variant: "destructive" });
      return;
    }
    setBusy("copy");
    try {
      const url = await getProposalPdfSignedUrl(proposta.output_pdf_path);
      if (!url) throw new Error("Falha ao gerar link");
      await navigator.clipboard.writeText(url);
      toast({ title: "Link do PDF copiado! 📋" });
    } catch (e: any) {
      toast({ title: "Erro ao copiar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = () => {
    if (!proposta.versao_id || !proposta.projeto_id) {
      toast({ title: "Dados incompletos", variant: "destructive" });
      return;
    }
    setMsgOpen(true);
  };

  const handleEmail = async () => {
    setBusy("email");
    try {
      const url = await resolveOfficialUrl(proposta);
      const subject = encodeURIComponent(`Proposta ${proposta.codigo || proposta.titulo || ""}`);
      const body = encodeURIComponent(`Olá!\n\nSegue a proposta oficial:\n${url}\n\nQualquer dúvida estou à disposição.`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (e: any) {
      toast({ title: "Erro no email", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
              onClick={handleOpenPublic}
              disabled={!!busy}
            >
              {busy === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Abrir Proposta</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={handleCopyPdf}
              disabled={!!busy || !proposta.output_pdf_path}
            >
              {busy === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copiar PDF</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
              onClick={handleWhatsApp}
              disabled={!!busy || !proposta.versao_id}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>WhatsApp</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-info hover:text-info hover:bg-info/10"
              onClick={handleEmail}
              disabled={!!busy}
            >
              {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar por E-mail</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {proposta.versao_id && proposta.projeto_id && (
        <ProposalMessageDrawer
          open={msgOpen}
          onOpenChange={setMsgOpen}
          versaoId={proposta.versao_id}
          propostaId={proposta.id}
          projetoId={proposta.projeto_id}
          clienteId={proposta.cliente_id}
          propostaData={{
            cliente_nome: proposta.cliente_nome,
            codigo: proposta.codigo,
            status: proposta.status,
          }}
          versaoData={{
            valor_total: proposta.valor_total,
            potencia_kwp: proposta.potencia_kwp,
            economia_mensal: proposta.economia_mensal,
            payback_meses: proposta.payback_meses,
            geracao_mensal: proposta.geracao_mensal,
            public_slug: proposta.public_slug,
          }}
        />
      )}
    </div>
  );
}


function TooltipAction({ 
  label, 
  icon: Icon, 
  onClick, 
  loading, 
  disabled 
}: { 
  label: string; 
  icon: any; 
  onClick: () => void; 
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          disabled={loading || disabled}
          className="h-8 w-8 p-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
          aria-label={label}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-[10px]">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

async function resolveOfficialUrl(proposta: PropostaConsultor): Promise<string> {
  let token = proposta.public_token;
  if (!token && proposta.versao_id) {
    try {
      token = await getOrCreateProposalToken(proposta.id, proposta.versao_id, "tracked");
    } catch (e) {
      console.error("[VendorPropostasView] Falha ao obter token:", e);
    }
  }
  if (!token) throw new Error("Link público indisponível");
  return getProposalWebUrl(token);
}

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "info" | "warning" | "success" | "destructive";
}

function KpiCard({ label, value, icon: Icon, accent }: KpiCardProps) {
  const accentMap: Record<KpiCardProps["accent"], string> = {
    primary: "border-l-primary/60 text-primary",
    info: "border-l-info/60 text-info",
    warning: "border-l-warning/60 text-warning",
    success: "border-l-success/60 text-success",
    destructive: "border-l-destructive/60 text-destructive",
  };
  return (
    <Card className={`border-l-[3px] ${accentMap[accent]}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-3.5 w-3.5 opacity-70" />
        </div>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </CardContent>
    </Card>
  );
}
