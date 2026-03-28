import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, GitBranch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsultoresListWithUserId } from "@/hooks/useConsultoresList";
import { useSaveMetaAutomation, useMetaAutomation } from "./useMetaFbConfigs";

interface StepAutomationProps {
  onNext: () => void;
  onBack: () => void;
}

const FIELD_MAPPING_OPTIONS = [
  { key: "nome", label: "Nome do cliente", defaults: ["full_name", "nome", "name"] },
  { key: "email", label: "Email", defaults: ["email", "e-mail"] },
  { key: "telefone", label: "Telefone", defaults: ["phone_number", "telefone", "phone", "whatsapp"] },
  { key: "cidade", label: "Cidade", defaults: ["city", "cidade"] },
  { key: "estado", label: "Estado", defaults: ["state", "estado", "uf"] },
];

export function StepAutomation({ onNext, onBack }: StepAutomationProps) {
  const saveAutomation = useSaveMetaAutomation();
  const { data: existingAutomation, isLoading: loadingAutomation } = useMetaAutomation();

  // Pipelines
  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ["pipelines-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 15,
  });

  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [selectedConsultors, setSelectedConsultors] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = useState(false);

  // Stages for selected pipeline
  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipelineId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!pipelineId,
  });

  // Consultores
  const { data: consultores, isLoading: loadingConsultores } = useConsultoresListWithUserId();

  // Prefill from existing automation
  useEffect(() => {
    if (!existingAutomation) return;
    if (existingAutomation.pipeline_id) setPipelineId(existingAutomation.pipeline_id);
    if (existingAutomation.stage_id) setStageId(existingAutomation.stage_id);
    if (existingAutomation.round_robin && Array.isArray(existingAutomation.round_robin_users)) {
      setSelectedConsultors(existingAutomation.round_robin_users as string[]);
    } else if (existingAutomation.responsible_user_id) {
      setSelectedConsultors([existingAutomation.responsible_user_id]);
    }
    if (existingAutomation.field_mapping && typeof existingAutomation.field_mapping === "object") {
      setFieldMapping(existingAutomation.field_mapping as Record<string, string>);
    }
  }, [existingAutomation]);

  const toggleConsultor = (userId: string) => {
    setSelectedConsultors(prev =>
      prev.includes(userId) ? prev.filter(c => c !== userId) : [...prev, userId]
    );
  };

  const handleActivate = async () => {
    if (!pipelineId || !stageId || selectedConsultors.length === 0) {
      toast.error("Preencha funil, etapa e pelo menos um responsável.");
      return;
    }

    const isRoundRobin = selectedConsultors.length > 1;

    try {
      await saveAutomation.mutateAsync({
        pipeline_id: pipelineId,
        stage_id: stageId,
        responsible_user_id: isRoundRobin ? null : selectedConsultors[0],
        round_robin: isRoundRobin,
        round_robin_users: isRoundRobin ? selectedConsultors : [],
        field_mapping: fieldMapping,
      });
      toast.success("Automação ativada ✅");
      onNext();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isLoading = loadingPipelines || loadingConsultores || loadingAutomation;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pipeline */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Funil</Label>
        <p className="text-[11px] text-muted-foreground">Para qual funil os leads do Facebook irão</p>
        <Select value={pipelineId} onValueChange={(v) => { setPipelineId(v); setStageId(""); }}>
          <SelectTrigger><SelectValue placeholder="Selecionar funil..." /></SelectTrigger>
          <SelectContent>
            {pipelines?.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Etapa inicial</Label>
        <p className="text-[11px] text-muted-foreground">Em qual etapa o lead será criado</p>
        <Select value={stageId} onValueChange={setStageId} disabled={!pipelineId}>
          <SelectTrigger><SelectValue placeholder={pipelineId ? "Selecionar etapa..." : "Selecione um funil primeiro"} /></SelectTrigger>
          <SelectContent>
            {loadingStages ? (
              <div className="p-2"><Skeleton className="h-6 w-full" /></div>
            ) : (
              stages?.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Consultores */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Responsável pelos leads</Label>
          <p className="text-[11px] text-muted-foreground">
            Selecione 1 para fixo, ou 2+ para rodízio automático
          </p>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {consultores?.map((c) => (
            <label key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox
                checked={selectedConsultors.includes(c.user_id || c.id)}
                onCheckedChange={() => toggleConsultor(c.user_id || c.id)}
              />
              <span className="text-sm text-foreground">{c.nome}</span>
            </label>
          ))}
        </div>

        {selectedConsultors.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
            {selectedConsultors.length === 1 ? (
              <>
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-foreground">
                  Todos os leads irão para <strong>{consultores?.find(c => (c.user_id || c.id) === selectedConsultors[0])?.nome || "—"}</strong>
                </span>
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs text-foreground">
                  Leads em rodízio entre <strong>{selectedConsultors.length}</strong> consultores
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Field Mapping (collapsible) */}
      <Collapsible open={showMapping} onOpenChange={setShowMapping}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-primary">
            {showMapping ? "▾" : "▸"} Mapeamento de campos (opcional)
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <p className="text-[11px] text-muted-foreground">
            Defina quais campos do formulário do Facebook correspondem a cada campo do CRM.
            Deixe em branco para usar o padrão.
          </p>
          {FIELD_MAPPING_OPTIONS.map(({ key, label, defaults }) => (
            <div key={key} className="flex items-center gap-3">
              <Label className="text-xs w-24 shrink-0">{label}</Label>
              <Select
                value={fieldMapping[key] || ""}
                onValueChange={(v) => setFieldMapping(prev => ({ ...prev, [key]: v }))}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder={`Padrão: ${defaults[0]}`} />
                </SelectTrigger>
                <SelectContent>
                  {defaults.map(d => (
                    <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>Voltar</Button>
        <Button
          onClick={handleActivate}
          disabled={!pipelineId || !stageId || selectedConsultors.length === 0 || saveAutomation.isPending}
        >
          {saveAutomation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Ativar automação
        </Button>
      </div>
    </div>
  );
}
