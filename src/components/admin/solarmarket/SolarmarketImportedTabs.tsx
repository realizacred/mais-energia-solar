/**
 * SolarmarketImportedTabs — Visualização da camada raw/staging SolarMarket.
 *
 * P0 (contenção arquitetural): após a refatoração de `solarmarket-import`,
 * todos os dados externos passam a residir EXCLUSIVAMENTE em `sm_*_raw`
 * (payload bruto). Esta tela NÃO lê mais de `clientes` / `projetos` /
 * `propostas_nativas` — esses são domínios canônicos do CRM e não devem
 * ser usados como staging.
 *
 * RB-04/RB-05: queries com staleTime. RB-19/RB-21/DS-02 mantidos.
 * Cada linha possui ação "Ver detalhes" abrindo drawer dedicado por entidade.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, FolderKanban, FileText, GitBranch, Settings2,
  Database, Eye, Inbox,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSolarmarketImport } from "@/hooks/useSolarmarketImport";
import {
  SolarmarketRecordDetailDrawer,
  type RawEntityKind,
  type RawRecord,
} from "./SolarmarketRecordDetailDrawer";
import {
  formatPhoneBR, formatDocument, formatDateTime, formatBRL, formatUF, sanitizeText, formatInteger,
} from "@/lib/formatters/index";
import {
  parseSmCliente, parseSmProjeto, parseSmProposta, parseSmFunil, parseSmCustomField,
} from "@/lib/solarmarket/parsers";

const PAGE_SIZE = 25;
const STALE = 1000 * 60 * 5;

type RawTable =
  | "sm_clientes_raw"
  | "sm_projetos_raw"
  | "sm_propostas_raw"
  | "sm_funis_raw"
  | "sm_custom_fields_raw";

const KIND_TO_TABLE: Record<RawEntityKind, RawTable> = {
  clientes: "sm_clientes_raw",
  projetos: "sm_projetos_raw",
  propostas: "sm_propostas_raw",
  funis: "sm_funis_raw",
  custom_fields: "sm_custom_fields_raw",
};

function pickPayload(payload: any, ...keys: string[]): any {
  if (!payload) return null;
  for (const k of keys) {
    const v = payload[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function CountBadge({ value, loading }: { value: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-5 w-8 inline-block" />;
  return (
    <Badge
      variant="outline"
      className="ml-1.5 h-5 px-1.5 text-[11px] font-semibold tabular-nums bg-muted text-muted-foreground border-border group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary group-data-[state=active]:border-primary/20"
    >
      {value.toLocaleString("pt-BR")}
    </Badge>
  );
}

// Mapeia status de proposta SolarMarket para variantes semânticas do design system (DS-05).
function proposalStatusBadge(status: unknown) {
  if (status == null || status === "") return <span className="text-muted-foreground text-xs">—</span>;
  const raw = String(status).toLowerCase();
  let cls = "bg-muted text-muted-foreground border-border";
  if (/(approved|aceit|ganha|won|aprov|success|conclu)/.test(raw)) {
    cls = "bg-success/10 text-success border-success/20";
  } else if (/(pend|progress|andament|wait|open|enviad|sent)/.test(raw)) {
    cls = "bg-warning/10 text-warning border-warning/20";
  } else if (/(refus|recus|reject|cancel|lost|perd|erro|error|fail)/.test(raw)) {
    cls = "bg-destructive/10 text-destructive border-destructive/20";
  } else if (/(draft|rascunho|novo|new)/.test(raw)) {
    cls = "bg-info/10 text-info border-info/20";
  }
  return <Badge variant="outline" className={`text-xs font-medium ${cls}`}>{String(status)}</Badge>;
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Sem dados em staging</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hook: contadores totais (sm_*_raw)
// ─────────────────────────────────────────────────────────────────────────
function useImportedCounts(isImporting: boolean) {
  return useQuery({
    queryKey: ["sm-imported-counts"],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const tables: RawTable[] = [
        "sm_clientes_raw",
        "sm_projetos_raw",
        "sm_propostas_raw",
        "sm_funis_raw",
        "sm_custom_fields_raw",
      ];
      const results = await Promise.all(
        tables.map((t) =>
          (supabase as any).from(t).select("id", { count: "exact", head: true }),
        ),
      );
      return {
        clientes:      results[0].count ?? 0,
        projetos:      results[1].count ?? 0,
        propostas:     results[2].count ?? 0,
        funis:         results[3].count ?? 0,
        custom_fields: results[4].count ?? 0,
      };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Hook: listagem paginada de uma tabela raw, com busca em payload->>name
// ─────────────────────────────────────────────────────────────────────────
function useRawList(
  table: RawTable,
  page: number,
  search: string,
  isImporting: boolean,
) {
  return useQuery({
    queryKey: ["sm-imported-list", table, page, search],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = (supabase as any)
        .from(table)
        .select("id, external_id, payload, imported_at, created_at", { count: "exact" })
        .order("imported_at", { ascending: false })
        .range(from, to);

      const term = search.trim();
      if (term) {
        q = q.or(
          [
            `external_id.ilike.%${term}%`,
            `payload->>name.ilike.%${term}%`,
            `payload->>nome.ilike.%${term}%`,
          ].join(","),
        );
      }
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────
export function SolarmarketImportedTabs() {
  const { jobs } = useSolarmarketImport();
  const runningJob = jobs.find((j) => j.status === "running" || j.status === "pending");
  const isImporting = !!runningJob;
  const counts = useImportedCounts(isImporting);
  const [activeTab, setActiveTab] = useState<RawEntityKind>("clientes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<RawRecord | null>(null);
  const [drawerKind, setDrawerKind] = useState<RawEntityKind>("clientes");

  const openDetail = (record: RawRecord, kind: RawEntityKind) => {
    setDrawerRecord(record);
    setDrawerKind(kind);
    setDrawerOpen(true);
  };

  const handleNavigate = (kind: RawEntityKind, searchTerm: string) => {
    setDrawerOpen(false);
    setActiveTab(kind);
    setSearch(searchTerm);
    setPage(0);
  };

  const totalRecords =
    (counts.data?.clientes ?? 0) +
    (counts.data?.projetos ?? 0) +
    (counts.data?.propostas ?? 0) +
    (counts.data?.funis ?? 0) +
    (counts.data?.custom_fields ?? 0);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Dados Brutos Importados (Staging)
        </CardTitle>
        <CardDescription className="text-xs">
          Inspeção e auditoria do que veio da API SolarMarket. Ainda não promovido ao CRM.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!counts.isLoading && totalRecords === 0 ? (
          <EmptyState
            icon={Inbox}
            message="Execute uma importação acima para visualizar os dados brutos por entidade."
          />
        ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => { setActiveTab(v as RawEntityKind); setSearch(""); setPage(0); }}
          className="mt-1"
        >
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 bg-muted/40 p-1 rounded-lg">
            <TabsTrigger
              value="clientes"
              className="group gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20"
            >
              <Users className="w-3.5 h-3.5" /> Clientes
              <CountBadge value={counts.data?.clientes ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger
              value="projetos"
              className="group gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20"
            >
              <FolderKanban className="w-3.5 h-3.5" /> Projetos
              <CountBadge value={counts.data?.projetos ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger
              value="propostas"
              className="group gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20"
            >
              <FileText className="w-3.5 h-3.5" /> Propostas
              <CountBadge value={counts.data?.propostas ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger
              value="funis"
              className="group gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20"
            >
              <GitBranch className="w-3.5 h-3.5" /> Funis
              <CountBadge value={counts.data?.funis ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger
              value="custom_fields"
              className="group gap-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-primary/20"
            >
              <Settings2 className="w-3.5 h-3.5" /> Campos Custom
              <CountBadge value={counts.data?.custom_fields ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
          </TabsList>

          <div className="mt-4" />

          <TabsContent value="clientes">
            <ListaRaw
              table="sm_clientes_raw" kind="clientes"
              labels={{ icon: Users, empty: "Nenhum cliente em staging." }}
              search={search} page={page} setPage={setPage} isImporting={isImporting}
              onOpenDetail={openDetail} onNavigate={handleNavigate}
            />
          </TabsContent>
          <TabsContent value="projetos">
            <ListaRaw
              table="sm_projetos_raw" kind="projetos"
              labels={{ icon: FolderKanban, empty: "Nenhum projeto em staging." }}
              search={search} page={page} setPage={setPage} isImporting={isImporting}
              onOpenDetail={openDetail} onNavigate={handleNavigate}
            />
          </TabsContent>
          <TabsContent value="propostas">
            <ListaRaw
              table="sm_propostas_raw" kind="propostas"
              labels={{ icon: FileText, empty: "Nenhuma proposta em staging." }}
              search={search} page={page} setPage={setPage} isImporting={isImporting}
              onOpenDetail={openDetail} onNavigate={handleNavigate}
            />
          </TabsContent>
          <TabsContent value="funis">
            <ListaRaw
              table="sm_funis_raw" kind="funis"
              labels={{ icon: GitBranch, empty: "Nenhum funil em staging." }}
              search={search} page={page} setPage={setPage} isImporting={isImporting}
              onOpenDetail={openDetail} onNavigate={handleNavigate}
            />
          </TabsContent>
          <TabsContent value="custom_fields">
            <ListaRaw
              table="sm_custom_fields_raw" kind="custom_fields"
              labels={{ icon: Settings2, empty: "Nenhum campo custom em staging." }}
              search={search} page={page} setPage={setPage} isImporting={isImporting}
              onOpenDetail={openDetail} onNavigate={handleNavigate}
            />
          </TabsContent>
        </Tabs>
        )}

        <SolarmarketRecordDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          record={drawerRecord}
          kind={drawerKind}
          onNavigate={handleNavigate}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Lista por entidade — colunas dedicadas + ação "Ver detalhes"
// ─────────────────────────────────────────────────────────────────────────
type ListaRawProps = {
  table: RawTable;
  kind: RawEntityKind;
  labels: { icon: any; empty: string };
  search: string;
  page: number;
  setPage: (n: number) => void;
  isImporting: boolean;
  onOpenDetail: (record: RawRecord, kind: RawEntityKind) => void;
};

function Pagination({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
      <span>{total} registro(s) · página {page + 1} de {totalPages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
          Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page + 1 >= totalPages}>
          Próxima
        </Button>
      </div>
    </div>
  );
}

function RelatedNav({
  items,
  onNavigate,
}: {
  items: Array<{ kind: RawEntityKind; search: string; icon: any; tooltip: string }>;
  onNavigate: (kind: RawEntityKind, search: string) => void;
}) {
  if (!items.length) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        {items.map((it, i) => {
          const Icon = it.icon;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                  onClick={() => onNavigate(it.kind, it.search)}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">{it.tooltip}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function ListaRaw({
  table, kind, labels, search, page, setPage, isImporting, onOpenDetail, onNavigate,
}: ListaRawProps & { onNavigate: (kind: RawEntityKind, search: string) => void }) {
  const { data, isLoading } = useRawList(table, page, search, isImporting);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.rows.length) return <EmptyState icon={labels.icon} message={labels.empty} />;

  const renderRow = (r: any) => {
    const p = r.payload ?? {};
    const importedAt = (
      <span className="text-xs">{formatDateTime(r.imported_at ?? r.created_at)}</span>
    );
    const extId = (
      <code className="text-xs font-mono text-muted-foreground">{r.external_id ?? "—"}</code>
    );
    const action = (
      <Button variant="ghost" size="sm" onClick={() => onOpenDetail(r as RawRecord, kind)}>
        <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver detalhes
      </Button>
    );

    if (kind === "clientes") {
      const nome = pickPayload(p, "name", "nome", "razao_social");
      const tel = pickPayload(p, "phone", "telefone", "celular", "mobile");
      const doc = pickPayload(p, "cpf_cnpj", "document", "documento", "cpf", "cnpj");
      const cidade = pickPayload(p, "city", "cidade") ?? pickPayload(p.address ?? {}, "city", "cidade");
      const uf = pickPayload(p, "state", "estado", "uf") ?? pickPayload(p.address ?? {}, "state", "estado", "uf");
      const clienteExtId = r.external_id ?? (p.id != null ? String(p.id) : null);
      return (
        <TableRow key={r.id}>
          <TableCell className="font-medium text-foreground">{sanitizeText(nome) || "—"}</TableCell>
          <TableCell className="text-sm">{formatPhoneBR(tel)}</TableCell>
          <TableCell className="text-sm">{doc ? formatDocument(String(doc)) : "—"}</TableCell>
          <TableCell className="text-sm">
            {cidade ? `${sanitizeText(String(cidade))}${uf ? "/" + formatUF(String(uf)) : ""}` : "—"}
          </TableCell>
          <TableCell>
            <RelatedNav
              onNavigate={onNavigate}
              items={
                clienteExtId
                  ? [
                      { kind: "projetos", search: clienteExtId, icon: FolderKanban, tooltip: "Ver projetos deste cliente" },
                      { kind: "propostas", search: clienteExtId, icon: FileText, tooltip: "Ver propostas deste cliente" },
                    ]
                  : []
              }
            />
          </TableCell>
          <TableCell>{importedAt}</TableCell>
          <TableCell className="text-right">{action}</TableCell>
        </TableRow>
      );
    }
    if (kind === "projetos") {
      const pr = parseSmProjeto(p);
      const cidadeUf = pr.cliente?.cidade
        ? `${sanitizeText(String(pr.cliente.cidade))}${pr.cliente.uf ? "/" + formatUF(String(pr.cliente.uf)) : ""}`
        : "—";
      const projetoExtId = r.external_id ?? pr.id;
      const clienteExtId = pr.cliente?.id ?? pr.clienteRef?.id ?? null;
      const related: Array<{ kind: RawEntityKind; search: string; icon: any; tooltip: string }> = [];
      if (clienteExtId) related.push({ kind: "clientes", search: clienteExtId, icon: Users, tooltip: "Ver cliente deste projeto" });
      if (projetoExtId) related.push({ kind: "propostas", search: projetoExtId, icon: FileText, tooltip: "Ver propostas deste projeto" });
      return (
        <TableRow key={r.id}>
          <TableCell className="font-medium text-foreground">{sanitizeText(pr.nome ?? "") || "—"}</TableCell>
          <TableCell className="text-sm">{pr.cliente?.nome ?? pr.clienteRef?.label ?? "—"}</TableCell>
          <TableCell className="text-sm">{pr.responsavel?.label ?? "—"}</TableCell>
          <TableCell className="text-sm">{cidadeUf}</TableCell>
          <TableCell><RelatedNav onNavigate={onNavigate} items={related} /></TableCell>
          <TableCell>{pr.criadoEm ? formatDateTime(pr.criadoEm) : importedAt}</TableCell>
          <TableCell className="text-right">{action}</TableCell>
        </TableRow>
      );
    }
    if (kind === "propostas") {
      const pp = parseSmProposta(p);
      const projetoExtId = pp.projeto?.id ?? null;
      const related: Array<{ kind: RawEntityKind; search: string; icon: any; tooltip: string }> = [];
      if (projetoExtId) related.push({ kind: "projetos", search: projetoExtId, icon: FolderKanban, tooltip: "Ver projeto desta proposta" });
      // tentamos resolver cliente via projeto (se carregou) — fallback pelo label
      const clienteFromProject = (p?.project?.client?.id ?? p?.project?.customer?.id ?? null);
      if (clienteFromProject) {
        related.push({ kind: "clientes", search: String(clienteFromProject), icon: Users, tooltip: "Ver cliente desta proposta" });
      }
      return (
        <TableRow key={r.id}>
          <TableCell className="font-medium text-foreground max-w-xs truncate">
            {sanitizeText(pp.nome ?? "") || "—"}
          </TableCell>
          <TableCell className="text-sm">{pp.projeto?.label ?? "—"}</TableCell>
          <TableCell>{proposalStatusBadge(pp.status)}</TableCell>
          <TableCell className="text-sm font-mono">
            {pp.valorTotalEstimado != null ? formatBRL(pp.valorTotalEstimado) : "—"}
          </TableCell>
          <TableCell><RelatedNav onNavigate={onNavigate} items={related} /></TableCell>
          <TableCell>{pp.criadoEm ? formatDateTime(pp.criadoEm) : importedAt}</TableCell>
          <TableCell className="text-right">{action}</TableCell>
        </TableRow>
      );
    }
    if (kind === "funis") {
      const f = parseSmFunil(p);
      return (
        <TableRow key={r.id}>
          <TableCell className="font-medium text-foreground">{sanitizeText(f.nome ?? "") || "—"}</TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">{f.etapas.length} etapa(s)</Badge>
          </TableCell>
          <TableCell>{extId}</TableCell>
          <TableCell>{importedAt}</TableCell>
          <TableCell className="text-right">{action}</TableCell>
        </TableRow>
      );
    }
    // custom_fields
    const cf = parseSmCustomField(p);
    return (
      <TableRow key={r.id}>
        <TableCell className="font-medium text-foreground">{sanitizeText(cf.nome ?? "") || "—"}</TableCell>
        <TableCell>{cf.tipo ? <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">{String(cf.tipo)}</Badge> : "—"}</TableCell>
        <TableCell className="text-sm">{cf.obrigatorio === true ? "Sim" : cf.obrigatorio === false ? "Não" : "—"}</TableCell>
        <TableCell>{importedAt}</TableCell>
        <TableCell className="text-right">{action}</TableCell>
      </TableRow>
    );
  };

  const headers: Record<RawEntityKind, string[]> = {
    clientes: ["Nome", "Telefone", "CPF/CNPJ", "Cidade/UF", "Relacionados", "Importado em", ""],
    projetos: ["Nome", "Cliente", "Responsável", "Cidade/UF", "Relacionados", "Data de inclusão", ""],
    propostas: ["Nome", "Projeto", "Status", "Valor total estimado", "Relacionados", "Data de inclusão", ""],
    funis: ["Nome", "Etapas", "ID Externo", "Importado em", ""],
    custom_fields: ["Nome", "Tipo", "Obrigatório", "Importado em", ""],
  };

  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {headers[kind].map((h, i) => (
                <TableHead key={i} className={i === headers[kind].length - 1 ? "text-right" : ""}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map(renderRow)}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} setPage={setPage} total={data.total} />
    </>
  );
}
