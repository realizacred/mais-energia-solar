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
  ArrowRightLeft,
  Trash2, 
  AlertTriangle,
  Info,
  GitBranch,
  Search,
  FolderKanban,
  XCircle,
  CheckCircle2,
  UserCog,
  FileText,
  CheckSquare
} from "lucide-react";
import { AutomationFlowNode, TriggerType, ActionType, TRIGGER_LABELS, ACTION_LABELS, AutomationNodeType } from "@/types/automation-flow";
import { cn } from "@/lib/utils";
import { nodeIcons, actionIcons } from "./AutomationNodeConstants";
import { AutomationWhatsAppForm } from "./AutomationWhatsAppForm";

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
              <nodeIcons.action className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-blue-700">Ação</span>
          </button>
          <button
            onClick={() => onSelectNewNodeType('condition')}
            className="flex flex-col items-center justify-center p-4 gap-2 rounded-xl border-2 border-dashed border-teal-200 hover:border-teal-500 hover:bg-teal-50 transition-all group"
          >
            <div className="p-3 rounded-lg bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <GitBranch className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-teal-700">Condicional</span>
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
    : node.type === 'search'
    ? (node.config.searchType ? `Procurar ${node.config.searchType.charAt(0).toUpperCase() + node.config.searchType.slice(1)}` : 'Configurar Busca')
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
              { type: 'projeto_perdido' as TriggerType, icon: XCircle, label: 'Projeto Perdido' },
              { type: 'proposta_pronta' as TriggerType, icon: FileText, label: 'Proposta Pronta' },
              { type: 'atividade_criada' as TriggerType, icon: CheckSquare, label: 'Atividade Criada' },
              { type: 'atividade_concluida' as TriggerType, icon: CheckCircle2, label: 'Atividade Concluída' },
              { type: 'campo_alterado' as TriggerType, icon: Search, label: 'Campo Alterado' },
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

          {(localConfig.triggerType === 'projeto_movido' || localConfig.triggerType === 'projeto_criado' || localConfig.triggerType === 'projeto_ganho' || localConfig.triggerType === 'projeto_perdido') && (
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

          {(localConfig.triggerType === 'atividade_criada' || localConfig.triggerType === 'atividade_concluida') && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label>Título da Atividade (Contém)</Label>
                <Input 
                  value={localConfig.atividade_titulo_contem || ''} 
                  onChange={(e) => updateConfig({ atividade_titulo_contem: e.target.value })}
                  placeholder="Ex: Ligação, Visita..."
                />
              </div>
            </div>
          )}

          {localConfig.triggerType === 'projeto_perdido' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label>Motivo da Perda (Contém)</Label>
                <Input 
                  value={localConfig.perda_motivo_contem || ''} 
                  onChange={(e) => updateConfig({ perda_motivo_contem: e.target.value })}
                  placeholder="Ex: Preço, Concorrente..."
                />
              </div>
            </div>
          )}
        </div>
      )}

      {node.type === 'action' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'whatsapp' as ActionType, icon: actionIcons.whatsapp, label: 'WhatsApp' },
              { type: 'webhook' as ActionType, icon: actionIcons.webhook, label: 'Webhook HTTP' },
              { type: 'mover_etapa' as ActionType, icon: actionIcons.mover_etapa, label: 'Mover Etapa' },
              { type: 'email' as ActionType, icon: actionIcons.email, label: 'Enviar Email' },
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
              <div className="space-y-2">
                <Label>Secret (Header Authorization)</Label>
                <Input 
                  type="password"
                  value={localConfig.webhook_secret || ''} 
                  onChange={(e) => updateConfig({ webhook_secret: e.target.value })}
                  placeholder="Token de segurança"
                />
              </div>
        </div>
      )}

      {node.type === 'search' && (
        <div className="space-y-6">
          <Label>O que deseja buscar?</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'projeto', icon: FolderKanban, label: 'Projeto' },
              { type: 'atividade', icon: CheckSquare, label: 'Atividade' },
              { type: 'responsavel', icon: UserCog, label: 'Responsável' },
              { type: 'cliente', icon: UserCog, label: 'Cliente' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => updateConfig({ searchType: opt.type })}
                className={cn(
                  "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-xs font-medium h-20 text-center",
                  localConfig.searchType === opt.type 
                    ? "bg-purple-50 border-purple-500 text-purple-700" 
                    : "bg-card hover:bg-muted"
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>

          {localConfig.searchType === 'responsavel' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label>De qual funil?</Label>
                <Select 
                  value={localConfig.funil_id} 
                  onValueChange={(v) => updateConfig({ funil_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                  <SelectContent>
                    {availableFunis.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {localConfig.searchType === 'projeto' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <Label>Campo de busca</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-xs text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Usará o ID do projeto atual automaticamente.</span>
              </div>
            </div>
          )}
        </div>
      )}

          {localConfig.actionType === 'whatsapp' && (
            <AutomationWhatsAppForm 
              config={localConfig} 
              updateConfig={updateConfig} 
            />
          )}

          {localConfig.actionType === 'email' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Template de Email</Label>
                <Textarea 
                  value={localConfig.template_mensagem || ''} 
                  onChange={(e) => updateConfig({ template_mensagem: e.target.value, canal_notificacao: 'email' })}
                  placeholder="Olá {nome_cliente}! Este é um email automático..."
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
