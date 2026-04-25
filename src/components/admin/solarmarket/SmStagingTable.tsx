/**
 * SmStagingTable — Visualização paginada e pesquisável dos dados brutos
 * importados do SolarMarket (tabelas sm_*_raw).
 *
 * Suporta as 6 tabelas de staging com colunas amigáveis por tipo, busca
 * por nome/identificação, ordenação por coluna (A-Z padrão) e modal
 * "Ver JSON completo" com payload bruto.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  formatPhoneBR,
  formatCpfCnpj,
  formatCep,
} from "@/lib/migrationFormatters";

/**
 * Aplica formatter nativo; se vier null (dado curto/inválido) preserva
 * o valor cru entre parênteses para manter visibilidade do problema.
 * Bug B-1 — Auditoria 2026-04-25 (RB-62).
 */
function fmtOrRaw(
  raw: unknown,
  formatter: (v: unknown) => string | null,
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  const formatted = formatter(raw);
  if (formatted) return formatted;
  return `${String(raw)} (inválido)`;
}

export type SmStagingTableName =
  | "sm_clientes_raw"
  | "sm_projetos_raw"
  | "sm_propostas_raw"
  | "sm_funis_raw"
  | "sm_projeto_funis_raw"
  | "sm_custom_fields_raw";

interface Props {
  tabela: SmStagingTableName;
  tenantId: string;
}

const PAGE_SIZE = 10;

interface ColumnDef {
  header: string;
  /** extrator a partir da row (com payload já normalizado) */
  get: (row: any) => string;
  /** Campo de ordenação no Postgres (ex.: "payload->>name", "imported_at"). Se omitido, coluna não é ordenável. */
  sortField?: string;
  className?: string;
}

type SortDir = "asc" | "desc";
interface SortState {
  field: string;
  direction: SortDir;
}

function fmtDate(v: any): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return String(v);
  }
}

function sumPricing(payload: any): string {
  const t = payload?.pricingTable;
  if (!Array.isArray(t)) return "—";
  const total = t.reduce(
    (acc: number, item: any) => acc + (Number(item?.value) || 0),
    0,
  );
  if (!total) return "—";
  return total.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const COLUMNS: Record<SmStagingTableName, ColumnDef[]> = {
  sm_clientes_raw: [
    { header: "Nome", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "CPF/CNPJ", get: (r) => r.payload?.cnpjCpf ?? "—" },
    { header: "Telefone", get: (r) => r.payload?.primaryPhone ?? "—" },
    { header: "Cidade", get: (r) => r.payload?.city ?? "—", sortField: "payload->>city" },
    { header: "Importado em", get: (r) => fmtDate(r.imported_at), sortField: "imported_at" },
  ],
  sm_projetos_raw: [
    { header: "Nome", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "Cliente", get: (r) => r.payload?.client?.name ?? "—", sortField: "payload->client->>name" },
    { header: "Responsável", get: (r) => r.payload?.responsible?.name ?? "—", sortField: "payload->responsible->>name" },
    { header: "Importado em", get: (r) => fmtDate(r.imported_at), sortField: "imported_at" },
  ],
  sm_propostas_raw: [
    { header: "Nome", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "Projeto", get: (r) => r.payload?.project?.name ?? "—", sortField: "payload->project->>name" },
    { header: "Status", get: (r) => r.payload?.status ?? "—", sortField: "payload->>status" },
    { header: "Valor", get: (r) => sumPricing(r.payload) },
    { header: "Importado em", get: (r) => fmtDate(r.imported_at), sortField: "imported_at" },
  ],
  sm_funis_raw: [
    { header: "Nome", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "Ordem", get: (r) => String(r.payload?.order ?? "—"), sortField: "payload->>order" },
    {
      header: "Etapas",
      get: (r) =>
        Array.isArray(r.payload?.stages)
          ? String(r.payload.stages.length)
          : "—",
    },
    { header: "Importado em", get: (r) => fmtDate(r.imported_at), sortField: "imported_at" },
  ],
  sm_projeto_funis_raw: [
    { header: "Projeto SM ID", get: (r) => String(r.sm_project_id ?? "—"), sortField: "sm_project_id" },
    { header: "Funil/Item", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "Etapa", get: (r) => r.payload?.stage?.name ?? "—", sortField: "payload->stage->>name" },
    { header: "Status", get: (r) => r.payload?.status ?? "—", sortField: "payload->>status" },
    {
      header: "Responsável",
      get: (r) => r.payload?.responsible?.name ?? "—",
      sortField: "payload->responsible->>name",
    },
  ],
  sm_custom_fields_raw: [
    { header: "Nome", get: (r) => r.payload?.name ?? "—", sortField: "payload->>name" },
    { header: "Tipo", get: (r) => r.payload?.type ?? "—", sortField: "payload->>type" },
    {
      header: "Valor padrão",
      get: (r) =>
        r.payload?.default === undefined || r.payload?.default === null
          ? "—"
          : String(r.payload.default),
    },
    { header: "Importado em", get: (r) => fmtDate(r.imported_at), sortField: "imported_at" },
  ],
};

/** Ordenação inicial A-Z por nome principal (ou identificador) */
const DEFAULT_SORT: Record<SmStagingTableName, SortState> = {
  sm_clientes_raw: { field: "payload->>name", direction: "asc" },
  sm_projetos_raw: { field: "payload->>name", direction: "asc" },
  sm_propostas_raw: { field: "payload->>name", direction: "asc" },
  sm_funis_raw: { field: "payload->>name", direction: "asc" },
  sm_projeto_funis_raw: { field: "payload->>name", direction: "asc" },
  sm_custom_fields_raw: { field: "payload->>name", direction: "asc" },
};

/** Campo do payload para busca textual case-insensitive */
const SEARCH_FIELD: Record<SmStagingTableName, string> = {
  sm_clientes_raw: "payload->>name",
  sm_projetos_raw: "payload->>name",
  sm_propostas_raw: "payload->>name",
  sm_funis_raw: "payload->>name",
  sm_projeto_funis_raw: "payload->>name",
  sm_custom_fields_raw: "payload->>name",
};

interface SortableHeaderProps {
  label: string;
  field?: string;
  currentSort: SortState;
  onSort: (field: string) => void;
}

function SortableHeader({ label, field, currentSort, onSort }: SortableHeaderProps) {
  if (!field) {
    return <TableHead>{label}</TableHead>;
  }
  const isActive = currentSort.field === field;
  const direction = isActive ? currentSort.direction : null;

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
      >
        <span>{label}</span>
        {!isActive && <ArrowUpDown className="w-3 h-3 opacity-40" />}
        {direction === "asc" && <ArrowUp className="w-3 h-3 text-primary" />}
        {direction === "desc" && <ArrowDown className="w-3 h-3 text-primary" />}
      </button>
    </TableHead>
  );
}

export function SmStagingTable({ tabela, tenantId }: Props) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [previewRow, setPreviewRow] = useState<any | null>(null);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT[tabela]);

  const columns = COLUMNS[tabela];

  const handleSort = (field: string) => {
    setPage(0);
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" },
    );
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["sm_staging_view", tabela, tenantId, page, search, sort.field, sort.direction],
    queryFn: async () => {
      let query: any = supabase
        .from(tabela)
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order(sort.field, { ascending: sort.direction === "asc" })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        const field = SEARCH_FIELD[tabela];
        query = query.ilike(field, `%${search.trim()}%`);
      }

      const { data: rows, count, error } = await query;
      if (error) throw error;
      return { rows: (rows ?? []) as any[], total: count ?? 0 };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 30,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)),
    [data?.total],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Buscar
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(0);
            }}
          >
            Limpar
          </Button>
        )}
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
          <Inbox className="w-10 h-10 mb-2 opacity-60" />
          <p className="text-sm">
            {search
              ? "Nenhum registro encontrado para a busca."
              : "Nenhum dado nesta tabela ainda."}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <SortableHeader
                      key={c.header}
                      label={c.header}
                      field={c.sortField}
                      currentSort={sort}
                      onSort={handleSort}
                    />
                  ))}
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id ?? row.external_id ?? Math.random()}>
                    {columns.map((c) => (
                      <TableCell key={c.header} className={c.className}>
                        <span className="text-sm text-foreground">
                          {c.get(row)}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewRow(row)}
                        title="Ver JSON completo"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {(data.total).toLocaleString("pt-BR")} registro(s) — página{" "}
              {page + 1} de {totalPages}
              {isFetching && " · atualizando..."}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!previewRow} onOpenChange={(o) => !o && setPreviewRow(null)}>
        <DialogContent className="w-[90vw] max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Payload bruto</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <pre className="text-xs bg-muted/40 border border-border rounded-md p-3 whitespace-pre-wrap break-all text-foreground">
              {previewRow ? JSON.stringify(previewRow, null, 2) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
