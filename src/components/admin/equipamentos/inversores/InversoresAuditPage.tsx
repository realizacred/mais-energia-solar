/**
 * Auditoria do catálogo de inversores (Fase 2).
 * Reaproveita: useInversoresCatalogo, edge function enrich-equipment.
 * Mostra registros marcados pela Fase 1 (audit_status) e permite re-enriquecer
 * via datasheet/IA em lote ou individualmente.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, FileSearch, AlertTriangle, CheckCircle2, Loader2, Wand2, ExternalLink, History } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useInversoresCatalogo } from "@/hooks/useInversoresCatalogo";
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

interface AuditCounts {
  total: number;
  pendente_datasheet: number;
  specs_incompletas: number;
  normalizado: number;
  enriquecido: number;
  sem_garantia: number;
}

export function InversoresAuditPage() {
  const queryClient = useQueryClient();
  const { data: inversores = [], isLoading } = useInversoresCatalogo();
  const [tab, setTab] = useState<AuditStatus>("pendente_datasheet");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, ok: 0, fail: 0 });

  // Buscar audit_status separado (não está no hook padrão)
  const { data: auditStatusMap = {} } = useQuery({
    queryKey: ["inversores-audit-status"],
    staleTime: 60_000,
    queryFn: async () => {
      const map: Record<string, { audit_status: string | null; audited_at: string | null; audit_notes: string | null }> = {};
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("inversores_catalogo")
          .select("id, audit_status, audited_at, audit_notes")
          .range(offset, offset + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) map[r.id] = { audit_status: r.audit_status, audited_at: r.audited_at, audit_notes: r.audit_notes };
        if (data.length < 1000) break;
        offset += 1000;
      }
      return map;
    },
  });

  const counts: AuditCounts = useMemo(() => {
    const c: AuditCounts = { total: inversores.length, pendente_datasheet: 0, specs_incompletas: 0, normalizado: 0, enriquecido: 0, sem_garantia: 0 };
    for (const inv of inversores) {
      const s = auditStatusMap[inv.id]?.audit_status;
      if (s === "pendente_datasheet") c.pendente_datasheet++;
      else if (s === "specs_incompletas") c.specs_incompletas++;
      else if (s === "enriquecido") c.enriquecido++;
      else if (s === "normalizado") c.normalizado++;
      if (!inv.garantia_anos) c.sem_garantia++;
    }
    return c;
  }, [inversores, auditStatusMap]);

  const filtered = useMemo(() => {
    return inversores.filter((i) => {
      const s = auditStatusMap[i.id]?.audit_status;
      if (tab !== "all" && s !== tab) return false;
      if (search && !`${i.fabricante} ${i.modelo}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [inversores, auditStatusMap, tab, search]);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((f) => f.id)) : new Set());
  };
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
      let totalConsensus = 0, totalConflict = 0;
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          const { data, error } = await supabase.functions.invoke("enrich-equipment", {
            body: { equipment_type: "inversor", equipment_id: id, tenant_id, force_refresh: true },
          });
          if (error) throw error;
          if (data?.team) {
            totalConsensus += data.team.consensus_count || 0;
            totalConflict += data.team.conflict_count || 0;
          }
          await supabase.from("inversores_catalogo")
            .update({ audit_status: "enriquecido", audited_at: new Date().toISOString() } as never)
            .eq("id", id);
          ok++;
          // Real-time UI: marca como enriquecido em cache + tira da seleção
          queryClient.setQueryData(["inversores-audit-status"], (old: any) => {
            const next = { ...(old || {}) };
            next[id] = { ...(next[id] || {}), audit_status: "enriquecido", audited_at: new Date().toISOString() };
            return next;
          });
          setSelected((prev) => {
            if (!prev.has(id)) return prev;
            const n = new Set(prev);
            n.delete(id);
            return n;
          });
        } catch (e) {
          fail++;
          console.warn("[audit-inv] falhou", id, e);
        }
        setProgress({ done: i + 1, total: ids.length, ok, fail });
      }
      return { ok, fail, totalConsensus, totalConflict };
    },
    onSuccess: ({ ok, fail, totalConsensus, totalConflict }) => {
      toast.success(
        `Auditoria concluída: ${ok} ok, ${fail} falhas — Equipe IA: ${totalConsensus} consensos, ${totalConflict} conflitos`,
      );
      queryClient.invalidateQueries({ queryKey: ["inversores-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["inversores-audit-status"] });
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
    onSettled: () => setEnriching(false),
  });

  const startBatch = () => {
    if (selected.size === 0) {
      toast.error("Selecione pelo menos 1 inversor");
      return;
    }
    enrichMutation.mutate(Array.from(selected));
  };

  const startTabBatch = () => {
    if (filtered.length === 0) return;
    enrichMutation.mutate(filtered.map((f) => f.id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Auditoria de Inversores"
        description="Revise registros normalizados, complete specs faltantes e busque datasheets oficiais via IA"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={startBatch} disabled={enriching || selected.size === 0} className="gap-2">
              <Wand2 className="w-4 h-4" /> Auditar selecionados ({selected.size})
            </Button>
            <Button size="sm" onClick={startTabBatch} disabled={enriching || filtered.length === 0} className="gap-2">
              {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Auditar toda a aba ({filtered.length})
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-l-[3px] border-l-primary"><CardContent className="p-4">
          <p className="text-xl font-bold">{counts.total}</p>
          <p className="text-xs text-muted-foreground mt-1">Total no catálogo</p>
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
          <p className="text-xs text-muted-foreground mt-1">Normalizados (Fase 1)</p>
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
              <p className="text-sm font-medium">Auditando inversores via IA...</p>
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
          <p className="font-medium text-foreground">Nenhum inversor nesta categoria</p>
          <p className="text-sm mt-1">Tudo certo por aqui!</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={(c) => toggleAll(!!c)} /></TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Pot. (kW)</TableHead>
                  <TableHead className="text-right">Efic.</TableHead>
                  <TableHead className="text-right">Garantia</TableHead>
                  <TableHead className="text-center">MPPTs</TableHead>
                  <TableHead className="text-center">Datasheet</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((inv) => {
                  const status = auditStatusMap[inv.id]?.audit_status || "pendente";
                  return (
                    <TableRow key={inv.id} className={selected.has(inv.id) ? "bg-muted/50" : ""}>
                      <TableCell><Checkbox checked={selected.has(inv.id)} onCheckedChange={(c) => toggleOne(inv.id, !!c)} /></TableCell>
                      <TableCell className="font-medium">{inv.fabricante}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inv.modelo}</TableCell>
                      <TableCell className="text-right tabular-nums">{inv.potencia_nominal_kw ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{inv.eficiencia_max_percent ? `${inv.eficiencia_max_percent}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{inv.garantia_anos ? `${inv.garantia_anos}a` : <span className="text-destructive">—</span>}</TableCell>
                      <TableCell className="text-center">{inv.mppt_count ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        {inv.datasheet_url ? (
                          <a href={inv.datasheet_url} target="_blank" rel="noreferrer" className="inline-flex text-info hover:underline"><ExternalLink className="w-4 h-4" /></a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status === "enriquecido" ? "default" : status === "pendente_datasheet" ? "secondary" : "outline"} className="text-xs">
                          {status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length > 200 && (
              <div className="text-center py-3 text-xs text-muted-foreground border-t">Mostrando 200 de {filtered.length}. Refine a busca para ver mais.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
