import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { StageValidationsConfig } from "../projetos/StageValidationsConfig";

export function StageValidationsManager() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ["pipelines_for_validations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["stages_for_validations", selectedPipelineId],
    enabled: !!selectedPipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", selectedPipelineId)
        .order("position");
      if (error) throw error;
      return data;
    },
  });

  if (loadingPipelines) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Selecione o Funil</Label>
          <Select value={selectedPipelineId} onValueChange={(v) => setSelectedPipelineId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um funil" />
            </SelectTrigger>
            <SelectContent>
              {pipelines?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedPipelineId && (
        <div className="pt-4 border-t border-border">
          {loadingStages ? (
            <div className="py-8 text-center text-muted-foreground">Carregando etapas...</div>
          ) : stages && stages.length > 0 ? (
            <StageValidationsConfig 
              pipelineId={selectedPipelineId}
              stages={stages.map(s => ({ id: s.id, name: s.name }))}
            />
          ) : (
            <div className="py-8 text-center text-muted-foreground italic">
              Este funil não possui etapas configuradas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
