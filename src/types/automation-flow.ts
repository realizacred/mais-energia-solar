export type AutomationNodeType = 
  | 'trigger'
  | 'action' 
  | 'condition'
  | 'search'

export type TriggerType =
  | 'projeto_movido'
  | 'projeto_ganho'
  | 'projeto_criado'
  | 'projeto_perdido'
  | 'proposta_pronta'
  | 'atividade_criada'
  | 'atividade_concluida'
  | 'campo_alterado'
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
  projeto_movido:   'Projeto Movido',
  projeto_criado:   'Projeto Criado', 
  projeto_ganho:    'Projeto Ganho',
  projeto_perdido:  'Projeto Perdido',
  proposta_pronta:  'Proposta Pronta',
  atividade_criada: 'Atividade Criada',
  atividade_concluida: 'Atividade Concluída',
  campo_alterado:   'Campo Alterado',
  cliente_criado:   'Cliente Criado',
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
    
    // WhatsApp Extended (RB-76, RB-105)
    wa_destinatario_tipo?: 'cliente' | 'responsavel' | 'fixo' | 'variavel'
    wa_destinatario_valor?: string
    wa_instance_id?: string
    wa_message_type?: 'text' | 'image' | 'document' | 'audio'
    wa_content_template?: string
    wa_media_url?: string
    wa_media_filename?: string
    wa_doc_origin?: 'fixo' | 'proposta' | 'variavel'
    wa_schedule_enabled?: boolean
    wa_schedule_tipo?: 'horas' | 'dias'
    wa_scheduled_valor?: number

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
