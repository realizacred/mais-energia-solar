export type AutomationNodeType = 
  | 'trigger'
  | 'action' 
  | 'condition'
  | 'search'

export type TriggerType =
  | 'projeto_movido'
  | 'projeto_ganho'
  | 'projeto_criado'
  | 'proposta_gerada'
  | 'projeto_fechado'
  | 'atividade_criada'
  | 'campo_customizado'

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
