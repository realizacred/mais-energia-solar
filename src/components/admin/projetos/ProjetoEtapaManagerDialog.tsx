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
  );
}
