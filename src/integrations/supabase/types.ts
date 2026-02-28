export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          created_at: string
          filters: Json | null
          generated_by_user_id: string | null
          id: string
          insight_type: string
          payload: Json
          period_end: string | null
          period_start: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          generated_by_user_id?: string | null
          id?: string
          insight_type: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          generated_by_user_id?: string | null
          id?: string
          insight_type?: string
          payload?: Json
          period_end?: string | null
          period_start?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      aneel_sync_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          logs: Json
          snapshot_hash: string | null
          started_at: string
          status: string
          tenant_id: string
          total_errors: number | null
          total_fetched: number | null
          total_matched: number | null
          total_updated: number | null
          trigger_type: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          snapshot_hash?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          total_errors?: number | null
          total_fetched?: number | null
          total_matched?: number | null
          total_updated?: number | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          logs?: Json
          snapshot_hash?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_errors?: number | null
          total_fetched?: number | null
          total_matched?: number | null
          total_updated?: number | null
          trigger_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aneel_sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          all_day: boolean | null
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_to: string | null
          cliente_id: string | null
          conversation_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          external_calendar_id: string | null
          external_etag: string | null
          external_event_id: string | null
          external_provider: string | null
          external_updated_at: string | null
          id: string
          idempotency_key: string | null
          last_synced_at: string | null
          lead_id: string | null
          reminder_minutes: number | null
          reminder_sent: boolean | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          sync_error: string | null
          sync_status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          cliente_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_calendar_id?: string | null
          external_etag?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          external_updated_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_synced_at?: string | null
          lead_id?: string | null
          reminder_minutes?: number | null
          reminder_sent?: boolean | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          sync_error?: string | null
          sync_status?: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean | null
          appointment_type?: Database["public"]["Enums"]["appointment_type"]
          assigned_to?: string | null
          cliente_id?: string | null
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          external_calendar_id?: string | null
          external_etag?: string | null
          external_event_id?: string | null
          external_provider?: string | null
          external_updated_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_synced_at?: string | null
          lead_id?: string | null
          reminder_minutes?: number | null
          reminder_sent?: boolean | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          sync_error?: string | null
          sync_status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          ip_address: string | null
          registro_id: string | null
          tabela: string
          tenant_id: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela: string
          tenant_id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          ip_address?: string | null
          registro_id?: string | null
          tabela?: string
          tenant_id?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_audit: {
        Row: {
          backfill_batch: string
          changed_at: string
          id: string
          row_pk: string
          table_name: string
          tenant_id_new: string
          tenant_id_old: string | null
        }
        Insert: {
          backfill_batch?: string
          changed_at?: string
          id?: string
          row_pk: string
          table_name: string
          tenant_id_new: string
          tenant_id_old?: string | null
        }
        Update: {
          backfill_batch?: string
          changed_at?: string
          id?: string
          row_pk?: string
          table_name?: string
          tenant_id_new?: string
          tenant_id_old?: string | null
        }
        Relationships: []
      }
      baterias: {
        Row: {
          ativo: boolean
          corrente_max_carga_a: number | null
          corrente_max_descarga_a: number | null
          correntes_recomendadas_a: string | null
          created_at: string
          dimensoes_mm: string | null
          energia_kwh: number | null
          fabricante: string
          id: string
          modelo: string
          potencia_max_saida_kw: number | null
          tenant_id: string
          tensao_carga_v: number | null
          tensao_nominal_v: number | null
          tensao_operacao_v: string | null
          tipo_bateria: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          corrente_max_carga_a?: number | null
          corrente_max_descarga_a?: number | null
          correntes_recomendadas_a?: string | null
          created_at?: string
          dimensoes_mm?: string | null
          energia_kwh?: number | null
          fabricante: string
          id?: string
          modelo: string
          potencia_max_saida_kw?: number | null
          tenant_id?: string
          tensao_carga_v?: number | null
          tensao_nominal_v?: number | null
          tensao_operacao_v?: string | null
          tipo_bateria?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          corrente_max_carga_a?: number | null
          corrente_max_descarga_a?: number | null
          correntes_recomendadas_a?: string | null
          created_at?: string
          dimensoes_mm?: string | null
          energia_kwh?: number | null
          fabricante?: string
          id?: string
          modelo?: string
          potencia_max_saida_kw?: number | null
          tenant_id?: string
          tensao_carga_v?: number | null
          tensao_nominal_v?: number | null
          tensao_operacao_v?: string | null
          tipo_bateria?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baterias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          allow_theme_switch: boolean
          border_radius: string
          color_accent: string
          color_accent_foreground: string
          color_background: string
          color_border: string
          color_card: string
          color_card_foreground: string
          color_destructive: string
          color_foreground: string
          color_info: string
          color_muted: string
          color_muted_foreground: string
          color_primary: string
          color_primary_foreground: string
          color_secondary: string
          color_secondary_foreground: string
          color_success: string
          color_warning: string
          created_at: string
          dark_color_background: string
          dark_color_border: string
          dark_color_card: string
          dark_color_foreground: string
          dark_color_muted: string
          dark_color_muted_foreground: string
          dark_color_primary: string
          default_theme: string
          favicon_url: string | null
          font_body: string
          font_heading: string
          font_size_base: string
          font_weight_heading: string
          id: string
          login_image_url: string | null
          logo_small_url: string | null
          logo_url: string | null
          logo_white_url: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_theme_switch?: boolean
          border_radius?: string
          color_accent?: string
          color_accent_foreground?: string
          color_background?: string
          color_border?: string
          color_card?: string
          color_card_foreground?: string
          color_destructive?: string
          color_foreground?: string
          color_info?: string
          color_muted?: string
          color_muted_foreground?: string
          color_primary?: string
          color_primary_foreground?: string
          color_secondary?: string
          color_secondary_foreground?: string
          color_success?: string
          color_warning?: string
          created_at?: string
          dark_color_background?: string
          dark_color_border?: string
          dark_color_card?: string
          dark_color_foreground?: string
          dark_color_muted?: string
          dark_color_muted_foreground?: string
          dark_color_primary?: string
          default_theme?: string
          favicon_url?: string | null
          font_body?: string
          font_heading?: string
          font_size_base?: string
          font_weight_heading?: string
          id?: string
          login_image_url?: string | null
          logo_small_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          allow_theme_switch?: boolean
          border_radius?: string
          color_accent?: string
          color_accent_foreground?: string
          color_background?: string
          color_border?: string
          color_card?: string
          color_card_foreground?: string
          color_destructive?: string
          color_foreground?: string
          color_info?: string
          color_muted?: string
          color_muted_foreground?: string
          color_primary?: string
          color_primary_foreground?: string
          color_secondary?: string
          color_secondary_foreground?: string
          color_success?: string
          color_warning?: string
          created_at?: string
          dark_color_background?: string
          dark_color_border?: string
          dark_color_card?: string
          dark_color_foreground?: string
          dark_color_muted?: string
          dark_color_muted_foreground?: string
          dark_color_primary?: string
          default_theme?: string
          favicon_url?: string | null
          font_body?: string
          font_heading?: string
          font_size_base?: string
          font_weight_heading?: string
          id?: string
          login_image_url?: string | null
          logo_small_url?: string | null
          logo_url?: string | null
          logo_white_url?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calculadora_config: {
        Row: {
          created_at: string
          custo_por_kwp: number
          fator_perdas_percentual: number
          geracao_mensal_por_kwp: number
          id: string
          kg_co2_por_kwh: number
          percentual_economia: number
          tarifa_media_kwh: number
          tenant_id: string
          updated_at: string
          vida_util_sistema: number
        }
        Insert: {
          created_at?: string
          custo_por_kwp?: number
          fator_perdas_percentual?: number
          geracao_mensal_por_kwp?: number
          id?: string
          kg_co2_por_kwh?: number
          percentual_economia?: number
          tarifa_media_kwh?: number
          tenant_id?: string
          updated_at?: string
          vida_util_sistema?: number
        }
        Update: {
          created_at?: string
          custo_por_kwp?: number
          fator_perdas_percentual?: number
          geracao_mensal_por_kwp?: number
          id?: string
          kg_co2_por_kwh?: number
          percentual_economia?: number
          tarifa_media_kwh?: number
          tenant_id?: string
          updated_at?: string
          vida_util_sistema?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculadora_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_queue: {
        Row: {
          appointment_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          max_retries: number
          next_retry_at: string | null
          operation: string
          payload_json: Json | null
          retry_count: number
          status: string
          tenant_id: string
        }
        Insert: {
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_retries?: number
          next_retry_at?: string | null
          operation: string
          payload_json?: Json | null
          retry_count?: number
          status?: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_retries?: number
          next_retry_at?: string | null
          operation?: string
          payload_json?: Json | null
          retry_count?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_sync_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_cliente_arquivos: {
        Row: {
          categoria: string
          checklist_id: string
          created_at: string
          id: string
          nome_arquivo: string
          resposta_id: string | null
          tamanho_bytes: number | null
          tenant_id: string
          tipo_mime: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          categoria: string
          checklist_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          resposta_id?: string | null
          tamanho_bytes?: number | null
          tenant_id?: string
          tipo_mime?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          categoria?: string
          checklist_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          resposta_id?: string | null
          tamanho_bytes?: number | null
          tenant_id?: string
          tipo_mime?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_cliente_arquivos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_cliente_arquivos_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "checklist_cliente_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_cliente_arquivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_cliente_respostas: {
        Row: {
          campo_custom: string | null
          checklist_id: string
          created_at: string
          etapa: string | null
          id: string
          template_item_id: string | null
          tenant_id: string
          updated_at: string
          valor: string | null
          valor_boolean: boolean | null
          valor_numerico: number | null
        }
        Insert: {
          campo_custom?: string | null
          checklist_id: string
          created_at?: string
          etapa?: string | null
          id?: string
          template_item_id?: string | null
          tenant_id?: string
          updated_at?: string
          valor?: string | null
          valor_boolean?: boolean | null
          valor_numerico?: number | null
        }
        Update: {
          campo_custom?: string | null
          checklist_id?: string
          created_at?: string
          etapa?: string | null
          id?: string
          template_item_id?: string | null
          tenant_id?: string
          updated_at?: string
          valor?: string | null
          valor_boolean?: boolean | null
          valor_numerico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_cliente_respostas_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_cliente_respostas_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_cliente_respostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instalador_arquivos: {
        Row: {
          categoria: string
          checklist_id: string
          created_at: string
          fase: Database["public"]["Enums"]["checklist_instalador_fase"] | null
          id: string
          nome_arquivo: string
          obrigatorio: boolean | null
          resposta_id: string | null
          tamanho_bytes: number | null
          tenant_id: string
          tipo_mime: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          categoria: string
          checklist_id: string
          created_at?: string
          fase?: Database["public"]["Enums"]["checklist_instalador_fase"] | null
          id?: string
          nome_arquivo: string
          obrigatorio?: boolean | null
          resposta_id?: string | null
          tamanho_bytes?: number | null
          tenant_id?: string
          tipo_mime?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          categoria?: string
          checklist_id?: string
          created_at?: string
          fase?: Database["public"]["Enums"]["checklist_instalador_fase"] | null
          id?: string
          nome_arquivo?: string
          obrigatorio?: boolean | null
          resposta_id?: string | null
          tamanho_bytes?: number | null
          tenant_id?: string
          tipo_mime?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instalador_arquivos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_instalador"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instalador_arquivos_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "checklist_instalador_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instalador_arquivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_instalador_respostas: {
        Row: {
          campo: string
          checklist_id: string
          conforme: boolean | null
          created_at: string
          fase: Database["public"]["Enums"]["checklist_instalador_fase"]
          id: string
          observacao: string | null
          respondido_por: string | null
          template_item_id: string | null
          tenant_id: string
          updated_at: string
          valor: string | null
          valor_boolean: boolean | null
        }
        Insert: {
          campo: string
          checklist_id: string
          conforme?: boolean | null
          created_at?: string
          fase: Database["public"]["Enums"]["checklist_instalador_fase"]
          id?: string
          observacao?: string | null
          respondido_por?: string | null
          template_item_id?: string | null
          tenant_id?: string
          updated_at?: string
          valor?: string | null
          valor_boolean?: boolean | null
        }
        Update: {
          campo?: string
          checklist_id?: string
          conforme?: boolean | null
          created_at?: string
          fase?: Database["public"]["Enums"]["checklist_instalador_fase"]
          id?: string
          observacao?: string | null
          respondido_por?: string | null
          template_item_id?: string | null
          tenant_id?: string
          updated_at?: string
          valor?: string | null
          valor_boolean?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instalador_respostas_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_instalador"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instalador_respostas_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instalador_respostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          campo: string
          created_at: string
          etapa: string
          id: string
          obrigatorio: boolean | null
          opcoes: Json | null
          ordem: number | null
          template_id: string
          tenant_id: string
          tipo_campo: string
        }
        Insert: {
          campo: string
          created_at?: string
          etapa: string
          id?: string
          obrigatorio?: boolean | null
          opcoes?: Json | null
          ordem?: number | null
          template_id: string
          tenant_id?: string
          tipo_campo: string
        }
        Update: {
          campo?: string
          created_at?: string
          etapa?: string
          id?: string
          obrigatorio?: boolean | null
          opcoes?: Json | null
          ordem?: number | null
          template_id?: string
          tenant_id?: string
          tipo_campo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tenant_id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_cliente: {
        Row: {
          cliente_id: string | null
          consultor_id: string | null
          created_at: string
          created_by: string | null
          data_envio: string | null
          data_revisao: string | null
          id: string
          lead_id: string | null
          motivo_reprovacao: string | null
          observacoes_cliente: string | null
          observacoes_internas: string | null
          projeto_id: string | null
          revisor_id: string | null
          status: Database["public"]["Enums"]["checklist_cliente_status"]
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          data_revisao?: string | null
          id?: string
          lead_id?: string | null
          motivo_reprovacao?: string | null
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          projeto_id?: string | null
          revisor_id?: string | null
          status?: Database["public"]["Enums"]["checklist_cliente_status"]
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_envio?: string | null
          data_revisao?: string | null
          id?: string
          lead_id?: string | null
          motivo_reprovacao?: string | null
          observacoes_cliente?: string | null
          observacoes_internas?: string | null
          projeto_id?: string | null
          revisor_id?: string | null
          status?: Database["public"]["Enums"]["checklist_cliente_status"]
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_cliente_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_cliente_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_cliente_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_cliente_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_instalacao: {
        Row: {
          adesivo_inversor: boolean | null
          assinatura_cliente_url: string | null
          assinatura_instalador_url: string | null
          avaliacao_atendimento: string | null
          bairro: string | null
          configuracao_wifi: boolean | null
          created_at: string
          data_instalacao: string
          endereco: string
          foto_servico: boolean | null
          fotos_urls: string[] | null
          id: string
          instalador_id: string
          inversor_local_aprovado: boolean | null
          lead_code: string | null
          nome_cliente: string
          observacoes: string | null
          placas_local_aprovado: boolean | null
          plaquinha_relogio: boolean | null
          synced: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adesivo_inversor?: boolean | null
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          avaliacao_atendimento?: string | null
          bairro?: string | null
          configuracao_wifi?: boolean | null
          created_at?: string
          data_instalacao: string
          endereco: string
          foto_servico?: boolean | null
          fotos_urls?: string[] | null
          id?: string
          instalador_id: string
          inversor_local_aprovado?: boolean | null
          lead_code?: string | null
          nome_cliente: string
          observacoes?: string | null
          placas_local_aprovado?: boolean | null
          plaquinha_relogio?: boolean | null
          synced?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          adesivo_inversor?: boolean | null
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          avaliacao_atendimento?: string | null
          bairro?: string | null
          configuracao_wifi?: boolean | null
          created_at?: string
          data_instalacao?: string
          endereco?: string
          foto_servico?: boolean | null
          fotos_urls?: string[] | null
          id?: string
          instalador_id?: string
          inversor_local_aprovado?: boolean | null
          lead_code?: string | null
          nome_cliente?: string
          observacoes?: string | null
          placas_local_aprovado?: boolean | null
          plaquinha_relogio?: boolean | null
          synced?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_instalacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists_instalador: {
        Row: {
          assinatura_cliente_url: string | null
          assinatura_instalador_url: string | null
          bairro: string | null
          cidade: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_agendada: string | null
          data_fim: string | null
          data_inicio: string | null
          endereco: string | null
          fase_atual:
            | Database["public"]["Enums"]["checklist_instalador_fase"]
            | null
          id: string
          instalador_id: string
          observacoes: string | null
          pendencias: string | null
          projeto_id: string
          status: Database["public"]["Enums"]["checklist_instalador_status"]
          supervisor_id: string | null
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          bairro?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          endereco?: string | null
          fase_atual?:
            | Database["public"]["Enums"]["checklist_instalador_fase"]
            | null
          id?: string
          instalador_id: string
          observacoes?: string | null
          pendencias?: string | null
          projeto_id: string
          status?: Database["public"]["Enums"]["checklist_instalador_status"]
          supervisor_id?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          bairro?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          endereco?: string | null
          fase_atual?:
            | Database["public"]["Enums"]["checklist_instalador_fase"]
            | null
          id?: string
          instalador_id?: string
          observacoes?: string | null
          pendencias?: string | null
          projeto_id?: string
          status?: Database["public"]["Enums"]["checklist_instalador_status"]
          supervisor_id?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_instalador_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_instalador_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_instalador_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_instalador_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_code: string
          complemento: string | null
          comprovante_beneficiaria_urls: string[] | null
          comprovante_endereco_url: string | null
          comprovante_endereco_urls: string[] | null
          cpf_cnpj: string | null
          created_at: string
          data_instalacao: string | null
          data_nascimento: string | null
          disjuntor_id: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          id: string
          identidade_url: string | null
          identidade_urls: string[] | null
          lead_id: string | null
          localizacao: string | null
          modelo_inversor: string | null
          nome: string
          numero: string | null
          numero_placas: number | null
          observacoes: string | null
          potencia_kwp: number | null
          rua: string | null
          simulacao_aceita_id: string | null
          telefone: string
          telefone_normalized: string | null
          tenant_id: string
          transformador_id: string | null
          updated_at: string
          valor_projeto: number | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_code: string
          complemento?: string | null
          comprovante_beneficiaria_urls?: string[] | null
          comprovante_endereco_url?: string | null
          comprovante_endereco_urls?: string[] | null
          cpf_cnpj?: string | null
          created_at?: string
          data_instalacao?: string | null
          data_nascimento?: string | null
          disjuntor_id?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          identidade_url?: string | null
          identidade_urls?: string[] | null
          lead_id?: string | null
          localizacao?: string | null
          modelo_inversor?: string | null
          nome: string
          numero?: string | null
          numero_placas?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          rua?: string | null
          simulacao_aceita_id?: string | null
          telefone: string
          telefone_normalized?: string | null
          tenant_id?: string
          transformador_id?: string | null
          updated_at?: string
          valor_projeto?: number | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_code?: string
          complemento?: string | null
          comprovante_beneficiaria_urls?: string[] | null
          comprovante_endereco_url?: string | null
          comprovante_endereco_urls?: string[] | null
          cpf_cnpj?: string | null
          created_at?: string
          data_instalacao?: string | null
          data_nascimento?: string | null
          disjuntor_id?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          id?: string
          identidade_url?: string | null
          identidade_urls?: string[] | null
          lead_id?: string | null
          localizacao?: string | null
          modelo_inversor?: string | null
          nome?: string
          numero?: string | null
          numero_placas?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          rua?: string | null
          simulacao_aceita_id?: string | null
          telefone?: string
          telefone_normalized?: string | null
          tenant_id?: string
          transformador_id?: string | null
          updated_at?: string
          valor_projeto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_disjuntor_id_fkey"
            columns: ["disjuntor_id"]
            isOneToOne: false
            referencedRelation: "disjuntores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_simulacao_aceita_id_fkey"
            columns: ["simulacao_aceita_id"]
            isOneToOne: false
            referencedRelation: "simulacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_transformador_id_fkey"
            columns: ["transformador_id"]
            isOneToOne: false
            referencedRelation: "transformadores"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          ano_referencia: number
          cliente_id: string | null
          consultor_id: string
          created_at: string
          descricao: string
          id: string
          mes_referencia: number
          observacoes: string | null
          percentual_comissao: number
          projeto_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor_base: number
          valor_comissao: number
        }
        Insert: {
          ano_referencia: number
          cliente_id?: string | null
          consultor_id: string
          created_at?: string
          descricao: string
          id?: string
          mes_referencia: number
          observacoes?: string | null
          percentual_comissao?: number
          projeto_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_base?: number
          valor_comissao?: number
        }
        Update: {
          ano_referencia?: number
          cliente_id?: string | null
          consultor_id?: string
          created_at?: string
          descricao?: string
          id?: string
          mes_referencia?: number
          observacoes?: string | null
          percentual_comissao?: number
          projeto_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_base?: number
          valor_comissao?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_plans: {
        Row: {
          commission_type: Database["public"]["Enums"]["commission_plan_type"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parameters: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          commission_type?: Database["public"]["Enums"]["commission_plan_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parameters?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          commission_type?: Database["public"]["Enums"]["commission_plan_type"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parameters?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      concessionaria_aneel_aliases: {
        Row: {
          alias_aneel: string
          concessionaria_id: string
          created_at: string
          created_by: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          alias_aneel: string
          concessionaria_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          alias_aneel?: string
          concessionaria_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concessionaria_aneel_aliases_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessionaria_aneel_aliases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      concessionaria_tarifas_subgrupo: {
        Row: {
          concessionaria_id: string
          created_at: string
          demanda_consumo_rs: number | null
          demanda_geracao_rs: number | null
          fio_b_fora_ponta: number | null
          fio_b_ponta: number | null
          id: string
          is_active: boolean | null
          modalidade_tarifaria: string | null
          origem: string | null
          subgrupo: string
          tarifa_energia: number | null
          tarifa_fio_b: number | null
          tarifacao_bt: number | null
          tarifacao_fora_ponta: number | null
          tarifacao_ponta: number | null
          te_fora_ponta: number | null
          te_ponta: number | null
          tenant_id: string
          tusd_fora_ponta: number | null
          tusd_ponta: number | null
          updated_at: string
          versao_id: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          concessionaria_id: string
          created_at?: string
          demanda_consumo_rs?: number | null
          demanda_geracao_rs?: number | null
          fio_b_fora_ponta?: number | null
          fio_b_ponta?: number | null
          id?: string
          is_active?: boolean | null
          modalidade_tarifaria?: string | null
          origem?: string | null
          subgrupo: string
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifacao_bt?: number | null
          tarifacao_fora_ponta?: number | null
          tarifacao_ponta?: number | null
          te_fora_ponta?: number | null
          te_ponta?: number | null
          tenant_id: string
          tusd_fora_ponta?: number | null
          tusd_ponta?: number | null
          updated_at?: string
          versao_id?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          concessionaria_id?: string
          created_at?: string
          demanda_consumo_rs?: number | null
          demanda_geracao_rs?: number | null
          fio_b_fora_ponta?: number | null
          fio_b_ponta?: number | null
          id?: string
          is_active?: boolean | null
          modalidade_tarifaria?: string | null
          origem?: string | null
          subgrupo?: string
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifacao_bt?: number | null
          tarifacao_fora_ponta?: number | null
          tarifacao_ponta?: number | null
          te_fora_ponta?: number | null
          te_ponta?: number | null
          tenant_id?: string
          tusd_fora_ponta?: number | null
          tusd_ponta?: number | null
          updated_at?: string
          versao_id?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concessionaria_tarifas_subgrupo_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessionaria_tarifas_subgrupo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concessionaria_tarifas_subgrupo_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "tarifa_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      concessionarias: {
        Row: {
          aliquota_icms: number | null
          ativo: boolean
          cofins_percentual: number | null
          created_at: string
          custo_disponibilidade_bifasico: number | null
          custo_disponibilidade_monofasico: number | null
          custo_disponibilidade_trifasico: number | null
          estado: string | null
          id: string
          nome: string
          nome_aneel_oficial: string | null
          percentual_isencao: number | null
          pis_percentual: number | null
          possui_isencao_scee: boolean | null
          sigla: string | null
          tarifa_energia: number | null
          tarifa_fio_b: number | null
          tarifa_fio_b_gd: number | null
          tenant_id: string
          ultima_sync_tarifas: string | null
          updated_at: string
        }
        Insert: {
          aliquota_icms?: number | null
          ativo?: boolean
          cofins_percentual?: number | null
          created_at?: string
          custo_disponibilidade_bifasico?: number | null
          custo_disponibilidade_monofasico?: number | null
          custo_disponibilidade_trifasico?: number | null
          estado?: string | null
          id?: string
          nome: string
          nome_aneel_oficial?: string | null
          percentual_isencao?: number | null
          pis_percentual?: number | null
          possui_isencao_scee?: boolean | null
          sigla?: string | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifa_fio_b_gd?: number | null
          tenant_id?: string
          ultima_sync_tarifas?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_icms?: number | null
          ativo?: boolean
          cofins_percentual?: number | null
          created_at?: string
          custo_disponibilidade_bifasico?: number | null
          custo_disponibilidade_monofasico?: number | null
          custo_disponibilidade_trifasico?: number | null
          estado?: string | null
          id?: string
          nome?: string
          nome_aneel_oficial?: string | null
          percentual_isencao?: number | null
          pis_percentual?: number | null
          possui_isencao_scee?: boolean | null
          sigla?: string | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifa_fio_b_gd?: number | null
          tenant_id?: string
          ultima_sync_tarifas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concessionarias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      config_tributaria_estado: {
        Row: {
          aliquota_icms: number
          created_at: string
          estado: string
          id: string
          observacoes: string | null
          percentual_isencao: number
          possui_isencao_scee: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          aliquota_icms?: number
          created_at?: string
          estado: string
          id?: string
          observacoes?: string | null
          percentual_isencao?: number
          possui_isencao_scee?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_icms?: number
          created_at?: string
          estado?: string
          id?: string
          observacoes?: string | null
          percentual_isencao?: number
          possui_isencao_scee?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consultor_achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          consultor_id: string
          id: string
          metadata: Json | null
          tenant_id: string
          unlocked_at: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          consultor_id: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          unlocked_at?: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          consultor_id?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_achievements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_achievements_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_metas: {
        Row: {
          ano: number
          comissao_percent: number | null
          consultor_id: string
          created_at: string
          id: string
          mes: number
          meta_conversoes: number | null
          meta_orcamentos: number | null
          meta_valor: number | null
          observacoes: string | null
          progresso_notificado: Json | null
          tenant_id: string
          updated_at: string
          usa_meta_individual: boolean
        }
        Insert: {
          ano: number
          comissao_percent?: number | null
          consultor_id: string
          created_at?: string
          id?: string
          mes: number
          meta_conversoes?: number | null
          meta_orcamentos?: number | null
          meta_valor?: number | null
          observacoes?: string | null
          progresso_notificado?: Json | null
          tenant_id?: string
          updated_at?: string
          usa_meta_individual?: boolean
        }
        Update: {
          ano?: number
          comissao_percent?: number | null
          consultor_id?: string
          created_at?: string
          id?: string
          mes?: number
          meta_conversoes?: number | null
          meta_orcamentos?: number | null
          meta_valor?: number | null
          observacoes?: string | null
          progresso_notificado?: Json | null
          tenant_id?: string
          updated_at?: string
          usa_meta_individual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_metas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_metas_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_metricas: {
        Row: {
          ano: number
          consultor_id: string
          created_at: string
          id: string
          leads_convertidos: number | null
          leads_perdidos: number | null
          leads_respondidos_24h: number | null
          mes: number
          taxa_resposta_rapida_percent: number | null
          taxa_retencao_percent: number | null
          tempo_medio_fechamento_dias: number | null
          tenant_id: string
          ticket_medio: number | null
          total_leads_atendidos: number | null
          updated_at: string
          valor_total_vendas: number | null
        }
        Insert: {
          ano: number
          consultor_id: string
          created_at?: string
          id?: string
          leads_convertidos?: number | null
          leads_perdidos?: number | null
          leads_respondidos_24h?: number | null
          mes: number
          taxa_resposta_rapida_percent?: number | null
          taxa_retencao_percent?: number | null
          tempo_medio_fechamento_dias?: number | null
          tenant_id?: string
          ticket_medio?: number | null
          total_leads_atendidos?: number | null
          updated_at?: string
          valor_total_vendas?: number | null
        }
        Update: {
          ano?: number
          consultor_id?: string
          created_at?: string
          id?: string
          leads_convertidos?: number | null
          leads_perdidos?: number | null
          leads_respondidos_24h?: number | null
          mes?: number
          taxa_resposta_rapida_percent?: number | null
          taxa_retencao_percent?: number | null
          tempo_medio_fechamento_dias?: number | null
          tenant_id?: string
          ticket_medio?: number | null
          total_leads_atendidos?: number | null
          updated_at?: string
          valor_total_vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_metricas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_metricas_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_performance_mensal: {
        Row: {
          ano: number
          consultor_id: string
          created_at: string
          id: string
          mes: number
          pontuacao_total: number
          posicao_ranking: number | null
          tempo_medio_resposta_horas: number | null
          tenant_id: string
          total_conversoes: number
          total_orcamentos: number
          updated_at: string
          valor_total_vendas: number
        }
        Insert: {
          ano: number
          consultor_id: string
          created_at?: string
          id?: string
          mes: number
          pontuacao_total?: number
          posicao_ranking?: number | null
          tempo_medio_resposta_horas?: number | null
          tenant_id?: string
          total_conversoes?: number
          total_orcamentos?: number
          updated_at?: string
          valor_total_vendas?: number
        }
        Update: {
          ano?: number
          consultor_id?: string
          created_at?: string
          id?: string
          mes?: number
          pontuacao_total?: number
          posicao_ranking?: number | null
          tempo_medio_resposta_horas?: number | null
          tenant_id?: string
          total_conversoes?: number
          total_orcamentos?: number
          updated_at?: string
          valor_total_vendas?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_performance_mensal_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_performance_mensal_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      consultores: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          email: string | null
          id: string
          nome: string
          percentual_comissao: number
          settings: Json | null
          slug: string | null
          telefone: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          percentual_comissao?: number
          settings?: Json | null
          slug?: string | null
          telefone: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          percentual_comissao?: number
          settings?: Json | null
          slug?: string | null
          telefone?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          last_interaction_at: string | null
          linked_cliente_id: string | null
          name: string | null
          owner_user_id: string | null
          phone_e164: string
          source: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          linked_cliente_id?: string | null
          name?: string | null
          owner_user_id?: string | null
          phone_e164: string
          source?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_interaction_at?: string | null
          linked_cliente_id?: string | null
          name?: string | null
          owner_user_id?: string | null
          phone_e164?: string
          source?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_linked_cliente_id_fkey"
            columns: ["linked_cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custo_faixas_kwp: {
        Row: {
          created_at: string
          custo_por_kwp: number
          descricao: string | null
          faixa_max_kwp: number
          faixa_min_kwp: number
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_por_kwp?: number
          descricao?: string | null
          faixa_max_kwp?: number
          faixa_min_kwp?: number
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_por_kwp?: number
          descricao?: string | null
          faixa_max_kwp?: number
          faixa_min_kwp?: number
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custo_faixas_kwp_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_queue: {
        Row: {
          created_at: string
          error_details: Json | null
          error_message: string | null
          failed_at: string
          id: string
          max_retries: number
          payload: Json | null
          resolved_at: string | null
          resolved_by: string | null
          retry_count: number
          source_id: string
          source_table: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          failed_at?: string
          id?: string
          max_retries?: number
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          source_id: string
          source_table: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          error_message?: string | null
          failed_at?: string
          id?: string
          max_retries?: number
          payload?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          retry_count?: number
          source_id?: string
          source_table?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["deal_activity_type"]
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["deal_activity_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["deal_activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deal_activity_status"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["deal_activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deal_activity_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_activity_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          ordem: number | null
          pipeline_ids: string[] | null
          tenant_id: string
          title: string
          visible_on_funnel: boolean | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          ordem?: number | null
          pipeline_ids?: string[] | null
          tenant_id: string
          title: string
          visible_on_funnel?: boolean | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          ordem?: number | null
          pipeline_ids?: string[] | null
          tenant_id?: string
          title?: string
          visible_on_funnel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_activity_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_custom_field_values: {
        Row: {
          created_at: string
          deal_id: string
          field_id: string
          id: string
          tenant_id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          field_id: string
          id?: string
          tenant_id: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          field_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_custom_field_values_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "deal_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_custom_field_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_custom_fields: {
        Row: {
          created_at: string
          field_context: string
          field_key: string
          field_type: string
          id: string
          important_on_funnel: boolean | null
          is_active: boolean | null
          options: Json | null
          ordem: number | null
          required_on_create: boolean | null
          required_on_funnel: boolean | null
          required_on_proposal: boolean | null
          show_on_create: boolean | null
          tenant_id: string
          title: string
          updated_at: string
          visible_on_funnel: boolean | null
        }
        Insert: {
          created_at?: string
          field_context?: string
          field_key: string
          field_type?: string
          id?: string
          important_on_funnel?: boolean | null
          is_active?: boolean | null
          options?: Json | null
          ordem?: number | null
          required_on_create?: boolean | null
          required_on_funnel?: boolean | null
          required_on_proposal?: boolean | null
          show_on_create?: boolean | null
          tenant_id: string
          title: string
          updated_at?: string
          visible_on_funnel?: boolean | null
        }
        Update: {
          created_at?: string
          field_context?: string
          field_key?: string
          field_type?: string
          id?: string
          important_on_funnel?: boolean | null
          is_active?: boolean | null
          options?: Json | null
          ordem?: number | null
          required_on_create?: boolean | null
          required_on_funnel?: boolean | null
          required_on_proposal?: boolean | null
          show_on_create?: boolean | null
          tenant_id?: string
          title?: string
          updated_at?: string
          visible_on_funnel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_kanban_projection: {
        Row: {
          cliente_code: string | null
          customer_name: string
          customer_phone: string | null
          deal_id: string
          deal_kwp: number | null
          deal_num: number | null
          deal_status: string
          deal_title: string
          deal_value: number
          etiqueta: string | null
          last_stage_change: string
          owner_id: string
          owner_name: string
          pipeline_id: string
          stage_id: string | null
          stage_name: string
          stage_position: number
          stage_probability: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cliente_code?: string | null
          customer_name?: string
          customer_phone?: string | null
          deal_id: string
          deal_kwp?: number | null
          deal_num?: number | null
          deal_status?: string
          deal_title?: string
          deal_value?: number
          etiqueta?: string | null
          last_stage_change?: string
          owner_id: string
          owner_name?: string
          pipeline_id: string
          stage_id?: string | null
          stage_name: string
          stage_position?: number
          stage_probability?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cliente_code?: string | null
          customer_name?: string
          customer_phone?: string | null
          deal_id?: string
          deal_kwp?: number | null
          deal_num?: number | null
          deal_status?: string
          deal_title?: string
          deal_value?: number
          etiqueta?: string | null
          last_stage_change?: string
          owner_id?: string
          owner_name?: string
          pipeline_id?: string
          stage_id?: string | null
          stage_name?: string
          stage_position?: number
          stage_probability?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_kanban_projection_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          deal_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          deal_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          deal_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_pipeline_stages: {
        Row: {
          added_at: string
          deal_id: string
          id: string
          pipeline_id: string
          stage_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          added_at?: string
          deal_id: string
          id?: string
          pipeline_id: string
          stage_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          added_at?: string
          deal_id?: string
          id?: string
          pipeline_id?: string
          stage_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_pipeline_stages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_pipeline_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          deal_id: string
          from_stage_id: string | null
          id: string
          metadata: Json | null
          moved_at: string
          moved_by: string | null
          tenant_id: string
          to_stage_id: string
        }
        Insert: {
          deal_id: string
          from_stage_id?: string | null
          id?: string
          metadata?: Json | null
          moved_at?: string
          moved_by?: string | null
          tenant_id: string
          to_stage_id: string
        }
        Update: {
          deal_id?: string
          from_stage_id?: string | null
          id?: string
          metadata?: Json | null
          moved_at?: string
          moved_by?: string | null
          tenant_id?: string
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          created_at: string
          customer_id: string
          deal_num: number
          doc_checklist: Json | null
          etiqueta: string | null
          expected_close_date: string | null
          id: string
          kwp: number | null
          motivo_perda_id: string | null
          motivo_perda_obs: string | null
          notas: string | null
          owner_id: string
          pipeline_id: string
          stage_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          deal_num: number
          doc_checklist?: Json | null
          etiqueta?: string | null
          expected_close_date?: string | null
          id?: string
          kwp?: number | null
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          notas?: string | null
          owner_id: string
          pipeline_id: string
          stage_id?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          deal_num?: number
          doc_checklist?: Json | null
          etiqueta?: string | null
          expected_close_date?: string | null
          id?: string
          kwp?: number | null
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          notas?: string | null
          owner_id?: string
          pipeline_id?: string
          stage_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_motivo_perda_id_fkey"
            columns: ["motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      disjuntores: {
        Row: {
          amperagem: number
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amperagem: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          amperagem?: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disjuntores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          default_signers: Json | null
          descricao: string | null
          docx_storage_path: string | null
          form_schema: Json | null
          id: string
          nome: string
          requires_signature_default: boolean
          status: string
          subcategoria: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          default_signers?: Json | null
          descricao?: string | null
          docx_storage_path?: string | null
          form_schema?: Json | null
          id?: string
          nome: string
          requires_signature_default?: boolean
          status?: string
          subcategoria?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          default_signers?: Json | null
          descricao?: string | null
          docx_storage_path?: string | null
          form_schema?: Json | null
          id?: string
          nome?: string
          requires_signature_default?: boolean
          status?: string
          subcategoria?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_rate_limits: {
        Row: {
          function_name: string
          id: string
          identifier: string
          request_count: number
          tenant_id: string | null
          window_start: string
        }
        Insert: {
          function_name: string
          id?: string
          identifier: string
          request_count?: number
          tenant_id?: string | null
          window_start?: string
        }
        Update: {
          function_name?: string
          id?: string
          identifier?: string
          request_count?: number
          tenant_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          custo_medio: number
          estoque_minimo: number
          id: string
          nome: string
          sku: string | null
          tenant_id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo_medio?: number
          estoque_minimo?: number
          id?: string
          nome: string
          sku?: string | null
          tenant_id: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          custo_medio?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          sku?: string | null
          tenant_id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_locais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_locais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentos: {
        Row: {
          created_at: string
          created_by: string | null
          custo_unitario: number | null
          id: string
          item_id: string
          local_id: string | null
          observacao: string | null
          origem: string
          quantidade: number
          ref_id: string | null
          ref_type: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custo_unitario?: number | null
          id?: string
          item_id: string
          local_id?: string | null
          observacao?: string | null
          origem?: string
          quantidade: number
          ref_id?: string | null
          ref_type?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custo_unitario?: number | null
          id?: string
          item_id?: string
          local_id?: string | null
          observacao?: string | null
          origem?: string
          quantidade?: number
          ref_id?: string | null
          ref_type?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_reservas: {
        Row: {
          created_at: string
          id: string
          item_id: string
          local_id: string | null
          quantidade_reservada: number
          ref_id: string | null
          ref_type: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          local_id?: string | null
          quantidade_reservada: number
          ref_id?: string | null
          ref_type?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          local_id?: string | null
          quantidade_reservada?: number
          ref_id?: string | null
          ref_type?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_reservas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_reservas_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "estoque_locais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_reservas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_ad_metrics: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          cpc: number
          cpl: number
          created_at: string
          ctr: number
          date: string
          id: string
          impressions: number
          leads_count: number
          spend: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          cpc?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date: string
          id?: string
          impressions?: number
          leads_count?: number
          spend?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          cpc?: number
          cpl?: number
          created_at?: string
          ctr?: number
          date?: string
          id?: string
          impressions?: number
          leads_count?: number
          spend?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_ad_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_leads: {
        Row: {
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_at: string
          error_message: string | null
          facebook_lead_id: string
          form_id: string | null
          id: string
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          page_id: string | null
          processed_at: string | null
          processing_status: string
          raw_json: Json
          received_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          facebook_lead_id: string
          form_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          page_id?: string | null
          processed_at?: string | null
          processing_status?: string
          raw_json?: Json
          received_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          facebook_lead_id?: string
          form_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          page_id?: string | null
          processed_at?: string | null
          processing_status?: string
          raw_json?: Json
          received_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamento_api_config: {
        Row: {
          api_key: string | null
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tenant_id: string
          ultima_sincronizacao: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          api_key?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          api_key?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_api_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamento_bancos: {
        Row: {
          api_customizada_url: string | null
          ativo: boolean
          codigo_bcb: string | null
          created_at: string
          fonte_sync: string | null
          id: string
          max_parcelas: number
          nome: string
          ordem: number
          taxa_mensal: number
          tenant_id: string
          ultima_sync: string | null
          updated_at: string
        }
        Insert: {
          api_customizada_url?: string | null
          ativo?: boolean
          codigo_bcb?: string | null
          created_at?: string
          fonte_sync?: string | null
          id?: string
          max_parcelas?: number
          nome: string
          ordem?: number
          taxa_mensal: number
          tenant_id?: string
          ultima_sync?: string | null
          updated_at?: string
        }
        Update: {
          api_customizada_url?: string | null
          ativo?: boolean
          codigo_bcb?: string | null
          created_at?: string
          fonte_sync?: string | null
          id?: string
          max_parcelas?: number
          nome?: string
          ordem?: number
          taxa_mensal?: number
          tenant_id?: string
          ultima_sync?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_bancos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fio_b_escalonamento: {
        Row: {
          ano: number
          created_at: string
          id: string
          percentual_nao_compensado: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          percentual_nao_compensado?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          percentual_nao_compensado?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_idempotency: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          result: Json | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          result?: Json | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          result?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_idempotency_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_events: {
        Row: {
          created_at: string
          event_source: string
          event_type: string
          id: string
          invoice_id: string
          new_status: string | null
          old_status: string | null
          payload: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_source?: string
          event_type: string
          id?: string
          invoice_id: string
          new_status?: string | null
          old_status?: string | null
          payload?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_source?: string
          event_type?: string
          id?: string
          invoice_id?: string
          new_status?: string | null
          old_status?: string | null
          payload?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          tenant_id: string
          total_value: number
          unit_value: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          tenant_id: string
          total_value?: number
          unit_value?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          tenant_id?: string
          total_value?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          asaas_invoice_id: string | null
          cliente_id: string | null
          created_at: string
          customer_id: string | null
          deductions: number | null
          effective_date: string
          error_details: Json | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          installment_id: string | null
          invoice_number: string | null
          municipal_service_code: string | null
          municipal_service_id: string | null
          municipal_service_name: string | null
          observations: string | null
          payment_id: string | null
          pdf_url: string | null
          recebimento_id: string | null
          rps_number: string | null
          service_description: string
          snapshot_json: Json | null
          snapshot_locked: boolean
          status: string
          status_asaas: string | null
          taxes: Json | null
          tenant_id: string
          updated_at: string
          validation_code: string | null
          value: number
          xml_url: string | null
        }
        Insert: {
          asaas_invoice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          customer_id?: string | null
          deductions?: number | null
          effective_date?: string
          error_details?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          installment_id?: string | null
          invoice_number?: string | null
          municipal_service_code?: string | null
          municipal_service_id?: string | null
          municipal_service_name?: string | null
          observations?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          recebimento_id?: string | null
          rps_number?: string | null
          service_description?: string
          snapshot_json?: Json | null
          snapshot_locked?: boolean
          status?: string
          status_asaas?: string | null
          taxes?: Json | null
          tenant_id: string
          updated_at?: string
          validation_code?: string | null
          value?: number
          xml_url?: string | null
        }
        Update: {
          asaas_invoice_id?: string | null
          cliente_id?: string | null
          created_at?: string
          customer_id?: string | null
          deductions?: number | null
          effective_date?: string
          error_details?: Json | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          installment_id?: string | null
          invoice_number?: string | null
          municipal_service_code?: string | null
          municipal_service_id?: string | null
          municipal_service_name?: string | null
          observations?: string | null
          payment_id?: string | null
          pdf_url?: string | null
          recebimento_id?: string | null
          rps_number?: string | null
          service_description?: string
          snapshot_json?: Json | null
          snapshot_locked?: boolean
          status?: string
          status_asaas?: string | null
          taxes?: Json | null
          tenant_id?: string
          updated_at?: string
          validation_code?: string | null
          value?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_municipal_requirements: {
        Row: {
          created_at: string
          id: string
          municipality_code: string | null
          municipality_name: string | null
          raw_response: Json | null
          required_fields: Json
          synced_at: string
          tenant_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipality_code?: string | null
          municipality_name?: string | null
          raw_response?: Json | null
          required_fields?: Json
          synced_at?: string
          tenant_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          municipality_code?: string | null
          municipality_name?: string | null
          raw_response?: Json | null
          required_fields?: Json
          synced_at?: string
          tenant_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_municipal_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_municipal_services: {
        Row: {
          asaas_service_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_manual: boolean
          service_code: string | null
          service_name: string
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          asaas_service_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          service_code?: string | null
          service_name: string
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          asaas_service_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_manual?: boolean
          service_code?: string | null
          service_name?: string
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_municipal_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_provider_requests: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          invoice_id: string | null
          method: string
          request_body_redacted: Json | null
          response_body_redacted: Json | null
          response_status: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          request_body_redacted?: Json | null
          response_body_redacted?: Json | null
          response_status?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          method?: string
          request_body_redacted?: Json | null
          response_body_redacted?: Json | null
          response_status?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_provider_requests_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_provider_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_provider_webhooks: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          id: string
          invoice_id: string | null
          processed: boolean
          processed_at: string | null
          raw_payload: Json
          signature_valid: boolean | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          invoice_id?: string | null
          processed?: boolean
          processed_at?: string | null
          raw_payload: Json
          signature_valid?: boolean | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          id?: string
          invoice_id?: string | null
          processed?: boolean
          processed_at?: string | null
          raw_payload?: Json
          signature_valid?: boolean | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_provider_webhooks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          allow_deductions: boolean
          auto_issue_on_payment: boolean
          cnpj_emitente: string | null
          created_at: string
          default_effective_date_rule: string | null
          default_observations: string | null
          default_service_description: string | null
          default_taxes: Json | null
          environment: string
          homologation_tested: boolean
          homologation_tested_at: string | null
          id: string
          inscricao_municipal: string | null
          is_active: boolean
          municipio_emitente: string | null
          portal_nacional_enabled: boolean
          provider: string
          regime_tributario: string | null
          tenant_id: string
          uf_emitente: string | null
          updated_at: string
        }
        Insert: {
          allow_deductions?: boolean
          auto_issue_on_payment?: boolean
          cnpj_emitente?: string | null
          created_at?: string
          default_effective_date_rule?: string | null
          default_observations?: string | null
          default_service_description?: string | null
          default_taxes?: Json | null
          environment?: string
          homologation_tested?: boolean
          homologation_tested_at?: string | null
          id?: string
          inscricao_municipal?: string | null
          is_active?: boolean
          municipio_emitente?: string | null
          portal_nacional_enabled?: boolean
          provider?: string
          regime_tributario?: string | null
          tenant_id: string
          uf_emitente?: string | null
          updated_at?: string
        }
        Update: {
          allow_deductions?: boolean
          auto_issue_on_payment?: boolean
          cnpj_emitente?: string | null
          created_at?: string
          default_effective_date_rule?: string | null
          default_observations?: string | null
          default_service_description?: string | null
          default_taxes?: Json | null
          environment?: string
          homologation_tested?: boolean
          homologation_tested_at?: string | null
          id?: string
          inscricao_municipal?: string | null
          is_active?: boolean
          municipio_emitente?: string | null
          portal_nacional_enabled?: boolean
          provider?: string
          regime_tributario?: string | null
          tenant_id?: string
          uf_emitente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          categorias: string[] | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          observacoes: string | null
          site: string | null
          telefone: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categorias?: string[] | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          observacoes?: string | null
          site?: string | null
          telefone?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categorias?: string[] | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          observacoes?: string | null
          site?: string | null
          telefone?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_config: {
        Row: {
          achievement_points: Json
          comissao_base_percent: number
          comissao_bonus_meta_percent: number
          created_at: string
          id: string
          meta_conversoes_mensal: number
          meta_orcamentos_mensal: number
          meta_valor_mensal: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          achievement_points?: Json
          comissao_base_percent?: number
          comissao_bonus_meta_percent?: number
          created_at?: string
          id?: string
          meta_conversoes_mensal?: number
          meta_orcamentos_mensal?: number
          meta_valor_mensal?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          achievement_points?: Json
          comissao_base_percent?: number
          comissao_bonus_meta_percent?: number
          created_at?: string
          id?: string
          meta_conversoes_mensal?: number
          meta_orcamentos_mensal?: number
          meta_valor_mensal?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          docx_filled_path: string | null
          envelope_id: string | null
          id: string
          input_payload: Json | null
          lead_id: string | null
          pdf_path: string | null
          projeto_id: string | null
          signature_provider: string | null
          signature_status: string | null
          signed_at: string | null
          status: string
          template_id: string
          template_version: number
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          docx_filled_path?: string | null
          envelope_id?: string | null
          id?: string
          input_payload?: Json | null
          lead_id?: string | null
          pdf_path?: string | null
          projeto_id?: string | null
          signature_provider?: string | null
          signature_status?: string | null
          signed_at?: string | null
          status?: string
          template_id: string
          template_version?: number
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          docx_filled_path?: string | null
          envelope_id?: string | null
          id?: string
          input_payload?: Json | null
          lead_id?: string | null
          pdf_path?: string | null
          projeto_id?: string | null
          signature_provider?: string | null
          signature_status?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string
          template_version?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_config: {
        Row: {
          access_token: string | null
          ativo: boolean
          created_at: string
          id: string
          tenant_id: string
          ultima_sincronizacao: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          tenant_id?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          id?: string
          tenant_id?: string
          ultima_sincronizacao?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          instagram_id: string
          media_type: string | null
          media_url: string
          permalink: string | null
          tenant_id: string
          thumbnail_url: string | null
          timestamp: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          instagram_id: string
          media_type?: string | null
          media_url: string
          permalink?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          instagram_id?: string
          media_type?: string | null
          media_url?: string
          permalink?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instalador_config: {
        Row: {
          bonus_meta_atingida: number
          created_at: string
          id: string
          meta_avaliacoes_positivas: number
          meta_servicos_mensal: number
          meta_tempo_medio_minutos: number
          pontos_por_avaliacao_positiva: number
          pontos_por_servico: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bonus_meta_atingida?: number
          created_at?: string
          id?: string
          meta_avaliacoes_positivas?: number
          meta_servicos_mensal?: number
          meta_tempo_medio_minutos?: number
          pontos_por_avaliacao_positiva?: number
          pontos_por_servico?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          bonus_meta_atingida?: number
          created_at?: string
          id?: string
          meta_avaliacoes_positivas?: number
          meta_servicos_mensal?: number
          meta_tempo_medio_minutos?: number
          pontos_por_avaliacao_positiva?: number
          pontos_por_servico?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalador_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instalador_metas: {
        Row: {
          created_at: string
          id: string
          instalador_id: string
          meta_avaliacoes_positivas: number
          meta_servicos_mensal: number
          meta_tempo_medio_minutos: number
          tenant_id: string
          updated_at: string
          usar_metas_individuais: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          instalador_id: string
          meta_avaliacoes_positivas?: number
          meta_servicos_mensal?: number
          meta_tempo_medio_minutos?: number
          tenant_id?: string
          updated_at?: string
          usar_metas_individuais?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          instalador_id?: string
          meta_avaliacoes_positivas?: number
          meta_servicos_mensal?: number
          meta_tempo_medio_minutos?: number
          tenant_id?: string
          updated_at?: string
          usar_metas_individuais?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "instalador_metas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instalador_performance_mensal: {
        Row: {
          ano: number
          avaliacoes_positivas: number
          avaliacoes_totais: number
          created_at: string
          id: string
          instalador_id: string
          mes: number
          pontuacao_total: number
          servicos_concluidos: number
          tempo_medio_minutos: number | null
          tenant_id: string
          total_servicos: number
          updated_at: string
        }
        Insert: {
          ano: number
          avaliacoes_positivas?: number
          avaliacoes_totais?: number
          created_at?: string
          id?: string
          instalador_id: string
          mes: number
          pontuacao_total?: number
          servicos_concluidos?: number
          tempo_medio_minutos?: number | null
          tenant_id?: string
          total_servicos?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          avaliacoes_positivas?: number
          avaliacoes_totais?: number
          created_at?: string
          id?: string
          instalador_id?: string
          mes?: number
          pontuacao_total?: number
          servicos_concluidos?: number
          tempo_medio_minutos?: number | null
          tenant_id?: string
          total_servicos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalador_performance_mensal_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_audit_events: {
        Row: {
          action: Database["public"]["Enums"]["integration_audit_action"]
          actor_id: string | null
          actor_type: string
          created_at: string
          id: string
          integration_id: string | null
          ip: string | null
          metadata_json: Json | null
          result: string
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["integration_audit_action"]
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          integration_id?: string | null
          ip?: string | null
          metadata_json?: Json | null
          result?: string
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["integration_audit_action"]
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          integration_id?: string | null
          ip?: string | null
          metadata_json?: Json | null
          result?: string
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_audit_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          last_validated_at: string | null
          service_key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          service_key: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_validated_at?: string | null
          service_key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          expires_at: string | null
          id: string
          integration_id: string
          refresh_token_encrypted: string | null
          revoked_at: string | null
          rotated_at: string | null
          tenant_id: string
          token_type: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id: string
          refresh_token_encrypted?: string | null
          revoked_at?: string | null
          rotated_at?: string | null
          tenant_id: string
          token_type?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_id?: string
          refresh_token_encrypted?: string | null
          revoked_at?: string | null
          rotated_at?: string | null
          tenant_id?: string
          token_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_health_cache: {
        Row: {
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          integration_name: string
          last_check_at: string
          latency_ms: number | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_name: string
          last_check_at?: string
          latency_ms?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_name?: string
          last_check_at?: string
          latency_ms?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_health_cache_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_endpoints: {
        Row: {
          created_at: string
          endpoint_url: string
          id: string
          integration_id: string
          is_active: boolean
          provider: Database["public"]["Enums"]["integration_provider"]
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          endpoint_url: string
          id?: string
          integration_id: string
          is_active?: boolean
          provider: Database["public"]["Enums"]["integration_provider"]
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          endpoint_url?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          provider?: Database["public"]["Enums"]["integration_provider"]
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhook_endpoints_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_account_email: string | null
          created_at: string
          default_calendar_id: string | null
          default_calendar_name: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_test_at: string | null
          last_test_status: string | null
          metadata: Json | null
          oauth_client_id: string | null
          oauth_client_secret_encrypted: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes: string[] | null
          status: Database["public"]["Enums"]["integration_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connected_account_email?: string | null
          created_at?: string
          default_calendar_id?: string | null
          default_calendar_name?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          metadata?: Json | null
          oauth_client_id?: string | null
          oauth_client_secret_encrypted?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connected_account_email?: string | null
          created_at?: string
          default_calendar_id?: string | null
          default_calendar_name?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_test_at?: string | null
          last_test_status?: string | null
          metadata?: Json | null
          oauth_client_id?: string | null
          oauth_client_secret_encrypted?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["integration_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_members: {
        Row: {
          chat_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_members_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          sender_id: string
          tenant_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_id: string
          tenant_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          sender_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "internal_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chats: {
        Row: {
          chat_type: string
          created_at: string
          created_by: string
          id: string
          name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          chat_type?: string
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          chat_type?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inversores: {
        Row: {
          ativo: boolean
          corrente_max_mppt_a: number | null
          created_at: string
          eficiencia_percent: string | null
          fabricante: string
          id: string
          modelo: string
          mppts: number | null
          potencia_maxima_w: number | null
          potencia_nominal_w: number
          tenant_id: string
          tensao_linha_v: number | null
          tensao_max_mppt_v: number | null
          tensao_max_v: number | null
          tensao_min_mppt_v: number | null
          tipo_sistema: Database["public"]["Enums"]["tipo_sistema_inversor"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          corrente_max_mppt_a?: number | null
          created_at?: string
          eficiencia_percent?: string | null
          fabricante: string
          id?: string
          modelo: string
          mppts?: number | null
          potencia_maxima_w?: number | null
          potencia_nominal_w: number
          tenant_id?: string
          tensao_linha_v?: number | null
          tensao_max_mppt_v?: number | null
          tensao_max_v?: number | null
          tensao_min_mppt_v?: number | null
          tipo_sistema?: Database["public"]["Enums"]["tipo_sistema_inversor"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          corrente_max_mppt_a?: number | null
          created_at?: string
          eficiencia_percent?: string | null
          fabricante?: string
          id?: string
          modelo?: string
          mppts?: number | null
          potencia_maxima_w?: number | null
          potencia_nominal_w?: number
          tenant_id?: string
          tensao_linha_v?: number | null
          tensao_max_mppt_v?: number | null
          tensao_max_v?: number | null
          tensao_min_mppt_v?: number | null
          tipo_sistema?: Database["public"]["Enums"]["tipo_sistema_inversor"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inversores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inversores_catalogo: {
        Row: {
          ativo: boolean
          corrente_entrada_max_a: number | null
          created_at: string
          dimensoes_mm: string | null
          eficiencia_max_percent: number | null
          fabricante: string
          fases: string
          garantia_anos: number | null
          id: string
          ip_protection: string | null
          modelo: string
          mppt_count: number | null
          peso_kg: number | null
          potencia_nominal_kw: number
          strings_por_mppt: number | null
          tenant_id: string | null
          tensao_entrada_max_v: number | null
          tensao_saida_v: number | null
          tipo: string
          updated_at: string
          wifi_integrado: boolean | null
        }
        Insert: {
          ativo?: boolean
          corrente_entrada_max_a?: number | null
          created_at?: string
          dimensoes_mm?: string | null
          eficiencia_max_percent?: number | null
          fabricante: string
          fases?: string
          garantia_anos?: number | null
          id?: string
          ip_protection?: string | null
          modelo: string
          mppt_count?: number | null
          peso_kg?: number | null
          potencia_nominal_kw: number
          strings_por_mppt?: number | null
          tenant_id?: string | null
          tensao_entrada_max_v?: number | null
          tensao_saida_v?: number | null
          tipo?: string
          updated_at?: string
          wifi_integrado?: boolean | null
        }
        Update: {
          ativo?: boolean
          corrente_entrada_max_a?: number | null
          created_at?: string
          dimensoes_mm?: string | null
          eficiencia_max_percent?: number | null
          fabricante?: string
          fases?: string
          garantia_anos?: number | null
          id?: string
          ip_protection?: string | null
          modelo?: string
          mppt_count?: number | null
          peso_kg?: number | null
          potencia_nominal_kw?: number
          strings_por_mppt?: number | null
          tenant_id?: string | null
          tensao_entrada_max_v?: number | null
          tensao_saida_v?: number | null
          tipo?: string
          updated_at?: string
          wifi_integrado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "inversores_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      irradiacao_por_estado: {
        Row: {
          created_at: string
          estado: string
          fonte: string | null
          geracao_media_kwp_mes: number
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado: string
          fonte?: string | null
          geracao_media_kwp_mes?: number
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string
          fonte?: string | null
          geracao_media_kwp_mes?: number
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irradiacao_por_estado_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      irradiance_dataset_versions: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          dataset_id: string
          id: string
          ingested_at: string
          metadata: Json
          row_count: number
          source_note: string | null
          status: string
          updated_at: string
          version_tag: string
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          dataset_id: string
          id?: string
          ingested_at?: string
          metadata?: Json
          row_count?: number
          source_note?: string | null
          status?: string
          updated_at?: string
          version_tag: string
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          dataset_id?: string
          id?: string
          ingested_at?: string
          metadata?: Json
          row_count?: number
          source_note?: string | null
          status?: string
          updated_at?: string
          version_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "irradiance_dataset_versions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "irradiance_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      irradiance_datasets: {
        Row: {
          code: string
          coverage: Json
          created_at: string
          default_unit: string
          description: string | null
          id: string
          name: string
          provider: string
          resolution_km: number | null
          updated_at: string
        }
        Insert: {
          code: string
          coverage?: Json
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name: string
          provider: string
          resolution_km?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          coverage?: Json
          created_at?: string
          default_unit?: string
          description?: string | null
          id?: string
          name?: string
          provider?: string
          resolution_km?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      irradiance_lookup_cache: {
        Row: {
          created_at: string
          distance_km: number | null
          id: number
          lat_round: number
          lon_round: number
          method: string
          point_lat: number | null
          point_lon: number | null
          series: Json
          version_id: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          id?: number
          lat_round: number
          lon_round: number
          method?: string
          point_lat?: number | null
          point_lon?: number | null
          series: Json
          version_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          id?: number
          lat_round?: number
          lon_round?: number
          method?: string
          point_lat?: number | null
          point_lon?: number | null
          series?: Json
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irradiance_lookup_cache_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      irradiance_points_monthly: {
        Row: {
          dhi_m01: number | null
          dhi_m02: number | null
          dhi_m03: number | null
          dhi_m04: number | null
          dhi_m05: number | null
          dhi_m06: number | null
          dhi_m07: number | null
          dhi_m08: number | null
          dhi_m09: number | null
          dhi_m10: number | null
          dhi_m11: number | null
          dhi_m12: number | null
          dni_m01: number | null
          dni_m02: number | null
          dni_m03: number | null
          dni_m04: number | null
          dni_m05: number | null
          dni_m06: number | null
          dni_m07: number | null
          dni_m08: number | null
          dni_m09: number | null
          dni_m10: number | null
          dni_m11: number | null
          dni_m12: number | null
          id: number
          lat: number
          lon: number
          m01: number
          m02: number
          m03: number
          m04: number
          m05: number
          m06: number
          m07: number
          m08: number
          m09: number
          m10: number
          m11: number
          m12: number
          plane: string
          unit: string
          version_id: string
        }
        Insert: {
          dhi_m01?: number | null
          dhi_m02?: number | null
          dhi_m03?: number | null
          dhi_m04?: number | null
          dhi_m05?: number | null
          dhi_m06?: number | null
          dhi_m07?: number | null
          dhi_m08?: number | null
          dhi_m09?: number | null
          dhi_m10?: number | null
          dhi_m11?: number | null
          dhi_m12?: number | null
          dni_m01?: number | null
          dni_m02?: number | null
          dni_m03?: number | null
          dni_m04?: number | null
          dni_m05?: number | null
          dni_m06?: number | null
          dni_m07?: number | null
          dni_m08?: number | null
          dni_m09?: number | null
          dni_m10?: number | null
          dni_m11?: number | null
          dni_m12?: number | null
          id?: number
          lat: number
          lon: number
          m01?: number
          m02?: number
          m03?: number
          m04?: number
          m05?: number
          m06?: number
          m07?: number
          m08?: number
          m09?: number
          m10?: number
          m11?: number
          m12?: number
          plane?: string
          unit?: string
          version_id: string
        }
        Update: {
          dhi_m01?: number | null
          dhi_m02?: number | null
          dhi_m03?: number | null
          dhi_m04?: number | null
          dhi_m05?: number | null
          dhi_m06?: number | null
          dhi_m07?: number | null
          dhi_m08?: number | null
          dhi_m09?: number | null
          dhi_m10?: number | null
          dhi_m11?: number | null
          dhi_m12?: number | null
          dni_m01?: number | null
          dni_m02?: number | null
          dni_m03?: number | null
          dni_m04?: number | null
          dni_m05?: number | null
          dni_m06?: number | null
          dni_m07?: number | null
          dni_m08?: number | null
          dni_m09?: number | null
          dni_m10?: number | null
          dni_m11?: number | null
          dni_m12?: number | null
          id?: number
          lat?: number
          lon?: number
          m01?: number
          m02?: number
          m03?: number
          m04?: number
          m05?: number
          m06?: number
          m07?: number
          m08?: number
          m09?: number
          m10?: number
          m11?: number
          m12?: number
          plane?: string
          unit?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irradiance_points_monthly_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      irradiance_transposed_monthly: {
        Row: {
          azimuth_deg: number
          computed_at: string
          computed_by: string | null
          dhi_source: string
          id: number
          lat: number
          lon: number
          losses_assumptions: Json | null
          poa_m01: number
          poa_m02: number
          poa_m03: number
          poa_m04: number
          poa_m05: number
          poa_m06: number
          poa_m07: number
          poa_m08: number
          poa_m09: number
          poa_m10: number
          poa_m11: number
          poa_m12: number
          source_point_id: number
          tilt_deg: number
          transposition_model: string
          unit: string
          version_id: string
        }
        Insert: {
          azimuth_deg: number
          computed_at?: string
          computed_by?: string | null
          dhi_source?: string
          id?: never
          lat: number
          lon: number
          losses_assumptions?: Json | null
          poa_m01?: number
          poa_m02?: number
          poa_m03?: number
          poa_m04?: number
          poa_m05?: number
          poa_m06?: number
          poa_m07?: number
          poa_m08?: number
          poa_m09?: number
          poa_m10?: number
          poa_m11?: number
          poa_m12?: number
          source_point_id: number
          tilt_deg: number
          transposition_model?: string
          unit?: string
          version_id: string
        }
        Update: {
          azimuth_deg?: number
          computed_at?: string
          computed_by?: string | null
          dhi_source?: string
          id?: never
          lat?: number
          lon?: number
          losses_assumptions?: Json | null
          poa_m01?: number
          poa_m02?: number
          poa_m03?: number
          poa_m04?: number
          poa_m05?: number
          poa_m06?: number
          poa_m07?: number
          poa_m08?: number
          poa_m09?: number
          poa_m10?: number
          poa_m11?: number
          poa_m12?: number
          source_point_id?: number
          tilt_deg?: number
          transposition_model?: string
          unit?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irradiance_transposed_monthly_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      layouts_solares: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          layout_data: Json
          nome: string
          potencia_estimada_kwp: number | null
          projeto_id: string | null
          servico_id: string | null
          tenant_id: string
          thumbnail_url: string | null
          tipo_telhado: string | null
          total_modulos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          layout_data?: Json
          nome?: string
          potencia_estimada_kwp?: number | null
          projeto_id?: string | null
          servico_id?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          tipo_telhado?: string | null
          total_modulos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          layout_data?: Json
          nome?: string
          potencia_estimada_kwp?: number | null
          projeto_id?: string | null
          servico_id?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          tipo_telhado?: string | null
          total_modulos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "layouts_solares_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layouts_solares_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layouts_solares_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_agendados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layouts_solares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_atividades: {
        Row: {
          concluido: boolean | null
          created_at: string
          created_by: string | null
          data_agendada: string | null
          descricao: string
          id: string
          lead_id: string
          metadata: Json | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["atividade_tipo"]
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          descricao: string
          id?: string
          lead_id: string
          metadata?: Json | null
          tenant_id?: string
          tipo: Database["public"]["Enums"]["atividade_tipo"]
        }
        Update: {
          concluido?: boolean | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          descricao?: string
          id?: string
          lead_id?: string
          metadata?: Json | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["atividade_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_atividades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_log: {
        Row: {
          consultor_anterior_id: string | null
          consultor_id: string
          distribuido_em: string | null
          distribuido_por: string | null
          id: string
          lead_id: string
          motivo: string | null
          rule_id: string | null
          tenant_id: string
        }
        Insert: {
          consultor_anterior_id?: string | null
          consultor_id: string
          distribuido_em?: string | null
          distribuido_por?: string | null
          id?: string
          lead_id: string
          motivo?: string | null
          rule_id?: string | null
          tenant_id?: string
        }
        Update: {
          consultor_anterior_id?: string | null
          consultor_id?: string
          distribuido_em?: string | null
          distribuido_por?: string | null
          id?: string
          lead_id?: string
          motivo?: string | null
          rule_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "lead_distribution_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_vendedor_anterior_id_fkey"
            columns: ["consultor_anterior_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_log_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_rules: {
        Row: {
          ativo: boolean | null
          config: Json | null
          created_at: string | null
          id: string
          nome: string
          tenant_id: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          nome: string
          tenant_id?: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          config?: Json | null
          created_at?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_links: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          link_reason: string
          sm_client_id: number
          sm_project_id: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          link_reason?: string
          sm_client_id: number
          sm_project_id?: number | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          link_reason?: string
          sm_client_id?: number
          sm_project_id?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_links_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scores: {
        Row: {
          calculado_em: string
          created_at: string
          fatores: Json
          id: string
          lead_id: string
          nivel: string
          probabilidade_fechamento: number
          recomendacao: string | null
          score: number
          score_consumo: number
          score_engajamento: number
          score_localizacao: number
          score_perfil_tecnico: number
          score_recencia: number
          score_tempo_resposta: number
          tenant_id: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          calculado_em?: string
          created_at?: string
          fatores?: Json
          id?: string
          lead_id: string
          nivel?: string
          probabilidade_fechamento?: number
          recomendacao?: string | null
          score?: number
          score_consumo?: number
          score_engajamento?: number
          score_localizacao?: number
          score_perfil_tecnico?: number
          score_recencia?: number
          score_tempo_resposta?: number
          tenant_id?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          calculado_em?: string
          created_at?: string
          fatores?: Json
          id?: string
          lead_id?: string
          nivel?: string
          probabilidade_fechamento?: number
          recomendacao?: string | null
          score?: number
          score_consumo?: number
          score_engajamento?: number
          score_localizacao?: number
          score_perfil_tecnico?: number
          score_recencia?: number
          score_tempo_resposta?: number
          tenant_id?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scoring_config: {
        Row: {
          consumo_alto_min: number
          consumo_medio_min: number
          created_at: string
          id: string
          peso_consumo: number
          peso_engajamento: number
          peso_localizacao: number
          peso_perfil_tecnico: number
          peso_recencia: number
          peso_tempo_resposta: number
          probabilidade_cold: number
          probabilidade_hot: number
          probabilidade_warm: number
          recencia_morna_max: number
          recencia_quente_max: number
          tenant_id: string
          threshold_hot: number
          threshold_warm: number
          ticket_medio: number
          updated_at: string
        }
        Insert: {
          consumo_alto_min?: number
          consumo_medio_min?: number
          created_at?: string
          id?: string
          peso_consumo?: number
          peso_engajamento?: number
          peso_localizacao?: number
          peso_perfil_tecnico?: number
          peso_recencia?: number
          peso_tempo_resposta?: number
          probabilidade_cold?: number
          probabilidade_hot?: number
          probabilidade_warm?: number
          recencia_morna_max?: number
          recencia_quente_max?: number
          tenant_id?: string
          threshold_hot?: number
          threshold_warm?: number
          ticket_medio?: number
          updated_at?: string
        }
        Update: {
          consumo_alto_min?: number
          consumo_medio_min?: number
          created_at?: string
          id?: string
          peso_consumo?: number
          peso_engajamento?: number
          peso_localizacao?: number
          peso_perfil_tecnico?: number
          peso_recencia?: number
          peso_tempo_resposta?: number
          probabilidade_cold?: number
          probabilidade_hot?: number
          probabilidade_warm?: number
          recencia_morna_max?: number
          recencia_quente_max?: number
          tenant_id?: string
          threshold_hot?: number
          threshold_warm?: number
          ticket_medio?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_status: {
        Row: {
          cor: string
          created_at: string
          id: string
          motivo_perda_obrigatorio: boolean | null
          nome: string
          ordem: number
          probabilidade_peso: number | null
          tenant_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          motivo_perda_obrigatorio?: boolean | null
          nome: string
          ordem: number
          probabilidade_peso?: number | null
          tenant_id?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          motivo_perda_obrigatorio?: boolean | null
          nome?: string
          ordem?: number
          probabilidade_peso?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          area: string
          arquivos_urls: string[] | null
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          consultor: string | null
          consultor_id: string
          consumo_previsto: number
          created_at: string
          data_proxima_acao: string | null
          deleted_at: string | null
          deleted_by: string | null
          distribuido_em: string | null
          estado: string
          id: string
          lead_code: string | null
          media_consumo: number
          motivo_perda_id: string | null
          motivo_perda_obs: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          origem: string | null
          proxima_acao: string | null
          rede_atendimento: string
          rua: string | null
          status_id: string | null
          telefone: string
          telefone_normalized: string | null
          tenant_id: string
          tipo_telhado: string
          ultimo_contato: string | null
          updated_at: string
          valor_estimado: number | null
          visto: boolean
          visto_admin: boolean
          wa_welcome_error: string | null
          wa_welcome_sent: boolean
          wa_welcome_status: string
        }
        Insert: {
          area: string
          arquivos_urls?: string[] | null
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          consultor?: string | null
          consultor_id?: string
          consumo_previsto: number
          created_at?: string
          data_proxima_acao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          distribuido_em?: string | null
          estado: string
          id?: string
          lead_code?: string | null
          media_consumo: number
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          proxima_acao?: string | null
          rede_atendimento: string
          rua?: string | null
          status_id?: string | null
          telefone: string
          telefone_normalized?: string | null
          tenant_id?: string
          tipo_telhado: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          visto?: boolean
          visto_admin?: boolean
          wa_welcome_error?: string | null
          wa_welcome_sent?: boolean
          wa_welcome_status?: string
        }
        Update: {
          area?: string
          arquivos_urls?: string[] | null
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          consultor?: string | null
          consultor_id?: string
          consumo_previsto?: number
          created_at?: string
          data_proxima_acao?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          distribuido_em?: string | null
          estado?: string
          id?: string
          lead_code?: string | null
          media_consumo?: number
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          origem?: string | null
          proxima_acao?: string | null
          rede_atendimento?: string
          rua?: string | null
          status_id?: string | null
          telefone?: string
          telefone_normalized?: string | null
          tenant_id?: string
          tipo_telhado?: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          visto?: boolean
          visto_admin?: boolean
          wa_welcome_error?: string | null
          wa_welcome_sent?: boolean
          wa_welcome_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_motivo_perda_id_fkey"
            columns: ["motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      loading_config: {
        Row: {
          ai_max_calls_per_flow: number
          ai_messages_enabled: boolean
          ai_min_duration_seconds: number
          ai_timeout_ms: number
          created_at: string
          custom_loader_url: string | null
          id: string
          loader_theme: string
          messages_catalog: Json
          overlay_delay_ms: number
          overlay_min_duration_ms: number
          show_messages: boolean
          sun_loader_enabled: boolean
          sun_loader_style: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_max_calls_per_flow?: number
          ai_messages_enabled?: boolean
          ai_min_duration_seconds?: number
          ai_timeout_ms?: number
          created_at?: string
          custom_loader_url?: string | null
          id?: string
          loader_theme?: string
          messages_catalog?: Json
          overlay_delay_ms?: number
          overlay_min_duration_ms?: number
          show_messages?: boolean
          sun_loader_enabled?: boolean
          sun_loader_style?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_max_calls_per_flow?: number
          ai_messages_enabled?: boolean
          ai_min_duration_seconds?: number
          ai_timeout_ms?: number
          created_at?: string
          custom_loader_url?: string | null
          id?: string
          loader_theme?: string
          messages_catalog?: Json
          overlay_delay_ms?: number
          overlay_min_duration_ms?: number
          show_messages?: boolean
          sun_loader_enabled?: boolean
          sun_loader_style?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loading_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      margin_plans: {
        Row: {
          created_at: string
          default_margin_percent: number
          description: string | null
          id: string
          is_active: boolean
          max_margin_percent: number
          min_margin_percent: number
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_margin_percent?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_margin_percent?: number
          min_margin_percent?: number
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_margin_percent?: number
          description?: string | null
          id?: string
          is_active?: boolean
          max_margin_percent?: number
          min_margin_percent?: number
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "margin_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_notifications: {
        Row: {
          ano: number
          consultor_id: string
          created_at: string
          id: string
          lida: boolean
          mes: number
          percentual_atingido: number
          tenant_id: string
          tipo_meta: string
        }
        Insert: {
          ano: number
          consultor_id: string
          created_at?: string
          id?: string
          lida?: boolean
          mes: number
          percentual_atingido: number
          tenant_id?: string
          tipo_meta: string
        }
        Update: {
          ano?: number
          consultor_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          mes?: number
          percentual_atingido?: number
          tenant_id?: string
          tipo_meta?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_notifications_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos_fotovoltaicos: {
        Row: {
          ativo: boolean
          coef_temp: string | null
          created_at: string
          dimensoes_mm: string | null
          eficiencia_percent: string | null
          fabricante: string
          id: string
          imp: number | null
          isc: number | null
          modelo: string
          numero_celulas: number | null
          potencia_w: number
          tenant_id: string
          tensao_sistema_v: number | null
          tipo_celula: string | null
          updated_at: string
          vmp: number | null
          voc: number | null
        }
        Insert: {
          ativo?: boolean
          coef_temp?: string | null
          created_at?: string
          dimensoes_mm?: string | null
          eficiencia_percent?: string | null
          fabricante: string
          id?: string
          imp?: number | null
          isc?: number | null
          modelo: string
          numero_celulas?: number | null
          potencia_w: number
          tenant_id?: string
          tensao_sistema_v?: number | null
          tipo_celula?: string | null
          updated_at?: string
          vmp?: number | null
          voc?: number | null
        }
        Update: {
          ativo?: boolean
          coef_temp?: string | null
          created_at?: string
          dimensoes_mm?: string | null
          eficiencia_percent?: string | null
          fabricante?: string
          id?: string
          imp?: number | null
          isc?: number | null
          modelo?: string
          numero_celulas?: number | null
          potencia_w?: number
          tenant_id?: string
          tensao_sistema_v?: number | null
          tipo_celula?: string | null
          updated_at?: string
          vmp?: number | null
          voc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modulos_fotovoltaicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos_solares: {
        Row: {
          area_m2: number | null
          ativo: boolean
          bifacial: boolean
          comprimento_mm: number | null
          created_at: string
          datasheet_found_at: string | null
          datasheet_source_url: string | null
          datasheet_url: string | null
          eficiencia_percent: number | null
          fabricante: string
          garantia_performance_anos: number | null
          garantia_produto_anos: number | null
          id: string
          imp_a: number | null
          isc_a: number | null
          largura_mm: number | null
          modelo: string
          num_celulas: number | null
          peso_kg: number | null
          potencia_wp: number
          profundidade_mm: number | null
          status: string
          temp_coeff_isc: number | null
          temp_coeff_pmax: number | null
          temp_coeff_voc: number | null
          tenant_id: string | null
          tensao_sistema: string | null
          tipo_celula: string
          updated_at: string
          vmp_v: number | null
          voc_v: number | null
        }
        Insert: {
          area_m2?: number | null
          ativo?: boolean
          bifacial?: boolean
          comprimento_mm?: number | null
          created_at?: string
          datasheet_found_at?: string | null
          datasheet_source_url?: string | null
          datasheet_url?: string | null
          eficiencia_percent?: number | null
          fabricante: string
          garantia_performance_anos?: number | null
          garantia_produto_anos?: number | null
          id?: string
          imp_a?: number | null
          isc_a?: number | null
          largura_mm?: number | null
          modelo: string
          num_celulas?: number | null
          peso_kg?: number | null
          potencia_wp: number
          profundidade_mm?: number | null
          status?: string
          temp_coeff_isc?: number | null
          temp_coeff_pmax?: number | null
          temp_coeff_voc?: number | null
          tenant_id?: string | null
          tensao_sistema?: string | null
          tipo_celula?: string
          updated_at?: string
          vmp_v?: number | null
          voc_v?: number | null
        }
        Update: {
          area_m2?: number | null
          ativo?: boolean
          bifacial?: boolean
          comprimento_mm?: number | null
          created_at?: string
          datasheet_found_at?: string | null
          datasheet_source_url?: string | null
          datasheet_url?: string | null
          eficiencia_percent?: number | null
          fabricante?: string
          garantia_performance_anos?: number | null
          garantia_produto_anos?: number | null
          id?: string
          imp_a?: number | null
          isc_a?: number | null
          largura_mm?: number | null
          modelo?: string
          num_celulas?: number | null
          peso_kg?: number | null
          potencia_wp?: number
          profundidade_mm?: number | null
          status?: string
          temp_coeff_isc?: number | null
          temp_coeff_pmax?: number | null
          temp_coeff_voc?: number | null
          tenant_id?: string | null
          tensao_sistema?: string | null
          tipo_celula?: string
          updated_at?: string
          vmp_v?: number | null
          voc_v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "modulos_solares_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_perda: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          tenant_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          tenant_id?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_perda_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_overrides: {
        Row: {
          created_at: string
          group_override: string | null
          id: string
          label_override: string | null
          nav_key: string
          order_override: number | null
          role_filter: string | null
          tenant_id: string
          updated_at: string
          visible_override: boolean
        }
        Insert: {
          created_at?: string
          group_override?: string | null
          id?: string
          label_override?: string | null
          nav_key: string
          order_override?: number | null
          role_filter?: string | null
          tenant_id?: string
          updated_at?: string
          visible_override?: boolean
        }
        Update: {
          created_at?: string
          group_override?: string | null
          id?: string
          label_override?: string | null
          nav_key?: string
          order_override?: number | null
          role_filter?: string | null
          tenant_id?: string
          updated_at?: string
          visible_override?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nav_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_config: {
        Row: {
          created_at: string
          id: string
          notify_conversation_idle: boolean
          notify_lead_idle: boolean
          notify_new_lead: boolean
          notify_new_orcamento: boolean
          notify_wa_message: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notify_conversation_idle?: boolean
          notify_lead_idle?: boolean
          notify_new_lead?: boolean
          notify_new_orcamento?: boolean
          notify_wa_message?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notify_conversation_idle?: boolean
          notify_lead_idle?: boolean
          notify_new_lead?: boolean
          notify_new_orcamento?: boolean
          notify_wa_message?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          ativo: boolean
          cidade: string
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          data_conclusao: string | null
          depoimento_cliente: string | null
          descricao: string | null
          destaque: boolean
          economia_mensal: number | null
          estado: string
          id: string
          imagens_urls: string[]
          marca_paineis: string | null
          modelo_inversor: string | null
          numero_modulos: number | null
          ordem: number
          payback_meses: number | null
          potencia_kwp: number | null
          projeto_id: string | null
          tags: string[]
          tempo_instalacao_dias: number | null
          tenant_id: string
          tipo_projeto: string
          titulo: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ativo?: boolean
          cidade: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_conclusao?: string | null
          depoimento_cliente?: string | null
          descricao?: string | null
          destaque?: boolean
          economia_mensal?: number | null
          estado?: string
          id?: string
          imagens_urls?: string[]
          marca_paineis?: string | null
          modelo_inversor?: string | null
          numero_modulos?: number | null
          ordem?: number
          payback_meses?: number | null
          potencia_kwp?: number | null
          projeto_id?: string | null
          tags?: string[]
          tempo_instalacao_dias?: number | null
          tenant_id?: string
          tipo_projeto?: string
          titulo: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_conclusao?: string | null
          depoimento_cliente?: string | null
          descricao?: string | null
          destaque?: boolean
          economia_mensal?: number | null
          estado?: string
          id?: string
          imagens_urls?: string[]
          marca_paineis?: string | null
          modelo_inversor?: string | null
          numero_modulos?: number | null
          ordem?: number
          payback_meses?: number | null
          potencia_kwp?: number | null
          projeto_id?: string | null
          tags?: string[]
          tempo_instalacao_dias?: number | null
          tenant_id?: string
          tipo_projeto?: string
          titulo?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          area: string
          arquivos_urls: string[] | null
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          concessionaria_id: string | null
          consultor: string | null
          consultor_id: string | null
          consumo_previsto: number
          created_at: string
          data_proxima_acao: string | null
          estado: string
          id: string
          lead_id: string
          media_consumo: number
          numero: string | null
          observacoes: string | null
          orc_code: string | null
          proxima_acao: string | null
          rede_atendimento: string
          regime_compensacao: string | null
          rua: string | null
          status_id: string | null
          tenant_id: string
          tipo_ligacao: string | null
          tipo_telhado: string
          ultimo_contato: string | null
          updated_at: string
          visto: boolean
          visto_admin: boolean
        }
        Insert: {
          area: string
          arquivos_urls?: string[] | null
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          concessionaria_id?: string | null
          consultor?: string | null
          consultor_id?: string | null
          consumo_previsto: number
          created_at?: string
          data_proxima_acao?: string | null
          estado: string
          id?: string
          lead_id: string
          media_consumo: number
          numero?: string | null
          observacoes?: string | null
          orc_code?: string | null
          proxima_acao?: string | null
          rede_atendimento: string
          regime_compensacao?: string | null
          rua?: string | null
          status_id?: string | null
          tenant_id?: string
          tipo_ligacao?: string | null
          tipo_telhado: string
          ultimo_contato?: string | null
          updated_at?: string
          visto?: boolean
          visto_admin?: boolean
        }
        Update: {
          area?: string
          arquivos_urls?: string[] | null
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          concessionaria_id?: string | null
          consultor?: string | null
          consultor_id?: string | null
          consumo_previsto?: number
          created_at?: string
          data_proxima_acao?: string | null
          estado?: string
          id?: string
          lead_id?: string
          media_consumo?: number
          numero?: string | null
          observacoes?: string | null
          orc_code?: string | null
          proxima_acao?: string | null
          rede_atendimento?: string
          regime_compensacao?: string | null
          rua?: string | null
          status_id?: string | null
          tenant_id?: string
          tipo_ligacao?: string | null
          tipo_telhado?: string
          ultimo_contato?: string | null
          updated_at?: string
          visto?: boolean
          visto_admin?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "lead_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      os_instalacao: {
        Row: {
          assinatura_cliente_url: string | null
          assinatura_instalador_url: string | null
          bairro: string | null
          cidade: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_agendada: string | null
          data_conclusao: string | null
          data_inicio: string | null
          endereco: string | null
          estado: string | null
          fotos_urls: string[] | null
          id: string
          instalador_id: string | null
          laudo_tecnico: string | null
          numero_os: string | null
          observacoes: string | null
          pendencias: string | null
          potencia_kwp: number | null
          projeto_id: string | null
          proposta_id: string
          status: string
          supervisor_id: string | null
          tenant_id: string
          updated_at: string
          valor_total: number | null
          versao_id: string
        }
        Insert: {
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          bairro?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          endereco?: string | null
          estado?: string | null
          fotos_urls?: string[] | null
          id?: string
          instalador_id?: string | null
          laudo_tecnico?: string | null
          numero_os?: string | null
          observacoes?: string | null
          pendencias?: string | null
          potencia_kwp?: number | null
          projeto_id?: string | null
          proposta_id: string
          status?: string
          supervisor_id?: string | null
          tenant_id: string
          updated_at?: string
          valor_total?: number | null
          versao_id: string
        }
        Update: {
          assinatura_cliente_url?: string | null
          assinatura_instalador_url?: string | null
          bairro?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          endereco?: string | null
          estado?: string | null
          fotos_urls?: string[] | null
          id?: string
          instalador_id?: string | null
          laudo_tecnico?: string | null
          numero_os?: string | null
          observacoes?: string | null
          pendencias?: string | null
          potencia_kwp?: number | null
          projeto_id?: string | null
          proposta_id?: string
          status?: string
          supervisor_id?: string | null
          tenant_id?: string
          updated_at?: string
          valor_total?: number | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_instalacao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_nativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "os_instalacao_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      otimizadores_catalogo: {
        Row: {
          ativo: boolean
          compatibilidade: string | null
          corrente_entrada_max_a: number | null
          corrente_saida_max_a: number | null
          created_at: string
          eficiencia_percent: number | null
          fabricante: string
          id: string
          modelo: string
          potencia_wp: number | null
          tenant_id: string | null
          tensao_entrada_max_v: number | null
          tensao_saida_v: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          compatibilidade?: string | null
          corrente_entrada_max_a?: number | null
          corrente_saida_max_a?: number | null
          created_at?: string
          eficiencia_percent?: number | null
          fabricante: string
          id?: string
          modelo: string
          potencia_wp?: number | null
          tenant_id?: string | null
          tensao_entrada_max_v?: number | null
          tensao_saida_v?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          compatibilidade?: string | null
          corrente_entrada_max_a?: number | null
          corrente_saida_max_a?: number | null
          created_at?: string
          eficiencia_percent?: number | null
          fabricante?: string
          id?: string
          modelo?: string
          potencia_wp?: number | null
          tenant_id?: string | null
          tensao_entrada_max_v?: number | null
          tensao_saida_v?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "otimizadores_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          comprovante_url: string | null
          created_at: string
          data_pagamento: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          recebimento_id: string
          tenant_id: string
          valor_pago: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          forma_pagamento: string
          id?: string
          observacoes?: string | null
          recebimento_id: string
          tenant_id?: string
          valor_pago: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          recebimento_id?: string
          tenant_id?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_comissao: {
        Row: {
          comissao_id: string
          comprovante_url: string | null
          created_at: string
          data_pagamento: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          tenant_id: string
          valor_pago: number
        }
        Insert: {
          comissao_id: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          forma_pagamento: string
          id?: string
          observacoes?: string | null
          tenant_id?: string
          valor_pago: number
        }
        Update: {
          comissao_id?: string
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          tenant_id?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_comissao_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_comissao_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas: {
        Row: {
          created_at: string
          data_vencimento: string
          id: string
          numero_parcela: number
          pagamento_id: string | null
          recebimento_id: string
          status: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_vencimento: string
          id?: string
          numero_parcela: number
          pagamento_id?: string | null
          recebimento_id: string
          status?: string
          tenant_id?: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          pagamento_id?: string | null
          recebimento_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payback_config: {
        Row: {
          created_at: string
          custo_disponibilidade_bifasico: number
          custo_disponibilidade_monofasico: number
          custo_disponibilidade_trifasico: number
          degradacao_anual_painel: number
          id: string
          reajuste_anual_tarifa: number
          tarifa_fio_b_padrao: number
          taxas_fixas_mensais: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_disponibilidade_bifasico?: number
          custo_disponibilidade_monofasico?: number
          custo_disponibilidade_trifasico?: number
          degradacao_anual_painel?: number
          id?: string
          reajuste_anual_tarifa?: number
          tarifa_fio_b_padrao?: number
          taxas_fixas_mensais?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_disponibilidade_bifasico?: number
          custo_disponibilidade_monofasico?: number
          custo_disponibilidade_trifasico?: number
          degradacao_anual_painel?: number
          id?: string
          reajuste_anual_tarifa?: number
          tarifa_fio_b_padrao?: number
          taxas_fixas_mensais?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_gateway_charges: {
        Row: {
          billing_type: string | null
          boleto_digitable_line: string | null
          boleto_pdf_url: string | null
          created_at: string
          due_date: string | null
          fee: number | null
          gateway_charge_id: string | null
          gateway_raw_response: Json | null
          gateway_status: string
          id: string
          net_value: number | null
          paid_at: string | null
          parcela_id: string
          pix_payload: string | null
          pix_qr_code_url: string | null
          provider: string
          recebimento_id: string
          tenant_id: string
          updated_at: string
          value: number
          webhook_last_at: string | null
          webhook_last_event: string | null
        }
        Insert: {
          billing_type?: string | null
          boleto_digitable_line?: string | null
          boleto_pdf_url?: string | null
          created_at?: string
          due_date?: string | null
          fee?: number | null
          gateway_charge_id?: string | null
          gateway_raw_response?: Json | null
          gateway_status?: string
          id?: string
          net_value?: number | null
          paid_at?: string | null
          parcela_id: string
          pix_payload?: string | null
          pix_qr_code_url?: string | null
          provider?: string
          recebimento_id: string
          tenant_id: string
          updated_at?: string
          value: number
          webhook_last_at?: string | null
          webhook_last_event?: string | null
        }
        Update: {
          billing_type?: string | null
          boleto_digitable_line?: string | null
          boleto_pdf_url?: string | null
          created_at?: string
          due_date?: string | null
          fee?: number | null
          gateway_charge_id?: string | null
          gateway_raw_response?: Json | null
          gateway_status?: string
          id?: string
          net_value?: number | null
          paid_at?: string | null
          parcela_id?: string
          pix_payload?: string | null
          pix_qr_code_url?: string | null
          provider?: string
          recebimento_id?: string
          tenant_id?: string
          updated_at?: string
          value?: number
          webhook_last_at?: string | null
          webhook_last_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_charges_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_gateway_charges_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_gateway_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateway_config: {
        Row: {
          api_key: string
          created_at: string
          environment: string
          id: string
          is_active: boolean
          metadata: Json | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          environment?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_automation_logs: {
        Row: {
          acao_executada: string
          automation_id: string
          created_at: string
          deal_id: string
          detalhes: Json | null
          erro_mensagem: string | null
          id: string
          status: string
          tenant_id: string
        }
        Insert: {
          acao_executada: string
          automation_id: string
          created_at?: string
          deal_id: string
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          status?: string
          tenant_id: string
        }
        Update: {
          acao_executada?: string
          automation_id?: string
          created_at?: string
          deal_id?: string
          detalhes?: Json | null
          erro_mensagem?: string | null
          id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "pipeline_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automation_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_automations: {
        Row: {
          ativo: boolean
          created_at: string
          destino_stage_id: string | null
          execucoes_total: number
          id: string
          mensagem_notificacao: string | null
          nome: string
          notificar_responsavel: boolean
          pipeline_id: string
          stage_id: string
          tempo_horas: number
          tenant_id: string
          tipo_acao: string
          tipo_gatilho: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          destino_stage_id?: string | null
          execucoes_total?: number
          id?: string
          mensagem_notificacao?: string | null
          nome?: string
          notificar_responsavel?: boolean
          pipeline_id: string
          stage_id: string
          tempo_horas?: number
          tenant_id: string
          tipo_acao?: string
          tipo_gatilho?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          destino_stage_id?: string | null
          execucoes_total?: number
          id?: string
          mensagem_notificacao?: string | null
          nome?: string
          notificar_responsavel?: boolean
          pipeline_id?: string
          stage_id?: string
          tempo_horas?: number
          tenant_id?: string
          tipo_acao?: string
          tipo_gatilho?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_automations_destino_stage_id_fkey"
            columns: ["destino_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_permissions: {
        Row: {
          created_at: string
          id: string
          restricao_tipo: string
          roles_permitidos: string[] | null
          stage_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          restricao_tipo?: string
          roles_permitidos?: string[] | null
          stage_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          restricao_tipo?: string
          roles_permitidos?: string[] | null
          stage_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_permissions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          is_closed: boolean
          is_won: boolean
          name: string
          pipeline_id: string
          position: number
          probability: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_closed?: boolean
          is_won?: boolean
          name: string
          pipeline_id: string
          position?: number
          probability?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_closed?: boolean
          is_won?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          probability?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["pipeline_kind"]
          name: string
          parent_pipeline_id: string | null
          tenant_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["pipeline_kind"]
          name: string
          parent_pipeline_id?: string | null
          tenant_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["pipeline_kind"]
          name?: string
          parent_pipeline_id?: string | null
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_parent_pipeline_id_fkey"
            columns: ["parent_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          created_at: string
          id: string
          limit_key: string
          limit_value: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          limit_key: string
          limit_value?: number
          plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          limit_key?: string
          limit_value?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          price_monthly: number
          price_yearly: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      post_sale_attachments: {
        Row: {
          created_at: string
          file_url: string
          id: string
          label: string | null
          storage_path: string
          tenant_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          label?: string | null
          storage_path: string
          tenant_id?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          label?: string | null
          storage_path?: string
          tenant_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_attachments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "post_sale_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_checklist_items: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem: number
          template_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          template_id: string
          tenant_id?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "post_sale_checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_checklist_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_checklist_templates: {
        Row: {
          created_at: string
          id: string
          nome: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_checklist_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_plans: {
        Row: {
          cliente_id: string
          created_at: string
          data_inicio: string | null
          garantia_inversor_fim: string | null
          garantia_modulos_fim: string | null
          id: string
          observacoes: string | null
          periodicidade_meses: number
          projeto_id: string
          proxima_preventiva: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_inicio?: string | null
          garantia_inversor_fim?: string | null
          garantia_modulos_fim?: string | null
          id?: string
          observacoes?: string | null
          periodicidade_meses?: number
          projeto_id: string
          proxima_preventiva?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_inicio?: string | null
          garantia_inversor_fim?: string | null
          garantia_modulos_fim?: string | null
          id?: string
          observacoes?: string | null
          periodicidade_meses?: number
          projeto_id?: string
          proxima_preventiva?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_plans_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_plans_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_reports: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          storage_path: string
          tenant_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          storage_path: string
          tenant_id?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          storage_path?: string
          tenant_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_reports_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "post_sale_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_upsell_opportunities: {
        Row: {
          cliente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          projeto_id: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_upsell_opportunities_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_upsell_opportunities_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_upsell_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_visit_checklist: {
        Row: {
          created_at: string
          id: string
          item_id: string
          observacao: string | null
          status: string
          tenant_id: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          observacao?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          observacao?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_visit_checklist_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "post_sale_checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_visit_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_visit_checklist_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "post_sale_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_visits: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_agendada: string | null
          data_conclusao: string | null
          data_prevista: string | null
          id: string
          observacoes: string | null
          plan_id: string | null
          projeto_id: string | null
          status: string
          tecnico_id: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          data_prevista?: string | null
          id?: string
          observacoes?: string | null
          plan_id?: string | null
          projeto_id?: string | null
          status?: string
          tecnico_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_agendada?: string | null
          data_conclusao?: string | null
          data_prevista?: string | null
          id?: string
          observacoes?: string | null
          plan_id?: string | null
          projeto_id?: string | null
          status?: string
          tecnico_id?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_visits_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_visits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "post_sale_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_visits_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_visits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_default_tenant: {
        Row: {
          created_at: string
          custo_disponibilidade_bifasico: number
          custo_disponibilidade_monofasico: number
          custo_disponibilidade_trifasico: number
          fator_simultaneidade: number
          id: string
          inflacao_energetica: number
          inflacao_ipca: number
          perda_eficiencia_anual: number
          sobredimensionamento: number
          taxa_desconto_vpl: number
          tenant_id: string
          troca_inversor_ano: number
          troca_inversor_custo_percentual: number
          updated_at: string
          vida_util_sistema: number
        }
        Insert: {
          created_at?: string
          custo_disponibilidade_bifasico?: number
          custo_disponibilidade_monofasico?: number
          custo_disponibilidade_trifasico?: number
          fator_simultaneidade?: number
          id?: string
          inflacao_energetica?: number
          inflacao_ipca?: number
          perda_eficiencia_anual?: number
          sobredimensionamento?: number
          taxa_desconto_vpl?: number
          tenant_id: string
          troca_inversor_ano?: number
          troca_inversor_custo_percentual?: number
          updated_at?: string
          vida_util_sistema?: number
        }
        Update: {
          created_at?: string
          custo_disponibilidade_bifasico?: number
          custo_disponibilidade_monofasico?: number
          custo_disponibilidade_trifasico?: number
          fator_simultaneidade?: number
          id?: string
          inflacao_energetica?: number
          inflacao_ipca?: number
          perda_eficiencia_anual?: number
          sobredimensionamento?: number
          taxa_desconto_vpl?: number
          tenant_id?: string
          troca_inversor_ano?: number
          troca_inversor_custo_percentual?: number
          updated_at?: string
          vida_util_sistema?: number
        }
        Relationships: [
          {
            foreignKeyName: "premissas_default_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      premissas_tecnicas: {
        Row: {
          created_at: string
          custo_disponibilidade_bi: number | null
          custo_disponibilidade_mono: number | null
          custo_disponibilidade_tri: number | null
          degradacao_anual_percent: number | null
          fator_perdas_percent: number | null
          horas_sol_pico: number | null
          id: string
          ipca_anual: number | null
          irradiacao_media_kwh_m2: number | null
          metadata: Json | null
          performance_ratio: number | null
          reajuste_tarifa_anual_percent: number | null
          taxa_selic_anual: number | null
          taxas_fixas_mensais: number | null
          tenant_id: string
          updated_at: string
          vida_util_anos: number | null
        }
        Insert: {
          created_at?: string
          custo_disponibilidade_bi?: number | null
          custo_disponibilidade_mono?: number | null
          custo_disponibilidade_tri?: number | null
          degradacao_anual_percent?: number | null
          fator_perdas_percent?: number | null
          horas_sol_pico?: number | null
          id?: string
          ipca_anual?: number | null
          irradiacao_media_kwh_m2?: number | null
          metadata?: Json | null
          performance_ratio?: number | null
          reajuste_tarifa_anual_percent?: number | null
          taxa_selic_anual?: number | null
          taxas_fixas_mensais?: number | null
          tenant_id: string
          updated_at?: string
          vida_util_anos?: number | null
        }
        Update: {
          created_at?: string
          custo_disponibilidade_bi?: number | null
          custo_disponibilidade_mono?: number | null
          custo_disponibilidade_tri?: number | null
          degradacao_anual_percent?: number | null
          fator_perdas_percent?: number | null
          horas_sol_pico?: number | null
          id?: string
          ipca_anual?: number | null
          irradiacao_media_kwh_m2?: number | null
          metadata?: Json | null
          performance_ratio?: number | null
          reajuste_tarifa_anual_percent?: number | null
          taxa_selic_anual?: number | null
          taxas_fixas_mensais?: number | null
          tenant_id?: string
          updated_at?: string
          vida_util_anos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "premissas_tecnicas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          comissao_gerente_percent: number | null
          comissao_padrao_percent: number | null
          created_at: string
          desconto_maximo_percent: number | null
          id: string
          margem_minima_percent: number | null
          markup_equipamentos_percent: number | null
          markup_servicos_percent: number | null
          metadata: Json | null
          preco_kwp_maximo: number | null
          preco_kwp_minimo: number | null
          preco_kwp_sugerido: number | null
          requer_aprovacao_desconto: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comissao_gerente_percent?: number | null
          comissao_padrao_percent?: number | null
          created_at?: string
          desconto_maximo_percent?: number | null
          id?: string
          margem_minima_percent?: number | null
          markup_equipamentos_percent?: number | null
          markup_servicos_percent?: number | null
          metadata?: Json | null
          preco_kwp_maximo?: number | null
          preco_kwp_minimo?: number | null
          preco_kwp_sugerido?: number | null
          requer_aprovacao_desconto?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          comissao_gerente_percent?: number | null
          comissao_padrao_percent?: number | null
          created_at?: string
          desconto_maximo_percent?: number | null
          id?: string
          margem_minima_percent?: number | null
          markup_equipamentos_percent?: number | null
          markup_servicos_percent?: number | null
          metadata?: Json | null
          preco_kwp_maximo?: number | null
          preco_kwp_minimo?: number | null
          preco_kwp_sugerido?: number | null
          requer_aprovacao_desconto?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_cost_components: {
        Row: {
          calculation_strategy: Database["public"]["Enums"]["cost_calc_strategy"]
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          parameters: Json
          tenant_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          calculation_strategy?: Database["public"]["Enums"]["cost_calc_strategy"]
          category: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          parameters?: Json
          tenant_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          calculation_strategy?: Database["public"]["Enums"]["cost_calc_strategy"]
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          parameters?: Json
          tenant_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_cost_components_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_cost_components_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "pricing_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_defaults_history: {
        Row: {
          categoria: string
          created_at: string
          created_by: string | null
          id: string
          percentual: number | null
          potencia_kwp: number
          proposta_id: string | null
          tenant_id: string
          valor_por_kwp: number
          valor_total: number
        }
        Insert: {
          categoria: string
          created_at?: string
          created_by?: string | null
          id?: string
          percentual?: number | null
          potencia_kwp?: number
          proposta_id?: string | null
          tenant_id: string
          valor_por_kwp?: number
          valor_total?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          created_by?: string | null
          id?: string
          percentual?: number | null
          potencia_kwp?: number
          proposta_id?: string | null
          tenant_id?: string
          valor_por_kwp?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_defaults_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_methods: {
        Row: {
          created_at: string
          default_margin_percent: number
          default_tax_percent: number
          id: string
          kit_margin_override_percent: number | null
          kit_tax_override_percent: number | null
          method_type: Database["public"]["Enums"]["pricing_method_type"]
          tenant_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          created_at?: string
          default_margin_percent?: number
          default_tax_percent?: number
          id?: string
          kit_margin_override_percent?: number | null
          kit_tax_override_percent?: number | null
          method_type?: Database["public"]["Enums"]["pricing_method_type"]
          tenant_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          created_at?: string
          default_margin_percent?: number
          default_tax_percent?: number
          id?: string
          kit_margin_override_percent?: number | null
          kit_tax_override_percent?: number | null
          method_type?: Database["public"]["Enums"]["pricing_method_type"]
          tenant_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_methods_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "pricing_policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_policies: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_policy_versions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          policy_id: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["pricing_policy_status"]
          tenant_id: string
          updated_at: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          policy_id: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["pricing_policy_status"]
          tenant_id: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          policy_id?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["pricing_policy_status"]
          tenant_id?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "pricing_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_policy_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo_solicitado: string | null
          created_at: string
          id: string
          nome: string
          settings: Json | null
          status: string
          telefone: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cargo_solicitado?: string | null
          created_at?: string
          id?: string
          nome: string
          settings?: Json | null
          status?: string
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cargo_solicitado?: string | null
          created_at?: string
          id?: string
          nome?: string
          settings?: Json | null
          status?: string
          telefone?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          deal_id: string
          event_type: string
          from_value: string | null
          id: string
          metadata: Json | null
          tenant_id: string
          to_value: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          deal_id: string
          event_type: string
          from_value?: string | null
          id?: string
          metadata?: Json | null
          tenant_id: string
          to_value?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          deal_id?: string
          event_type?: string
          from_value?: string | null
          id?: string
          metadata?: Json | null
          tenant_id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_etapas: {
        Row: {
          categoria: Database["public"]["Enums"]["projeto_etapa_categoria"]
          cor: string
          created_at: string
          funil_id: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["projeto_etapa_categoria"]
          cor?: string
          created_at?: string
          funil_id: string
          id?: string
          nome: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["projeto_etapa_categoria"]
          cor?: string
          created_at?: string
          funil_id?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_etapas_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "projeto_funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_etapas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_etiqueta_rel: {
        Row: {
          etiqueta_id: string
          projeto_id: string
        }
        Insert: {
          etiqueta_id: string
          projeto_id: string
        }
        Update: {
          etiqueta_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_etiqueta_rel_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "projeto_etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_etiqueta_rel_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_etiquetas: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          grupo: string
          icon: string | null
          id: string
          nome: string
          ordem: number
          short: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          grupo?: string
          icon?: string | null
          id?: string
          nome: string
          ordem?: number
          short?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          grupo?: string
          icon?: string | null
          id?: string
          nome?: string
          ordem?: number
          short?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_etiquetas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_funis: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_funis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_proposta_counters: {
        Row: {
          next_value: number
          projeto_id: string
          tenant_id: string
        }
        Insert: {
          next_value?: number
          projeto_id: string
          tenant_id: string
        }
        Update: {
          next_value?: number
          projeto_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      projetos: {
        Row: {
          area_util_m2: number | null
          bairro_instalacao: string | null
          cep_instalacao: string | null
          cidade_instalacao: string | null
          cliente_id: string
          codigo: string
          complemento_instalacao: string | null
          consultor_id: string | null
          created_at: string
          created_by: string | null
          data_comissionamento: string | null
          data_instalacao: string | null
          data_previsao_instalacao: string | null
          data_venda: string | null
          deal_id: string | null
          etapa_id: string | null
          forma_pagamento: string | null
          funil_id: string | null
          geracao_mensal_media_kwh: number | null
          id: string
          instalador_id: string | null
          lat_instalacao: number | null
          lead_id: string | null
          lon_instalacao: number | null
          modelo_inversor: string | null
          modelo_modulos: string | null
          motivo_perda_id: string | null
          motivo_perda_obs: string | null
          numero_instalacao: string | null
          numero_inversores: number | null
          numero_modulos: number | null
          numero_parcelas: number | null
          observacoes: string | null
          potencia_kwp: number | null
          prazo_estimado_dias: number | null
          prazo_vistoria_dias: number | null
          projeto_num: number
          proposta_id: string | null
          rua_instalacao: string | null
          status: Database["public"]["Enums"]["projeto_status"]
          tenant_id: string
          tipo_instalacao: string | null
          uf_instalacao: string | null
          updated_at: string
          valor_entrada: number | null
          valor_equipamentos: number | null
          valor_financiado: number | null
          valor_mao_obra: number | null
          valor_parcela: number | null
          valor_total: number | null
        }
        Insert: {
          area_util_m2?: number | null
          bairro_instalacao?: string | null
          cep_instalacao?: string | null
          cidade_instalacao?: string | null
          cliente_id: string
          codigo: string
          complemento_instalacao?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_comissionamento?: string | null
          data_instalacao?: string | null
          data_previsao_instalacao?: string | null
          data_venda?: string | null
          deal_id?: string | null
          etapa_id?: string | null
          forma_pagamento?: string | null
          funil_id?: string | null
          geracao_mensal_media_kwh?: number | null
          id?: string
          instalador_id?: string | null
          lat_instalacao?: number | null
          lead_id?: string | null
          lon_instalacao?: number | null
          modelo_inversor?: string | null
          modelo_modulos?: string | null
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          numero_instalacao?: string | null
          numero_inversores?: number | null
          numero_modulos?: number | null
          numero_parcelas?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          prazo_estimado_dias?: number | null
          prazo_vistoria_dias?: number | null
          projeto_num?: number
          proposta_id?: string | null
          rua_instalacao?: string | null
          status?: Database["public"]["Enums"]["projeto_status"]
          tenant_id?: string
          tipo_instalacao?: string | null
          uf_instalacao?: string | null
          updated_at?: string
          valor_entrada?: number | null
          valor_equipamentos?: number | null
          valor_financiado?: number | null
          valor_mao_obra?: number | null
          valor_parcela?: number | null
          valor_total?: number | null
        }
        Update: {
          area_util_m2?: number | null
          bairro_instalacao?: string | null
          cep_instalacao?: string | null
          cidade_instalacao?: string | null
          cliente_id?: string
          codigo?: string
          complemento_instalacao?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_comissionamento?: string | null
          data_instalacao?: string | null
          data_previsao_instalacao?: string | null
          data_venda?: string | null
          deal_id?: string | null
          etapa_id?: string | null
          forma_pagamento?: string | null
          funil_id?: string | null
          geracao_mensal_media_kwh?: number | null
          id?: string
          instalador_id?: string | null
          lat_instalacao?: number | null
          lead_id?: string | null
          lon_instalacao?: number | null
          modelo_inversor?: string | null
          modelo_modulos?: string | null
          motivo_perda_id?: string | null
          motivo_perda_obs?: string | null
          numero_instalacao?: string | null
          numero_inversores?: number | null
          numero_modulos?: number | null
          numero_parcelas?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          prazo_estimado_dias?: number | null
          prazo_vistoria_dias?: number | null
          projeto_num?: number
          proposta_id?: string | null
          rua_instalacao?: string | null
          status?: Database["public"]["Enums"]["projeto_status"]
          tenant_id?: string
          tipo_instalacao?: string | null
          uf_instalacao?: string | null
          updated_at?: string
          valor_entrada?: number | null
          valor_equipamentos?: number | null
          valor_financiado?: number | null
          valor_mao_obra?: number | null
          valor_parcela?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_projetos_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "projeto_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "projeto_funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_motivo_perda_id_fkey"
            columns: ["motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_nativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_variables: {
        Row: {
          created_at: string
          id: string
          lead_id: string | null
          metadata: Json | null
          proposta_id: string | null
          tenant_id: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          proposta_id?: string | null
          tenant_id?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          proposta_id?: string | null
          tenant_id?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proposal_variables_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_variables_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_sm_legado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_variables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_aceite_tokens: {
        Row: {
          aceite_documento: string | null
          aceite_ip: string | null
          aceite_nome: string | null
          aceite_observacoes: string | null
          aceite_user_agent: string | null
          assinatura_url: string | null
          cenario_aceito_id: string | null
          created_at: string
          created_by: string | null
          decisao: string | null
          expires_at: string
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          proposta_id: string
          recusa_at: string | null
          recusa_motivo: string | null
          tenant_id: string
          token: string
          used_at: string | null
          versao_id: string
          view_count: number | null
        }
        Insert: {
          aceite_documento?: string | null
          aceite_ip?: string | null
          aceite_nome?: string | null
          aceite_observacoes?: string | null
          aceite_user_agent?: string | null
          assinatura_url?: string | null
          cenario_aceito_id?: string | null
          created_at?: string
          created_by?: string | null
          decisao?: string | null
          expires_at?: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          proposta_id: string
          recusa_at?: string | null
          recusa_motivo?: string | null
          tenant_id: string
          token?: string
          used_at?: string | null
          versao_id: string
          view_count?: number | null
        }
        Update: {
          aceite_documento?: string | null
          aceite_ip?: string | null
          aceite_nome?: string | null
          aceite_observacoes?: string | null
          aceite_user_agent?: string | null
          assinatura_url?: string | null
          cenario_aceito_id?: string | null
          created_at?: string
          created_by?: string | null
          decisao?: string | null
          expires_at?: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          proposta_id?: string
          recusa_at?: string | null
          recusa_motivo?: string | null
          tenant_id?: string
          token?: string
          used_at?: string | null
          versao_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_aceite_tokens_cenario_aceito_id_fkey"
            columns: ["cenario_aceito_id"]
            isOneToOne: false
            referencedRelation: "proposta_cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_aceite_tokens_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_nativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_aceite_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_campos_distribuidora: {
        Row: {
          campo_key: string
          created_at: string
          id: string
          tenant_id: string
          valor: string | null
          valor_boolean: boolean | null
          versao_id: string
        }
        Insert: {
          campo_key: string
          created_at?: string
          id?: string
          tenant_id: string
          valor?: string | null
          valor_boolean?: boolean | null
          versao_id: string
        }
        Update: {
          campo_key?: string
          created_at?: string
          id?: string
          tenant_id?: string
          valor?: string | null
          valor_boolean?: boolean | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_campos_distribuidora_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_campos_distribuidora_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_cenarios: {
        Row: {
          ativo: boolean | null
          cet_anual: number | null
          comissao_percent: number | null
          comissao_valor: number | null
          created_at: string
          custo_equipamentos: number | null
          custo_servicos: number | null
          custo_total: number | null
          economia_primeiro_ano: number | null
          entrada_percent: number | null
          entrada_valor: number | null
          financiador_id: string | null
          id: string
          is_default: boolean
          margem_percent: number | null
          markup_percent: number | null
          metadata: Json | null
          nome: string
          num_parcelas: number | null
          ordem: number | null
          payback_meses: number | null
          preco_final: number | null
          preco_por_kwp: number | null
          roi_25_anos: number | null
          taxa_juros_anual: number | null
          taxa_juros_mensal: number | null
          tenant_id: string
          tipo: string
          tir_anual: number | null
          updated_at: string
          valor_financiado: number | null
          valor_parcela: number | null
          versao_id: string
        }
        Insert: {
          ativo?: boolean | null
          cet_anual?: number | null
          comissao_percent?: number | null
          comissao_valor?: number | null
          created_at?: string
          custo_equipamentos?: number | null
          custo_servicos?: number | null
          custo_total?: number | null
          economia_primeiro_ano?: number | null
          entrada_percent?: number | null
          entrada_valor?: number | null
          financiador_id?: string | null
          id?: string
          is_default?: boolean
          margem_percent?: number | null
          markup_percent?: number | null
          metadata?: Json | null
          nome: string
          num_parcelas?: number | null
          ordem?: number | null
          payback_meses?: number | null
          preco_final?: number | null
          preco_por_kwp?: number | null
          roi_25_anos?: number | null
          taxa_juros_anual?: number | null
          taxa_juros_mensal?: number | null
          tenant_id: string
          tipo?: string
          tir_anual?: number | null
          updated_at?: string
          valor_financiado?: number | null
          valor_parcela?: number | null
          versao_id: string
        }
        Update: {
          ativo?: boolean | null
          cet_anual?: number | null
          comissao_percent?: number | null
          comissao_valor?: number | null
          created_at?: string
          custo_equipamentos?: number | null
          custo_servicos?: number | null
          custo_total?: number | null
          economia_primeiro_ano?: number | null
          entrada_percent?: number | null
          entrada_valor?: number | null
          financiador_id?: string | null
          id?: string
          is_default?: boolean
          margem_percent?: number | null
          markup_percent?: number | null
          metadata?: Json | null
          nome?: string
          num_parcelas?: number | null
          ordem?: number | null
          payback_meses?: number | null
          preco_final?: number | null
          preco_por_kwp?: number | null
          roi_25_anos?: number | null
          taxa_juros_anual?: number | null
          taxa_juros_mensal?: number | null
          tenant_id?: string
          tipo?: string
          tir_anual?: number | null
          updated_at?: string
          valor_financiado?: number | null
          valor_parcela?: number | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_cenarios_financiador_id_fkey"
            columns: ["financiador_id"]
            isOneToOne: false
            referencedRelation: "financiamento_bancos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_cenarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_cenarios_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_comercial: {
        Row: {
          created_at: string
          empresa_cidade: string | null
          empresa_cnpj_cpf: string | null
          empresa_estado: string | null
          empresa_nome: string | null
          id: string
          projeto_id_externo: string | null
          representante_celular: string | null
          representante_email: string | null
          representante_nome: string | null
          responsavel_celular: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          tenant_id: string
          versao_id: string
        }
        Insert: {
          created_at?: string
          empresa_cidade?: string | null
          empresa_cnpj_cpf?: string | null
          empresa_estado?: string | null
          empresa_nome?: string | null
          id?: string
          projeto_id_externo?: string | null
          representante_celular?: string | null
          representante_email?: string | null
          representante_nome?: string | null
          responsavel_celular?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          tenant_id: string
          versao_id: string
        }
        Update: {
          created_at?: string
          empresa_cidade?: string | null
          empresa_cnpj_cpf?: string | null
          empresa_estado?: string | null
          empresa_nome?: string | null
          id?: string
          projeto_id_externo?: string | null
          representante_celular?: string | null
          representante_email?: string | null
          representante_nome?: string | null
          responsavel_celular?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          tenant_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_comercial_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_comercial_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_config: {
        Row: {
          created_at: string
          id: string
          proposta_exibir_expirada: boolean
          proposta_tem_validade: boolean
          proposta_validade_dias: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposta_exibir_expirada?: boolean
          proposta_tem_validade?: boolean
          proposta_validade_dias?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          proposta_exibir_expirada?: boolean
          proposta_tem_validade?: boolean
          proposta_validade_dias?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          corpo_html: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_envios: {
        Row: {
          canal: string
          created_at: string
          destinatario: string | null
          detalhes: Json | null
          enviado_em: string
          enviado_por: string | null
          id: string
          status: string
          tenant_id: string
          versao_id: string
        }
        Insert: {
          canal: string
          created_at?: string
          destinatario?: string | null
          detalhes?: Json | null
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          status?: string
          tenant_id: string
          versao_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          destinatario?: string | null
          detalhes?: Json | null
          enviado_em?: string
          enviado_por?: string | null
          id?: string
          status?: string
          tenant_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_envios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_envios_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_kit_itens: {
        Row: {
          avulso: boolean | null
          categoria: string
          created_at: string
          descricao: string
          fabricante: string | null
          id: string
          kit_id: string
          modelo: string | null
          ordem: number | null
          potencia_w: number | null
          preco_unitario: number
          produto_ref: string | null
          quantidade: number
          tenant_id: string
        }
        Insert: {
          avulso?: boolean | null
          categoria: string
          created_at?: string
          descricao: string
          fabricante?: string | null
          id?: string
          kit_id: string
          modelo?: string | null
          ordem?: number | null
          potencia_w?: number | null
          preco_unitario?: number
          produto_ref?: string | null
          quantidade?: number
          tenant_id: string
        }
        Update: {
          avulso?: boolean | null
          categoria?: string
          created_at?: string
          descricao?: string
          fabricante?: string | null
          id?: string
          kit_id?: string
          modelo?: string | null
          ordem?: number | null
          potencia_w?: number | null
          preco_unitario?: number
          produto_ref?: string | null
          quantidade?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_kit_itens_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "proposta_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_kit_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_kits: {
        Row: {
          created_at: string
          id: string
          kit_fechado_ref: string | null
          tenant_id: string
          tipo_kit: string
          tipo_sistema: string | null
          topologia: string | null
          versao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kit_fechado_ref?: string | null
          tenant_id: string
          tipo_kit?: string
          tipo_sistema?: string | null
          topologia?: string | null
          versao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kit_fechado_ref?: string | null
          tenant_id?: string
          tipo_kit?: string
          tipo_sistema?: string | null
          topologia?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_kits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_kits_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_layout_modulos: {
        Row: {
          arranjo_index: number
          created_at: string
          disposicao: string | null
          id: string
          inclinacao: number | null
          kit_id: string
          modulos_por_linha: number
          num_linhas: number
          orientacao: string | null
          tenant_id: string
        }
        Insert: {
          arranjo_index?: number
          created_at?: string
          disposicao?: string | null
          id?: string
          inclinacao?: number | null
          kit_id: string
          modulos_por_linha?: number
          num_linhas?: number
          orientacao?: string | null
          tenant_id: string
        }
        Update: {
          arranjo_index?: number
          created_at?: string
          disposicao?: string | null
          id?: string
          inclinacao?: number | null
          kit_id?: string
          modulos_por_linha?: number
          num_linhas?: number
          orientacao?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_layout_modulos_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "proposta_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_layout_modulos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_pagamento_opcoes: {
        Row: {
          carencia_meses: number | null
          created_at: string
          entrada: number | null
          id: string
          nome: string
          num_parcelas: number | null
          observacoes: string | null
          ordem: number | null
          taxa_mensal: number | null
          tenant_id: string
          tipo: string | null
          valor_financiado: number | null
          valor_parcela: number | null
          versao_id: string
        }
        Insert: {
          carencia_meses?: number | null
          created_at?: string
          entrada?: number | null
          id?: string
          nome: string
          num_parcelas?: number | null
          observacoes?: string | null
          ordem?: number | null
          taxa_mensal?: number | null
          tenant_id: string
          tipo?: string | null
          valor_financiado?: number | null
          valor_parcela?: number | null
          versao_id: string
        }
        Update: {
          carencia_meses?: number | null
          created_at?: string
          entrada?: number | null
          id?: string
          nome?: string
          num_parcelas?: number | null
          observacoes?: string | null
          ordem?: number | null
          taxa_mensal?: number | null
          tenant_id?: string
          tipo?: string | null
          valor_financiado?: number | null
          valor_parcela?: number | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_pagamento_opcoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_pagamento_opcoes_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_premissas: {
        Row: {
          created_at: string
          id: string
          imposto: number | null
          inflacao_energetica: number | null
          inflacao_ipca: number | null
          perda_eficiencia_anual: number | null
          sobredimensionamento: number | null
          tenant_id: string
          troca_inversor_anos: number | null
          troca_inversor_custo: number | null
          versao_id: string
          vpl_taxa_desconto: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          imposto?: number | null
          inflacao_energetica?: number | null
          inflacao_ipca?: number | null
          perda_eficiencia_anual?: number | null
          sobredimensionamento?: number | null
          tenant_id: string
          troca_inversor_anos?: number | null
          troca_inversor_custo?: number | null
          versao_id: string
          vpl_taxa_desconto?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          imposto?: number | null
          inflacao_energetica?: number | null
          inflacao_ipca?: number | null
          perda_eficiencia_anual?: number | null
          sobredimensionamento?: number | null
          tenant_id?: string
          troca_inversor_anos?: number | null
          troca_inversor_custo?: number | null
          versao_id?: string
          vpl_taxa_desconto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_premissas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_premissas_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_renders: {
        Row: {
          created_at: string
          gerado_por: string | null
          html: string | null
          id: string
          storage_path: string | null
          tamanho_bytes: number | null
          tenant_id: string
          tipo: string
          url: string | null
          versao_id: string
        }
        Insert: {
          created_at?: string
          gerado_por?: string | null
          html?: string | null
          id?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tenant_id: string
          tipo: string
          url?: string | null
          versao_id: string
        }
        Update: {
          created_at?: string
          gerado_por?: string | null
          html?: string | null
          id?: string
          storage_path?: string | null
          tamanho_bytes?: number | null
          tenant_id?: string
          tipo?: string
          url?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_renders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_renders_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_resultados_energia: {
        Row: {
          consumo_abatido: number | null
          created_at: string
          creditos_abr: number | null
          creditos_ago: number | null
          creditos_alocados: number | null
          creditos_dez: number | null
          creditos_fev: number | null
          creditos_jan: number | null
          creditos_jul: number | null
          creditos_jun: number | null
          creditos_mai: number | null
          creditos_mar: number | null
          creditos_nov: number | null
          creditos_out: number | null
          creditos_set: number | null
          economia_demanda_mensal: number | null
          economia_energia_mensal: number | null
          economia_energia_percentual: number | null
          economia_total_anual: number | null
          economia_total_mensal: number | null
          gasto_demanda_mensal_atual: number | null
          gasto_demanda_mensal_novo: number | null
          gasto_energia_mensal_atual: number | null
          gasto_energia_mensal_novo: number | null
          gasto_total_mensal_atual: number | null
          gasto_total_mensal_novo: number | null
          id: string
          tarifacao_energia_compensada_bt: number | null
          tarifacao_energia_compensada_fp: number | null
          tarifacao_energia_compensada_p: number | null
          tenant_id: string
          uc_id: string | null
          valor_imposto_energia: number | null
          versao_id: string
        }
        Insert: {
          consumo_abatido?: number | null
          created_at?: string
          creditos_abr?: number | null
          creditos_ago?: number | null
          creditos_alocados?: number | null
          creditos_dez?: number | null
          creditos_fev?: number | null
          creditos_jan?: number | null
          creditos_jul?: number | null
          creditos_jun?: number | null
          creditos_mai?: number | null
          creditos_mar?: number | null
          creditos_nov?: number | null
          creditos_out?: number | null
          creditos_set?: number | null
          economia_demanda_mensal?: number | null
          economia_energia_mensal?: number | null
          economia_energia_percentual?: number | null
          economia_total_anual?: number | null
          economia_total_mensal?: number | null
          gasto_demanda_mensal_atual?: number | null
          gasto_demanda_mensal_novo?: number | null
          gasto_energia_mensal_atual?: number | null
          gasto_energia_mensal_novo?: number | null
          gasto_total_mensal_atual?: number | null
          gasto_total_mensal_novo?: number | null
          id?: string
          tarifacao_energia_compensada_bt?: number | null
          tarifacao_energia_compensada_fp?: number | null
          tarifacao_energia_compensada_p?: number | null
          tenant_id: string
          uc_id?: string | null
          valor_imposto_energia?: number | null
          versao_id: string
        }
        Update: {
          consumo_abatido?: number | null
          created_at?: string
          creditos_abr?: number | null
          creditos_ago?: number | null
          creditos_alocados?: number | null
          creditos_dez?: number | null
          creditos_fev?: number | null
          creditos_jan?: number | null
          creditos_jul?: number | null
          creditos_jun?: number | null
          creditos_mai?: number | null
          creditos_mar?: number | null
          creditos_nov?: number | null
          creditos_out?: number | null
          creditos_set?: number | null
          economia_demanda_mensal?: number | null
          economia_energia_mensal?: number | null
          economia_energia_percentual?: number | null
          economia_total_anual?: number | null
          economia_total_mensal?: number | null
          gasto_demanda_mensal_atual?: number | null
          gasto_demanda_mensal_novo?: number | null
          gasto_energia_mensal_atual?: number | null
          gasto_energia_mensal_novo?: number | null
          gasto_total_mensal_atual?: number | null
          gasto_total_mensal_novo?: number | null
          id?: string
          tarifacao_energia_compensada_bt?: number | null
          tarifacao_energia_compensada_fp?: number | null
          tarifacao_energia_compensada_p?: number | null
          tenant_id?: string
          uc_id?: string | null
          valor_imposto_energia?: number | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_resultados_energia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_resultados_energia_uc_id_fkey"
            columns: ["uc_id"]
            isOneToOne: false
            referencedRelation: "proposta_ucs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_resultados_energia_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_series: {
        Row: {
          created_at: string
          data_points: Json
          id: string
          serie_key: string
          tenant_id: string
          uc_index: number | null
          unidade: string | null
          versao_id: string
        }
        Insert: {
          created_at?: string
          data_points?: Json
          id?: string
          serie_key: string
          tenant_id: string
          uc_index?: number | null
          unidade?: string | null
          versao_id: string
        }
        Update: {
          created_at?: string
          data_points?: Json
          id?: string
          serie_key?: string
          tenant_id?: string
          uc_index?: number | null
          unidade?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_series_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_series_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_servicos: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string
          id: string
          incluso_no_preco: boolean | null
          ordem: number | null
          tenant_id: string
          valor: number
          versao_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao: string
          id?: string
          incluso_no_preco?: boolean | null
          ordem?: number | null
          tenant_id: string
          valor?: number
          versao_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string
          id?: string
          incluso_no_preco?: boolean | null
          ordem?: number | null
          tenant_id?: string
          valor?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_servicos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_templates: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          file_url: string | null
          grupo: string
          id: string
          nome: string
          ordem: number
          template_html: string | null
          tenant_id: string
          thumbnail_url: string | null
          tipo: string
          updated_at: string
          variaveis_disponiveis: Json
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          file_url?: string | null
          grupo?: string
          id?: string
          nome: string
          ordem?: number
          template_html?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          tipo?: string
          updated_at?: string
          variaveis_disponiveis?: Json
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          file_url?: string | null
          grupo?: string
          id?: string
          nome?: string
          ordem?: number
          template_html?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          tipo?: string
          updated_at?: string
          variaveis_disponiveis?: Json
        }
        Relationships: [
          {
            foreignKeyName: "proposta_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_ucs: {
        Row: {
          cidade: string | null
          consumo_abr: number | null
          consumo_ago: number | null
          consumo_dez: number | null
          consumo_fev: number | null
          consumo_jan: number | null
          consumo_jul: number | null
          consumo_jun: number | null
          consumo_mai: number | null
          consumo_mar: number | null
          consumo_mensal: number | null
          consumo_mensal_fp: number | null
          consumo_mensal_p: number | null
          consumo_nov: number | null
          consumo_out: number | null
          consumo_set: number | null
          created_at: string
          custo_disponibilidade_kwh: number | null
          custo_disponibilidade_valor: number | null
          demanda_adicional: number | null
          demanda_contratada: number | null
          demanda_g: number | null
          demanda_g_preco: number | null
          demanda_preco: number | null
          desvio_azimutal: number | null
          distancia: number | null
          distribuidora: string | null
          estado: string | null
          fase: string | null
          fator_simultaneidade: number | null
          id: string
          imposto_energia: number | null
          inclinacao: number | null
          nome: string | null
          outros_encargos_atual: number | null
          outros_encargos_novo: number | null
          rateio_creditos: number | null
          rateio_sugerido_creditos: number | null
          regra_compensacao: number | null
          subgrupo: string | null
          tarifa_distribuidora: number | null
          tarifa_te_fp: number | null
          tarifa_te_p: number | null
          tarifa_tusd_fp: number | null
          tarifa_tusd_p: number | null
          taxa_desempenho: number | null
          tenant_id: string
          tensao_rede: string | null
          tipo_dimensionamento: string | null
          tipo_telhado: string | null
          uc_index: number
          versao_id: string
        }
        Insert: {
          cidade?: string | null
          consumo_abr?: number | null
          consumo_ago?: number | null
          consumo_dez?: number | null
          consumo_fev?: number | null
          consumo_jan?: number | null
          consumo_jul?: number | null
          consumo_jun?: number | null
          consumo_mai?: number | null
          consumo_mar?: number | null
          consumo_mensal?: number | null
          consumo_mensal_fp?: number | null
          consumo_mensal_p?: number | null
          consumo_nov?: number | null
          consumo_out?: number | null
          consumo_set?: number | null
          created_at?: string
          custo_disponibilidade_kwh?: number | null
          custo_disponibilidade_valor?: number | null
          demanda_adicional?: number | null
          demanda_contratada?: number | null
          demanda_g?: number | null
          demanda_g_preco?: number | null
          demanda_preco?: number | null
          desvio_azimutal?: number | null
          distancia?: number | null
          distribuidora?: string | null
          estado?: string | null
          fase?: string | null
          fator_simultaneidade?: number | null
          id?: string
          imposto_energia?: number | null
          inclinacao?: number | null
          nome?: string | null
          outros_encargos_atual?: number | null
          outros_encargos_novo?: number | null
          rateio_creditos?: number | null
          rateio_sugerido_creditos?: number | null
          regra_compensacao?: number | null
          subgrupo?: string | null
          tarifa_distribuidora?: number | null
          tarifa_te_fp?: number | null
          tarifa_te_p?: number | null
          tarifa_tusd_fp?: number | null
          tarifa_tusd_p?: number | null
          taxa_desempenho?: number | null
          tenant_id: string
          tensao_rede?: string | null
          tipo_dimensionamento?: string | null
          tipo_telhado?: string | null
          uc_index?: number
          versao_id: string
        }
        Update: {
          cidade?: string | null
          consumo_abr?: number | null
          consumo_ago?: number | null
          consumo_dez?: number | null
          consumo_fev?: number | null
          consumo_jan?: number | null
          consumo_jul?: number | null
          consumo_jun?: number | null
          consumo_mai?: number | null
          consumo_mar?: number | null
          consumo_mensal?: number | null
          consumo_mensal_fp?: number | null
          consumo_mensal_p?: number | null
          consumo_nov?: number | null
          consumo_out?: number | null
          consumo_set?: number | null
          created_at?: string
          custo_disponibilidade_kwh?: number | null
          custo_disponibilidade_valor?: number | null
          demanda_adicional?: number | null
          demanda_contratada?: number | null
          demanda_g?: number | null
          demanda_g_preco?: number | null
          demanda_preco?: number | null
          desvio_azimutal?: number | null
          distancia?: number | null
          distribuidora?: string | null
          estado?: string | null
          fase?: string | null
          fator_simultaneidade?: number | null
          id?: string
          imposto_energia?: number | null
          inclinacao?: number | null
          nome?: string | null
          outros_encargos_atual?: number | null
          outros_encargos_novo?: number | null
          rateio_creditos?: number | null
          rateio_sugerido_creditos?: number | null
          regra_compensacao?: number | null
          subgrupo?: string | null
          tarifa_distribuidora?: number | null
          tarifa_te_fp?: number | null
          tarifa_te_p?: number | null
          tarifa_tusd_fp?: number | null
          tarifa_tusd_p?: number | null
          taxa_desempenho?: number | null
          tenant_id?: string
          tensao_rede?: string | null
          tipo_dimensionamento?: string | null
          tipo_telhado?: string | null
          uc_index?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_ucs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_ucs_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_variaveis: {
        Row: {
          created_at: string
          formatted_value: string | null
          id: string
          item: string | null
          key: string
          proposta_id: string
          tenant_id: string
          topic: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          formatted_value?: string | null
          id?: string
          item?: string | null
          key: string
          proposta_id: string
          tenant_id?: string
          topic?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          formatted_value?: string | null
          id?: string
          item?: string | null
          key?: string
          proposta_id?: string
          tenant_id?: string
          topic?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposta_variaveis_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_sm_legado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_variaveis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_variaveis_custom: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          expressao: string
          id: string
          label: string
          nome: string
          ordem: number
          precisao: number
          tenant_id: string
          tipo_resultado: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          expressao: string
          id?: string
          label: string
          nome: string
          ordem?: number
          precisao?: number
          tenant_id: string
          tipo_resultado?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          expressao?: string
          id?: string
          label?: string
          nome?: string
          ordem?: number
          precisao?: number
          tenant_id?: string
          tipo_resultado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_variaveis_custom_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_venda: {
        Row: {
          created_at: string
          custo_comissao: number | null
          custo_instalacao: number | null
          custo_kit: number | null
          custo_outros: number | null
          custo_total: number | null
          desconto_percentual: number | null
          desconto_valor: number | null
          id: string
          margem_percentual: number | null
          markup: number | null
          observacoes: string | null
          preco_final: number | null
          preco_por_kwp: number | null
          tenant_id: string
          versao_id: string
        }
        Insert: {
          created_at?: string
          custo_comissao?: number | null
          custo_instalacao?: number | null
          custo_kit?: number | null
          custo_outros?: number | null
          custo_total?: number | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          id?: string
          margem_percentual?: number | null
          markup?: number | null
          observacoes?: string | null
          preco_final?: number | null
          preco_por_kwp?: number | null
          tenant_id: string
          versao_id: string
        }
        Update: {
          created_at?: string
          custo_comissao?: number | null
          custo_instalacao?: number | null
          custo_kit?: number | null
          custo_outros?: number | null
          custo_total?: number | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          id?: string
          margem_percentual?: number | null
          markup?: number | null
          observacoes?: string | null
          preco_final?: number | null
          preco_por_kwp?: number | null
          tenant_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_venda_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_venda_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: true
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versao_series: {
        Row: {
          ano: number
          cenario_id: string | null
          custo_om: number | null
          degradacao_acumulada: number | null
          economia_acumulada_rs: number | null
          economia_rs: number | null
          fluxo_caixa: number | null
          fluxo_caixa_acumulado: number | null
          geracao_kwh: number | null
          id: string
          mes: number | null
          metadata: Json | null
          parcela_financiamento: number | null
          saldo_devedor: number | null
          tarifa_vigente: number | null
          tenant_id: string
          versao_id: string
        }
        Insert: {
          ano: number
          cenario_id?: string | null
          custo_om?: number | null
          degradacao_acumulada?: number | null
          economia_acumulada_rs?: number | null
          economia_rs?: number | null
          fluxo_caixa?: number | null
          fluxo_caixa_acumulado?: number | null
          geracao_kwh?: number | null
          id?: string
          mes?: number | null
          metadata?: Json | null
          parcela_financiamento?: number | null
          saldo_devedor?: number | null
          tarifa_vigente?: number | null
          tenant_id: string
          versao_id: string
        }
        Update: {
          ano?: number
          cenario_id?: string | null
          custo_om?: number | null
          degradacao_acumulada?: number | null
          economia_acumulada_rs?: number | null
          economia_rs?: number | null
          fluxo_caixa?: number | null
          fluxo_caixa_acumulado?: number | null
          geracao_kwh?: number | null
          id?: string
          mes?: number | null
          metadata?: Json | null
          parcela_financiamento?: number | null
          saldo_devedor?: number | null
          tarifa_vigente?: number | null
          tenant_id?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versao_series_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "proposta_cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_series_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_series_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versao_servicos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          incluso: boolean | null
          metadata: Json | null
          obrigatorio: boolean | null
          ordem: number | null
          tenant_id: string
          tipo: string
          valor: number
          versao_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          incluso?: boolean | null
          metadata?: Json | null
          obrigatorio?: boolean | null
          ordem?: number | null
          tenant_id: string
          tipo: string
          valor?: number
          versao_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          incluso?: boolean | null
          metadata?: Json | null
          obrigatorio?: boolean | null
          ordem?: number | null
          tenant_id?: string
          tipo?: string
          valor?: number
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versao_servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_servicos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versao_ucs: {
        Row: {
          aliquota_icms: number | null
          concessionaria_id: string | null
          consumo_fora_ponta_kwh: number | null
          consumo_mensal_kwh: number
          consumo_ponta_kwh: number | null
          created_at: string
          demanda_contratada_kw: number | null
          geracao_mensal_estimada: number | null
          grupo: string | null
          id: string
          metadata: Json | null
          modalidade: string | null
          nome: string | null
          numero_uc: string | null
          ordem: number
          percentual_atendimento: number | null
          potencia_necessaria_kwp: number | null
          tarifa_energia: number | null
          tarifa_fio_b: number | null
          tarifa_fora_ponta: number | null
          tarifa_ponta: number | null
          tenant_id: string
          tipo_ligacao: string | null
          titular: string | null
          versao_id: string
        }
        Insert: {
          aliquota_icms?: number | null
          concessionaria_id?: string | null
          consumo_fora_ponta_kwh?: number | null
          consumo_mensal_kwh?: number
          consumo_ponta_kwh?: number | null
          created_at?: string
          demanda_contratada_kw?: number | null
          geracao_mensal_estimada?: number | null
          grupo?: string | null
          id?: string
          metadata?: Json | null
          modalidade?: string | null
          nome?: string | null
          numero_uc?: string | null
          ordem?: number
          percentual_atendimento?: number | null
          potencia_necessaria_kwp?: number | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifa_fora_ponta?: number | null
          tarifa_ponta?: number | null
          tenant_id: string
          tipo_ligacao?: string | null
          titular?: string | null
          versao_id: string
        }
        Update: {
          aliquota_icms?: number | null
          concessionaria_id?: string | null
          consumo_fora_ponta_kwh?: number | null
          consumo_mensal_kwh?: number
          consumo_ponta_kwh?: number | null
          created_at?: string
          demanda_contratada_kw?: number | null
          geracao_mensal_estimada?: number | null
          grupo?: string | null
          id?: string
          metadata?: Json | null
          modalidade?: string | null
          nome?: string | null
          numero_uc?: string | null
          ordem?: number
          percentual_atendimento?: number | null
          potencia_necessaria_kwp?: number | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tarifa_fora_ponta?: number | null
          tarifa_ponta?: number | null
          tenant_id?: string
          tipo_ligacao?: string | null
          titular?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versao_ucs_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_ucs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_ucs_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versao_variaveis: {
        Row: {
          created_at: string
          expressao: string
          id: string
          label: string
          nome: string
          tenant_id: string
          valor_calculado: string | null
          variavel_id: string | null
          versao_id: string
        }
        Insert: {
          created_at?: string
          expressao: string
          id?: string
          label: string
          nome: string
          tenant_id: string
          valor_calculado?: string | null
          variavel_id?: string | null
          versao_id: string
        }
        Update: {
          created_at?: string
          expressao?: string
          id?: string
          label?: string
          nome?: string
          tenant_id?: string
          valor_calculado?: string | null
          variavel_id?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versao_variaveis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_variaveis_variavel_id_fkey"
            columns: ["variavel_id"]
            isOneToOne: false
            referencedRelation: "proposta_variaveis_custom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versao_variaveis_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "proposta_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_versoes: {
        Row: {
          aceito_em: string | null
          calc_hash: string | null
          created_at: string
          economia_mensal: number | null
          engine_version: string | null
          final_snapshot: Json | null
          finalized_at: string | null
          geracao_mensal: number | null
          gerado_em: string | null
          gerado_por: string | null
          grupo: string | null
          id: string
          idempotency_key: string | null
          irradiance_dataset_code: string | null
          irradiance_source_point: Json | null
          irradiance_version_id: string | null
          motivo_rejeicao: string | null
          observacoes: string | null
          payback_meses: number | null
          potencia_kwp: number | null
          proposta_id: string
          public_slug: string | null
          rejeitado_em: string | null
          snapshot: Json | null
          snapshot_locked: boolean
          status: Database["public"]["Enums"]["proposta_nativa_status"]
          tenant_id: string
          updated_at: string
          validade_dias: number
          valido_ate: string | null
          valor_total: number | null
          versao_numero: number
        }
        Insert: {
          aceito_em?: string | null
          calc_hash?: string | null
          created_at?: string
          economia_mensal?: number | null
          engine_version?: string | null
          final_snapshot?: Json | null
          finalized_at?: string | null
          geracao_mensal?: number | null
          gerado_em?: string | null
          gerado_por?: string | null
          grupo?: string | null
          id?: string
          idempotency_key?: string | null
          irradiance_dataset_code?: string | null
          irradiance_source_point?: Json | null
          irradiance_version_id?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          payback_meses?: number | null
          potencia_kwp?: number | null
          proposta_id: string
          public_slug?: string | null
          rejeitado_em?: string | null
          snapshot?: Json | null
          snapshot_locked?: boolean
          status?: Database["public"]["Enums"]["proposta_nativa_status"]
          tenant_id: string
          updated_at?: string
          validade_dias?: number
          valido_ate?: string | null
          valor_total?: number | null
          versao_numero: number
        }
        Update: {
          aceito_em?: string | null
          calc_hash?: string | null
          created_at?: string
          economia_mensal?: number | null
          engine_version?: string | null
          final_snapshot?: Json | null
          finalized_at?: string | null
          geracao_mensal?: number | null
          gerado_em?: string | null
          gerado_por?: string | null
          grupo?: string | null
          id?: string
          idempotency_key?: string | null
          irradiance_dataset_code?: string | null
          irradiance_source_point?: Json | null
          irradiance_version_id?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          payback_meses?: number | null
          potencia_kwp?: number | null
          proposta_id?: string
          public_slug?: string | null
          rejeitado_em?: string | null
          snapshot?: Json | null
          snapshot_locked?: boolean
          status?: Database["public"]["Enums"]["proposta_nativa_status"]
          tenant_id?: string
          updated_at?: string
          validade_dias?: number
          valido_ate?: string | null
          valor_total?: number | null
          versao_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposta_versoes_irradiance_version_id_fkey"
            columns: ["irradiance_version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_nativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_versoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      proposta_views: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          proposta_id: string
          referrer: string | null
          tenant_id: string
          token_id: string
          user_agent: string | null
          versao_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          proposta_id: string
          referrer?: string | null
          tenant_id: string
          token_id: string
          user_agent?: string | null
          versao_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          proposta_id?: string
          referrer?: string | null
          tenant_id?: string
          token_id?: string
          user_agent?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposta_views_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas_nativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_views_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposta_views_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "proposta_aceite_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_nativas: {
        Row: {
          aceita_at: string | null
          aceite_estimativa: boolean | null
          aceite_motivo: string | null
          aneel_run_id: string | null
          ano_gd: number | null
          cliente_id: string | null
          codigo: string
          consultor_id: string | null
          created_at: string
          created_by: string | null
          data_aceite_estimativa: string | null
          deal_id: string | null
          enviada_at: string | null
          fio_b_percent_aplicado: number | null
          id: string
          lead_id: string | null
          missing_variables: string[] | null
          origem: string
          origem_tarifa: string | null
          precisao_calculo: string | null
          precisao_motivo: string | null
          projeto_id: string
          proposta_num: number
          recusa_motivo: string | null
          recusada_at: string | null
          regra_gd: string | null
          sm_id: string | null
          sm_project_id: string | null
          sm_raw_payload: Json | null
          snapshot_hash: string | null
          status: string
          tariff_version_id: string | null
          template_id: string | null
          tenant_id: string
          titulo: string
          updated_at: string
          validade_dias: number | null
          versao_atual: number
          vigencia_tarifa: string | null
        }
        Insert: {
          aceita_at?: string | null
          aceite_estimativa?: boolean | null
          aceite_motivo?: string | null
          aneel_run_id?: string | null
          ano_gd?: number | null
          cliente_id?: string | null
          codigo: string
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_aceite_estimativa?: string | null
          deal_id?: string | null
          enviada_at?: string | null
          fio_b_percent_aplicado?: number | null
          id?: string
          lead_id?: string | null
          missing_variables?: string[] | null
          origem?: string
          origem_tarifa?: string | null
          precisao_calculo?: string | null
          precisao_motivo?: string | null
          projeto_id: string
          proposta_num: number
          recusa_motivo?: string | null
          recusada_at?: string | null
          regra_gd?: string | null
          sm_id?: string | null
          sm_project_id?: string | null
          sm_raw_payload?: Json | null
          snapshot_hash?: string | null
          status?: string
          tariff_version_id?: string | null
          template_id?: string | null
          tenant_id: string
          titulo?: string
          updated_at?: string
          validade_dias?: number | null
          versao_atual?: number
          vigencia_tarifa?: string | null
        }
        Update: {
          aceita_at?: string | null
          aceite_estimativa?: boolean | null
          aceite_motivo?: string | null
          aneel_run_id?: string | null
          ano_gd?: number | null
          cliente_id?: string | null
          codigo?: string
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_aceite_estimativa?: string | null
          deal_id?: string | null
          enviada_at?: string | null
          fio_b_percent_aplicado?: number | null
          id?: string
          lead_id?: string | null
          missing_variables?: string[] | null
          origem?: string
          origem_tarifa?: string | null
          precisao_calculo?: string | null
          precisao_motivo?: string | null
          projeto_id?: string
          proposta_num?: number
          recusa_motivo?: string | null
          recusada_at?: string | null
          regra_gd?: string | null
          sm_id?: string | null
          sm_project_id?: string | null
          sm_raw_payload?: Json | null
          snapshot_hash?: string | null
          status?: string
          tariff_version_id?: string | null
          template_id?: string | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
          validade_dias?: number | null
          versao_atual?: number
          vigencia_tarifa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_propostas_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_propostas_projeto"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_aneel_run_id_fkey"
            columns: ["aneel_run_id"]
            isOneToOne: false
            referencedRelation: "aneel_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_tariff_version_id_fkey"
            columns: ["tariff_version_id"]
            isOneToOne: false
            referencedRelation: "tariff_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "proposta_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_nativas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas_sm_legado: {
        Row: {
          area_necessaria: number | null
          cliente_celular: string | null
          cliente_cep: string | null
          cliente_cidade: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_estado: string | null
          cliente_nome: string | null
          consultor_id: string | null
          created_at: string
          created_at_sm: string | null
          distribuidora: string | null
          economia_mensal: number | null
          expiration_date: string | null
          generated_at: string | null
          geracao_mensal_kwh: number | null
          id: string
          link_pdf: string | null
          modelo_inversor: string | null
          modelo_modulo: string | null
          nome: string
          numero_modulos: number | null
          payback_anos: number | null
          potencia_kwp: number | null
          preco_total: number | null
          raw_payload: Json | null
          serie_consumo_mensal: number[] | null
          serie_economia_anual: number[] | null
          serie_geracao_mensal: number[] | null
          sm_id: string | null
          sm_project_id: string | null
          sm_project_name: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          area_necessaria?: number | null
          cliente_celular?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_estado?: string | null
          cliente_nome?: string | null
          consultor_id?: string | null
          created_at?: string
          created_at_sm?: string | null
          distribuidora?: string | null
          economia_mensal?: number | null
          expiration_date?: string | null
          generated_at?: string | null
          geracao_mensal_kwh?: number | null
          id?: string
          link_pdf?: string | null
          modelo_inversor?: string | null
          modelo_modulo?: string | null
          nome: string
          numero_modulos?: number | null
          payback_anos?: number | null
          potencia_kwp?: number | null
          preco_total?: number | null
          raw_payload?: Json | null
          serie_consumo_mensal?: number[] | null
          serie_economia_anual?: number[] | null
          serie_geracao_mensal?: number[] | null
          sm_id?: string | null
          sm_project_id?: string | null
          sm_project_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          area_necessaria?: number | null
          cliente_celular?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_estado?: string | null
          cliente_nome?: string | null
          consultor_id?: string | null
          created_at?: string
          created_at_sm?: string | null
          distribuidora?: string | null
          economia_mensal?: number | null
          expiration_date?: string | null
          generated_at?: string | null
          geracao_mensal_kwh?: number | null
          id?: string
          link_pdf?: string | null
          modelo_inversor?: string | null
          modelo_modulo?: string | null
          nome?: string
          numero_modulos?: number | null
          payback_anos?: number | null
          potencia_kwp?: number | null
          preco_total?: number | null
          raw_payload?: Json | null
          serie_consumo_mensal?: number[] | null
          serie_economia_anual?: number[] | null
          serie_geracao_mensal?: number[] | null
          sm_id?: string | null
          sm_project_id?: string | null
          sm_project_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "propostas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      push_muted_conversations: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          muted_until: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          muted_until?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_muted_conversations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_muted_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_sent_log: {
        Row: {
          id: string
          message_id: string
          sent_at: string
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          message_id: string
          sent_at?: string
          subscription_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          message_id?: string
          sent_at?: string
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_sent_log_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_sent_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh: string
          tenant_id: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh: string
          tenant_id: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh?: string
          tenant_id?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_contrato_servicos: {
        Row: {
          contrato_id: string
          created_at: string
          id: string
          preco_unitario: number | null
          quantidade: number
          servico_id: string
          tenant_id: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          id?: string
          preco_unitario?: number | null
          quantidade?: number
          servico_id: string
          tenant_id: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          id?: string
          preco_unitario?: number | null
          quantidade?: number
          servico_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_contrato_servicos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "pv_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_contrato_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "pv_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_contrato_servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_contratos: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          numero_contrato: string | null
          observacoes: string | null
          periodicidade_meses: number | null
          proximo_servico_em: string | null
          status: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor_mensal: number | null
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          periodicidade_meses?: number | null
          proximo_servico_em?: string | null
          status?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor_mensal?: number | null
          valor_total?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          numero_contrato?: string | null
          observacoes?: string | null
          periodicidade_meses?: number | null
          proximo_servico_em?: string | null
          status?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor_mensal?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pv_contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_contratos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_ordens_servico: {
        Row: {
          appointment_id: string | null
          assinatura_cliente_url: string | null
          cliente_id: string
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_agendada: string | null
          data_conclusao: string | null
          data_execucao: string | null
          executado_por: string | null
          fotos_urls: string[] | null
          id: string
          laudo_tecnico: string | null
          numero_os: string | null
          observacoes: string | null
          servico_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor_cobrado: number | null
        }
        Insert: {
          appointment_id?: string | null
          assinatura_cliente_url?: string | null
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          data_execucao?: string | null
          executado_por?: string | null
          fotos_urls?: string[] | null
          id?: string
          laudo_tecnico?: string | null
          numero_os?: string | null
          observacoes?: string | null
          servico_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Update: {
          appointment_id?: string | null
          assinatura_cliente_url?: string | null
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          data_execucao?: string | null
          executado_por?: string | null
          fotos_urls?: string[] | null
          id?: string
          laudo_tecnico?: string | null
          numero_os?: string | null
          observacoes?: string | null
          servico_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_cobrado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pv_ordens_servico_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_ordens_servico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "pv_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_ordens_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "pv_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_ordens_servico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_os_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          foto_url: string | null
          id: string
          item: string
          observacao: string | null
          ordem: number
          ordem_id: string
          tenant_id: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          item: string
          observacao?: string | null
          ordem?: number
          ordem_id: string
          tenant_id: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          item?: string
          observacao?: string | null
          ordem?: number
          ordem_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_os_checklist_ordem_id_fkey"
            columns: ["ordem_id"]
            isOneToOne: false
            referencedRelation: "pv_ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_os_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pv_servicos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          duracao_estimada_min: number | null
          id: string
          nome: string
          preco_base: number
          requer_agendamento: boolean
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_estimada_min?: number | null
          id?: string
          nome: string
          preco_base?: number
          requer_agendamento?: boolean
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_estimada_min?: number | null
          id?: string
          nome?: string
          preco_base?: number
          requer_agendamento?: boolean
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pv_servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          cliente_id: string
          created_at: string
          data_acordo: string
          descricao: string | null
          forma_pagamento_acordada: string
          id: string
          numero_parcelas: number
          status: string
          tenant_id: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_acordo?: string
          descricao?: string | null
          forma_pagamento_acordada: string
          id?: string
          numero_parcelas?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_total: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_acordo?: string
          descricao?: string | null
          forma_pagamento_acordada?: string
          id?: string
          numero_parcelas?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      release_checklists: {
        Row: {
          ambiente: string
          aprovado_em: string | null
          aprovado_por: string | null
          commit_hash: string | null
          created_at: string
          criado_por: string
          id: string
          itens: Json
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          versao: string
        }
        Insert: {
          ambiente?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          commit_hash?: string | null
          created_at?: string
          criado_por: string
          id?: string
          itens?: Json
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          versao?: string
        }
        Update: {
          ambiente?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          commit_hash?: string | null
          created_at?: string
          criado_por?: string
          id?: string
          itens?: Json
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_checklists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          consultor_code_hash: string | null
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip_hash: string | null
          path: string | null
          success: boolean
          tenant_id: string | null
          user_agent_hash: string | null
        }
        Insert: {
          consultor_code_hash?: string | null
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          success?: boolean
          tenant_id?: string | null
          user_agent_hash?: string | null
        }
        Update: {
          consultor_code_hash?: string | null
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          path?: string | null
          success?: boolean
          tenant_id?: string | null
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_agendados: {
        Row: {
          audio_url: string | null
          bairro: string | null
          checklist_id: string | null
          cidade: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_agendada: string
          data_hora_fim: string | null
          data_hora_inicio: string | null
          descricao: string | null
          endereco: string | null
          fotos_urls: string[] | null
          google_calendar_event_id: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          instalador_id: string
          layout_modulos: Json | null
          lead_id: string | null
          observacoes: string | null
          observacoes_conclusao: string | null
          observacoes_validacao: string | null
          projeto_id: string | null
          status: Database["public"]["Enums"]["servico_status"]
          tenant_id: string
          tipo: Database["public"]["Enums"]["servico_tipo"]
          updated_at: string
          validado: boolean | null
          validado_em: string | null
          validado_por: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          bairro?: string | null
          checklist_id?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          descricao?: string | null
          endereco?: string | null
          fotos_urls?: string[] | null
          google_calendar_event_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instalador_id: string
          layout_modulos?: Json | null
          lead_id?: string | null
          observacoes?: string | null
          observacoes_conclusao?: string | null
          observacoes_validacao?: string | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["servico_status"]
          tenant_id?: string
          tipo: Database["public"]["Enums"]["servico_tipo"]
          updated_at?: string
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          bairro?: string | null
          checklist_id?: string | null
          cidade?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string
          data_hora_fim?: string | null
          data_hora_inicio?: string | null
          descricao?: string | null
          endereco?: string | null
          fotos_urls?: string[] | null
          google_calendar_event_id?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          instalador_id?: string
          layout_modulos?: Json | null
          lead_id?: string | null
          observacoes?: string | null
          observacoes_conclusao?: string | null
          observacoes_validacao?: string | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["servico_status"]
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["servico_tipo"]
          updated_at?: string
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_agendados_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists_instalacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_agendados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_agendados_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_agendados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_agendados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_settings: {
        Row: {
          api_token_encrypted: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          provider: string | null
          sandbox_mode: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          api_token_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          provider?: string | null
          sandbox_mode?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          api_token_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          provider?: string | null
          sandbox_mode?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signers: {
        Row: {
          auth_method: string
          birth_date: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          options: Json | null
          phone: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_method?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          options?: Json | null
          phone?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_method?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          options?: Json | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes: {
        Row: {
          cidade: string | null
          co2_evitado_kg: number | null
          concessionaria: string | null
          consumo_kwh: number | null
          created_at: string
          economia_anual: number | null
          economia_mensal: number | null
          estado: string | null
          geracao_mensal_estimada: number | null
          id: string
          investimento_estimado: number | null
          irradiacao_usada: number | null
          irradiance_dataset_code: string | null
          irradiance_distance_km: number | null
          irradiance_method: string | null
          irradiance_point_id: number | null
          irradiance_source_lat: number | null
          irradiance_source_lon: number | null
          irradiance_units: string | null
          irradiance_version_id: string | null
          lead_id: string | null
          payback_meses: number | null
          potencia_recomendada_kwp: number | null
          tarifa_kwh_usada: number | null
          tenant_id: string
          tipo_conta: string | null
          tipo_telhado: string | null
          valor_conta: number | null
        }
        Insert: {
          cidade?: string | null
          co2_evitado_kg?: number | null
          concessionaria?: string | null
          consumo_kwh?: number | null
          created_at?: string
          economia_anual?: number | null
          economia_mensal?: number | null
          estado?: string | null
          geracao_mensal_estimada?: number | null
          id?: string
          investimento_estimado?: number | null
          irradiacao_usada?: number | null
          irradiance_dataset_code?: string | null
          irradiance_distance_km?: number | null
          irradiance_method?: string | null
          irradiance_point_id?: number | null
          irradiance_source_lat?: number | null
          irradiance_source_lon?: number | null
          irradiance_units?: string | null
          irradiance_version_id?: string | null
          lead_id?: string | null
          payback_meses?: number | null
          potencia_recomendada_kwp?: number | null
          tarifa_kwh_usada?: number | null
          tenant_id: string
          tipo_conta?: string | null
          tipo_telhado?: string | null
          valor_conta?: number | null
        }
        Update: {
          cidade?: string | null
          co2_evitado_kg?: number | null
          concessionaria?: string | null
          consumo_kwh?: number | null
          created_at?: string
          economia_anual?: number | null
          economia_mensal?: number | null
          estado?: string | null
          geracao_mensal_estimada?: number | null
          id?: string
          investimento_estimado?: number | null
          irradiacao_usada?: number | null
          irradiance_dataset_code?: string | null
          irradiance_distance_km?: number | null
          irradiance_method?: string | null
          irradiance_point_id?: number | null
          irradiance_source_lat?: number | null
          irradiance_source_lon?: number | null
          irradiance_units?: string | null
          irradiance_version_id?: string | null
          lead_id?: string | null
          payback_meses?: number | null
          potencia_recomendada_kwp?: number | null
          tarifa_kwh_usada?: number | null
          tenant_id?: string
          tipo_conta?: string | null
          tipo_telhado?: string | null
          valor_conta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacoes_irradiance_version_id_fkey"
            columns: ["irradiance_version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_banners: {
        Row: {
          ativo: boolean
          botao_link: string | null
          botao_texto: string | null
          created_at: string
          id: string
          imagem_url: string
          ordem: number
          subtitulo: string | null
          tenant_id: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          botao_link?: string | null
          botao_texto?: string | null
          created_at?: string
          id?: string
          imagem_url: string
          ordem?: number
          subtitulo?: string | null
          tenant_id: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          botao_link?: string | null
          botao_texto?: string | null
          created_at?: string
          id?: string
          imagem_url?: string
          ordem?: number
          subtitulo?: string | null
          tenant_id?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_banners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_servicos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          imagem_url: string | null
          ordem: number
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          imagem_url?: string | null
          ordem?: number
          tenant_id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          imagem_url?: string | null
          ordem?: number
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_servicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          coordenadas_lat: number | null
          coordenadas_lng: number | null
          created_at: string
          cta_subtitulo: string | null
          cta_titulo: string | null
          dominio_customizado: string | null
          email: string | null
          endereco_completo: string | null
          estado: string | null
          facebook_url: string | null
          google_maps_url: string | null
          hero_badge_texto: string | null
          hero_cta_texto: string | null
          hero_cta_whatsapp_texto: string | null
          hero_subtitulo: string | null
          hero_titulo: string | null
          horario_atendimento: string | null
          id: string
          instagram_url: string | null
          instrucoes_dns: string | null
          linkedin_url: string | null
          meta_description: string | null
          meta_title: string | null
          nome_empresa: string
          rua: string | null
          site_url: string | null
          slogan: string | null
          stat_anos_experiencia: number | null
          stat_economia_percentual: number | null
          stat_projetos_realizados: number | null
          telefone: string | null
          tenant_id: string
          texto_sobre: string | null
          texto_sobre_resumido: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_mensagem_padrao: string | null
          youtube_url: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          cta_subtitulo?: string | null
          cta_titulo?: string | null
          dominio_customizado?: string | null
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          hero_badge_texto?: string | null
          hero_cta_texto?: string | null
          hero_cta_whatsapp_texto?: string | null
          hero_subtitulo?: string | null
          hero_titulo?: string | null
          horario_atendimento?: string | null
          id?: string
          instagram_url?: string | null
          instrucoes_dns?: string | null
          linkedin_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nome_empresa?: string
          rua?: string | null
          site_url?: string | null
          slogan?: string | null
          stat_anos_experiencia?: number | null
          stat_economia_percentual?: number | null
          stat_projetos_realizados?: number | null
          telefone?: string | null
          tenant_id: string
          texto_sobre?: string | null
          texto_sobre_resumido?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_mensagem_padrao?: string | null
          youtube_url?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          coordenadas_lat?: number | null
          coordenadas_lng?: number | null
          created_at?: string
          cta_subtitulo?: string | null
          cta_titulo?: string | null
          dominio_customizado?: string | null
          email?: string | null
          endereco_completo?: string | null
          estado?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          hero_badge_texto?: string | null
          hero_cta_texto?: string | null
          hero_cta_whatsapp_texto?: string | null
          hero_subtitulo?: string | null
          hero_titulo?: string | null
          horario_atendimento?: string | null
          id?: string
          instagram_url?: string | null
          instrucoes_dns?: string | null
          linkedin_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          nome_empresa?: string
          rua?: string | null
          site_url?: string | null
          slogan?: string | null
          stat_anos_experiencia?: number | null
          stat_economia_percentual?: number | null
          stat_projetos_realizados?: number | null
          telefone?: string | null
          tenant_id?: string
          texto_sobre?: string | null
          texto_sobre_resumido?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_mensagem_padrao?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_breaches: {
        Row: {
          consultor_id: string | null
          created_at: string | null
          escalado: boolean | null
          escalado_para: string | null
          id: string
          lead_id: string
          minutos_limite: number
          minutos_real: number | null
          resolvido: boolean | null
          resolvido_em: string | null
          sla_rule_id: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          consultor_id?: string | null
          created_at?: string | null
          escalado?: boolean | null
          escalado_para?: string | null
          id?: string
          lead_id: string
          minutos_limite: number
          minutos_real?: number | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          sla_rule_id?: string | null
          tenant_id?: string
          tipo: string
        }
        Update: {
          consultor_id?: string | null
          created_at?: string | null
          escalado?: boolean | null
          escalado_para?: string | null
          id?: string
          lead_id?: string
          minutos_limite?: number
          minutos_real?: number | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          sla_rule_id?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_breaches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_sla_rule_id_fkey"
            columns: ["sla_rule_id"]
            isOneToOne: false
            referencedRelation: "sla_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_breaches_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_rules: {
        Row: {
          applies_to: string | null
          ativo: boolean | null
          auto_create_task: boolean | null
          created_at: string
          escalation_enabled: boolean | null
          id: string
          max_minutes_to_first_contact: number | null
          max_minutes_to_next_followup: number | null
          rule_name: string
          task_priority: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applies_to?: string | null
          ativo?: boolean | null
          auto_create_task?: boolean | null
          created_at?: string
          escalation_enabled?: boolean | null
          id?: string
          max_minutes_to_first_contact?: number | null
          max_minutes_to_next_followup?: number | null
          rule_name: string
          task_priority?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          applies_to?: string | null
          ativo?: boolean | null
          auto_create_task?: boolean | null
          created_at?: string
          escalation_enabled?: boolean | null
          id?: string
          max_minutes_to_first_contact?: number | null
          max_minutes_to_next_followup?: number | null
          rule_name?: string
          task_priority?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          created_at: string
          enabled: boolean
          from_email: string
          from_name: string
          host: string
          id: string
          password_encrypted: string
          port: number
          reply_to: string | null
          secure: boolean
          tenant_id: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          from_email: string
          from_name: string
          host: string
          id?: string
          password_encrypted: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          tenant_id: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          password_encrypted?: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          tenant_id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      solar_import_job_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_import_job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "solar_import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_import_job_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          dataset_key: string
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          row_count: number | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dataset_key: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          row_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dataset_key?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          row_count?: number | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_kit_catalog: {
        Row: {
          created_at: string
          description: string | null
          estimated_kwp: number | null
          fixed_price: number | null
          id: string
          name: string
          pricing_mode: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_kwp?: number | null
          fixed_price?: number | null
          id?: string
          name: string
          pricing_mode?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_kwp?: number | null
          fixed_price?: number | null
          id?: string
          name?: string
          pricing_mode?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_kit_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_kit_catalog_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_type: string
          kit_id: string
          notes: string | null
          quantity: number
          ref_id: string | null
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_type: string
          kit_id: string
          notes?: string | null
          quantity: number
          ref_id?: string | null
          tenant_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          kit_id?: string
          notes?: string | null
          quantity?: number
          ref_id?: string | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_kit_catalog_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "solar_kit_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_kit_catalog_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_clients: {
        Row: {
          address: Json | null
          city: string | null
          company: string | null
          complement: string | null
          created_at: string
          document: string | null
          document_formatted: string | null
          email: string | null
          email_normalized: string | null
          id: string
          lead_id: string | null
          name: string | null
          neighborhood: string | null
          number: string | null
          phone: string | null
          phone_formatted: string | null
          phone_normalized: string | null
          raw_payload: Json | null
          representative: Json | null
          responsible: Json | null
          secondary_phone: string | null
          sm_client_id: number
          sm_created_at: string | null
          state: string | null
          synced_at: string
          tenant_id: string
          zip_code: string | null
          zip_code_formatted: string | null
        }
        Insert: {
          address?: Json | null
          city?: string | null
          company?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          document_formatted?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          phone_formatted?: string | null
          phone_normalized?: string | null
          raw_payload?: Json | null
          representative?: Json | null
          responsible?: Json | null
          secondary_phone?: string | null
          sm_client_id: number
          sm_created_at?: string | null
          state?: string | null
          synced_at?: string
          tenant_id: string
          zip_code?: string | null
          zip_code_formatted?: string | null
        }
        Update: {
          address?: Json | null
          city?: string | null
          company?: string | null
          complement?: string | null
          created_at?: string
          document?: string | null
          document_formatted?: string | null
          email?: string | null
          email_normalized?: string | null
          id?: string
          lead_id?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          phone_formatted?: string | null
          phone_normalized?: string | null
          raw_payload?: Json | null
          representative?: Json | null
          responsible?: Json | null
          secondary_phone?: string | null
          sm_client_id?: number
          sm_created_at?: string | null
          state?: string | null
          synced_at?: string
          tenant_id?: string
          zip_code?: string | null
          zip_code_formatted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_market_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_config: {
        Row: {
          api_token: string | null
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_token?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_token?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_custom_field_values: {
        Row: {
          field_key: string | null
          field_value: string | null
          id: string
          raw_payload: Json | null
          sm_client_id: number | null
          sm_custom_field_id: number
          sm_project_id: number | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          field_key?: string | null
          field_value?: string | null
          id?: string
          raw_payload?: Json | null
          sm_client_id?: number | null
          sm_custom_field_id: number
          sm_project_id?: number | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          field_key?: string | null
          field_value?: string | null
          id?: string
          raw_payload?: Json | null
          sm_client_id?: number | null
          sm_custom_field_id?: number
          sm_project_id?: number | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      solar_market_custom_fields: {
        Row: {
          field_type: string | null
          id: string
          key: string | null
          name: string | null
          options: Json | null
          raw_payload: Json | null
          sm_custom_field_id: number
          synced_at: string
          tenant_id: string
        }
        Insert: {
          field_type?: string | null
          id?: string
          key?: string | null
          name?: string | null
          options?: Json | null
          raw_payload?: Json | null
          sm_custom_field_id: number
          synced_at?: string
          tenant_id: string
        }
        Update: {
          field_type?: string | null
          id?: string
          key?: string | null
          name?: string | null
          options?: Json | null
          raw_payload?: Json | null
          sm_custom_field_id?: number
          synced_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      solar_market_funnel_stages: {
        Row: {
          funnel_name: string | null
          id: string
          raw_payload: Json | null
          sm_funnel_id: number
          sm_stage_id: number
          stage_name: string | null
          stage_order: number | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          funnel_name?: string | null
          id?: string
          raw_payload?: Json | null
          sm_funnel_id: number
          sm_stage_id: number
          stage_name?: string | null
          stage_order?: number | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          funnel_name?: string | null
          id?: string
          raw_payload?: Json | null
          sm_funnel_id?: number
          sm_stage_id?: number
          stage_name?: string | null
          stage_order?: number | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      solar_market_funnels: {
        Row: {
          id: string
          name: string | null
          raw_payload: Json | null
          sm_funnel_id: number
          stages: Json | null
          synced_at: string
          tenant_id: string
        }
        Insert: {
          id?: string
          name?: string | null
          raw_payload?: Json | null
          sm_funnel_id: number
          stages?: Json | null
          synced_at?: string
          tenant_id: string
        }
        Update: {
          id?: string
          name?: string | null
          raw_payload?: Json | null
          sm_funnel_id?: number
          stages?: Json | null
          synced_at?: string
          tenant_id?: string
        }
        Relationships: []
      }
      solar_market_projects: {
        Row: {
          address: string | null
          city: string | null
          complement: string | null
          created_at: string
          custom_fields: Json | null
          description: string | null
          energy_consumption: number | null
          id: string
          installation_type: string | null
          lead_id: string | null
          name: string | null
          neighborhood: string | null
          number: string | null
          phase_type: string | null
          potencia_kwp: number | null
          raw_payload: Json | null
          representative: Json | null
          responsible: Json | null
          sm_client_id: number | null
          sm_created_at: string | null
          sm_funnel_id: number | null
          sm_funnel_name: string | null
          sm_project_id: number
          sm_stage_id: number | null
          sm_stage_name: string | null
          sm_updated_at: string | null
          state: string | null
          status: string | null
          synced_at: string
          tenant_id: string
          valor: number | null
          voltage: string | null
          zip_code: string | null
          zip_code_formatted: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          energy_consumption?: number | null
          id?: string
          installation_type?: string | null
          lead_id?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phase_type?: string | null
          potencia_kwp?: number | null
          raw_payload?: Json | null
          representative?: Json | null
          responsible?: Json | null
          sm_client_id?: number | null
          sm_created_at?: string | null
          sm_funnel_id?: number | null
          sm_funnel_name?: string | null
          sm_project_id: number
          sm_stage_id?: number | null
          sm_stage_name?: string | null
          sm_updated_at?: string | null
          state?: string | null
          status?: string | null
          synced_at?: string
          tenant_id: string
          valor?: number | null
          voltage?: string | null
          zip_code?: string | null
          zip_code_formatted?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          complement?: string | null
          created_at?: string
          custom_fields?: Json | null
          description?: string | null
          energy_consumption?: number | null
          id?: string
          installation_type?: string | null
          lead_id?: string | null
          name?: string | null
          neighborhood?: string | null
          number?: string | null
          phase_type?: string | null
          potencia_kwp?: number | null
          raw_payload?: Json | null
          representative?: Json | null
          responsible?: Json | null
          sm_client_id?: number | null
          sm_created_at?: string | null
          sm_funnel_id?: number | null
          sm_funnel_name?: string | null
          sm_project_id?: number
          sm_stage_id?: number | null
          sm_stage_name?: string | null
          sm_updated_at?: string | null
          state?: string | null
          status?: string | null
          synced_at?: string
          tenant_id?: string
          valor?: number | null
          voltage?: string | null
          zip_code?: string | null
          zip_code_formatted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_market_projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_proposals: {
        Row: {
          acceptance_date: string | null
          cidade: string | null
          consumo_mensal: number | null
          created_at: string
          custo_disponibilidade: number | null
          description: string | null
          dis_energia: string | null
          discount: number | null
          economia_mensal: number | null
          economia_mensal_percent: number | null
          energy_generation: number | null
          equipment_cost: number | null
          estado: string | null
          fase: string | null
          generated_at: string | null
          geracao_anual: number | null
          id: string
          inflacao_energetica: number | null
          installation_cost: number | null
          inversores: string | null
          inverter_model: string | null
          inverter_quantity: number | null
          link_pdf: string | null
          modulos: string | null
          panel_model: string | null
          panel_quantity: number | null
          payback: string | null
          payment_conditions: string | null
          perda_eficiencia_anual: number | null
          potencia_kwp: number | null
          preco_total: number | null
          raw_payload: Json | null
          rejection_date: string | null
          roof_type: string | null
          send_at: string | null
          sm_client_id: number | null
          sm_created_at: string | null
          sm_project_id: number | null
          sm_proposal_id: number
          sm_updated_at: string | null
          sobredimensionamento: number | null
          status: string | null
          structure_type: string | null
          synced_at: string
          tarifa_distribuidora: number | null
          tenant_id: string
          tipo_dimensionamento: string | null
          tir: number | null
          titulo: string | null
          valid_until: string | null
          valor_total: number | null
          viewed_at: string | null
          vpl: number | null
          warranty: string | null
        }
        Insert: {
          acceptance_date?: string | null
          cidade?: string | null
          consumo_mensal?: number | null
          created_at?: string
          custo_disponibilidade?: number | null
          description?: string | null
          dis_energia?: string | null
          discount?: number | null
          economia_mensal?: number | null
          economia_mensal_percent?: number | null
          energy_generation?: number | null
          equipment_cost?: number | null
          estado?: string | null
          fase?: string | null
          generated_at?: string | null
          geracao_anual?: number | null
          id?: string
          inflacao_energetica?: number | null
          installation_cost?: number | null
          inversores?: string | null
          inverter_model?: string | null
          inverter_quantity?: number | null
          link_pdf?: string | null
          modulos?: string | null
          panel_model?: string | null
          panel_quantity?: number | null
          payback?: string | null
          payment_conditions?: string | null
          perda_eficiencia_anual?: number | null
          potencia_kwp?: number | null
          preco_total?: number | null
          raw_payload?: Json | null
          rejection_date?: string | null
          roof_type?: string | null
          send_at?: string | null
          sm_client_id?: number | null
          sm_created_at?: string | null
          sm_project_id?: number | null
          sm_proposal_id: number
          sm_updated_at?: string | null
          sobredimensionamento?: number | null
          status?: string | null
          structure_type?: string | null
          synced_at?: string
          tarifa_distribuidora?: number | null
          tenant_id: string
          tipo_dimensionamento?: string | null
          tir?: number | null
          titulo?: string | null
          valid_until?: string | null
          valor_total?: number | null
          viewed_at?: string | null
          vpl?: number | null
          warranty?: string | null
        }
        Update: {
          acceptance_date?: string | null
          cidade?: string | null
          consumo_mensal?: number | null
          created_at?: string
          custo_disponibilidade?: number | null
          description?: string | null
          dis_energia?: string | null
          discount?: number | null
          economia_mensal?: number | null
          economia_mensal_percent?: number | null
          energy_generation?: number | null
          equipment_cost?: number | null
          estado?: string | null
          fase?: string | null
          generated_at?: string | null
          geracao_anual?: number | null
          id?: string
          inflacao_energetica?: number | null
          installation_cost?: number | null
          inversores?: string | null
          inverter_model?: string | null
          inverter_quantity?: number | null
          link_pdf?: string | null
          modulos?: string | null
          panel_model?: string | null
          panel_quantity?: number | null
          payback?: string | null
          payment_conditions?: string | null
          perda_eficiencia_anual?: number | null
          potencia_kwp?: number | null
          preco_total?: number | null
          raw_payload?: Json | null
          rejection_date?: string | null
          roof_type?: string | null
          send_at?: string | null
          sm_client_id?: number | null
          sm_created_at?: string | null
          sm_project_id?: number | null
          sm_proposal_id?: number
          sm_updated_at?: string | null
          sobredimensionamento?: number | null
          status?: string | null
          structure_type?: string | null
          synced_at?: string
          tarifa_distribuidora?: number | null
          tenant_id?: string
          tipo_dimensionamento?: string | null
          tir?: number | null
          titulo?: string | null
          valid_until?: string | null
          valor_total?: number | null
          viewed_at?: string | null
          vpl?: number | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          started_at: string
          status: string
          sync_type: string
          tenant_id: string
          total_errors: number | null
          total_fetched: number | null
          total_upserted: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          sync_type: string
          tenant_id: string
          total_errors?: number | null
          total_fetched?: number | null
          total_upserted?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          started_at?: string
          status?: string
          sync_type?: string
          tenant_id?: string
          total_errors?: number | null
          total_fetched?: number | null
          total_upserted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          external_id: string | null
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_id?: string | null
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          external_id?: string | null
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_actions: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_tenant_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_tenant_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "super_admin_actions_target_tenant_id_fkey"
            columns: ["target_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifa_versoes: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          arquivo_nome: string | null
          created_at: string
          created_by: string | null
          id: string
          notas: string | null
          origem: string
          status: string
          sync_run_id: string | null
          tenant_id: string
          total_concessionarias: number | null
          total_registros: number | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notas?: string | null
          origem?: string
          status?: string
          sync_run_id?: string | null
          tenant_id: string
          total_concessionarias?: number | null
          total_registros?: number | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notas?: string | null
          origem?: string
          status?: string
          sync_run_id?: string | null
          tenant_id?: string
          total_concessionarias?: number | null
          total_registros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifa_versoes_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "aneel_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifa_versoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tariff_versions: {
        Row: {
          aliquota_icms: number | null
          concessionaria_id: string
          created_at: string
          custo_disp_bi: number | null
          custo_disp_mono: number | null
          custo_disp_tri: number | null
          id: string
          is_active: boolean
          origem: string
          percentual_isencao: number | null
          pnd_kwh: number | null
          possui_isencao: boolean | null
          precisao: string
          published_at: string | null
          published_by: string | null
          run_id: string | null
          snapshot_hash: string | null
          snapshot_raw: Json | null
          tarifa_total_kwh: number | null
          te_kwh: number | null
          tenant_id: string
          tfsee_kwh: number | null
          tusd_fio_a_kwh: number | null
          tusd_fio_b_kwh: number | null
          tusd_total_kwh: number | null
          updated_at: string
          validation_notes: Json | null
          validation_status: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aliquota_icms?: number | null
          concessionaria_id: string
          created_at?: string
          custo_disp_bi?: number | null
          custo_disp_mono?: number | null
          custo_disp_tri?: number | null
          id?: string
          is_active?: boolean
          origem?: string
          percentual_isencao?: number | null
          pnd_kwh?: number | null
          possui_isencao?: boolean | null
          precisao?: string
          published_at?: string | null
          published_by?: string | null
          run_id?: string | null
          snapshot_hash?: string | null
          snapshot_raw?: Json | null
          tarifa_total_kwh?: number | null
          te_kwh?: number | null
          tenant_id: string
          tfsee_kwh?: number | null
          tusd_fio_a_kwh?: number | null
          tusd_fio_b_kwh?: number | null
          tusd_total_kwh?: number | null
          updated_at?: string
          validation_notes?: Json | null
          validation_status?: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aliquota_icms?: number | null
          concessionaria_id?: string
          created_at?: string
          custo_disp_bi?: number | null
          custo_disp_mono?: number | null
          custo_disp_tri?: number | null
          id?: string
          is_active?: boolean
          origem?: string
          percentual_isencao?: number | null
          pnd_kwh?: number | null
          possui_isencao?: boolean | null
          precisao?: string
          published_at?: string | null
          published_by?: string | null
          run_id?: string | null
          snapshot_hash?: string | null
          snapshot_raw?: Json | null
          tarifa_total_kwh?: number | null
          te_kwh?: number | null
          tenant_id?: string
          tfsee_kwh?: number | null
          tusd_fio_a_kwh?: number | null
          tusd_fio_b_kwh?: number | null
          tusd_total_kwh?: number | null
          updated_at?: string
          validation_notes?: Json | null
          validation_status?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "tariff_versions_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_versions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "aneel_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tariff_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          task_id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          task_id: string
          tenant_id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          task_id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          related_id: string | null
          related_type: string | null
          sla_rule_id: string | null
          source: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          sla_rule_id?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          related_id?: string | null
          related_type?: string | null
          sla_rule_id?: string | null
          source?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_counters: {
        Row: {
          created_at: string
          entity: string
          last_value: number | null
          next_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          last_value?: number | null
          next_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          last_value?: number | null
          next_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_feriados: {
        Row: {
          ativo: boolean
          created_at: string
          data: string
          id: string
          nome: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data: string
          id?: string
          nome: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data?: string
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feriados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_horarios_atendimento: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_horarios_atendimento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_irradiance_config: {
        Row: {
          created_at: string
          dataset_code: string
          lookup_method: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_code?: string
          lookup_method?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_code?: string
          lookup_method?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_irradiance_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_irradiance_config_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "irradiance_dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_premises: {
        Row: {
          base_irradiancia: string
          concessionaria_id: string | null
          considerar_custo_disponibilidade: boolean
          considerar_custo_disponibilidade_solar: boolean
          considerar_kits_transformador: boolean
          created_at: string
          created_by: string | null
          custo_por_kwp: number
          custo_troca_inversor_microinversor: number
          custo_troca_inversor_otimizador: number
          custo_troca_inversor_tradicional: number
          desvio_azimutal: number
          dod: number
          fase_tensao_rede: string
          fator_simultaneidade: number
          fornecedor_filtro: string
          geracao_mensal_por_kwp: number
          grupo_tarifario: string
          id: string
          imposto_energia: number
          inclinacao_modulos: number
          inflacao_energetica: number
          kg_co2_por_kwh: number
          margem_potencia_ideal: number
          outros_encargos_atual: number
          outros_encargos_novo: number
          percentual_economia: number
          perda_eficiencia_microinversor: number
          perda_eficiencia_otimizador: number
          perda_eficiencia_tradicional: number
          preco_demanda: number
          preco_demanda_geracao: number
          sobredimensionamento_padrao: number
          sombreamento_config: Json
          tarifa: number
          tarifa_te_fora_ponta: number
          tarifa_te_ponta: number
          tarifa_tusd_fora_ponta: number
          tarifa_tusd_ponta: number
          tarifacao_compensada_bt: number
          tarifacao_compensada_fora_ponta: number
          tarifacao_compensada_ponta: number
          taxa_desempenho_microinversor: number
          taxa_desempenho_otimizador: number
          taxa_desempenho_tradicional: number
          tenant_id: string
          tipo_kits: string[]
          tipo_preco: string
          tipo_sistema: string
          tipo_telhado_padrao: string
          topologias: string[]
          troca_inversor_anos_microinversor: number
          troca_inversor_anos_otimizador: number
          troca_inversor_anos_tradicional: number
          tusd_fio_b_bt: number
          tusd_fio_b_fora_ponta: number
          tusd_fio_b_ponta: number
          updated_at: string
          updated_by: string | null
          vida_util_sistema: number
          vpl_taxa_desconto: number
        }
        Insert: {
          base_irradiancia?: string
          concessionaria_id?: string | null
          considerar_custo_disponibilidade?: boolean
          considerar_custo_disponibilidade_solar?: boolean
          considerar_kits_transformador?: boolean
          created_at?: string
          created_by?: string | null
          custo_por_kwp?: number
          custo_troca_inversor_microinversor?: number
          custo_troca_inversor_otimizador?: number
          custo_troca_inversor_tradicional?: number
          desvio_azimutal?: number
          dod?: number
          fase_tensao_rede?: string
          fator_simultaneidade?: number
          fornecedor_filtro?: string
          geracao_mensal_por_kwp?: number
          grupo_tarifario?: string
          id?: string
          imposto_energia?: number
          inclinacao_modulos?: number
          inflacao_energetica?: number
          kg_co2_por_kwh?: number
          margem_potencia_ideal?: number
          outros_encargos_atual?: number
          outros_encargos_novo?: number
          percentual_economia?: number
          perda_eficiencia_microinversor?: number
          perda_eficiencia_otimizador?: number
          perda_eficiencia_tradicional?: number
          preco_demanda?: number
          preco_demanda_geracao?: number
          sobredimensionamento_padrao?: number
          sombreamento_config?: Json
          tarifa?: number
          tarifa_te_fora_ponta?: number
          tarifa_te_ponta?: number
          tarifa_tusd_fora_ponta?: number
          tarifa_tusd_ponta?: number
          tarifacao_compensada_bt?: number
          tarifacao_compensada_fora_ponta?: number
          tarifacao_compensada_ponta?: number
          taxa_desempenho_microinversor?: number
          taxa_desempenho_otimizador?: number
          taxa_desempenho_tradicional?: number
          tenant_id: string
          tipo_kits?: string[]
          tipo_preco?: string
          tipo_sistema?: string
          tipo_telhado_padrao?: string
          topologias?: string[]
          troca_inversor_anos_microinversor?: number
          troca_inversor_anos_otimizador?: number
          troca_inversor_anos_tradicional?: number
          tusd_fio_b_bt?: number
          tusd_fio_b_fora_ponta?: number
          tusd_fio_b_ponta?: number
          updated_at?: string
          updated_by?: string | null
          vida_util_sistema?: number
          vpl_taxa_desconto?: number
        }
        Update: {
          base_irradiancia?: string
          concessionaria_id?: string | null
          considerar_custo_disponibilidade?: boolean
          considerar_custo_disponibilidade_solar?: boolean
          considerar_kits_transformador?: boolean
          created_at?: string
          created_by?: string | null
          custo_por_kwp?: number
          custo_troca_inversor_microinversor?: number
          custo_troca_inversor_otimizador?: number
          custo_troca_inversor_tradicional?: number
          desvio_azimutal?: number
          dod?: number
          fase_tensao_rede?: string
          fator_simultaneidade?: number
          fornecedor_filtro?: string
          geracao_mensal_por_kwp?: number
          grupo_tarifario?: string
          id?: string
          imposto_energia?: number
          inclinacao_modulos?: number
          inflacao_energetica?: number
          kg_co2_por_kwh?: number
          margem_potencia_ideal?: number
          outros_encargos_atual?: number
          outros_encargos_novo?: number
          percentual_economia?: number
          perda_eficiencia_microinversor?: number
          perda_eficiencia_otimizador?: number
          perda_eficiencia_tradicional?: number
          preco_demanda?: number
          preco_demanda_geracao?: number
          sobredimensionamento_padrao?: number
          sombreamento_config?: Json
          tarifa?: number
          tarifa_te_fora_ponta?: number
          tarifa_te_ponta?: number
          tarifa_tusd_fora_ponta?: number
          tarifa_tusd_ponta?: number
          tarifacao_compensada_bt?: number
          tarifacao_compensada_fora_ponta?: number
          tarifacao_compensada_ponta?: number
          taxa_desempenho_microinversor?: number
          taxa_desempenho_otimizador?: number
          taxa_desempenho_tradicional?: number
          tenant_id?: string
          tipo_kits?: string[]
          tipo_preco?: string
          tipo_sistema?: string
          tipo_telhado_padrao?: string
          topologias?: string[]
          troca_inversor_anos_microinversor?: number
          troca_inversor_anos_otimizador?: number
          troca_inversor_anos_tradicional?: number
          tusd_fio_b_bt?: number
          tusd_fio_b_fora_ponta?: number
          tusd_fio_b_ponta?: number
          updated_at?: string
          updated_by?: string | null
          vida_util_sistema?: number
          vpl_taxa_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_premises_concessionaria_id_fkey"
            columns: ["concessionaria_id"]
            isOneToOne: false
            referencedRelation: "concessionarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_premises_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roof_area_factors: {
        Row: {
          created_at: string
          desvio_azimutal_padrao: number | null
          enabled: boolean
          fator_area: number
          id: string
          inclinacao_padrao: number | null
          label: string | null
          tenant_id: string
          tipo_telhado: string
          tipos_sistema_permitidos: string[] | null
          topologias_permitidas: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          desvio_azimutal_padrao?: number | null
          enabled?: boolean
          fator_area?: number
          id?: string
          inclinacao_padrao?: number | null
          label?: string | null
          tenant_id: string
          tipo_telhado: string
          tipos_sistema_permitidos?: string[] | null
          topologias_permitidas?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          desvio_azimutal_padrao?: number | null
          enabled?: boolean
          fator_area?: number
          id?: string
          inclinacao_padrao?: number | null
          label?: string | null
          tenant_id?: string
          tipo_telhado?: string
          tipos_sistema_permitidos?: string[] | null
          topologias_permitidas?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_roof_area_factors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_smtp_config: {
        Row: {
          ativo: boolean | null
          created_at: string
          from_email: string
          from_name: string | null
          host: string
          id: string
          password_encrypted: string
          port: number
          tenant_id: string
          updated_at: string
          use_tls: boolean | null
          username: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          from_email: string
          from_name?: string | null
          host: string
          id?: string
          password_encrypted: string
          port?: number
          tenant_id: string
          updated_at?: string
          use_tls?: boolean | null
          username: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          from_email?: string
          from_name?: string | null
          host?: string
          id?: string
          password_encrypted?: string
          port?: number
          tenant_id?: string
          updated_at?: string
          use_tls?: boolean | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_smtp_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          documento: string | null
          dominio_customizado: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          nome: string
          owner_user_id: string | null
          plano: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          subdominio: string | null
          suspended_at: string | null
          suspended_reason: string | null
          tenant_config: Json
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          documento?: string | null
          dominio_customizado?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome: string
          owner_user_id?: string | null
          plano?: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subdominio?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_config?: Json
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          documento?: string | null
          dominio_customizado?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome?: string
          owner_user_id?: string | null
          plano?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          subdominio?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          tenant_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      transformadores: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          potencia_kva: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transformadores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          created_at: string
          current_value: number
          id: string
          metric_key: string
          period_end: string
          period_start: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value?: number
          id?: string
          metric_key: string
          period_end?: string
          period_start?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          metric_key?: string
          period_end?: string
          period_start?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          delta: number
          id: string
          metadata: Json | null
          metric_key: string
          source: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          metric_key: string
          source?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          metadata?: Json | null
          metric_key?: string
          source?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feature_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          feature: string
          granted_by: string | null
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: string
          granted_by?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: string
          granted_by?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pricing_assignments: {
        Row: {
          commission_plan_id: string | null
          created_at: string
          id: string
          margin_plan_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_plan_id?: string | null
          created_at?: string
          id?: string
          margin_plan_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_plan_id?: string | null
          created_at?: string
          id?: string
          margin_plan_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pricing_assignments_commission_plan_id_fkey"
            columns: ["commission_plan_id"]
            isOneToOne: false
            referencedRelation: "commission_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pricing_assignments_margin_plan_id_fkey"
            columns: ["margin_plan_id"]
            isOneToOne: false
            referencedRelation: "margin_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pricing_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_invites: {
        Row: {
          consultor_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          tenant_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          consultor_id: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          tenant_id: string
          token?: string
          used_at?: string | null
        }
        Update: {
          consultor_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          tenant_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_invites_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_ai_settings: {
        Row: {
          created_at: string
          followup_confidence_threshold: number
          followup_cooldown_hours: number
          id: string
          max_sugestoes_dia: number | null
          max_tokens: number
          modelo_preferido: string | null
          modo: string
          temperature: number
          templates: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          followup_confidence_threshold?: number
          followup_cooldown_hours?: number
          id?: string
          max_sugestoes_dia?: number | null
          max_tokens?: number
          modelo_preferido?: string | null
          modo?: string
          temperature?: number
          templates?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          followup_confidence_threshold?: number
          followup_cooldown_hours?: number
          id?: string
          max_sugestoes_dia?: number | null
          max_tokens?: number
          modelo_preferido?: string | null
          modo?: string
          temperature?: number
          templates?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_ai_tasks: {
        Row: {
          context: Json | null
          conversation_id: string | null
          created_at: string
          generated_at: string | null
          id: string
          lead_id: string | null
          requested_by: string | null
          resolved_at: string | null
          status: string
          suggestion: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          context?: Json | null
          conversation_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          lead_id?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          status?: string
          suggestion?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          context?: Json | null
          conversation_id?: string | null
          created_at?: string
          generated_at?: string | null
          id?: string
          lead_id?: string | null
          requested_by?: string | null
          resolved_at?: string | null
          status?: string
          suggestion?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_ai_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_ai_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_ai_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_auto_reply_config: {
        Row: {
          ativo: boolean
          cooldown_minutos: number
          created_at: string
          id: string
          mensagem_feriado: string
          mensagem_fora_horario: string
          silenciar_alertas: boolean
          silenciar_sla: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cooldown_minutos?: number
          created_at?: string
          id?: string
          mensagem_feriado?: string
          mensagem_fora_horario?: string
          silenciar_alertas?: boolean
          silenciar_sla?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cooldown_minutos?: number
          created_at?: string
          id?: string
          mensagem_feriado?: string
          mensagem_fora_horario?: string
          silenciar_alertas?: boolean
          silenciar_sla?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_auto_reply_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_auto_reply_log: {
        Row: {
          conversation_id: string
          id: string
          sent_at: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          conversation_id: string
          id?: string
          sent_at?: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          conversation_id?: string
          id?: string
          sent_at?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_auto_reply_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_auto_reply_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_bg_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          instance_id: string
          job_type: string
          last_error: string | null
          next_run_at: string | null
          payload: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          instance_id: string
          job_type: string
          last_error?: string | null
          next_run_at?: string | null
          payload?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          instance_id?: string
          job_type?: string
          last_error?: string | null
          next_run_at?: string | null
          payload?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_bg_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cadence_enrollments: {
        Row: {
          cadence_id: string
          cliente_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          current_step_ordem: number
          enrolled_at: string
          enrolled_by: string | null
          id: string
          lead_id: string | null
          next_execution_at: string | null
          paused_at: string | null
          paused_reason: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cadence_id: string
          cliente_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          current_step_ordem?: number
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          lead_id?: string | null
          next_execution_at?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cadence_id?: string
          cliente_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          current_step_ordem?: number
          enrolled_at?: string
          enrolled_by?: string | null
          id?: string
          lead_id?: string | null
          next_execution_at?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cadence_enrollments_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "wa_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_enrollments_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_enrollments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cadence_executions: {
        Row: {
          ai_confidence_score: number | null
          ai_message: string | null
          created_at: string
          enrollment_id: string
          error_message: string | null
          id: string
          responded_at: string | null
          sent_at: string | null
          status: string
          step_id: string
          tenant_id: string
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_message?: string | null
          created_at?: string
          enrollment_id: string
          error_message?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          step_id: string
          tenant_id: string
        }
        Update: {
          ai_confidence_score?: number | null
          ai_message?: string | null
          created_at?: string
          enrollment_id?: string
          error_message?: string | null
          id?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          step_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cadence_executions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "wa_cadence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "wa_cadence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_executions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cadence_steps: {
        Row: {
          ativo: boolean
          cadence_id: string
          canal: string
          created_at: string
          delay_hours: number
          fallback_template: string | null
          id: string
          nome: string
          ordem: number
          prompt_ia: string | null
          tenant_id: string
        }
        Insert: {
          ativo?: boolean
          cadence_id: string
          canal?: string
          created_at?: string
          delay_hours?: number
          fallback_template?: string | null
          id?: string
          nome: string
          ordem?: number
          prompt_ia?: string | null
          tenant_id: string
        }
        Update: {
          ativo?: boolean
          cadence_id?: string
          canal?: string
          created_at?: string
          delay_hours?: number
          fallback_template?: string | null
          id?: string
          nome?: string
          ordem?: number
          prompt_ia?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cadence_steps_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "wa_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_cadence_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_cadences: {
        Row: {
          ativo: boolean
          auto_enroll: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auto_enroll?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auto_enroll?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_cadences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversation_participants: {
        Row: {
          added_by: string | null
          conversation_id: string
          created_at: string
          id: string
          is_active: boolean
          removed_at: string | null
          role: Database["public"]["Enums"]["wa_participant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          removed_at?: string | null
          role?: Database["public"]["Enums"]["wa_participant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          removed_at?: string | null
          role?: Database["public"]["Enums"]["wa_participant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversation_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversation_preferences: {
        Row: {
          conversation_id: string
          created_at: string
          hidden: boolean
          id: string
          muted: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          hidden?: boolean
          id?: string
          muted?: boolean
          tenant_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          hidden?: boolean
          id?: string
          muted?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversation_preferences_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversation_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversation_summaries: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_message_id: string
          message_count: number
          summary_json: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_message_id: string
          message_count?: number
          summary_json?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_message_id?: string
          message_count?: number
          summary_json?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversation_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversation_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
          tenant_id?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "wa_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversation_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_conversations: {
        Row: {
          assigned_to: string | null
          canal: string
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string
          created_at: string
          id: string
          instance_id: string
          is_group: boolean
          last_message_at: string | null
          last_message_direction: string | null
          last_message_id: string | null
          last_message_preview: string | null
          lead_id: string | null
          profile_picture_url: string | null
          remote_jid: string
          sla_paused_until: string | null
          status: string
          telefone_normalized: string | null
          tenant_id: string
          unread_count: number
          updated_at: string
          version: number
        }
        Insert: {
          assigned_to?: string | null
          canal?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone: string
          created_at?: string
          id?: string
          instance_id: string
          is_group?: boolean
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          profile_picture_url?: string | null
          remote_jid: string
          sla_paused_until?: string | null
          status?: string
          telefone_normalized?: string | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
          version?: number
        }
        Update: {
          assigned_to?: string | null
          canal?: string
          cliente_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string
          created_at?: string
          id?: string
          instance_id?: string
          is_group?: boolean
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_id?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          profile_picture_url?: string | null
          remote_jid?: string
          sla_paused_until?: string | null
          status?: string
          telefone_normalized?: string | null
          tenant_id?: string
          unread_count?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wa_conversations_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_last_message_id_fkey"
            columns: ["last_message_id"]
            isOneToOne: false
            referencedRelation: "wa_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_followup_logs: {
        Row: {
          action: string
          ai_confidence: number | null
          ai_model: string | null
          ai_reason: string | null
          assigned_to: string | null
          cenario: string | null
          conversation_id: string
          created_at: string
          id: string
          led_to_conversion: boolean | null
          mensagem_enviada: string | null
          mensagem_original: string | null
          metadata: Json | null
          queue_id: string | null
          responded_at: string | null
          response_time_minutes: number | null
          rule_id: string | null
          tenant_id: string
          tentativa: number | null
        }
        Insert: {
          action: string
          ai_confidence?: number | null
          ai_model?: string | null
          ai_reason?: string | null
          assigned_to?: string | null
          cenario?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          led_to_conversion?: boolean | null
          mensagem_enviada?: string | null
          mensagem_original?: string | null
          metadata?: Json | null
          queue_id?: string | null
          responded_at?: string | null
          response_time_minutes?: number | null
          rule_id?: string | null
          tenant_id: string
          tentativa?: number | null
        }
        Update: {
          action?: string
          ai_confidence?: number | null
          ai_model?: string | null
          ai_reason?: string | null
          assigned_to?: string | null
          cenario?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          led_to_conversion?: boolean | null
          mensagem_enviada?: string | null
          mensagem_original?: string | null
          metadata?: Json | null
          queue_id?: string | null
          responded_at?: string | null
          response_time_minutes?: number | null
          rule_id?: string | null
          tenant_id?: string
          tentativa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_followup_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_followup_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "wa_followup_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_followup_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "wa_followup_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_followup_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_followup_queue: {
        Row: {
          assigned_to: string | null
          conversation_id: string
          created_at: string
          google_calendar_event_id: string | null
          id: string
          mensagem_enviada: string | null
          responded_at: string | null
          rule_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
          tentativa: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          mensagem_enviada?: string | null
          responded_at?: string | null
          rule_id: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          tentativa?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          google_calendar_event_id?: string | null
          id?: string
          mensagem_enviada?: string | null
          responded_at?: string | null
          rule_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          tentativa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_followup_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "wa_followup_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_followup_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_followup_rules: {
        Row: {
          ativo: boolean
          cenario: string
          created_at: string
          descricao: string | null
          envio_automatico: boolean
          id: string
          max_tentativas: number
          mensagem_template: string | null
          nome: string
          ordem: number
          prazo_minutos: number
          prioridade: string
          status_conversa: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cenario: string
          created_at?: string
          descricao?: string | null
          envio_automatico?: boolean
          id?: string
          max_tentativas?: number
          mensagem_template?: string | null
          nome: string
          ordem?: number
          prazo_minutos?: number
          prioridade?: string
          status_conversa?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cenario?: string
          created_at?: string
          descricao?: string | null
          envio_automatico?: boolean
          id?: string
          max_tentativas?: number
          mensagem_template?: string | null
          nome?: string
          ordem?: number
          prazo_minutos?: number
          prioridade?: string
          status_conversa?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_followup_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_health_checks: {
        Row: {
          checked_at: string
          created_at: string
          error_message: string | null
          evolution_state: string | null
          id: string
          instance_id: string
          latency_ms: number | null
          ok: boolean
          tenant_id: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          error_message?: string | null
          evolution_state?: string | null
          id?: string
          instance_id: string
          latency_ms?: number | null
          ok?: boolean
          tenant_id: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          error_message?: string | null
          evolution_state?: string | null
          id?: string
          instance_id?: string
          latency_ms?: number | null
          ok?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_health_checks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_health_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_instance_consultores: {
        Row: {
          consultor_id: string
          created_at: string
          id: string
          instance_id: string
          tenant_id: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          id?: string
          instance_id: string
          tenant_id: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          id?: string
          instance_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_instance_vendedores_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instance_vendedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instance_vendedores_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_instances: {
        Row: {
          api_key: string | null
          consultor_id: string | null
          created_at: string
          evolution_api_url: string
          evolution_instance_key: string
          id: string
          last_seen_at: string | null
          last_sync_at: string | null
          last_sync_conversations: number | null
          last_sync_messages: number | null
          nome: string
          owner_user_id: string | null
          phone_number: string | null
          profile_name: string | null
          profile_picture_url: string | null
          status: string
          tenant_id: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          api_key?: string | null
          consultor_id?: string | null
          created_at?: string
          evolution_api_url?: string
          evolution_instance_key: string
          id?: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          last_sync_conversations?: number | null
          last_sync_messages?: number | null
          nome: string
          owner_user_id?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          api_key?: string | null
          consultor_id?: string | null
          created_at?: string
          evolution_api_url?: string
          evolution_instance_key?: string
          id?: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          last_sync_conversations?: number | null
          last_sync_messages?: number | null
          nome?: string
          owner_user_id?: string | null
          phone_number?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_instances_vendedor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_internal_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          tenant_id: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          tenant_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          tenant_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_internal_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_internal_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "wa_internal_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_internal_threads: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string
          id: string
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by: string
          id?: string
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_internal_threads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_internal_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_message_hidden: {
        Row: {
          created_at: string
          id: string
          message_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_message_hidden_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          evolution_message_id: string | null
          id: string
          is_internal_note: boolean
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          participant_jid: string | null
          participant_name: string | null
          quoted_message_id: string | null
          sent_by_user_id: string | null
          source: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_message?: string | null
          evolution_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          participant_jid?: string | null
          participant_name?: string | null
          quoted_message_id?: string | null
          sent_by_user_id?: string | null
          source?: string
          status?: string | null
          tenant_id?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_message?: string | null
          evolution_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          metadata?: Json | null
          participant_jid?: string | null
          participant_name?: string | null
          quoted_message_id?: string | null
          sent_by_user_id?: string | null
          source?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "wa_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_ops_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          instance_id: string | null
          payload: Json | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          instance_id?: string | null
          payload?: Json | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          instance_id?: string | null
          payload?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_ops_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_ops_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_outbox: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          instance_id: string
          max_retries: number
          media_url: string | null
          message_id: string | null
          message_type: string
          read_at: string | null
          remote_jid: string
          remote_jid_canonical: string | null
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          instance_id: string
          max_retries?: number
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          read_at?: string | null
          remote_jid: string
          remote_jid_canonical?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          instance_id?: string
          max_retries?: number
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          read_at?: string | null
          remote_jid?: string
          remote_jid_canonical?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_outbox_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_outbox_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_outbox_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "wa_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_participant_events: {
        Row: {
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          performed_by: string
          role: Database["public"]["Enums"]["wa_participant_role"] | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          performed_by: string
          role?: Database["public"]["Enums"]["wa_participant_role"] | null
          tenant_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          role?: Database["public"]["Enums"]["wa_participant_role"] | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_participant_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_participant_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_quick_replies: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          conteudo: string
          created_at: string
          created_by: string | null
          emoji: string | null
          id: string
          media_filename: string | null
          media_type: string | null
          media_url: string | null
          ordem: number | null
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          ordem?: number | null
          tenant_id?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          conteudo?: string
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          id?: string
          media_filename?: string | null
          media_type?: string | null
          media_url?: string | null
          ordem?: number | null
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_quick_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_quick_reply_categories: {
        Row: {
          ativo: boolean | null
          cor: string
          created_at: string
          emoji: string | null
          id: string
          nome: string
          ordem: number | null
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string
          created_at?: string
          emoji?: string | null
          id?: string
          nome: string
          ordem?: number | null
          slug: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string
          created_at?: string
          emoji?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_quick_reply_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_reads: {
        Row: {
          conversation_id: string
          id: string
          last_read_at: string
          last_read_message_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          tenant_id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "wa_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_satisfaction_ratings: {
        Row: {
          answered_at: string | null
          attendant_user_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          rating: number | null
          sent_at: string
          tenant_id: string
        }
        Insert: {
          answered_at?: string | null
          attendant_user_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          sent_at?: string
          tenant_id?: string
        }
        Update: {
          answered_at?: string | null
          attendant_user_id?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_satisfaction_ratings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_satisfaction_ratings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_sla_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          ai_summary: string | null
          assigned_to: string | null
          conversation_id: string
          created_at: string
          escalated: boolean
          escalated_at: string | null
          id: string
          resolved: boolean
          resolved_at: string | null
          tempo_sem_resposta_minutos: number | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_summary?: string | null
          assigned_to?: string | null
          conversation_id: string
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          tempo_sem_resposta_minutos?: number | null
          tenant_id: string
          tipo: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          ai_summary?: string | null
          assigned_to?: string | null
          conversation_id?: string
          created_at?: string
          escalated?: boolean
          escalated_at?: string | null
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          tempo_sem_resposta_minutos?: number | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_sla_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_sla_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_sla_config: {
        Row: {
          alerta_sonoro: boolean
          alerta_visual: boolean
          ativo: boolean
          created_at: string
          escalonar_apos_minutos: number
          gerar_resumo_ia: boolean
          horario_comercial_fim: string | null
          horario_comercial_inicio: string | null
          id: string
          ignorar_fora_horario: boolean
          prazo_resposta_minutos: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          alerta_sonoro?: boolean
          alerta_visual?: boolean
          ativo?: boolean
          created_at?: string
          escalonar_apos_minutos?: number
          gerar_resumo_ia?: boolean
          horario_comercial_fim?: string | null
          horario_comercial_inicio?: string | null
          id?: string
          ignorar_fora_horario?: boolean
          prazo_resposta_minutos?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          alerta_sonoro?: boolean
          alerta_visual?: boolean
          ativo?: boolean
          created_at?: string
          escalonar_apos_minutos?: number
          gerar_resumo_ia?: boolean
          horario_comercial_fim?: string | null
          horario_comercial_inicio?: string | null
          id?: string
          ignorar_fora_horario?: boolean
          prazo_resposta_minutos?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_sla_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_transfers: {
        Row: {
          conversation_id: string
          created_at: string
          created_by: string | null
          from_user_id: string | null
          id: string
          reason: string | null
          tenant_id: string
          to_user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          created_by?: string | null
          from_user_id?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string
          to_user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          from_user_id?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_transfers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          instance_id: string | null
          payload: Json
          processed: boolean
          processed_at: string | null
          retry_count: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          instance_id?: string | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          retry_count?: number
          tenant_id?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          instance_id?: string | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          retry_count?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_webhook_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_config: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          id: string
          nome: string
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome: string
          tenant_id?: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_config: {
        Row: {
          api_token: string | null
          ativo: boolean
          auto_reply_cooldown_minutes: number
          auto_reply_enabled: boolean
          auto_reply_message: string | null
          automacoes_ativas: boolean
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_instance: string | null
          id: string
          lembrete_ativo: boolean
          lembrete_dias: number
          mensagem_boas_vindas: string | null
          mensagem_followup: string | null
          modo_envio: string
          tenant_id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          ativo?: boolean
          auto_reply_cooldown_minutes?: number
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          automacoes_ativas?: boolean
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          lembrete_ativo?: boolean
          lembrete_dias?: number
          mensagem_boas_vindas?: string | null
          mensagem_followup?: string | null
          modo_envio?: string
          tenant_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          ativo?: boolean
          auto_reply_cooldown_minutes?: number
          auto_reply_enabled?: boolean
          auto_reply_message?: string | null
          automacoes_ativas?: boolean
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_instance?: string | null
          id?: string
          lembrete_ativo?: boolean
          lembrete_dias?: number
          mensagem_boas_vindas?: string | null
          mensagem_followup?: string | null
          modo_envio?: string
          tenant_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_logs: {
        Row: {
          cliente_id: string | null
          created_at: string
          erro_detalhes: string | null
          id: string
          instance_id: string | null
          lead_id: string | null
          mensagem_enviada: string
          servico_id: string | null
          status: string
          telefone: string
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          erro_detalhes?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          mensagem_enviada: string
          servico_id?: string | null
          status?: string
          telefone: string
          template_id?: string | null
          tenant_id?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          erro_detalhes?: string | null
          id?: string
          instance_id?: string | null
          lead_id?: string | null
          mensagem_enviada?: string
          servico_id?: string | null
          status?: string
          telefone?: string
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_logs_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "wa_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_logs_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_agendados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_automation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automation_templates: {
        Row: {
          ativo: boolean
          created_at: string
          gatilho_config: Json
          id: string
          mensagem: string
          nome: string
          ordem: number
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          gatilho_config?: Json
          id?: string
          mensagem: string
          nome: string
          ordem?: number
          tenant_id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          gatilho_config?: Json
          id?: string
          mensagem?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      estoque_saldos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          custo_medio: number | null
          estoque_atual: number | null
          estoque_minimo: number | null
          item_id: string | null
          nome: string | null
          reservado: number | null
          sku: string | null
          tenant_id: string | null
          unidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_analytics_view: {
        Row: {
          acceptance_date: string | null
          client_city: string | null
          client_created_at: string | null
          client_id: string | null
          client_lead_id: string | null
          client_name: string | null
          client_state: string | null
          company: string | null
          consultor_sm: string | null
          consumo_mensal: number | null
          document: string | null
          document_formatted: string | null
          economia_mensal: number | null
          email: string | null
          email_normalized: string | null
          energy_consumption: number | null
          has_lead_link: boolean | null
          has_project: boolean | null
          has_proposal: boolean | null
          installation_type: string | null
          inversores: string | null
          inverter_model: string | null
          inverter_quantity: number | null
          lead_code: string | null
          lead_consultor_id: string | null
          lead_nome: string | null
          lead_status_id: string | null
          lifecycle_stage: string | null
          link_pdf: string | null
          modulos: string | null
          panel_model: string | null
          panel_quantity: number | null
          payback: string | null
          phase_type: string | null
          phone: string | null
          phone_formatted: string | null
          phone_normalized: string | null
          project_city: string | null
          project_id: string | null
          project_name: string | null
          project_potencia_kwp: number | null
          project_state: string | null
          project_status: string | null
          project_valor: number | null
          proposal_created_at: string | null
          proposal_id: string | null
          proposal_potencia_kwp: number | null
          proposal_status: string | null
          proposal_titulo: string | null
          proposal_valor_total: number | null
          rejection_date: string | null
          sm_client_id: number | null
          sm_funnel_name: string | null
          sm_project_id: number | null
          sm_proposal_id: number | null
          sm_stage_name: string | null
          tenant_id: string | null
          voltage: string | null
          zip_code: string | null
          zip_code_formatted: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_status_id_fkey"
            columns: ["lead_status_id"]
            isOneToOne: false
            referencedRelation: "lead_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["lead_consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_market_clients_lead_id_fkey"
            columns: ["client_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solar_market_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      acquire_conversation_lock: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      activate_irradiance_version: {
        Args: { _version_id: string }
        Returns: Json
      }
      assign_wa_conversation_by_phone: {
        Args: { _phone_digits: string }
        Returns: string
      }
      auto_mark_missed_appointments: { Args: never; Returns: undefined }
      can_access_wa_conversation: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      canonicalize_phone_br: { Args: { raw_phone: string }; Returns: string }
      check_phone_duplicate: { Args: { _telefone: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _function_name: string
          _identifier: string
          _max_requests?: number
          _window_seconds?: number
        }
        Returns: boolean
      }
      check_tenant_limit: {
        Args: { _delta?: number; _metric_key: string }
        Returns: {
          allowed: boolean
          current_value: number
          limit_value: number
          remaining: number
        }[]
      }
      claim_followup_candidates: {
        Args: { _limit?: number }
        Returns: {
          assigned_to: string
          attempt_count: number
          cenario: string
          cliente_nome: string
          cliente_telefone: string
          conversation_id: string
          envio_automatico: boolean
          instance_id: string
          last_msg_direction: string
          max_tentativas: number
          mensagem_template: string
          prazo_minutos: number
          remote_jid: string
          rule_id: string
          tenant_id: string
        }[]
      }
      claim_wa_bg_jobs: {
        Args: { max_jobs?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          instance_id: string
          job_type: string
          last_error: string | null
          next_run_at: string | null
          payload: Json
          status: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "wa_bg_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_edge_rate_limits: { Args: never; Returns: undefined }
      cleanup_security_events: { Args: never; Returns: undefined }
      cleanup_stuck_irradiance_versions: { Args: never; Returns: number }
      cleanup_wa_followup_logs: { Args: never; Returns: undefined }
      cleanup_wa_health_checks: { Args: never; Returns: undefined }
      cleanup_wa_webhook_events: { Args: never; Returns: undefined }
      clone_proposta_versao: {
        Args: { p_from_versao_id: string }
        Returns: Json
      }
      create_appointment_idempotent: {
        Args: {
          _all_day?: boolean
          _appointment_type?: Database["public"]["Enums"]["appointment_type"]
          _assigned_to?: string
          _cliente_id?: string
          _conversation_id?: string
          _created_by?: string
          _description?: string
          _ends_at?: string
          _idempotency_key: string
          _lead_id?: string
          _reminder_minutes?: number
          _starts_at: string
          _tenant_id: string
          _title: string
        }
        Returns: string
      }
      create_irradiance_version: {
        Args: { _dataset_code: string; _metadata?: Json; _version_tag: string }
        Returns: string
      }
      create_proposta_nativa_atomic: {
        Args: {
          p_cliente_bairro?: string
          p_cliente_cep?: string
          p_cliente_cidade?: string
          p_cliente_complemento?: string
          p_cliente_cpf_cnpj?: string
          p_cliente_email?: string
          p_cliente_empresa?: string
          p_cliente_estado?: string
          p_cliente_nome?: string
          p_cliente_numero?: string
          p_cliente_rua?: string
          p_cliente_telefone?: string
          p_deal_id?: string
          p_lead_id?: string
          p_origem?: string
          p_potencia_kwp?: number
          p_projeto_id?: string
          p_snapshot?: Json
          p_titulo: string
          p_valor_total?: number
        }
        Returns: Json
      }
      create_proposta_nativa_atomic_v2: {
        Args: {
          p_deal_id: string
          p_lead_id: string
          p_origem: string
          p_potencia_kwp: number
          p_projeto_id: string
          p_snapshot: Json
          p_titulo: string
          p_valor_total: number
        }
        Returns: Json
      }
      current_tenant_id: { Args: never; Returns: string }
      decrypt_secret: { Args: { enc: string; secret: string }; Returns: string }
      delete_seed_data: { Args: never; Returns: Json }
      encrypt_secret: {
        Args: { plain: string; secret: string }
        Returns: string
      }
      enforce_limit_or_throw: {
        Args: { _delta?: number; _metric_key: string }
        Returns: undefined
      }
      enqueue_wa_outbox_item: {
        Args: {
          p_content: string
          p_conversation_id?: string
          p_idempotency_key?: string
          p_instance_id: string
          p_media_url?: string
          p_message_id?: string
          p_message_type: string
          p_remote_jid: string
          p_scheduled_at?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: string
      }
      expire_proposals: { Args: never; Returns: undefined }
      finalize_proposta_versao: {
        Args: { p_final_snapshot?: Json; p_versao_id: string }
        Returns: Json
      }
      find_leads_by_phone: {
        Args: { _telefone: string }
        Returns: {
          created_at: string
          id: string
          lead_code: string
          nome: string
          telefone: string
          telefone_normalized: string
          updated_at: string
        }[]
      }
      generate_consultor_slug: { Args: { nome: string }; Returns: string }
      get_active_financing_banks: {
        Args: never
        Returns: {
          max_parcelas: number
          nome: string
          taxa_mensal: number
        }[]
      }
      get_active_tariff_version: {
        Args: { p_concessionaria_id: string; p_tenant_id: string }
        Returns: {
          custo_disp_bi: number
          custo_disp_mono: number
          custo_disp_tri: number
          id: string
          origem: string
          pnd_kwh: number
          tarifa_total_kwh: number
          te_kwh: number
          tfsee_kwh: number
          tusd_fio_a_kwh: number
          tusd_fio_b_kwh: number
          validation_status: string
          vigencia_fim: string
          vigencia_inicio: string
        }[]
      }
      get_calculator_config: {
        Args: never
        Returns: {
          custo_por_kwp: number
          fator_perdas_percentual: number
          geracao_mensal_por_kwp: number
          kg_co2_por_kwh: number
          percentual_economia: number
          tarifa_media_kwh: number
          vida_util_sistema: number
        }[]
      }
      get_canonical_irradiance_version: {
        Args: { _dataset_code?: string }
        Returns: {
          checksum: string
          dataset_code: string
          dataset_id: string
          dataset_name: string
          has_dhi: boolean
          has_dni: boolean
          row_count: number
          version_id: string
          version_tag: string
        }[]
      }
      get_concessionarias_por_estado: {
        Args: { _estado: string }
        Returns: {
          aliquota_icms: number
          custo_disponibilidade_bifasico: number
          custo_disponibilidade_monofasico: number
          custo_disponibilidade_trifasico: number
          id: string
          nome: string
          percentual_isencao: number
          possui_isencao_scee: boolean
          sigla: string
          tarifa_energia: number
          tarifa_fio_b: number
        }[]
      }
      get_config_tributaria: {
        Args: { _estado: string }
        Returns: {
          aliquota_icms: number
          observacoes: string
          percentual_isencao: number
          possui_isencao_scee: boolean
        }[]
      }
      get_dashboard_consultor_performance: {
        Args: never
        Returns: {
          consultor: string
          leads_com_status: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_consultor_performance_v2: {
        Args: never
        Returns: {
          consultor: string
          leads_com_status: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_financeiro: {
        Args: never
        Returns: {
          atualizado_em: string
          parcelas_atrasadas: number
          parcelas_pagas: number
          parcelas_pendentes: number
          valor_atrasado: number
          valor_pago: number
          valor_pendente: number
        }[]
      }
      get_dashboard_financeiro_v2: {
        Args: never
        Returns: {
          atualizado_em: string
          parcelas_atrasadas: number
          parcelas_pagas: number
          parcelas_pendentes: number
          valor_atrasado: number
          valor_pago: number
          valor_pendente: number
        }[]
      }
      get_dashboard_leads_estado: {
        Args: never
        Returns: {
          estado: string
          media_consumo: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_leads_estado_v2: {
        Args: never
        Returns: {
          estado: string
          media_consumo: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_leads_mensal: {
        Args: never
        Returns: {
          consultores_ativos: number
          estados_unicos: number
          media_consumo: number
          mes: string
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_leads_mensal_v2: {
        Args: never
        Returns: {
          consultores_ativos: number
          estados_unicos: number
          media_consumo: number
          mes: string
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_pipeline: {
        Args: never
        Returns: {
          status_cor: string
          status_id: string
          status_nome: string
          status_ordem: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_dashboard_pipeline_v2: {
        Args: never
        Returns: {
          status_cor: string
          status_id: string
          status_nome: string
          status_ordem: number
          total_kwh: number
          total_leads: number
        }[]
      }
      get_fio_b_atual: {
        Args: never
        Returns: {
          ano: number
          percentual_nao_compensado: number
        }[]
      }
      get_integration_key: {
        Args: { _service_key: string; _tenant_id?: string }
        Returns: string
      }
      get_irradiacao_estado: {
        Args: { _estado: string; _tenant_id?: string }
        Returns: number
      }
      get_irradiance_for_simulation: {
        Args: {
          _lat: number
          _lon: number
          _method?: string
          _radius_deg?: number
          _version_id: string
        }
        Returns: Json
      }
      get_my_calendar_token: {
        Args: never
        Returns: {
          created_at: string
          google_email: string
          id: string
          is_active: boolean
          last_synced_at: string
          token_expires_at: string
          updated_at: string
        }[]
      }
      get_my_tenant_status: { Args: never; Returns: Json }
      get_or_create_cliente: {
        Args: {
          p_bairro?: string
          p_cep?: string
          p_cidade?: string
          p_complemento?: string
          p_cpf_cnpj?: string
          p_email?: string
          p_empresa?: string
          p_estado?: string
          p_nome: string
          p_numero?: string
          p_rua?: string
          p_telefone: string
        }
        Returns: string
      }
      get_payback_config: {
        Args: never
        Returns: {
          custo_disponibilidade_bifasico: number
          custo_disponibilidade_monofasico: number
          custo_disponibilidade_trifasico: number
          degradacao_anual_painel: number
          reajuste_anual_tarifa: number
          tarifa_fio_b_padrao: number
          taxas_fixas_mensais: number
        }[]
      }
      get_pending_appointment_reminders: {
        Args: never
        Returns: {
          appointment_type: Database["public"]["Enums"]["appointment_type"]
          assigned_to: string
          cliente_id: string
          conversation_id: string
          id: string
          lead_id: string
          reminder_minutes: number
          starts_at: string
          tenant_id: string
          title: string
        }[]
      }
      get_roof_types_by_consultor: {
        Args: { p_consultor_code: string }
        Returns: {
          label: string
          tipo_telhado: string
        }[]
      }
      get_smtp_password: { Args: { secret: string }; Returns: string }
      get_super_admin_metrics: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status_filter?: string
        }
        Returns: Json
      }
      get_super_admin_tenant_detail: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      get_tenant_status: {
        Args: { _tenant_id: string }
        Returns: Database["public"]["Enums"]["tenant_status"]
      }
      get_tenant_subscription: {
        Args: never
        Returns: {
          cancel_at_period_end: boolean
          current_period_end: string
          current_period_start: string
          plan_code: string
          plan_name: string
          price_monthly: number
          status: Database["public"]["Enums"]["subscription_status"]
          subscription_id: string
          trial_ends_at: string
        }[]
      }
      get_user_chat_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_tenant_id: { Args: { _user_id?: string }; Returns: string }
      get_user_unread_conversations:
        | {
            Args: { _limit?: number }
            Returns: {
              cliente_nome: string
              cliente_telefone: string
              conversation_id: string
              last_message_at: string
              last_message_preview: string
              unread_for_user: number
            }[]
          }
        | {
            Args: { _limit?: number; _only_assigned?: boolean }
            Returns: {
              cliente_nome: string
              cliente_telefone: string
              conversation_id: string
              last_message_at: string
              last_message_preview: string
              unread_for_user: number
            }[]
          }
      get_wa_bg_jobs_metrics: {
        Args: never
        Returns: {
          avg_duration_s: number
          dead_jobs: number
          job_count: number
          job_type: string
          max_attempts_seen: number
          p50_duration_s: number
          p95_duration_s: number
          status: string
        }[]
      }
      get_wa_messages: {
        Args: {
          _conversation_id: string
          _cursor_created_at?: string
          _cursor_id?: string
          _direction?: string
          _limit?: number
        }
        Returns: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_message: string | null
          evolution_message_id: string | null
          id: string
          is_internal_note: boolean
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          metadata: Json | null
          participant_jid: string | null
          participant_name: string | null
          quoted_message_id: string | null
          sent_by_user_id: string | null
          source: string
          status: string | null
          tenant_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "wa_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_feature_permission: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_irradiance_points_chunk: {
        Args: { _rows: Json; _version_id: string }
        Returns: Json
      }
      increment_usage: {
        Args: { _delta?: number; _metric_key: string; _source?: string }
        Returns: undefined
      }
      irradiance_nearest_point: {
        Args: {
          p_lat: number
          p_lon: number
          p_radius_deg?: number
          p_version_id: string
        }
        Returns: {
          dhi_m01: number
          dhi_m02: number
          dhi_m03: number
          dhi_m04: number
          dhi_m05: number
          dhi_m06: number
          dhi_m07: number
          dhi_m08: number
          dhi_m09: number
          dhi_m10: number
          dhi_m11: number
          dhi_m12: number
          distance_km: number
          lat: number
          lon: number
          m01: number
          m02: number
          m03: number
          m04: number
          m05: number
          m06: number
          m07: number
          m08: number
          m09: number
          m10: number
          m11: number
          m12: number
          point_id: number
          unit: string
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_last_admin_of_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_tenant_active: { Args: { _tenant_id: string }; Returns: boolean }
      is_within_business_hours: {
        Args: { _tenant_id: string }
        Returns: boolean
      }
      move_deal_to_owner: {
        Args: { _deal_id: string; _to_owner_id: string }
        Returns: Json
      }
      move_deal_to_stage: {
        Args: { _deal_id: string; _to_stage_id: string }
        Returns: Json
      }
      next_proposta_number: {
        Args: { p_projeto_id: string; p_tenant_id: string }
        Returns: number
      }
      next_proposta_versao_numero: {
        Args: { _proposta_id: string }
        Returns: number
      }
      next_tenant_number: {
        Args: { p_entity: string; p_tenant_id: string }
        Returns: number
      }
      normalize_br_phone: { Args: { phone: string }; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      normalize_remote_jid: { Args: { raw_jid: string }; Returns: string }
      preview_seed_data: { Args: never; Returns: Json }
      purge_irradiance_dataset: { Args: { _dataset_id: string }; Returns: Json }
      refresh_dashboard_views: { Args: never; Returns: undefined }
      refresh_dashboard_views_v2: { Args: never; Returns: undefined }
      release_followup_lock: { Args: never; Returns: undefined }
      release_outbox_lock:
        | { Args: never; Returns: undefined }
        | {
            Args: { p_instance_id?: string; p_tenant_id?: string }
            Returns: undefined
          }
      release_webhook_lock: { Args: never; Returns: undefined }
      reorder_pipeline_stages: {
        Args: { _ordered_ids: string[]; _pipeline_id: string }
        Returns: undefined
      }
      require_tenant_id: { Args: { _user_id?: string }; Returns: string }
      reset_solar_data_layer: { Args: { _confirm: string }; Returns: Json }
      resolve_consultor_public: {
        Args: { _codigo: string }
        Returns: {
          codigo: string
          id: string
          nome: string
          slug: string
          tenant_id: string
        }[]
      }
      resolve_deal_id_by_num: {
        Args: { p_deal_num: number; p_tenant_id: string }
        Returns: string
      }
      resolve_default_consultor_id: {
        Args: { _tenant_id: string }
        Returns: string
      }
      resolve_phone_to_email: { Args: { _phone: string }; Returns: string }
      resolve_projeto_id: { Args: { p_projeto_num: number }; Returns: string }
      resolve_projeto_id_by_num: {
        Args: { p_projeto_num: number; p_tenant_id: string }
        Returns: string
      }
      resolve_proposta_id_by_num: {
        Args: {
          p_projeto_num: number
          p_proposta_num: number
          p_tenant_id: string
        }
        Returns: string
      }
      resolve_public_tenant_id: {
        Args: { _consultor_code: string }
        Returns: string
      }
      resolve_tenant_public: {
        Args: { _id?: string; _slug?: string }
        Returns: {
          id: string
          nome: string
          slug: string
          status: string
        }[]
      }
      rpc_post_sale_guarantees_expiring: {
        Args: { p_tenant_id?: string }
        Returns: number
      }
      rpc_recall_or_start_conversation: {
        Args: {
          p_instance_preference?: string
          p_message_optional?: string
          p_name_optional?: string
          p_phone_raw: string
        }
        Returns: Json
      }
      rpc_transfer_conversation: {
        Args: {
          p_conversation_id: string
          p_generate_summary?: boolean
          p_reason?: string
          p_summary_msg_count?: number
          p_to_user_id: string
        }
        Returns: Json
      }
      sm_match_clients_to_leads: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      start_conversation_by_phone:
        | {
            Args: {
              p_message_optional?: string
              p_name_optional?: string
              p_phone_raw: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_instance_preference?: string
              p_message_optional?: string
              p_name_optional?: string
              p_phone_raw: string
            }
            Returns: Json
          }
      sync_concessionarias_from_subgrupos: { Args: never; Returns: Json }
      tenant_and_user_active: { Args: never; Returns: boolean }
      tenant_is_active: { Args: { _tenant_id?: string }; Returns: boolean }
      touch_contact_last_interaction: {
        Args: { p_at: string; p_phone_e164: string; p_tenant_id: string }
        Returns: undefined
      }
      try_create_post_sale_visit: {
        Args: {
          p_data_prevista: string
          p_plan_id: string
          p_projeto_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      try_followup_lock: { Args: never; Returns: boolean }
      try_outbox_lock:
        | { Args: never; Returns: boolean }
        | {
            Args: { p_instance_id?: string; p_tenant_id?: string }
            Returns: boolean
          }
      try_webhook_lock: { Args: never; Returns: boolean }
      update_parcelas_atrasadas: { Args: never; Returns: undefined }
      user_belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
      user_is_active: { Args: { _user_id?: string }; Returns: boolean }
      validate_consultor_code: {
        Args: { _codigo: string }
        Returns: {
          nome: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      achievement_type:
        | "first_conversion"
        | "fast_responder"
        | "conversion_streak"
        | "monthly_champion"
        | "top_performer"
        | "consistency_king"
        | "high_volume"
        | "perfect_month"
      app_role:
        | "admin"
        | "gerente"
        | "consultor"
        | "instalador"
        | "financeiro"
        | "super_admin"
      appointment_status: "scheduled" | "completed" | "cancelled" | "missed"
      appointment_type: "call" | "meeting" | "followup" | "visit" | "other"
      atividade_tipo:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "reuniao"
        | "visita"
        | "proposta"
        | "negociacao"
        | "anotacao"
        | "status_change"
      checklist_cliente_status:
        | "pendente"
        | "em_preenchimento"
        | "enviado"
        | "em_revisao"
        | "aprovado"
        | "reprovado"
      checklist_instalador_fase:
        | "pre_instalacao"
        | "instalacao_estrutura"
        | "instalacao_modulos"
        | "instalacao_eletrica"
        | "comissionamento"
        | "pos_instalacao"
      checklist_instalador_status:
        | "agendado"
        | "em_execucao"
        | "pausado"
        | "pendente_correcao"
        | "finalizado"
        | "cancelado"
      commission_plan_type: "fixed" | "percentage" | "dynamic"
      cost_calc_strategy:
        | "fixed_amount"
        | "cost_per_kwp"
        | "cost_per_kva"
        | "cost_per_km"
        | "percentage_of_cost"
        | "composite"
        | "rule_based"
      deal_activity_status: "pending" | "done" | "cancelled"
      deal_activity_type:
        | "call"
        | "meeting"
        | "email"
        | "task"
        | "visit"
        | "follow_up"
        | "other"
      integration_audit_action:
        | "connect_started"
        | "connect_completed"
        | "callback_received"
        | "test_success"
        | "test_fail"
        | "disconnect"
        | "reauthorize"
        | "token_refreshed"
        | "token_revoked"
        | "token_expired"
      integration_provider: "google_calendar" | "meta_facebook"
      integration_status:
        | "disconnected"
        | "connected"
        | "error"
        | "revoked"
        | "expired"
      pipeline_kind: "process" | "owner_board"
      pricing_method_type: "margin_on_sale" | "margin_on_cost"
      pricing_policy_status: "draft" | "active" | "archived"
      projeto_etapa_categoria: "aberto" | "ganho" | "perdido" | "excluido"
      projeto_status:
        | "criado"
        | "aguardando_documentacao"
        | "em_analise"
        | "aprovado"
        | "em_instalacao"
        | "instalado"
        | "comissionado"
        | "concluido"
        | "cancelado"
      proposta_nativa_status:
        | "draft"
        | "generated"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
      servico_status:
        | "agendado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "reagendado"
      servico_tipo: "instalacao" | "manutencao" | "visita_tecnica" | "suporte"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
      tenant_status: "active" | "suspended" | "disabled" | "pending"
      tipo_sistema_inversor: "ON_GRID" | "HIBRIDO" | "OFF_GRID"
      wa_participant_role: "owner" | "collaborator" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      achievement_type: [
        "first_conversion",
        "fast_responder",
        "conversion_streak",
        "monthly_champion",
        "top_performer",
        "consistency_king",
        "high_volume",
        "perfect_month",
      ],
      app_role: [
        "admin",
        "gerente",
        "consultor",
        "instalador",
        "financeiro",
        "super_admin",
      ],
      appointment_status: ["scheduled", "completed", "cancelled", "missed"],
      appointment_type: ["call", "meeting", "followup", "visit", "other"],
      atividade_tipo: [
        "ligacao",
        "whatsapp",
        "email",
        "reuniao",
        "visita",
        "proposta",
        "negociacao",
        "anotacao",
        "status_change",
      ],
      checklist_cliente_status: [
        "pendente",
        "em_preenchimento",
        "enviado",
        "em_revisao",
        "aprovado",
        "reprovado",
      ],
      checklist_instalador_fase: [
        "pre_instalacao",
        "instalacao_estrutura",
        "instalacao_modulos",
        "instalacao_eletrica",
        "comissionamento",
        "pos_instalacao",
      ],
      checklist_instalador_status: [
        "agendado",
        "em_execucao",
        "pausado",
        "pendente_correcao",
        "finalizado",
        "cancelado",
      ],
      commission_plan_type: ["fixed", "percentage", "dynamic"],
      cost_calc_strategy: [
        "fixed_amount",
        "cost_per_kwp",
        "cost_per_kva",
        "cost_per_km",
        "percentage_of_cost",
        "composite",
        "rule_based",
      ],
      deal_activity_status: ["pending", "done", "cancelled"],
      deal_activity_type: [
        "call",
        "meeting",
        "email",
        "task",
        "visit",
        "follow_up",
        "other",
      ],
      integration_audit_action: [
        "connect_started",
        "connect_completed",
        "callback_received",
        "test_success",
        "test_fail",
        "disconnect",
        "reauthorize",
        "token_refreshed",
        "token_revoked",
        "token_expired",
      ],
      integration_provider: ["google_calendar", "meta_facebook"],
      integration_status: [
        "disconnected",
        "connected",
        "error",
        "revoked",
        "expired",
      ],
      pipeline_kind: ["process", "owner_board"],
      pricing_method_type: ["margin_on_sale", "margin_on_cost"],
      pricing_policy_status: ["draft", "active", "archived"],
      projeto_etapa_categoria: ["aberto", "ganho", "perdido", "excluido"],
      projeto_status: [
        "criado",
        "aguardando_documentacao",
        "em_analise",
        "aprovado",
        "em_instalacao",
        "instalado",
        "comissionado",
        "concluido",
        "cancelado",
      ],
      proposta_nativa_status: [
        "draft",
        "generated",
        "sent",
        "accepted",
        "rejected",
        "expired",
      ],
      servico_status: [
        "agendado",
        "em_andamento",
        "concluido",
        "cancelado",
        "reagendado",
      ],
      servico_tipo: ["instalacao", "manutencao", "visita_tecnica", "suporte"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
      tenant_status: ["active", "suspended", "disabled", "pending"],
      tipo_sistema_inversor: ["ON_GRID", "HIBRIDO", "OFF_GRID"],
      wa_participant_role: ["owner", "collaborator", "viewer"],
    },
  },
} as const
