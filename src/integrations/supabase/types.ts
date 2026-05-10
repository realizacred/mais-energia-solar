export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      wa_conversations: {
        Row: {
          id: string
          tenant_id: string
          instance_id: string
          remote_jid: string
          cliente_nome: string | null
          cliente_telefone: string
          status: string
          assigned_to: string | null
          lead_id: string | null
          cliente_id: string | null
          last_message_at: string | null
          last_message_preview: string | null
          unread_count: number
          canal: string
          profile_picture_url: string | null
          created_at: string
          updated_at: string
          is_group: boolean
          last_message_id: string | null
          last_message_direction: string | null
          version: number
          telefone_normalized: string | null
          sla_paused_until: string | null
          projeto_id: string | null
          proposta_id: string | null
          ai_context: string
          ai_context_updated_at: string | null
          ai_context_reason: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          instance_id: string
          remote_jid: string
          cliente_nome?: string | null
          cliente_telefone: string
          status?: string
          assigned_to?: string | null
          lead_id?: string | null
          cliente_id?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number
          canal: string
          profile_picture_url?: string | null
          created_at?: string
          updated_at?: string
          is_group?: boolean
          last_message_id?: string | null
          last_message_direction?: string | null
          version?: number
          telefone_normalized?: string | null
          sla_paused_until?: string | null
          projeto_id?: string | null
          proposta_id?: string | null
          ai_context?: string
          ai_context_updated_at?: string | null
          ai_context_reason?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          instance_id?: string
          remote_jid?: string
          cliente_nome?: string | null
          cliente_telefone?: string
          status?: string
          assigned_to?: string | null
          lead_id?: string | null
          cliente_id?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_count?: number
          canal?: string
          profile_picture_url?: string | null
          created_at?: string
          updated_at?: string
          is_group?: boolean
          last_message_id?: string | null
          last_message_direction?: string | null
          version?: number
          telefone_normalized?: string | null
          sla_paused_until?: string | null
          projeto_id?: string | null
          proposta_id?: string | null
          ai_context?: string
          ai_context_updated_at?: string | null
          ai_context_reason?: string | null
        }
        Relationships: []
      }
      wa_followup_queue: {
        Row: {
          id: string
          tenant_id: string
          rule_id: string
          conversation_id: string
          status: string
          tentativa: number
          scheduled_at: string
          sent_at: string | null
          responded_at: string | null
          assigned_to: string | null
          mensagem_enviada: string | null
          created_at: string
          updated_at: string
          google_calendar_event_id: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          rule_id: string
          conversation_id: string
          status?: string
          tentativa?: number
          scheduled_at: string
          sent_at?: string | null
          responded_at?: string | null
          assigned_to?: string | null
          mensagem_enviada?: string | null
          created_at?: string
          updated_at?: string
          google_calendar_event_id?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          rule_id?: string
          conversation_id?: string
          status?: string
          tentativa?: number
          scheduled_at?: string
          sent_at?: string | null
          responded_at?: string | null
          assigned_to?: string | null
          mensagem_enviada?: string | null
          created_at?: string
          updated_at?: string
          google_calendar_event_id?: string | null
        }
        Relationships: []
      }
      wa_context_events: {
        Row: {
          id: string
          tenant_id: string
          conversation_id: string
          projeto_id: string | null
          proposta_id: string | null
          evento: string
          context_anterior: string | null
          context_novo: string | null
          origem: string | null
          usuario_id: string | null
          criado_em: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          conversation_id: string
          projeto_id?: string | null
          proposta_id?: string | null
          evento: string
          context_anterior?: string | null
          context_novo?: string | null
          origem?: string | null
          usuario_id?: string | null
          criado_em?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          conversation_id?: string
          projeto_id?: string | null
          proposta_id?: string | null
          evento?: string
          context_anterior?: string | null
          context_novo?: string | null
          origem?: string | null
          usuario_id?: string | null
          criado_em?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
