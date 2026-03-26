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
import { calcCompletude } from "@/utils/calcCompletude";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";

type SortKey = "fabricante" | "modelo" | "potencia_wp" | "tipo_celula" | "num_celulas" | "eficiencia_percent" | "tensao_sistema" | "status" | "completude";
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
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

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
    const headers = ["Fabricante", "Modelo", "Potência(W)", "Tipo", "Células", "Eficiência(%)", "Tensão", "Status", "Bifacial", "Vmp", "Imp", "Voc", "Isc"];
    const rows = sorted.map(m => [
      m.fabricante, m.modelo, m.potencia_wp, m.tipo_celula,
      m.num_celulas ?? "", m.eficiencia_percent ?? "", m.tensao_sistema ?? "",
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
              <SortHeader label="Tensão" field="tensao_sistema" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Completude" field="completude" />
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map(m => {
              const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;
              const global = isGlobal(m);
              const comp = completudeMap.get(m.id) ?? 0;
              return (
                <TableRow key={m.id} className={selectedIds.has(m.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(m.id)}
                      onCheckedChange={() => toggleOne(m.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{m.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{m.potencia_wp}W</Badge></TableCell>
                  <TableCell className="text-xs">{m.tipo_celula}</TableCell>
                  <TableCell className="text-xs">{m.num_celulas || "—"}</TableCell>
                  <TableCell>{m.eficiencia_percent ? `${m.eficiencia_percent}%` : "—"}</TableCell>
                  <TableCell className="text-xs">{m.tensao_sistema || "—"}</TableCell>
                  <TableCell><Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <Progress value={comp} className="h-1.5 flex-1" />
                      <span className={`text-xs font-medium tabular-nums ${comp >= 80 ? "text-success" : comp >= 60 ? "text-warning" : "text-destructive"}`}>
                        {comp}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {global ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Globe className="w-3 h-3" /> Global
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 text-xs">
                        <Building2 className="w-3 h-3" /> Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={m.ativo}
                        onCheckedChange={(v) => onToggle(m.id, v)} />
                      <span className={`text-xs font-medium ${m.ativo ? "text-success" : "text-muted-foreground"}`}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EnrichButton equipmentType="modulo" equipmentId={m.id} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(m)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {!global && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => onDelete(m)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
            <SelectTrigger className="w-[70px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(1)}>«</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}>‹</Button>
          <span className="text-xs text-muted-foreground px-2">
            Página {safeCurrentPage} de {totalPages}
          </span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}>›</Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={safeCurrentPage >= totalPages}
            onClick={() => setCurrentPage(totalPages)}>»</Button>
        </div>
      </div>
    </div>
  );
}
