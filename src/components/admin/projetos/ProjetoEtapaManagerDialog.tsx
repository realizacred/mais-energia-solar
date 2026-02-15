import { Layers } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjetoEtapaManager } from "./ProjetoEtapaManager";
import { ProjetoAutomacaoConfig } from "./ProjetoAutomacaoConfig";
import type { PipelineStage } from "@/hooks/useDealPipeline";

interface Pipeline {
  id: string;
  name: string;
  is_active: boolean;
  tenant_id: string;
}

interface Props {
  pipeline: Pipeline | null;
  stages: PipelineStage[];
  onClose: () => void;
  onCreateStage: (pipelineId: string, name: string, categoria?: string) => Promise<any>;
  onRenameStage: (stageId: string, name: string) => Promise<any>;
  onReorderStages: (funilId: string, orderedIds: string[]) => void;
  onDeleteStage: (stageId: string) => Promise<any>;
}

export function ProjetoEtapaManagerDialog({
  pipeline,
  stages,
  onClose,
  onCreateStage,
  onRenameStage,
  onReorderStages,
  onDeleteStage,
}: Props) {
  if (!pipeline) return null;

  const pipelineStages = stages
    .filter(s => s.pipeline_id === pipeline.id)
    .sort((a, b) => a.position - b.position);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4.5 w-4.5 text-primary" />
            Etapas do funil "{pipeline.name}"
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Gerencie as etapas do funil. Arraste para reordenar.
          </p>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          <ProjetoEtapaManager
            funilId={pipeline.id}
            funilNome={pipeline.name}
            etapas={pipelineStages.map(s => ({
              id: s.id,
              funil_id: s.pipeline_id,
              nome: s.name,
              cor: s.is_won ? "#10B981" : s.is_closed ? "#EF4444" : "#3B82F6",
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
  );
}
