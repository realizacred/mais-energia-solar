/**
 * EditDistributionModal — Edita percentuais de rateio GD em lote.
 * §25: Modal padrão. RB-07: w-[90vw].
 */
import { useState, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Loader2, PieChart, Sun, Users } from "lucide-react";
import { useSaveGdBeneficiary, type GdBeneficiary } from "@/hooks/useGdBeneficiaries";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { UCOption } from "@/hooks/useFormSelects";

interface EditDistributionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  generatorName: string;
  beneficiaries: GdBeneficiary[];
  allUcs: UCOption[];
}

interface EditableRow {
  id: string;
  ucId: string;
  ucName: string;
  codigoUc: string;
  percent: string;
  original: number;
}

export function EditDistributionModal({
  open,
  onOpenChange,
  groupId,
  groupName,
  generatorName,
  beneficiaries,
  allUcs,
}: EditDistributionModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const saveBeneficiary = useSaveGdBeneficiary();
  const [saving, setSaving] = useState(false);

  const ucMap = useMemo(() => new Map(allUcs.map((u) => [u.id, u])), [allUcs]);

  const [rows, setRows] = useState<EditableRow[]>([]);

  // Sync rows from beneficiaries whenever modal opens or beneficiaries change while open
  useEffect(() => {
    if (!open) return;
    setRows(
      beneficiaries.map((b) => {
        const uc = ucMap.get(b.uc_beneficiaria_id);
        return {
          id: b.id,
          ucId: b.uc_beneficiaria_id,
          ucName: uc?.nome || "UC desconhecida",
          codigoUc: uc?.codigo_uc || "—",
          percent: String(Number(b.allocation_percent)),
          original: Number(b.allocation_percent),
        };
      })
    );
  }, [open, beneficiaries, ucMap]);

  const handlePercentChange = (index: number, value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, percent: value } : r)));
  };

  const parsedRows = rows.map((r) => {
    const val = parseFloat(r.percent);
    return { ...r, numericPercent: isNaN(val) ? 0 : val };
  });

  const totalAllocated = parsedRows.reduce((sum, r) => sum + r.numericPercent, 0);
  const generatorRetained = Math.max(0, 100 - totalAllocated);
  const isOverLimit = totalAllocated > 100;
  const hasNegative = parsedRows.some((r) => r.numericPercent < 0);
  const hasChanges = parsedRows.some((r) => Math.abs(r.numericPercent - r.original) > 0.001);
  const canSave = hasChanges && !isOverLimit && !hasNegative && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      for (const row of parsedRows) {
        if (Math.abs(row.numericPercent - row.original) > 0.001) {
          await saveBeneficiary.mutateAsync({
            id: row.id,
            allocation_percent: Math.round(row.numericPercent * 100) / 100,
          });
        }
      }
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries", groupId] });
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries"] });
      qc.invalidateQueries({ queryKey: ["gd_groups"] });
      toast({ title: "Distribuição atualizada!", description: "Os percentuais de rateio foram salvos." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <PieChart className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Ajustar distribuição
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Grupo: {groupName} · Geradora: {generatorName}
            </p>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.ucName}</p>
                    <p className="text-xs font-mono text-muted-foreground">{row.codigoUc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={row.percent}
                      onChange={(e) => handlePercentChange(index, e.target.value)}
                      className="w-20 text-right font-mono text-sm h-9"
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}

              {rows.length === 0 && (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                  Nenhuma beneficiária para editar
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Total alocado
                </span>
                <span className={`font-mono font-semibold ${isOverLimit ? "text-destructive" : "text-foreground"}`}>
                  {totalAllocated.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5" /> Saldo na geradora
                </span>
                <span className={`font-mono font-semibold ${isOverLimit ? "text-destructive" : "text-success"}`}>
                  {isOverLimit ? "—" : `${generatorRetained.toFixed(2)}%`}
                </span>
              </div>

              <div className="h-2.5 rounded-full bg-muted overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${isOverLimit ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(totalAllocated, 100)}%` }}
                />
              </div>

              {isOverLimit && (
                <div className="flex items-center gap-2 text-xs text-destructive mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  A soma dos percentuais ultrapassa 100%. Ajuste os valores.
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {saving ? "Salvando..." : "Salvar distribuição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
