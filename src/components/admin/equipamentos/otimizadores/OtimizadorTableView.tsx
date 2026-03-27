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
import { calcCompletudeOtimizador } from "@/utils/calcCompletudeOtimizador";
import type { Otimizador } from "@/hooks/useOtimizadoresCatalogo";

type SortKey = "fabricante" | "modelo" | "potencia_wp" | "tensao_entrada_max_v" | "tensao_saida_v" | "eficiencia_percent" | "status" | "completude";
type SortDir = "asc" | "desc";

interface Props {
  otimizadores: Otimizador[];
  onView?: (o: Otimizador) => void;
  onEdit: (o: Otimizador) => void;
  onDelete: (o: Otimizador) => void;
  onToggle: (id: string, ativo: boolean) => void;
}

function isGlobal(o: Otimizador) { return o.tenant_id === null; }

export function OtimizadorTableView({ otimizadores, onView, onEdit, onDelete, onToggle }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fabricante");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: "potencia_wp" | "eficiencia_percent"; value: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const enrichBatch = useEnrichEquipmentBatch();

  const itemsKey = otimizadores.length;
  const [prevKey, setPrevKey] = useState(itemsKey);
  if (itemsKey !== prevKey) { setPrevKey(itemsKey); setCurrentPage(1); setSelectedIds(new Set()); }

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const completudeMap = useMemo(() => {
    const map = new Map<string, number>();
    otimizadores.forEach(o => map.set(o.id, calcCompletudeOtimizador(o)));
    return map;
  }, [otimizadores]);

  const sorted = useMemo(() => {
    return [...otimizadores].sort((a, b) => {
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
  }, [otimizadores, sortKey, sortDir, completudeMap]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const allPageSelected = paginated.length > 0 && paginated.every(o => selectedIds.has(o.id));
  const somePageSelected = paginated.some(o => selectedIds.has(o.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) paginated.forEach(o => next.delete(o.id));
    else paginated.forEach(o => next.add(o.id));
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
      await Promise.all(ids.map(id => supabase.from("otimizadores_catalogo").update({ ativo }).eq("id", id)));
      queryClient.invalidateQueries({ queryKey: ["otimizadores-catalogo"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} otimizadores ${ativo ? "ativados" : "desativados"}` });
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  const handleBulkEnrich = () => {
    enrichBatch.mutate({ equipment_type: "otimizador", ids: Array.from(selectedIds) }, { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleInlineSave = async (id: string, field: "potencia_wp" | "eficiencia_percent", rawValue: string) => {
    const val = parseFloat(rawValue);
    if (isNaN(val)) { setEditingCell(null); return; }
    if (field === "potencia_wp" && (val < 10 || val > 800)) {
      toast({ title: "Potência deve ser entre 10 e 800 W", variant: "destructive" }); return;
    }
    if (field === "eficiencia_percent" && (val < 80 || val > 99)) {
      toast({ title: "Eficiência deve ser entre 80% e 99%", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("otimizadores_catalogo").update({ [field]: val }).eq("id", id);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["otimizadores-catalogo"] });
    toast({ title: field === "potencia_wp" ? "Potência atualizada" : "Eficiência atualizada" });
    setEditingCell(null);
  };

  const exportCSV = useCallback(() => {
    const headers = ["Fabricante", "Modelo", "Potência(W)", "Tensão Ent.(V)", "Tensão Saída(V)", "Eficiência(%)", "Status"];
    const rows = sorted.map(o => [o.fabricante, o.modelo, o.potencia_wp ?? "", o.tensao_entrada_max_v ?? "", o.tensao_saida_v ?? "", o.eficiencia_percent ?? "", o.status]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `otimizadores_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
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

  function InlineCell({ ot, field, display }: { ot: Otimizador; field: "potencia_wp" | "eficiencia_percent"; display: string }) {
    const isEditing = editingCell?.id === ot.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input autoFocus type="number" step="0.01" className="w-[80px] h-7 text-xs" value={editingCell.value}
          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") handleInlineSave(ot.id, field, editingCell.value); if (e.key === "Escape") setEditingCell(null); }}
          onBlur={() => handleInlineSave(ot.id, field, editingCell.value)}
        />
      );
    }
    return (
      <span className="group/cell cursor-pointer flex items-center gap-1" onDoubleClick={() => setEditingCell({ id: ot.id, field, value: String((ot as any)[field] ?? "") })}>
        {display}
        <Pencil className="w-3 h-3 opacity-0 group-hover/cell:opacity-40 transition-opacity" />
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} otimizador{selectedIds.size > 1 ? "es" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
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
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px]"><Checkbox checked={allPageSelected} onCheckedChange={toggleAll} /></TableHead>
              <SortHeader label="Fabricante" field="fabricante" />
              <SortHeader label="Modelo" field="modelo" />
              <SortHeader label="Potência" field="potencia_wp" />
              <SortHeader label="Tensão Ent." field="tensao_entrada_max_v" />
              <SortHeader label="Tensão Saída" field="tensao_saida_v" />
              <SortHeader label="Efic.%" field="eficiencia_percent" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Completude" field="completude" />
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(ot => {
              const global = isGlobal(ot);
              const comp = completudeMap.get(ot.id) ?? 0;
              const statusColor = ot.status === "publicado" ? "bg-success/10 text-success border-success/20" : ot.status === "revisao" ? "bg-info/10 text-info border-info/20" : "bg-warning/10 text-warning border-warning/20";
              const statusLabel = ot.status === "publicado" ? "Publicado" : ot.status === "revisao" ? "Revisão" : "Rascunho";
              return (
                <TableRow key={ot.id} className={`${selectedIds.has(ot.id) ? "bg-primary/5" : ""} ${!ot.ativo ? "opacity-50" : ""}`}>
                  <TableCell><Checkbox checked={selectedIds.has(ot.id)} onCheckedChange={() => toggleOne(ot.id)} /></TableCell>
                  <TableCell className="font-medium">{ot.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{ot.modelo}</TableCell>
                  <TableCell>
                    <InlineCell ot={ot} field="potencia_wp" display={ot.potencia_wp ? `${ot.potencia_wp} W` : "—"} />
                  </TableCell>
                  <TableCell className="text-xs">{ot.tensao_entrada_max_v ? `${ot.tensao_entrada_max_v}V` : "—"}</TableCell>
                  <TableCell className="text-xs">{ot.tensao_saida_v ? `${ot.tensao_saida_v}V` : "—"}</TableCell>
                  <TableCell>
                    <InlineCell ot={ot} field="eficiencia_percent" display={ot.eficiencia_percent ? `${ot.eficiencia_percent}%` : "—"} />
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
                      <Switch checked={ot.ativo} onCheckedChange={(v) => onToggle(ot.id, v)} />
                      <span className={`text-xs font-medium ${ot.ativo ? "text-success" : "text-muted-foreground"}`}>{ot.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EnrichButton equipmentType="otimizador" equipmentId={ot.id} />
                      {onView && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(ot)}><Eye className="w-4 h-4" /></Button>}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(ot)}><Pencil className="w-4 h-4" /></Button>
                      {!global && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(ot)}><Trash2 className="w-4 h-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
