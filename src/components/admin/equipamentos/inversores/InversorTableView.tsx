import { useState, useMemo, useCallback } from "react";
import { Globe, Building2, Trash2, Pencil, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { EnrichButton } from "../shared/EnrichButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useEnrichEquipmentBatch } from "@/hooks/useEnrichEquipment";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { calcCompletudeInversor } from "@/utils/calcCompletudeInversor";
import type { Inversor } from "@/hooks/useInversoresCatalogo";

type SortKey = "fabricante" | "modelo" | "potencia_nominal_kw" | "tipo" | "fases" | "mppt_count" | "eficiencia_max_percent" | "status" | "completude";
type SortDir = "asc" | "desc";

interface Props {
  inversores: Inversor[];
  onEdit: (i: Inversor) => void;
  onDelete: (i: Inversor) => void;
  onToggle: (id: string, ativo: boolean) => void;
}

function isGlobal(i: Inversor) { return i.tenant_id === null; }

const formatPotencia = (kw: number) => kw < 1 ? `${(kw * 1000).toFixed(0)} W` : `${kw} kW`;

export function InversorTableView({ inversores, onEdit, onDelete, onToggle }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fabricante");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: "potencia_nominal_kw" | "eficiencia_max_percent"; value: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const enrichBatch = useEnrichEquipmentBatch();

  const modulosKey = inversores.length;
  const [prevKey, setPrevKey] = useState(modulosKey);
  if (modulosKey !== prevKey) { setPrevKey(modulosKey); setCurrentPage(1); setSelectedIds(new Set()); }

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const completudeMap = useMemo(() => {
    const map = new Map<string, number>();
    inversores.forEach(i => map.set(i.id, calcCompletudeInversor(i)));
    return map;
  }, [inversores]);

  const sorted = useMemo(() => {
    return [...inversores].sort((a, b) => {
      if (sortKey === "completude") {
        const av = completudeMap.get(a.id) ?? 0;
        const bv = completudeMap.get(b.id) ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = (a as any)[sortKey];
      const bv = (b as any)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [inversores, sortKey, sortDir, completudeMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const allPageSelected = paginated.length > 0 && paginated.every(i => selectedIds.has(i.id));
  const somePageSelected = paginated.some(i => selectedIds.has(i.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) paginated.forEach(i => next.delete(i.id));
    else paginated.forEach(i => next.add(i.id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkToggle = async (ativo: boolean) => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => supabase.from("inversores_catalogo").update({ ativo }).eq("id", id)));
      queryClient.invalidateQueries({ queryKey: ["inversores-catalogo"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} inversores ${ativo ? "ativados" : "desativados"}` });
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  const handleBulkEnrich = () => {
    enrichBatch.mutate({ equipment_type: "inversor", ids: Array.from(selectedIds) }, { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleInlineSave = async (id: string, field: "potencia_nominal_kw" | "eficiencia_max_percent", rawValue: string) => {
    const val = parseFloat(rawValue);
    if (isNaN(val)) { setEditingCell(null); return; }
    if (field === "potencia_nominal_kw" && (val < 0.3 || val > 10000)) {
      toast({ title: "Potência deve ser entre 0.3 e 10000 kW", variant: "destructive" }); return;
    }
    if (field === "eficiencia_max_percent" && (val < 90 || val > 99.9)) {
      toast({ title: "Eficiência deve ser entre 90% e 99.9%", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("inversores_catalogo").update({ [field]: val }).eq("id", id);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["inversores-catalogo"] });
    toast({ title: field === "potencia_nominal_kw" ? "Potência atualizada" : "Eficiência atualizada" });
    setEditingCell(null);
  };

  const exportCSV = useCallback(() => {
    const headers = ["Fabricante", "Modelo", "Potência(kW)", "Tipo", "Fases", "MPPTs", "Eficiência(%)", "Garantia(anos)", "Status"];
    const rows = sorted.map(i => [i.fabricante, i.modelo, i.potencia_nominal_kw, i.tipo, i.fases, i.mppt_count ?? "", i.eficiencia_max_percent ?? "", i.garantia_anos ?? "", i.status]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `inversores_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }, [sorted]);

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
        <span className="flex items-center gap-1">{label}
          {active ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
        </span>
      </TableHead>
    );
  }

  function InlineCell({ inv, field, display, range }: { inv: Inversor; field: "potencia_nominal_kw" | "eficiencia_max_percent"; display: string; range: [number, number] }) {
    const isEditing = editingCell?.id === inv.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input
          autoFocus
          type="number"
          step="0.01"
          className="w-[80px] h-7 text-xs"
          value={editingCell.value}
          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") handleInlineSave(inv.id, field, editingCell.value); if (e.key === "Escape") setEditingCell(null); }}
          onBlur={() => handleInlineSave(inv.id, field, editingCell.value)}
        />
      );
    }
    return (
      <span className="group/cell cursor-pointer flex items-center gap-1" onDoubleClick={() => setEditingCell({ id: inv.id, field, value: String((inv as any)[field] ?? "") })}>
        {display}
        <Pencil className="w-3 h-3 opacity-0 group-hover/cell:opacity-40 transition-opacity" />
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} inversor{selectedIds.size > 1 ? "es" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(true)}>Ativar</Button>
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(false)}>Desativar</Button>
            <Button variant="outline" size="sm" className="gap-1" disabled={enrichBatch.isPending} onClick={handleBulkEnrich}>
              {enrichBatch.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Buscar specs IA
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}><Download className="w-4 h-4" /> Exportar CSV</Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"><Checkbox checked={allPageSelected} onCheckedChange={toggleAll} /></TableHead>
              <SortHeader label="Fabricante" field="fabricante" />
              <SortHeader label="Modelo" field="modelo" />
              <SortHeader label="Potência" field="potencia_nominal_kw" />
              <SortHeader label="Tipo" field="tipo" />
              <SortHeader label="Fases" field="fases" />
              <SortHeader label="MPPTs" field="mppt_count" />
              <SortHeader label="Efic.%" field="eficiencia_max_percent" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Completude" field="completude" />
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(inv => {
              const global = isGlobal(inv);
              const comp = completudeMap.get(inv.id) ?? 0;
              const statusColor = inv.status === "publicado" ? "bg-success/10 text-success border-success/20" : inv.status === "revisao" ? "bg-info/10 text-info border-info/20" : "bg-warning/10 text-warning border-warning/20";
              const statusLabel = inv.status === "publicado" ? "Publicado" : inv.status === "revisao" ? "Revisão" : "Rascunho";
              return (
                <TableRow key={inv.id} className={`${selectedIds.has(inv.id) ? "bg-primary/5" : ""} ${!inv.ativo ? "opacity-50" : ""}`}>
                  <TableCell><Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} /></TableCell>
                  <TableCell className="font-medium">{inv.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{inv.modelo}</TableCell>
                  <TableCell>
                    <InlineCell inv={inv} field="potencia_nominal_kw" display={formatPotencia(inv.potencia_nominal_kw)} range={[0.3, 10000]} />
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{inv.tipo}</Badge></TableCell>
                  <TableCell className="text-xs">{inv.fases}</TableCell>
                  <TableCell className="text-xs">{inv.mppt_count || "—"}</TableCell>
                  <TableCell>
                    <InlineCell inv={inv} field="eficiencia_max_percent" display={inv.eficiencia_max_percent ? `${inv.eficiencia_max_percent}%` : "—"} range={[90, 99.9]} />
                  </TableCell>
                  <TableCell><Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Progress value={comp} className="h-1.5 flex-1" />
                      <span className={`text-xs font-medium tabular-nums ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>{comp}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {global ? <Badge variant="secondary" className="gap-1 text-xs"><Globe className="w-3 h-3" /> Global</Badge>
                      : <Badge variant="default" className="gap-1 text-xs"><Building2 className="w-3 h-3" /> Custom</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={inv.ativo} onCheckedChange={(v) => onToggle(inv.id, v)} />
                      <span className={`text-xs font-medium ${inv.ativo ? "text-success" : "text-muted-foreground"}`}>{inv.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EnrichButton equipmentType="inversor" equipmentId={inv.id} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(inv)}><Pencil className="w-4 h-4" /></Button>
                      {!global && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(inv)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="w-[70px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem><SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{sorted.length} resultado{sorted.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)}>«</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>‹</Button>
          <span className="text-xs text-muted-foreground px-2">Página {safeCurrentPage} de {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</Button>
        </div>
      </div>
    </div>
  );
}
