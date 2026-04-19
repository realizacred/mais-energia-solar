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
import { toast } from "@/hooks/use-toast";
import {
  Users, FolderKanban, FileText, GitBranch, Settings2,
  ExternalLink, RefreshCw, Loader2, Database, Search,
} from "lucide-react";
import { useSolarmarketImport, type ImportScope } from "@/hooks/useSolarmarketImport";

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
      const [c, p, pr] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("external_source", "solarmarket"),
      ]);
      return {
        clientes: c.count ?? 0,
        projetos: p.count ?? 0,
        propostas: pr.count ?? 0,
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
  search: string
) {
  return useQuery({
    queryKey: ["sm-imported-list", table, page, search],
    staleTime: STALE,
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
  const counts = useImportedCounts();
  const { importAll, jobs } = useSolarmarketImport();
  const [activeTab, setActiveTab] = useState("clientes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const runningJob = jobs.find((j) => j.status === "running");

  const handleReimport = async (entity: keyof ImportScope) => {
    const labels: Record<string, string> = {
      clientes: "Clientes",
      projetos: "Projetos",
      propostas: "Propostas",
      funis: "Funis e Etapas",
      custom_fields: "Campos Customizados",
    };
    if (!confirm(`Reimportar ${labels[entity]} do SolarMarket? Será iniciada uma nova importação.`)) return;
    try {
      const scope: ImportScope = {
        clientes: false, projetos: false, propostas: false, funis: false, custom_fields: false,
        [entity]: true,
      };
      await importAll.mutateAsync(scope);
      toast({ title: `Reimportação iniciada`, description: `${labels[entity]} sendo reimportados.` });
    } catch (e: any) {
      toast({ title: "Erro ao reimportar", description: e?.message, variant: "destructive" });
    }
  };

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
            </TabsTrigger>
            <TabsTrigger value="custom_fields" className="gap-1">
              <Settings2 className="w-3.5 h-3.5" /> Campos Custom
            </TabsTrigger>
          </TabsList>

          {/* Toolbar de busca + reimportar */}
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReimport(activeTab as keyof ImportScope)}
                disabled={importAll.isPending || !!runningJob}
              >
                {importAll.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Reimportar
              </Button>
            </div>
          )}

          <TabsContent value="clientes">
            <ListaClientes search={search} page={page} setPage={setPage} />
          </TabsContent>
          <TabsContent value="projetos">
            <ListaProjetos search={search} page={page} setPage={setPage} />
          </TabsContent>
          <TabsContent value="propostas">
            <ListaPropostas search={search} page={page} setPage={setPage} />
          </TabsContent>
          <TabsContent value="funis" className="mt-4">
            <FunisPlaceholder onReimport={() => handleReimport("funis")} disabled={importAll.isPending || !!runningJob} />
          </TabsContent>
          <TabsContent value="custom_fields" className="mt-4">
            <CustomFieldsPlaceholder onReimport={() => handleReimport("custom_fields")} disabled={importAll.isPending || !!runningJob} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sub-listas
// ─────────────────────────────────────────────────────────────────────────
type ListProps = { search: string; page: number; setPage: (n: number) => void };

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

function ListaClientes({ search, page, setPage }: ListProps) {
  const { data, isLoading } = useImportedList("clientes", page, search);
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

function ListaProjetos({ search, page, setPage }: ListProps) {
  const { data, isLoading } = useImportedList("projetos", page, search);
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

function ListaPropostas({ search, page, setPage }: ListProps) {
  const { data, isLoading } = useImportedList("propostas_nativas", page, search);
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
function FunisPlaceholder({ onReimport, disabled }: { onReimport: () => void; disabled: boolean }) {
  return (
    <Card className="bg-muted/20 border-border shadow-sm">
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <GitBranch className="w-8 h-8 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Funis e Etapas</p>
          <p className="text-xs text-muted-foreground mt-1">
            Funis e etapas do SolarMarket são mapeados diretamente para os pipelines nativos.
            Use o botão abaixo para reimportar a estrutura.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReimport} disabled={disabled}>
          <RefreshCw className="w-4 h-4 mr-2" /> Reimportar
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomFieldsPlaceholder({ onReimport, disabled }: { onReimport: () => void; disabled: boolean }) {
  return (
    <Card className="bg-muted/20 border-border shadow-sm">
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Settings2 className="w-8 h-8 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Campos Customizados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Campos customizados do SolarMarket são integrados ao catálogo nativo de campos.
            Use o botão abaixo para reimportar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReimport} disabled={disabled}>
          <RefreshCw className="w-4 h-4 mr-2" /> Reimportar
        </Button>
      </CardContent>
    </Card>
  );
}
