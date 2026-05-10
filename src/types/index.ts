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
  tags?: WaConversationTag[];
  instance_name?: string;
  instance_profile_name?: string | null;
  vendedor_nome?: string;
  lead_nome?: string;
  lead_telefone?: string;
  cliente_nome_real?: string | null;
}

export interface WaMessage {
  id: string;
  conversation_id: string;
  evolution_message_id: string | null;
  correlation_id: string | null;
  direction: "in" | "out";
  message_type: string;
  content: string | null;
  media_url: string | null;
  storage_path: string | null;
  media_mime_type: string | null;
  media_status: string | null;
  media_error_message: string | null;
  file_name: string | null;
  file_size: number | null;
  quoted_message_id: string | null;
  sent_by_user_id: string | null;
  is_internal_note: boolean;
  status: string | null;
  error_message: string | null;
  error_code: string | null;
  metadata: any;
  participant_jid: string | null;
  participant_name: string | null;
  created_at: string;
  // timestamps
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  // joined
  sent_by_name?: string | null;
}

export interface WaTag {
  id: string;
  name: string;
  color: string;
}

export interface WaConversationTag {
  id: string;
  conversation_id: string;
  tag_id: string;
  tag?: WaTag;
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
