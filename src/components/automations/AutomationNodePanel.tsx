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
  CheckSquare,
  MessageCircle,
  Anchor,
  Mail,
  FolderOpen,
  User,
  Plus,
  UserCheck,
  UserPlus
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
  onSelectNewNodeType: (type: AutomationNodeType, initialConfig?: any) => void;
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
  const [addingStep, setAddingStep] = useState<'type' | 'action-grid'>('type');

  useEffect(() => {
    if (node) setLocalConfig(node.config);
  }, [node]);

  useEffect(() => {
    if (addingAfterIndex !== null) setAddingStep('type');
  }, [addingAfterIndex]);

  if (addingAfterIndex !== null) {
    if (addingStep === 'type') {
      return (
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold">Adicionar Passo</h2>
            <p className="text-xs text-muted-foreground">Escolha o tipo de nó para adicionar ao fluxo</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setAddingStep('action-grid')}
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

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setAddingStep('type')} className="h-8 w-8">
            <ArrowRightLeft className="h-4 w-4 rotate-180" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">Escolha a Ação</h2>
            <p className="text-xs text-muted-foreground">O que o sistema deve fazer neste passo?</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', color: 'text-teal-600 bg-teal-50 border-teal-500' },
            { type: 'webhook', icon: Anchor, label: 'Webhook HTTP', color: 'text-blue-600 bg-blue-50 border-blue-500' },
            { type: 'mover_etapa', icon: ArrowRightLeft, label: 'Mover Etapa', color: 'text-purple-600 bg-purple-50 border-purple-500' },
            { type: 'email', icon: Mail, label: 'Enviar Email', color: 'text-gray-600 bg-gray-50 border-gray-500' },
            { type: 'projeto', icon: FolderOpen, label: 'Projeto', color: 'text-green-600 bg-green-50 border-green-500' },
            { type: 'atividade', icon: CheckSquare, label: 'Atividade', color: 'text-teal-600 bg-teal-50 border-teal-500' },
            { type: 'cliente', icon: User, label: 'Cliente', color: 'text-pink-600 bg-pink-50 border-pink-500' },
          ].map((opt) => (
            <button
              key={opt.type}
              onClick={() => {
                onSelectNewNodeType('action', { actionType: opt.type as ActionType });
              }}
              className={cn(
                "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-xs font-medium h-20 text-center hover:shadow-sm",
                opt.color
              )}
            >
              <opt.icon className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
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
              { type: 'cliente_criado' as TriggerType, icon: UserPlus, label: 'Cliente Criado' },
              { type: 'cliente_alterado' as TriggerType, icon: UserCog, label: 'Cliente Alterado' },
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

          {/* PROJETO MOVIDO */}
          {localConfig.triggerType === 'projeto_movido' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Funil do Projeto <span className="text-destructive">*</span>
                </Label>
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
                <Alert className="bg-teal-50 border-teal-200 text-teal-800">
                  <AlertTriangle className="h-4 w-4 text-teal-600" />
                  <AlertDescription className="text-[11px] font-medium leading-relaxed">
                    Interceptor RB-90: Este funil exige Fornecedor vinculado para mudança de etapas.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Etapa destino (Opcional)</Label>
                <Select 
                  value={localConfig.etapa_id || 'all'} 
                  onValueChange={(v) => updateConfig({ etapa_id: v === 'all' ? undefined : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer etapa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer etapa</SelectItem>
                    {availableEtapas.filter(e => e.funil_id === localConfig.funil_id || e.pipeline_id === localConfig.funil_id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* PROJETO CRIADO */}
          {localConfig.triggerType === 'projeto_criado' && (
            <div className="p-4 rounded-lg bg-muted/50 border animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dispara quando qualquer projeto for criado
              </p>
            </div>
          )}

          {/* PROJETO GANHO */}
          {localConfig.triggerType === 'projeto_ganho' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label>Funil (Opcional)</Label>
                <Select 
                  value={localConfig.funil_id || 'all'} 
                  onValueChange={(v) => updateConfig({ funil_id: v === 'all' ? undefined : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer funil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer funil</SelectItem>
                    {availableFunis.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* PROJETO PERDIDO */}
          {localConfig.triggerType === 'projeto_perdido' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label>Motivo contém (Opcional)</Label>
                <Input 
                  value={localConfig.perda_motivo_contem || ''} 
                  onChange={(e) => updateConfig({ perda_motivo_contem: e.target.value })}
                  placeholder="Ex: Preço, Concorrente..."
                />
              </div>
            </div>
          )}

          {/* PROPOSTA PRONTA */}
          {localConfig.triggerType === 'proposta_pronta' && (
            <div className="p-4 rounded-lg bg-muted/50 border animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dispara quando proposta for gerada
              </p>
            </div>
          )}

          {/* ATIVIDADE CRIADA / CONCLUIDA */}
          {(localConfig.triggerType === 'atividade_criada' || localConfig.triggerType === 'atividade_concluida') && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label>Título contém (Opcional)</Label>
                <Input 
                  value={localConfig.atividade_titulo_contem || ''} 
                  onChange={(e) => updateConfig({ atividade_titulo_contem: e.target.value })}
                  placeholder="Ex: Ligação, Visita..."
                />
              </div>
            </div>
          )}

          {/* CAMPO ALTERADO */}
          {localConfig.triggerType === 'campo_alterado' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  Campo customizado <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={localConfig.custom_field_id} 
                  onValueChange={(v) => updateConfig({ custom_field_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o campo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="valor">Valor</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="responsavel">Responsável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo valor contém (Opcional)</Label>
                <Input 
                  value={localConfig.novo_valor_contem || ''} 
                  onChange={(e) => updateConfig({ novo_valor_contem: e.target.value })}
                  placeholder="Filtrar por valor específico..."
                />
              </div>
            </div>
          )}

          {/* CLIENTE CRIADO */}
          {localConfig.triggerType === 'cliente_criado' && (
            <div className="p-4 rounded-lg bg-muted/50 border animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dispara quando novo cliente for cadastrado
              </p>
            </div>
          )}

          {/* CLIENTE ALTERADO */}
          {localConfig.triggerType === 'cliente_alterado' && (
            <div className="p-4 rounded-lg bg-muted/50 border animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dispara quando dados do cliente forem alterados
              </p>
            </div>
          )}
        </div>
      )}

      {node.type === 'action' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', color: 'text-teal-600 bg-teal-50 border-teal-500' },
              { type: 'webhook', icon: Anchor, label: 'Webhook HTTP', color: 'text-blue-600 bg-blue-50 border-blue-500' },
              { type: 'mover_etapa', icon: ArrowRightLeft, label: 'Mover Etapa', color: 'text-purple-600 bg-purple-50 border-purple-500' },
              { type: 'email', icon: Mail, label: 'Enviar Email', color: 'text-gray-600 bg-gray-50 border-gray-500' },
              { type: 'projeto', icon: FolderOpen, label: 'Projeto', color: 'text-green-600 bg-green-50 border-green-500' },
              { type: 'atividade', icon: CheckSquare, label: 'Atividade', color: 'text-teal-600 bg-teal-50 border-teal-500' },
              { type: 'cliente', icon: User, label: 'Cliente', color: 'text-pink-600 bg-pink-50 border-pink-500' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => updateConfig({ actionType: opt.type })}
                className={cn(
                  "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-xs font-medium h-20 text-center",
                  localConfig.actionType === opt.type 
                    ? opt.color 
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

          {(localConfig.actionType === 'mover_etapa' || localConfig.actionType === 'projeto') && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Funil de Destino</Label>
                <Select 
                  value={localConfig.funil_id} 
                  onValueChange={(v) => updateConfig({ funil_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Mesmo funil" /></SelectTrigger>
                  <SelectContent>
                    {availableFunis.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mover para Etapa</Label>
                <Select 
                  value={localConfig.destino_etapa_id} 
                  onValueChange={(v) => updateConfig({ destino_etapa_id: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                  <SelectContent>
                    {availableEtapas.filter(e => e.funil_id === localConfig.funil_id || e.pipeline_id === localConfig.funil_id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {localConfig.actionType === 'atividade' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-2">
                <Label>Título da Atividade</Label>
                <Input 
                  value={localConfig.atividade_titulo || ''} 
                  onChange={(e) => updateConfig({ atividade_titulo: e.target.value })}
                  placeholder="Ex: Ligar para confirmar aceite"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (Opcional)</Label>
                <Textarea 
                  value={localConfig.atividade_descricao || ''} 
                  onChange={(e) => updateConfig({ atividade_descricao: e.target.value })}
                  placeholder="Instruções para o consultor..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {node.type === 'search' && (
        <div className="space-y-6">
          <Label className="text-sm font-bold">O que deseja buscar?</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'projeto', icon: FolderOpen, label: 'Projeto' },
              { type: 'atividade', icon: CheckSquare, label: 'Atividade' },
              { type: 'responsavel', icon: User, label: 'Responsável' },
              { type: 'cliente', icon: UserCheck, label: 'Cliente' },
            ].map((opt) => (
              <button
                key={opt.type}
                onClick={() => updateConfig({ searchType: opt.type })}
                className={cn(
                  "flex flex-col items-center justify-center p-3 gap-2 rounded-lg border transition-all text-xs font-medium h-20 text-center hover:shadow-sm",
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
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <Label className="text-xs">Origem do Projeto</Label>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => updateConfig({ source: 'gatilho' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source !== 'fixo' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Projeto do gatilho</span>
                  {localConfig.source !== 'fixo' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
                <button 
                  onClick={() => updateConfig({ source: 'fixo' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source === 'fixo' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Projeto fixo</span>
                  {localConfig.source === 'fixo' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
              </div>
              {localConfig.source === 'fixo' && (
                <Input 
                  placeholder="ID do projeto" 
                  value={localConfig.search_value || ''} 
                  onChange={(e) => updateConfig({ search_value: e.target.value })}
                  className="h-8"
                />
              )}
            </div>
          )}

          {localConfig.searchType === 'atividade' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <Label className="text-xs">Origem da Atividade</Label>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => updateConfig({ source: 'gatilho' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source !== 'ultima' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Atividade do gatilho</span>
                  {localConfig.source !== 'ultima' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
                <button 
                  onClick={() => updateConfig({ source: 'ultima' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source === 'ultima' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Última do projeto</span>
                  {localConfig.source === 'ultima' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
              </div>
            </div>
          )}

          {localConfig.searchType === 'cliente' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border-t pt-4">
              <Label className="text-xs">Origem do Cliente</Label>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => updateConfig({ source: 'projeto' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source !== 'fixo' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Cliente do projeto</span>
                  {localConfig.source !== 'fixo' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
                <button 
                  onClick={() => updateConfig({ source: 'fixo' })}
                  className={cn("flex items-center justify-between p-2 rounded border text-xs text-left", localConfig.source === 'fixo' ? "border-purple-500 bg-purple-50" : "border-border")}
                >
                  <span>Fixo por email</span>
                  {localConfig.source === 'fixo' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </button>
              </div>
              {localConfig.source === 'fixo' && (
                <Input 
                  placeholder="email@cliente.com" 
                  value={localConfig.search_value || ''} 
                  onChange={(e) => updateConfig({ search_value: e.target.value })}
                  className="h-8"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
