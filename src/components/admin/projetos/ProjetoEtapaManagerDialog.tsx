import { useState } from "react";
import { Layers, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ProjetoEtapaManager } from "./ProjetoEtapaManager";
import { ProjetoAutomacaoConfig } from "./ProjetoAutomacaoConfig";
import type { Pipeline, PipelineStage } from "@/hooks/useDealPipeline";

interface Props {
  pipeline: Pipeline | null;
  stages: PipelineStage[];
  allPipelines: Pipeline[];
  onClose: () => void;
  onCreateStage: (pipelineId: string, name: string, categoria?: string) => Promise<any>;
  onRenameStage: (stageId: string, name: string) => Promise<any>;
  onReorderStages: (funilId: string, orderedIds: string[]) => void;
  onDeleteStage: (stageId: string) => Promise<any>;
  onDeletePipeline: (id: string, moveDealsTo?: string) => Promise<boolean>;
}

export function ProjetoEtapaManagerDialog({
  pipeline,
  stages,
  allPipelines,
  onClose,
  onCreateStage,
  onRenameStage,
  onReorderStages,
  onDeleteStage,
  onDeletePipeline,
}: Props) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealCount, setDealCount] = useState<number | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  if (!pipeline) return null;

  const pipelineStages = stages
    .filter(s => s.pipeline_id === pipeline.id)
    .sort((a, b) => a.position - b.position);

  const handleDeleteClick = async () => {
    // Check deal count
    const { count, error } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", pipeline.id);

    setDealCount(error ? 0 : (count || 0));
    if (allPipelines.length > 0) {
      setMoveTarget(allPipelines[0].id);
    }
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    const hasDeals = (dealCount || 0) > 0;
    const success = await onDeletePipeline(pipeline.id, hasDeals ? moveTarget : undefined);
    setDeleting(false);
    if (success) {
      setDeleteDialogOpen(false);
      onClose();
    }
  };

  return (
    <>
      <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="w-[90vw] max-w-[1100px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Etapas do funil "{pipeline.name}"
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gerencie as etapas do funil. Arraste para reordenar.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Deletar funil
            </Button>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 max-h-[70vh]">
            <ProjetoEtapaManager
              funilId={pipeline.id}
              funilNome={pipeline.name}
              etapas={pipelineStages.map(s => ({
                id: s.id,
                funil_id: s.pipeline_id,
                nome: s.name,
                cor: s.is_won ? "hsl(var(--success))" : s.is_closed ? "hsl(var(--destructive))" : "hsl(var(--info))",
                ordem: s.position,
                categoria: (s.is_won ? "ganho" : s.is_closed ? "perdido" : "aberto") as any,
                tenant_id: s.tenant_id,
              }))}
              onCreate={onCreateStage}
              onRename={onRenameStage}
              onUpdateCor={() => {}}
              onUpdateCategoria={() => {}}
              onReorder={onReorderStages}
              onDelete={onDeleteStage}
            />
            <Separator />
            <ProjetoAutomacaoConfig
              pipelineId={pipeline.id}
              stages={pipelineStages.map(s => ({ id: s.id, name: s.name, position: s.position }))}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar funil "{pipeline.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {(dealCount || 0) > 0 ? (
                <>
                  Este funil tem <strong>{dealCount}</strong> {dealCount === 1 ? "projeto vinculado" : "projetos vinculados"}.
                  Selecione um funil para mover os projetos antes de deletar.
                </>
              ) : (
                "Este funil não tem projetos vinculados. Ao deletar, todas as etapas serão removidas. Esta ação não pode ser desfeita."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(dealCount || 0) > 0 && allPipelines.length > 0 && (
            <div className="space-y-2 py-2">
              <label className="text-sm font-medium text-foreground">
                Mover projetos para:
              </label>
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um funil..." />
                </SelectTrigger>
                <SelectContent>
                  {allPipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(dealCount || 0) > 0 && allPipelines.length === 0 && (
            <p className="text-sm text-destructive py-2">
              Não há outros funis ativos para mover os projetos. Crie outro funil primeiro.
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting || ((dealCount || 0) > 0 && (!moveTarget || allPipelines.length === 0))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deletando..." : (dealCount || 0) > 0 ? "Mover projetos e deletar" : "Deletar funil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
