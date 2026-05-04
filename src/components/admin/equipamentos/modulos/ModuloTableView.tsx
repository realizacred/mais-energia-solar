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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui-kit/TablePagination";
import { supabase } from "@/integrations/supabase/client";
import { useEnrichEquipmentBatch } from "@/hooks/useEnrichEquipment";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { calcCompletude } from "@/utils/calcCompletude";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";

type SortKey = "fabricante" | "modelo" | "potencia_wp" | "tipo_celula" | "num_celulas" | "eficiencia_percent" | "status" | "completude";
type SortDir = "asc" | "desc";

interface Props {
  modulos: Modulo[];
  onView: (m: Modulo) => void;
  onEdit: (m: Modulo) => void;
  onDelete: (m: Modulo) => void;
  onToggle: (id: string, ativo: boolean) => void;
}

function isGlobal(m: Modulo) {
  return m.tenant_id === null;
}

export function ModuloTableView({ modulos, onView, onEdit, onDelete, onToggle }: Props) {
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

  // Reset page when modulos change (filters)
  const modulosKey = modulos.length;
  const [prevKey, setPrevKey] = useState(modulosKey);
  if (modulosKey !== prevKey) {
    setPrevKey(modulosKey);
    setCurrentPage(1);
    setSelectedIds(new Set());
  }

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const completudeMap = useMemo(() => {
    const map = new Map<string, number>();
    modulos.forEach(m => map.set(m.id, calcCompletude(m)));
    return map;
  }, [modulos]);

  const sorted = useMemo(() => {
    return [...modulos].sort((a, b) => {
      if (sortKey === "completude") {
        const av = completudeMap.get(a.id) ?? 0;
        const bv = completudeMap.get(b.id) ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [modulos, sortKey, sortDir, completudeMap]);

  // Pagination
  const totalPages = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length, pageSize]);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize), [sorted, safeCurrentPage, pageSize]);

  // Selection
  const allPageSelected = paginated.length > 0 && paginated.every(m => selectedIds.has(m.id));
  const somePageSelected = paginated.some(m => selectedIds.has(m.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allPageSelected) {
      paginated.forEach(m => next.delete(m.id));
    } else {
      paginated.forEach(m => next.add(m.id));
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  // Bulk actions
  const handleBulkToggle = async (ativo: boolean) => {
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id =>
        supabase.from("modulos_solares").update({ ativo }).eq("id", id)
      ));
      queryClient.invalidateQueries({ queryKey: ["modulos-solares"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} módulos ${ativo ? "ativados" : "desativados"}` });
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkEnrich = () => {
    const ids = Array.from(selectedIds);
    enrichBatch.mutate(
      { equipment_type: "modulo", ids },
      { onSuccess: () => setSelectedIds(new Set()) },
    );
  };

  const handleInlineSave = async (id: string, field: "potencia_wp" | "eficiencia_percent", rawValue: string) => {
    const val = parseFloat(rawValue);
    if (isNaN(val)) { setEditingCell(null); return; }
    if (field === "potencia_wp" && (val < 50 || val > 1000)) {
      toast({ title: "Potência deve ser entre 50 e 1000 W", variant: "destructive" }); return;
    }
    if (field === "eficiencia_percent" && (val < 10 || val > 30)) {
      toast({ title: "Eficiência deve ser entre 10% e 30%", variant: "destructive" }); return;
    }
    const { error } = await supabase.from("modulos_solares").update({ [field]: val }).eq("id", id);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["modulos-solares"] });
    toast({ title: field === "potencia_wp" ? "Potência atualizada" : "Eficiência atualizada" });
    setEditingCell(null);
  };

  const exportCSV = useCallback(() => {
    const headers = ["Fabricante", "Modelo", "Potência(W)", "Tipo", "Células", "Eficiência(%)", "Status", "Bifacial", "Vmp", "Imp", "Voc", "Isc"];
    const rows = sorted.map(m => [
      m.fabricante, m.modelo, m.potencia_wp, m.tipo_celula,
      m.num_celulas ?? "", m.eficiencia_percent ?? "",
      m.status, m.bifacial ? "Sim" : "Não",
      m.vmp_v ?? "", m.imp_a ?? "", m.voc_v ?? "", m.isc_a ?? "",
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modulos_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

  function SortHeader({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
        <span className="flex items-center gap-1">
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </span>
      </TableHead>
    );
  }

  function InlineCell({ m, field, display }: { m: Modulo; field: "potencia_wp" | "eficiencia_percent"; display: string }) {
    const isEditing = editingCell?.id === m.id && editingCell?.field === field;
    if (isEditing) {
      return (
        <Input autoFocus type="number" step="0.01" className="w-[80px] h-7 text-xs" value={editingCell.value}
          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") handleInlineSave(m.id, field, editingCell.value); if (e.key === "Escape") setEditingCell(null); }}
          onBlur={() => handleInlineSave(m.id, field, editingCell.value)}
        />
      );
    }
    return (
      <span className="group/cell cursor-pointer flex items-center gap-1" onDoubleClick={() => setEditingCell({ id: m.id, field, value: String((m as any)[field] ?? "") })}>
        {display}
        <Pencil className="w-3 h-3 opacity-0 group-hover/cell:opacity-40 transition-opacity" />
      </span>
    );
  }

  return (
    <div className="space-y-2">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} módulo{selectedIds.size > 1 ? "s" : ""} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(true)}>
              Ativar
            </Button>
            <Button variant="outline" size="sm" disabled={bulkLoading} onClick={() => handleBulkToggle(false)}>
              Desativar
            </Button>
            <Button variant="outline" size="sm" className="gap-1" disabled={enrichBatch.isPending} onClick={handleBulkEnrich}>
              {enrichBatch.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Buscar specs IA
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table className="text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = somePageSelected && !allPageSelected;
                    }
                  }}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <SortHeader label="Fabricante" field="fabricante" />
              <SortHeader label="Modelo" field="modelo" />
              <SortHeader label="Potência" field="potencia_wp" />
              <SortHeader label="Tipo" field="tipo_celula" />
              <SortHeader label="Células" field="num_celulas" />
              <SortHeader label="Efic.%" field="eficiencia_percent" />
              
              <SortHeader label="Status" field="status" />
              <SortHeader label="Completude" field="completude" />
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(m => {
              const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;
              const global = isGlobal(m);
              const comp = completudeMap.get(m.id) ?? 0;
              return (
                <TableRow key={m.id} className={`${selectedIds.has(m.id) ? "bg-primary/5" : ""} ${!m.ativo ? "opacity-50" : ""}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(m.id)}
                      onCheckedChange={() => toggleOne(m.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{m.fabricante}</TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs" title={m.modelo}>{m.modelo}</TableCell>
                  <TableCell className="text-xs"><InlineCell m={m} field="potencia_wp" display={`${m.potencia_wp}W`} /></TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{m.tipo_celula}</TableCell>
                  <TableCell className="text-xs">{m.num_celulas || "—"}</TableCell>
                  <TableCell className="text-xs"><InlineCell m={m} field="eficiencia_percent" display={m.eficiencia_percent ? `${m.eficiencia_percent}%` : "—"} /></TableCell>
                  
                  <TableCell><Badge className={`text-2xs px-1.5 py-0 ${statusInfo.color}`}>{statusInfo.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-[70px]">
                      <Progress value={comp} className="h-1.5 flex-1" />
                      <span className={`text-2xs font-medium tabular-nums ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>
                        {comp}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {global ? (
                      <Badge variant="secondary" className="gap-0.5 text-2xs px-1.5 py-0">
                        <Globe className="w-2.5 h-2.5" /> Global
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-0.5 text-2xs px-1.5 py-0">
                        <Building2 className="w-2.5 h-2.5" /> Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Switch checked={m.ativo}
                        onCheckedChange={(v) => onToggle(m.id, v)} />
                      <span className={`text-2xs font-medium ${m.ativo ? "text-success" : "text-muted-foreground"}`}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <EnrichButton equipmentType="modulo" equipmentId={m.id} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(m)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(m)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => onDelete(m)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        totalItems={sorted.length}
        page={safeCurrentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
        pageSizeOptions={[10, 25, 50, 100]}
      />
    </div>
  );
}
