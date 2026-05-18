import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  FolderPlus, 
  Trophy, 
  FileCheck, 
  CheckSquare, 
  Edit3, 
  ArrowRightLeft,
  Anchor, 
  Mail, 
  MessageSquare, 
  Trash2, 
  AlertTriangle,
  Info,
  Target,
  GitBranch,
  Search,
  FolderKanban
} from "lucide-react";
import { AutomationFlowNode, TriggerType, ActionType, TRIGGER_LABELS, ACTION_LABELS, AutomationNodeType } from "@/types/automation-flow";
import { cn } from "@/lib/utils";

interface AutomationNodePanelProps {
  node: AutomationFlowNode | null;
  availableFunis: any[];
  availableEtapas: any[];
  onUpdate: (node: AutomationFlowNode) => void;
  onRemove: (id: string) => void;
  addingAfterIndex: number | null;
  onSelectNewNodeType: (type: AutomationNodeType) => void;
}

export function AutomationNodePanel({ 
  node, 
  availableFunis, 
  availableEtapas, 
  onUpdate, 
  onRemove,
  addingAfterIndex,
  onSelectNewNodeType
}: AutomationNodePanelProps) {
  const [localConfig, setLocalConfig] = useState<any>(node?.config || {});

  useEffect(() => {
    if (node) setLocalConfig(node.config);
  }, [node]);

  if (addingAfterIndex !== null) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold">Adicionar Passo</h2>
          <p className="text-xs text-muted-foreground">Escolha o tipo de nó para adicionar ao fluxo</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onSelectNewNodeType('action')}
            className="flex flex-col items-center justify-center p-4 gap-2 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="p-3 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Target className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-blue-700">Ação</span>
          </button>
          <button
            onClick={() => onSelectNewNodeType('condition')}
            className="flex flex-col items-center justify-center p-4 gap-2 rounded-xl border-2 border-dashed border-orange-200 hover:border-orange-500 hover:bg-orange-50 transition-all group"
          >
            <div className="p-3 rounded-lg bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <GitBranch className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-orange-700">Condicional</span>
          </button>
          <button
            onClick={() => onSelectNewNodeType('search')}
            className="flex flex-col items-center justify-center p-4 gap-2 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-500 hover:bg-purple-50 transition-all group col-span-2"
          >
            <div className="p-3 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Search className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-purple-700">Procurar</span>
          </button>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-3 opacity-60">
        <div className="p-4 rounded-full bg-muted">
          <Info className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Nenhum nó selecionado</p>
          <p className="text-xs text-muted-foreground">Clique em um nó no canvas para configurar os detalhes.</p>
        </div>
      </div>
    );
  }

  const updateConfig = (patch: any) => {
    const newConfig = { ...localConfig, ...patch };
    setLocalConfig(newConfig);
    onUpdate({ ...node, config: newConfig });
  };

  const isEquipamento = availableFunis.find(f => f.id === localConfig.funil_id)?.name?.toLowerCase().includes("equipamento");

  const panelTitle = node.type === 'trigger' 
    ? (node.config.triggerType ? TRIGGER_LABELS[node.config.triggerType] : 'Configurar Gatilho')
    : (node.config.actionType ? ACTION_LABELS[node.config.actionType] : 'Configurar Ação');

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-lg font-bold">{panelTitle}</h2>
          <p className="text-xs text-muted-foreground">Defina o comportamento deste passo</p>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onRemove(node.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {node.type === 'trigger' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'projeto_movido' as TriggerType, icon: ArrowRightLeft, label: 'Projeto Movido' },
              { type: 'projeto_criado' as TriggerType, icon: FolderPlus, label: 'Projeto Criado' },
              { type: 'projeto_ganho' as TriggerType, icon: Trophy, label: 'Projeto Ganho' },
              { type: 'proposta_pronta' as TriggerType, icon: FileCheck, label: 'Proposta Pronta' },
              { type: 'atividade_criada' as TriggerType, icon: CheckSquare, label: 'Atividade Criada' },
              { type: 'campo_customizado' as TriggerType, icon: Edit3, label: 'Campo Alterado' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => updateConfig({ triggerType: opt.type })}
                className={cn(
                  "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-[11px] font-medium leading-tight h-20 text-center",
                  localConfig.triggerType === opt.type 
                    ? "bg-teal-50 border-teal-500 text-teal-700" 
                    : "bg-card hover:bg-muted"
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>

          {(localConfig.triggerType === 'projeto_movido' || localConfig.triggerType === 'projeto_criado') && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label>Funil do Projeto</Label>
                <Select 
                  value={localConfig.funil_id} 
                  onValueChange={(v) => updateConfig({ funil_id: v, etapa_id: undefined })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                  <SelectContent>
                    {availableFunis.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isEquipamento && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-[11px] font-medium leading-relaxed">
                    Interceptor RB-90: Este funil exige Fornecedor vinculado para mudança de etapas.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Etapa (Opcional)</Label>
                <Select 
                  value={localConfig.etapa_id} 
                  onValueChange={(v) => updateConfig({ etapa_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer etapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as etapas</SelectItem>
                    {availableEtapas.filter(e => e.funil_id === localConfig.funil_id || e.pipeline_id === localConfig.funil_id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {node.type === 'action' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'whatsapp' as ActionType, icon: MessageSquare, label: 'WhatsApp' },
              { type: 'webhook' as ActionType, icon: Anchor, label: 'Webhook HTTP' },
              { type: 'mover_etapa' as ActionType, icon: FolderKanban, label: 'Mover Etapa' },
              { type: 'email' as ActionType, icon: Mail, label: 'Enviar Email' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => updateConfig({ actionType: opt.type })}
                className={cn(
                  "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-xs font-medium h-20 text-center",
                  localConfig.actionType === opt.type 
                    ? "bg-blue-50 border-blue-500 text-blue-700" 
                    : "bg-card hover:bg-muted"
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>

          {localConfig.actionType === 'webhook' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>URL de Destino</Label>
                <Input 
                  value={localConfig.webhook_url || ''} 
                  onChange={(e) => updateConfig({ webhook_url: e.target.value })}
                  placeholder="https://api.seusistema.com/webhook"
                />
              </div>
...
  );
}

