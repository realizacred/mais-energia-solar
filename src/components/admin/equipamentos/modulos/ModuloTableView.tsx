import { useState, useMemo, useCallback } from "react";
import { Search, Globe, Building2, Trash2, Pencil, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Modulo } from "./types";
import { STATUS_LABELS } from "./types";

type SortKey = "fabricante" | "modelo" | "potencia_wp" | "tipo_celula" | "num_celulas" | "eficiencia_percent" | "tensao_sistema" | "status";
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

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const sorted = useMemo(() => {
    return [...modulos].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [modulos, sortKey, sortDir]);

  const exportCSV = useCallback(() => {
    const headers = ["Fabricante", "Modelo", "Potência(W)", "Tipo", "Células", "Eficiência(%)", "Tensão", "Status", "Bifacial", "Vmp", "Imp", "Voc", "Isc"];
    const rows = modulos.map(m => [
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
  }, [modulos]);

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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Fabricante" field="fabricante" />
              <SortHeader label="Modelo" field="modelo" />
              <SortHeader label="Potência" field="potencia_wp" />
              <SortHeader label="Tipo" field="tipo_celula" />
              <SortHeader label="Células" field="num_celulas" />
              <SortHeader label="Efic.%" field="eficiencia_percent" />
              <SortHeader label="Tensão" field="tensao_sistema" />
              <SortHeader label="Status" field="status" />
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(m => {
              const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.rascunho;
              const global = isGlobal(m);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{m.potencia_wp}W</Badge></TableCell>
                  <TableCell className="text-xs">{m.tipo_celula}</TableCell>
                  <TableCell className="text-xs">{m.num_celulas || "—"}</TableCell>
                  <TableCell>{m.eficiencia_percent ? `${m.eficiencia_percent}%` : "—"}</TableCell>
                  <TableCell className="text-xs">{m.tensao_sistema || "—"}</TableCell>
                  <TableCell><Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge></TableCell>
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
                      <span className={`text-xs font-medium ${m.ativo ? "text-green-600" : "text-muted-foreground"}`}>
                        {m.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
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
    </div>
  );
}
