/**
 * Página genérica de auditoria de equipamentos.
 * Reaproveita: edge function enrich-equipment.
 * Usada por: Inversores (custom), Baterias, Módulos, Otimizadores.
 *
 * NÃO duplica BD: lê direto da tabela informada via prop, mesma estrutura
 * de audit_status aplicada pela migration de Fase 1.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, FileSearch, AlertTriangle, CheckCircle2, Loader2, Wand2, ExternalLink, History } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditStatus = "all" | "pendente_datasheet" | "specs_incompletas" | "normalizado" | "enriquecido";

export interface EquipmentAuditConfig {
  /** Tipo de equipamento aceito pela edge function enrich-equipment */
  equipmentType: "modulo" | "inversor" | "otimizador" | "bateria";
  /** Tabela do catálogo no Supabase */
  tableName: "modulos_solares" | "inversores_catalogo" | "otimizadores_catalogo" | "baterias";
  /** Título da página */
  title: string;
  description: string;
  /** Coluna de garantia padrão na tabela */
  warrantyColumn: "garantia_anos" | "garantia_produto_anos";
  /** Coluna de potência/capacidade exibida na tabela */
  capacityColumn: { key: string; label: string; suffix?: string };
  /** Campos extras a exibir (até 2) */
  extraColumns?: Array<{ key: string; label: string; suffix?: string; align?: "right" | "center" | "left" }>;
}

interface AuditCounts {
  total: number;
  pendente_datasheet: number;
  specs_incompletas: number;
  normalizado: number;
  enriquecido: number;
}

export function EquipmentAuditPage({ config }: { config: EquipmentAuditConfig }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AuditStatus>("pendente_datasheet");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  const queryKey = [`${config.tableName}-audit`] as const;

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    staleTime: 60_000,
    queryFn: async () => {
      const all: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from(config.tableName as any)
          .select(`id, fabricante, modelo, datasheet_url, ${config.warrantyColumn}, ${config.capacityColumn.key}, audit_status, audited_at, audit_notes${(config.extraColumns || []).map(c => `, ${c.key}`).join("")}`)
          .order("fabricante")
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        offset += 1000;
      }
      return all;
    },
  });

  const counts: AuditCounts = useMemo(() => {
    const c: AuditCounts = { total: rows.length, pendente_datasheet: 0, specs_incompletas: 0, normalizado: 0, enriquecido: 0 };
    for (const r of rows) {
      const s = r.audit_status;
      if (s === "pendente_datasheet") c.pendente_datasheet++;
      else if (s === "specs_incompletas") c.specs_incompletas++;
      else if (s === "enriquecido") c.enriquecido++;
      else if (s === "normalizado") c.normalizado++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tab !== "all" && r.audit_status !== tab) return false;
      if (search && !`${r.fabricante} ${r.modelo}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, tab, search]);

  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(filtered.map((f) => f.id)) : new Set());
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const enrichMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const tenant_id = await getCurrentTenantId();
      if (!tenant_id) throw new Error("Tenant não identificado");
      setEnriching(true);
      setProgress({ done: 0, total: ids.length, ok: 0, fail: 0 });
      let ok = 0, fail = 0;
      for (let i = 0; i < ids.length; i++) {
        try {
          const { error } = await supabase.functions.invoke("enrich-equipment", {
            body: { equipment_type: config.equipmentType, equipment_id: ids[i], tenant_id, force_refresh: true },
          });
          if (error) throw error;
          await supabase.from(config.tableName as any)
            .update({ audit_status: "enriquecido", audited_at: new Date().toISOString() } as never)
            .eq("id", ids[i]);
          ok++;
        } catch (e) {
          fail++;
          console.warn(`[audit-${config.equipmentType}] falhou`, ids[i], e);
        }
        setProgress({ done: i + 1, total: ids.length, ok, fail });
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      toast.success(`Auditoria concluída: ${ok} ok, ${fail} falhas`);
      queryClient.invalidateQueries({ queryKey });
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
    onSettled: () => setEnriching(false),
  });

  const startBatch = () => {
    if (selected.size === 0) { toast.error("Selecione pelo menos 1 item"); return; }
    enrichMutation.mutate(Array.from(selected));
  };
  const startTabBatch = () => {
    if (filtered.length === 0) return;
    enrichMutation.mutate(filtered.slice(0, 200).map((f) => f.id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title={config.title}
        description={config.description}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startBatch} disabled={enriching || selected.size === 0} className="gap-2">
              <Wand2 className="w-4 h-4" /> Auditar selecionados ({selected.size})
            </Button>
            <Button size="sm" onClick={startTabBatch} disabled={enriching || filtered.length === 0} className="gap-2">
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Auditar aba ({Math.min(filtered.length, 200)})
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-l-[3px] border-l-primary"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total</p>
        </CardContent></Card>
        <Card className="border-l-[3px] border-l-warning"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.pendente_datasheet}</p>
          <p className="text-xs text-muted-foreground mt-1">Sem datasheet</p>
        </CardContent></Card>
        <Card className="border-l-[3px] border-l-destructive"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.specs_incompletas}</p>
          <p className="text-xs text-muted-foreground mt-1">Specs incompletas</p>
        </CardContent></Card>
        <Card className="border-l-[3px] border-l-info"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.normalizado}</p>
          <p className="text-xs text-muted-foreground mt-1">Normalizados</p>
        </CardContent></Card>
        <Card className="border-l-[3px] border-l-success"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.enriquecido}</p>
          <p className="text-xs text-muted-foreground mt-1">Enriquecidos via IA</p>
        </CardContent></Card>
      </div>

      {enriching && (
        <Card className="border-l-[3px] border-l-info bg-info/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-info" />
            <div className="flex-1">
              <p className="text-sm font-medium">Auditando via IA...</p>
              <p className="text-xs text-muted-foreground">{progress.done} / {progress.total} — {progress.ok} ok, {progress.fail} falhas</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v as AuditStatus); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="pendente_datasheet" className="gap-2"><AlertTriangle className="w-3 h-3" /> Sem datasheet ({counts.pendente_datasheet})</TabsTrigger>
          <TabsTrigger value="specs_incompletas" className="gap-2"><FileSearch className="w-3 h-3" /> Specs incompletas ({counts.specs_incompletas})</TabsTrigger>
          <TabsTrigger value="normalizado" className="gap-2"><History className="w-3 h-3" /> Normalizados ({counts.normalizado})</TabsTrigger>
          <TabsTrigger value="enriquecido" className="gap-2"><CheckCircle2 className="w-3 h-3" /> Enriquecidos ({counts.enriquecido})</TabsTrigger>
          <TabsTrigger value="all">Todos ({counts.total})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Input placeholder="Buscar fabricante ou modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-success" />
          <p className="font-medium text-foreground">Nenhum item nesta categoria</p>
          <p className="text-sm mt-1">Tudo certo por aqui!</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={(c) => toggleAll(!!c)} />
                  </TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">{config.capacityColumn.label}</TableHead>
                  {(config.extraColumns || []).map((c) => (
                    <TableHead key={c.key} className={c.align === "center" ? "text-center" : c.align === "left" ? "" : "text-right"}>{c.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Garantia</TableHead>
                  <TableHead className="text-center">Datasheet</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => {
                  const status = r.audit_status || "pendente";
                  const cap = r[config.capacityColumn.key];
                  const warr = r[config.warrantyColumn];
                  return (
                    <TableRow key={r.id} className={selected.has(r.id) ? "bg-muted/50" : ""}>
                      <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={(c) => toggleOne(r.id, !!c)} /></TableCell>
                      <TableCell className="font-medium">{r.fabricante}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.modelo}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cap != null ? `${cap}${config.capacityColumn.suffix ?? ""}` : "—"}
                      </TableCell>
                      {(config.extraColumns || []).map((c) => {
                        const v = r[c.key];
                        return (
                          <TableCell key={c.key} className={c.align === "center" ? "text-center" : c.align === "left" ? "" : "text-right tabular-nums"}>
                            {v != null && v !== "" ? `${v}${c.suffix ?? ""}` : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums">
                        {warr ? `${warr}a` : <span className="text-destructive">—</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.datasheet_url ? (
                          <a href={r.datasheet_url} target="_blank" rel="noreferrer" className="inline-flex text-info hover:underline">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status === "enriquecido" ? "default" : status === "pendente_datasheet" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {String(status).replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs text-muted-foreground border-t">
                Mostrando 200 de {filtered.length}. Refine a busca para ver mais.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
