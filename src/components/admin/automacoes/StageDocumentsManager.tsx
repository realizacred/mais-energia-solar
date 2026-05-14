import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, FileText, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface StageDoc {
  id: string;
  pipeline_stage_id: string;
  categoria: string;
  label: string;
  obrigatorio: boolean;
}

const CATEGORIES = [
  { value: "rg_cnh", label: "RG/CNH" },
  { value: "conta_luz", label: "Conta de Luz" },
  { value: "iptu", label: "IPTU/Escritura" },
  { value: "parecer", label: "Parecer de Acesso" },
  { value: "homolog", label: "Protocolo Homologação" },
  { value: "art", label: "ART/TRT" },
  { value: "foto_local", label: "Foto do Local" },
  { value: "comprovante_pagamento", label: "Comprovante de Pagamento" },
  { value: "contrato_assinado", label: "Contrato Assinado" },
  { value: "outro", label: "Outro" },
];

export function StageDocumentsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ["pipelines_for_docs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pipelines").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["stages_for_docs", selectedPipelineId],
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

  const { data: requiredDocs, isLoading: loadingDocs } = useQuery({
    queryKey: ["stage_docs", selectedStageId],
    enabled: !!selectedStageId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("etapa_documentos_obrigatorios")
        .select("*")
        .eq("pipeline_stage_id", selectedStageId)
        .order("created_at");
      if (error) throw error;
      return data as StageDoc[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<StageDoc, "id">) => {
      const { tenantId } = await getCurrentTenantId();
      const { data, error } = await supabase
        .from("etapa_documentos_obrigatorios")
        .insert({ ...payload, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage_docs", selectedStageId] });
      toast({ title: "Documento adicionado" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("etapa_documentos_obrigatorios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage_docs", selectedStageId] });
      toast({ title: "Documento removido" });
    },
  });

  const handleAdd = () => {
    if (!selectedStageId) return;
    createMutation.mutate({
      pipeline_stage_id: selectedStageId,
      categoria: "outro",
      label: "Novo Documento",
      obrigatorio: true,
    });
  };

  const updateField = async (id: string, field: keyof StageDoc, value: any) => {
    const { error } = await supabase
      .from("etapa_documentos_obrigatorios")
      .update({ [field]: value })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["stage_docs", selectedStageId] });
    }
  };

  if (loadingPipelines) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Selecione o Funil</Label>
          <Select value={selectedPipelineId} onValueChange={(v) => { setSelectedPipelineId(v); setSelectedStageId(""); }}>
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

        <div className="space-y-2">
          <Label>Selecione a Etapa</Label>
          <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={!selectedPipelineId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma etapa" />
            </SelectTrigger>
            <SelectContent>
              {stages?.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedStageId ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">Documentos Obrigatórios</CardTitle>
              <CardDescription>Defina quais documentos o sistema deve exigir nesta etapa</CardDescription>
            </div>
            <Button size="sm" onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" /> Add Documento
            </Button>
          </CardHeader>
          <CardContent>
            {loadingDocs ? (
              <div className="py-8 text-center text-muted-foreground">Carregando...</div>
            ) : requiredDocs?.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed rounded-lg">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum documento configurado para esta etapa.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requiredDocs?.map((doc) => (
                  <div key={doc.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg border bg-muted/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground">Rótulo (Exibido ao usuário)</Label>
                        <Input
                          value={doc.label}
                          onChange={(e) => updateField(doc.id, "label", e.target.value)}
                          onBlur={(e) => updateField(doc.id, "label", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground">Categoria (Identificador interno)</Label>
                        <Select value={doc.categoria} onValueChange={(v) => updateField(doc.id, "categoria", v)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 pt-2 sm:pt-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={doc.obrigatorio}
                          onCheckedChange={(v) => updateField(doc.id, "obrigatorio", v)}
                        />
                        <span className="text-xs font-medium">Obrigatório</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : selectedPipelineId ? (
        <div className="py-12 text-center border-2 border-dashed rounded-lg">
          <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
          <p className="text-sm text-muted-foreground">Selecione uma etapa para configurar os documentos.</p>
        </div>
      ) : null}
    </div>
  );
}
