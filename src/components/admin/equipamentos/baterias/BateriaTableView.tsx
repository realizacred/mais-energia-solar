import { useState, useMemo, useCallback } from "react";
import { Trash2, Pencil, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { calcCompletudeBateria } from "@/utils/calcCompletudeBateria";
import { Loader2 } from "lucide-react";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  dimensoes_mm: string | null;
  tensao_operacao_v: string | null;
  tensao_carga_v: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  correntes_recomendadas_a: string | null;
  ativo: boolean;
  tenant_id?: string | null;
}

type SortKey = "fabricante" | "modelo" | "tipo_bateria" | "energia_kwh" | "tensao_nominal_v" | "completude";
type SortDir = "asc" | "desc";

interface Props {
  baterias: Bateria[];
  onView: (b: Bateria) => void;
  onEdit: (b: Bateria) => void;
  onDelete: (b: Bateria) => void;
  onToggle: (id: string, ativo: boolean) => void;
}

export function BateriaTableView({ baterias, onView, onEdit, onDelete, onToggle }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("fabricante");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: "energia_kwh"; value: string } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dataKey = baterias.length;
  const [prevKey, setPrevKey] = useState(dataKey);
  if (dataKey !== prevKey) { setPrevKey(dataKey); setCurrentPage(1); setSelectedIds(new Set()); }

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }, [sortKey]);

  const completudeMap = useMemo(() => {
    const map = new Map<string, number>();
    baterias.forEach(b => map.set(b.id, calcCompletudeBateria(b)));
    return map;
  }, [baterias]);

  const sorted = useMemo(() => {
    return [...baterias].sort((a, b) => {
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
  }, [baterias, sortKey, sortDir, completudeMap]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length, pageSize]);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize), [sorted, safeCurrentPage, pageSize]);

  const allPageSelected = paginated.length > 0 && paginated.every(b => selectedIds.has(b.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) paginated.forEach(b => next.delete(b.id));
    else paginated.forEach(b => next.add(b.id));
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
      await Promise.all(ids.map(id => supabase.from("baterias").update({ ativo }).eq("id", id)));
      queryClient.invalidateQueries({ queryKey: ["baterias"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} bateria${ids.length > 1 ? "s" : ""} ${ativo ? "ativada" : "desativada"}${ids.length > 1 ? "s" : ""}` });
    } catch { toast({ title: "Erro ao atualizar", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  const handleInlineSave = async (id: string, field: "energia_kwh", rawValue: string) => {
    const val = parseFloat(rawValue);
    if (isNaN(val)) { setEditingCell(null); return; }
    if (field === "energia_kwh" && (val < 0.1 || val > 500)) {
      toast({ title: "Capacidade deve ser entre 0.1 e 500 kWh", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("baterias").update({ [field]: val }).eq("id", id);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["baterias"] });
    toast({ title: "Capacidade atualizada" });
    setEditingCell(null);
  };

  const exportCSV = useCallback(() => {
    const headers = ["Fabricante", "Modelo", "Tipo", "Capacidade(kWh)", "Tensão Nominal(V)", "Pot. Máx Saída(kW)", "Ativo"];
    const rows = sorted.map(b => [b.fabricante, b.modelo, b.tipo_bateria ?? "", b.energia_kwh ?? "", b.tensao_nominal_v ?? "", b.potencia_max_saida_kw ?? "", b.ativo ? "Sim" : "Não"]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `baterias_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
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

  function InlineCell({ bat }: { bat: Bateria }) {
    const isEditing = editingCell?.id === bat.id && editingCell?.field === "energia_kwh";
    if (isEditing) {
      return (
        <Input
          autoFocus
          type="number"
          step="0.1"
          className="w-[80px] h-7 text-xs"
          value={editingCell.value}
          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") handleInlineSave(bat.id, "energia_kwh", editingCell.value); if (e.key === "Escape") setEditingCell(null); }}
          onBlur={() => handleInlineSave(bat.id, "energia_kwh", editingCell.value)}
        />
      );
    }
    return (
      <span className="group/cell cursor-pointer flex items-center gap-1" onDoubleClick={() => setEditingCell({ id: bat.id, field: "energia_kwh", value: String(bat.energia_kwh ?? "") })}>
        {bat.energia_kwh ? `${bat.energia_kwh} kWh` : "—"}
        <Pencil className="w-3 h-3 opacity-0 group-hover/cell:opacity-40 transition-opacity" />
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} bateria{selectedIds.size > 1 ? "s" : ""} selecionada{selectedIds.size > 1 ? "s" : ""}</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(true)}>Ativar</Button>
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(false)}>Desativar</Button>
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
              <SortHeader label="Tipo" field="tipo_bateria" />
              <SortHeader label="Capacidade" field="energia_kwh" />
              <SortHeader label="Tensão (V)" field="tensao_nominal_v" />
              <SortHeader label="Completude" field="completude" />
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(bat => {
              const comp = completudeMap.get(bat.id) ?? 0;
              return (
                <TableRow key={bat.id} className={`${selectedIds.has(bat.id) ? "bg-primary/5" : ""} ${!bat.ativo ? "opacity-50" : ""}`}>
                  <TableCell><Checkbox checked={selectedIds.has(bat.id)} onCheckedChange={() => toggleOne(bat.id)} /></TableCell>
                  <TableCell className="font-medium">{bat.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{bat.modelo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
                      {bat.tipo_bateria || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell><InlineCell bat={bat} /></TableCell>
                  <TableCell className="text-xs tabular-nums">{bat.tensao_nominal_v ? `${bat.tensao_nominal_v} V` : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Progress value={comp} className="h-1.5 flex-1" />
                      <span className={`text-xs font-medium tabular-nums ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>{comp}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={bat.ativo} onCheckedChange={(v) => onToggle(bat.id, v)} />
                      <span className={`text-xs font-medium ${bat.ativo ? "text-success" : "text-muted-foreground"}`}>{bat.ativo ? "Ativo" : "Inativo"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(bat)}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(bat)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(bat)}><Trash2 className="w-4 h-4" /></Button>
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
