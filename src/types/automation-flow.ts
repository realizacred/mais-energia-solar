export type AutomationNodeType = 
  | 'trigger'
  | 'action' 
  | 'condition'
  | 'search'

export type TriggerType =
  | 'projeto_movido'
  | 'projeto_ganho'
  | 'projeto_criado'
  | 'projeto_fechado'
  | 'proposta_gerada'
  | 'proposta_pronta'
  | 'atividade_criada'
  | 'campo_customizado'
  | 'cliente_criado'

export type ActionType =
  | 'whatsapp'
  | 'email'
  | 'webhook'
  | 'mover_etapa'
  | 'criar_atividade'
  | 'notificar_responsavel'

export type SearchType =
  | 'projeto'
  | 'atividade'

export const TRIGGER_LABELS: Record<string, string> = {
  projeto_movido:      'Projeto Movido',
  projeto_ganho:       'Projeto Ganho',
  projeto_criado:      'Projeto Criado',
  projeto_fechado:     'Projeto Fechado',
  proposta_gerada:     'Proposta Gerada',
  proposta_pronta:     'Proposta Pronta',
  atividade_criada:    'Atividade Criada',
  campo_customizado:   'Campo Alterado',
  cliente_criado:      'Cliente Criado',
}

export const ACTION_LABELS: Record<string, string> = {
  whatsapp:            'Enviar WhatsApp',
  email:               'Enviar Email',
  webhook:             'Enviar Webhook',
  mover_etapa:         'Mover de Etapa',
  criar_atividade:     'Criar Atividade',
  notificar_responsavel: 'Notificar Responsável',
}

export interface AutomationFlowNode {
  id: string
  type: AutomationNodeType
  order: number
  config: {
    // Trigger
    triggerType?: TriggerType
    funil_id?: string
    etapa_id?: string
    // Action
    actionType?: ActionType
    webhook_url?: string
    webhook_secret?: string
    webhook_headers?: Record<string, string>
    canal_notificacao?: string
    template_mensagem?: string
    destino_etapa_id?: string
    // Condition
    field?: string
    operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
    value?: string
    logic?: 'AND' | 'OR'
    // Search
    searchType?: SearchType
  }
}

export interface AutomationFlow {
  nodes: AutomationFlowNode[]
}

