import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Zap, Settings2 } from "lucide-react";
import { AutomationCanvas } from "./AutomationCanvas";
import { AutomationNodePanel } from "./AutomationNodePanel";
import { AutomationFlow, AutomationFlowNode } from "@/types/automation-flow";
import { useAutomationFlow, useSaveAutomationFlow } from "@/hooks/usePipelineAutomations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

interface AutomationFlowEditorProps {
  automationId: string | null;
  onBack: () => void;
}

export function AutomationFlowEditor({ automationId, onBack }: AutomationFlowEditorProps) {
  const { toast } = useToast();
  const { data: initialFlow, isLoading: isLoadingFlow } = useAutomationFlow(automationId);
  const saveFlowMutation = useSaveAutomationFlow();
  
  const [nodes, setNodes] = useState<AutomationFlowNode[]>([]);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sync state with loaded data
  useEffect(() => {
    if (initialFlow) {
      setNodes(initialFlow.nodes || []);
      // If editing existing, we'd need name/active too. 
      // Simplified here, assuming we fetch it separately or extend useAutomationFlow
    }
  }, [initialFlow]);

  // Load basic auto info if editing
  useEffect(() => {
    if (automationId) {
      supabase.from("pipeline_automations")
        .select("nome, ativo")
        .eq("id", automationId)
        .single()
        .then(({ data }) => {
          if (data) {
            setName(data.nome);
            setActive(data.ativo);
          }
        });
    }
  }, [automationId]);

  // Load funis/etapas for panels
  const { data: pipelines } = useQuery({
    queryKey: ["pipelines-flow-editor"],
    queryFn: async () => {
      const [modern, legacy] = await Promise.all([
        supabase.from("pipelines").select("id, name").order("name"),
        supabase.from("projeto_funis").select("id, nome").order("nome")
      ]);
      return [
        ...(modern.data || []).map(p => ({ ...p, type: 'modern' })),
        ...(legacy.data || []).map(p => ({ id: p.id, name: p.nome, type: 'legacy' }))
      ];
    }
  });

  const { data: stages } = useQuery({
    queryKey: ["stages-flow-editor"],
    queryFn: async () => {
      const [modern, legacy] = await Promise.all([
        supabase.from("pipeline_stages").select("id, pipeline_id, name").order("position"),
        supabase.from("projeto_etapas").select("id, funil_id, nome").order("ordem")
      ]);
      return [
        ...(modern.data || []).map(s => ({ ...s, type: 'modern' })),
        ...(legacy.data || []).map(s => ({ ...s, type: 'legacy' }))
      ];
    }
  });

  const handleAddNode = (index: number) => {
    const newNode: AutomationFlowNode = {
      id: crypto.randomUUID(),
      type: nodes.length === 0 ? 'trigger' : 'action',
      order: index,
      config: {}
    };
    const newNodes = [...nodes];
    newNodes.splice(index, 0, newNode);
    setNodes(newNodes.map((n, i) => ({ ...n, order: i })));
    setSelectedNodeId(newNode.id);
  };

  const handleUpdateNode = (updatedNode: AutomationFlowNode) => {
    setNodes(nodes.map(n => n.id === updatedNode.id ? updatedNode : n));
  };

  const handleRemoveNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id).map((n, i) => ({ ...n, order: i })));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleSave = async () => {
    if (!name) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    
    const { tenantId } = await getCurrentTenantId();
    
    saveFlowMutation.mutate({
      automationId,
      flow: { nodes },
      basicData: { nome: name, ativo: active, tenant_id: tenantId }
    }, {
      onSuccess: () => {
        toast({ title: "Automação salva!" });
        onBack();
      },
      onError: (err: any) => {
        toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      }
    });
  };

  if (isLoadingFlow) return <LoadingState message="Carregando fluxograma..." />;

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] bg-muted/20 border rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-background border-b shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-3">
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da automação..." 
              className="w-64 h-9 font-medium"
            />
            <div className="flex items-center gap-2 px-3 h-9 bg-muted/50 rounded-lg border">
              <Switch checked={active} onCheckedChange={setActive} />
              <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">
                {active ? 'Ativada' : 'Pausada'}
              </span>
            </div>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saveFlowMutation.isPending} className="gap-2 px-6">
          <Save className="h-4 w-4" />
          {saveFlowMutation.isPending ? 'Salvando...' : 'Salvar Fluxo'}
        </Button>
      </header>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]">
          <AutomationCanvas 
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onNodeSelect={(n) => setSelectedNodeId(n.id)}
            onAddNode={handleAddNode}
            onRemoveNode={handleRemoveNode}
          />
        </main>

        {/* Configuration Panel */}
        <aside className="w-96 bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-300">
          <AutomationNodePanel 
            node={selectedNode}
            availableFunis={pipelines || []}
            availableEtapas={stages || []}
            onUpdate={handleUpdateNode}
            onRemove={handleRemoveNode}
          />
        </aside>
      </div>
    </div>
  );
}
