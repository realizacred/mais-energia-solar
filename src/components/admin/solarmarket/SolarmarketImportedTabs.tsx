/**
 * SolarmarketImportedTabs — Visualização dos dados importados do SolarMarket.
 * Lista clientes/projetos/propostas com external_source='solarmarket' e
 * permite ver detalhe nativo ou reimportar a entidade inteira.
 *
 * RB-04: queries em hook (inline aqui apenas para listagem read-only de auditoria).
 * Padrão: tabs horizontais (RB-19), Card padrão (DS-02), badges semânticos.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, FolderKanban, FileText, GitBranch, Settings2,
  ExternalLink, Database, Search,
} from "lucide-react";
import { useSolarmarketImport } from "@/hooks/useSolarmarketImport";

const PAGE_SIZE = 25;
const STALE = 1000 * 60 * 5;
const fmtBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function CountBadge({ value, loading }: { value: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-5 w-8 inline-block" />;
  return (
    <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">
      {value}
    </Badge>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hook: contadores totais (sempre carregados para os badges das abas)
// ─────────────────────────────────────────────────────────────────────────
function useImportedCounts(isImporting: boolean) {
  return useQuery({
    queryKey: ["sm-imported-counts"],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const [c, p, pr, pipes, stages, fields] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
        supabase.from("pipelines").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("pipeline_stages").select("id", { count: "exact", head: true }),
        supabase.from("deal_custom_fields").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        clientes: c.count ?? 0,
        projetos: p.count ?? 0,
        propostas: pr.count ?? 0,
        pipelines: pipes.count ?? 0,
        stages: stages.count ?? 0,
        custom_fields: fields.count ?? 0,
      };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Hook: listagem paginada
// ─────────────────────────────────────────────────────────────────────────
function useImportedList(
  table: "clientes" | "projetos" | "propostas_nativas",
  page: number,
  search: string,
  isImporting: boolean
) {
  return useQuery({
    queryKey: ["sm-imported-list", table, page, search],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase.from(table).select("*", { count: "exact" })
        .eq("external_source", "solarmarket")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        if (table === "clientes") {
          q = q.or(`nome.ilike.%${search}%,cliente_code.ilike.%${search}%,external_id.ilike.%${search}%`);
        } else {
          q = q.ilike("external_id", `%${search}%`);
        }
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
  const [activeTab, setActiveTab] = useState("clientes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Dados Importados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearch(""); setPage(0); }}>
          <TabsList className="overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="clientes" className="gap-1">
              <Users className="w-3.5 h-3.5" /> Clientes
              <CountBadge value={counts.data?.clientes ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger value="projetos" className="gap-1">
              <FolderKanban className="w-3.5 h-3.5" /> Projetos
              <CountBadge value={counts.data?.projetos ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger value="propostas" className="gap-1">
              <FileText className="w-3.5 h-3.5" /> Propostas
              <CountBadge value={counts.data?.propostas ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger value="funis" className="gap-1">
              <GitBranch className="w-3.5 h-3.5" /> Funis e Etapas
              <CountBadge value={(counts.data?.pipelines ?? 0) + (counts.data?.stages ?? 0)} loading={counts.isLoading} />
            </TabsTrigger>
            <TabsTrigger value="custom_fields" className="gap-1">
              <Settings2 className="w-3.5 h-3.5" /> Campos Custom
              <CountBadge value={counts.data?.custom_fields ?? 0} loading={counts.isLoading} />
            </TabsTrigger>
          </TabsList>

          {/* Toolbar de busca */}
          {(activeTab === "clientes" || activeTab === "projetos" || activeTab === "propostas") && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4 mb-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, código ou ID externo…"
                  className="pl-8"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                />
              </div>
            </div>
          )}

          <TabsContent value="clientes">
            <ListaClientes search={search} page={page} setPage={setPage} isImporting={isImporting} />
          </TabsContent>
          <TabsContent value="projetos">
            <ListaProjetos search={search} page={page} setPage={setPage} isImporting={isImporting} />
          </TabsContent>
          <TabsContent value="propostas">
            <ListaPropostas search={search} page={page} setPage={setPage} isImporting={isImporting} />
          </TabsContent>
          <TabsContent value="funis" className="mt-4">
            <ListaFunis isImporting={isImporting} />
          </TabsContent>
          <TabsContent value="custom_fields" className="mt-4">
            <ListaCustomFields isImporting={isImporting} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-listas
// ─────────────────────────────────────────────────────────────────────────
type ListProps = { search: string; page: number; setPage: (n: number) => void; isImporting: boolean };

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

function ListaClientes({ search, page, setPage, isImporting }: ListProps) {
  const { data, isLoading } = useImportedList("clientes", page, search, isImporting);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.rows.length) return <EmptyState icon={Users} message="Nenhum cliente importado encontrado." />;
  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>ID Externo</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Importado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.nome ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{c.cliente_code ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{c.external_id ?? "—"}</TableCell>
                <TableCell className="text-xs">{[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell className="text-xs">{fmtBR(c.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link to={`/admin/clientes?focus=${c.id}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} setPage={setPage} total={data.total} />
    </>
  );
}

function ListaProjetos({ search, page, setPage, isImporting }: ListProps) {
  const { data, isLoading } = useImportedList("projetos", page, search, isImporting);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.rows.length) return <EmptyState icon={FolderKanban} message="Nenhum projeto importado encontrado." />;
  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Externo</TableHead>
              <TableHead>Cliente ID</TableHead>
              <TableHead>Importado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-mono">{p.external_id ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{p.cliente_id?.slice(0, 8) ?? "—"}…</TableCell>
                <TableCell className="text-xs">{fmtBR(p.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link to={`/admin/projetos?focus=${p.id}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} setPage={setPage} total={data.total} />
    </>
  );
}

function ListaPropostas({ search, page, setPage, isImporting }: ListProps) {
  const { data, isLoading } = useImportedList("propostas_nativas", page, search, isImporting);
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.rows.length) return <EmptyState icon={FileText} message="Nenhuma proposta importada encontrada." />;
  return (
    <>
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID Externo</TableHead>
              <TableHead>Projeto ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Importada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((pr: any) => (
              <TableRow key={pr.id}>
                <TableCell className="text-xs font-mono">{pr.external_id ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {pr.projeto_id?.slice(0, 8) ?? "—"}…
                </TableCell>
                <TableCell className="text-xs">{pr.status ?? "—"}</TableCell>
                <TableCell className="text-xs">{fmtBR(pr.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <Link to={`/admin/propostas?focus=${pr.id}`}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} setPage={setPage} total={data.total} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Placeholders para Funis e Campos Customizados
// (não há tabela de staging com external_source — exibimos card informativo)
// ─────────────────────────────────────────────────────────────────────────
type ExtraListProps = { isImporting: boolean };

function ListaFunis({ isImporting }: ExtraListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["sm-imported-funis"],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const { data: pipes, error: e1 } = await supabase
        .from("pipelines")
        .select("id,name,kind,is_active,is_default,created_at")
        .order("created_at", { ascending: false });
      if (e1) throw e1;
      const ids = (pipes ?? []).map((p) => p.id);
      const { data: stages, error: e2 } = ids.length
        ? await supabase.from("pipeline_stages").select("id,pipeline_id,name,position").in("pipeline_id", ids)
        : { data: [], error: null };
      if (e2) throw e2;
      const byPipe = new Map<string, number>();
      (stages ?? []).forEach((s: any) => byPipe.set(s.pipeline_id, (byPipe.get(s.pipeline_id) ?? 0) + 1));
      return (pipes ?? []).map((p: any) => ({ ...p, stages: byPipe.get(p.id) ?? 0 }));
    },
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={GitBranch} message="Nenhum funil encontrado." />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funil</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Etapas</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                  <TableCell className="text-xs">{p.kind ?? "—"}</TableCell>
                  <TableCell className="text-center text-xs font-mono">{p.stages}</TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/20">Sim</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{p.is_default ? "★" : "—"}</TableCell>
                  <TableCell className="text-xs">{fmtBR(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ListaCustomFields({ isImporting }: ExtraListProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["sm-imported-custom-fields"],
    staleTime: isImporting ? 0 : STALE,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_custom_fields")
        .select("id,title,field_key,field_type,field_context,is_active,created_at")
        .order("field_context", { ascending: true })
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !data?.length ? (
        <EmptyState icon={Settings2} message="Nenhum campo customizado encontrado." />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-foreground">{f.title}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{f.field_key}</TableCell>
                  <TableCell className="text-xs">{f.field_type}</TableCell>
                  <TableCell className="text-xs">{f.field_context ?? "—"}</TableCell>
                  <TableCell>
                    {f.is_active ? (
                      <Badge className="bg-success/10 text-success border-success/20">Sim</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Não</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
