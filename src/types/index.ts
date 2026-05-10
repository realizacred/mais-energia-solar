export interface WaConversation {
  id: string;
  tenant_id: string;
  instance_id: string;
  remote_jid: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  status: "open" | "pending" | "resolved";
  assigned_to: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: "in" | "out" | null;
  unread_count: number;
  canal: string;
  profile_picture_url: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  // New Follow-up fields
  projeto_id?: string | null;
  proposta_id?: string | null;
  ai_context: 'ai_active' | 'ai_paused' | 'human_active' | 'needs_human_review' | 'waiting_customer' | 'closed' | 'support_context' | 'post_sale_context';
  ai_context_updated_at?: string | null;
  ai_context_reason?: string | null;
  // joined
  tags?: any[];
  instance_name?: string;
  instance_profile_name?: string | null;
  vendedor_nome?: string;
  lead_nome?: string;
  lead_telefone?: string;
  cliente_nome_real?: string | null;
}

export interface WaContextEvent {
  id: string;
  tenant_id: string;
  conversation_id: string;
  projeto_id?: string | null;
  proposta_id?: string | null;
  evento: string;
  context_anterior?: string | null;
  context_novo?: string | null;
  origem: 'sistema' | 'humano' | 'ia' | 'automacao';
  usuario_id?: string | null;
  criado_em: string;
}

export interface FollowupQueueItem {
  id: string;
  tenant_id: string;
  rule_id: string;
  conversation_id: string;
  status: string;
  scheduled_at: string;
  sent_at?: string | null;
  responded_at?: string | null;
  assigned_to?: string | null;
  mensagem_enviada?: string | null;
  created_at: string;
  updated_at: string;
  // New Follow-up fields
  tentativas: number;
  max_tentativas: number;
  ultimo_erro?: string | null;
  motivo_followup?: string | null;
  gatilho?: 'proposta_sem_resposta' | 'projeto_parado' | 'manual' | 'proposta_expirada' | 'pos_visita' | null;
}

export * from './lead';
