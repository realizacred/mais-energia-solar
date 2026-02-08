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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
        }
        Relationships: []
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          geracao_mensal_por_kwp: number
          id: string
          kg_co2_por_kwh: number
          percentual_economia: number
          tarifa_media_kwh: number
          tenant_id: string | null
          updated_at: string
          vida_util_sistema: number
        }
        Insert: {
          created_at?: string
          custo_por_kwp?: number
          geracao_mensal_por_kwp?: number
          id?: string
          kg_co2_por_kwh?: number
          percentual_economia?: number
          tarifa_media_kwh?: number
          tenant_id?: string | null
          updated_at?: string
          vida_util_sistema?: number
        }
        Update: {
          created_at?: string
          custo_por_kwp?: number
          geracao_mensal_por_kwp?: number
          id?: string
          kg_co2_por_kwh?: number
          percentual_economia?: number
          tarifa_media_kwh?: number
          tenant_id?: string | null
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
      checklist_cliente_arquivos: {
        Row: {
          categoria: string
          checklist_id: string
          created_at: string
          id: string
          nome_arquivo: string
          resposta_id: string | null
          tamanho_bytes: number | null
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
          vendedor_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
          transformador_id: string | null
          updated_at: string
          valor_projeto: number | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
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
          tenant_id?: string | null
          transformador_id?: string | null
          updated_at?: string
          valor_projeto?: number | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
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
          tenant_id?: string | null
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
          created_at: string
          descricao: string
          id: string
          mes_referencia: number
          observacoes: string | null
          percentual_comissao: number
          projeto_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          valor_base: number
          valor_comissao: number
          vendedor_id: string
        }
        Insert: {
          ano_referencia: number
          cliente_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          mes_referencia: number
          observacoes?: string | null
          percentual_comissao?: number
          projeto_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          valor_base?: number
          valor_comissao?: number
          vendedor_id: string
        }
        Update: {
          ano_referencia?: number
          cliente_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          mes_referencia?: number
          observacoes?: string | null
          percentual_comissao?: number
          projeto_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          valor_base?: number
          valor_comissao?: number
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      concessionarias: {
        Row: {
          aliquota_icms: number | null
          ativo: boolean
          created_at: string
          custo_disponibilidade_bifasico: number | null
          custo_disponibilidade_monofasico: number | null
          custo_disponibilidade_trifasico: number | null
          estado: string | null
          id: string
          nome: string
          percentual_isencao: number | null
          possui_isencao_scee: boolean | null
          sigla: string | null
          tarifa_energia: number | null
          tarifa_fio_b: number | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          aliquota_icms?: number | null
          ativo?: boolean
          created_at?: string
          custo_disponibilidade_bifasico?: number | null
          custo_disponibilidade_monofasico?: number | null
          custo_disponibilidade_trifasico?: number | null
          estado?: string | null
          id?: string
          nome: string
          percentual_isencao?: number | null
          possui_isencao_scee?: boolean | null
          sigla?: string | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_icms?: number | null
          ativo?: boolean
          created_at?: string
          custo_disponibilidade_bifasico?: number | null
          custo_disponibilidade_monofasico?: number | null
          custo_disponibilidade_trifasico?: number | null
          estado?: string | null
          id?: string
          nome?: string
          percentual_isencao?: number | null
          possui_isencao_scee?: boolean | null
          sigla?: string | null
          tarifa_energia?: number | null
          tarifa_fio_b?: number | null
          tenant_id?: string | null
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
      disjuntores: {
        Row: {
          amperagem: number
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amperagem: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amperagem?: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          tenant_id?: string | null
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
      financiamento_api_config: {
        Row: {
          api_key: string | null
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          percentual_nao_compensado?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          percentual_nao_compensado?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
      instagram_config: {
        Row: {
          access_token: string | null
          ativo: boolean
          created_at: string
          id: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
      lead_links: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          link_reason: string
          sm_client_id: number
          sm_project_id: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          link_reason?: string
          sm_client_id: number
          sm_project_id?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          link_reason?: string
          sm_client_id?: number
          sm_project_id?: number | null
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          nome: string
          ordem: number
          tenant_id: string | null
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
          tenant_id?: string | null
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string | null
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
          consumo_previsto: number
          created_at: string
          data_proxima_acao: string | null
          estado: string
          id: string
          lead_code: string | null
          media_consumo: number
          nome: string
          numero: string | null
          observacoes: string | null
          proxima_acao: string | null
          rede_atendimento: string
          rua: string | null
          status_id: string | null
          telefone: string
          telefone_normalized: string | null
          tenant_id: string | null
          tipo_telhado: string
          ultimo_contato: string | null
          updated_at: string
          vendedor: string | null
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
          consumo_previsto: number
          created_at?: string
          data_proxima_acao?: string | null
          estado: string
          id?: string
          lead_code?: string | null
          media_consumo: number
          nome: string
          numero?: string | null
          observacoes?: string | null
          proxima_acao?: string | null
          rede_atendimento: string
          rua?: string | null
          status_id?: string | null
          telefone: string
          telefone_normalized?: string | null
          tenant_id?: string | null
          tipo_telhado: string
          ultimo_contato?: string | null
          updated_at?: string
          vendedor?: string | null
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
          consumo_previsto?: number
          created_at?: string
          data_proxima_acao?: string | null
          estado?: string
          id?: string
          lead_code?: string | null
          media_consumo?: number
          nome?: string
          numero?: string | null
          observacoes?: string | null
          proxima_acao?: string | null
          rede_atendimento?: string
          rua?: string | null
          status_id?: string | null
          telefone?: string
          telefone_normalized?: string | null
          tenant_id?: string | null
          tipo_telhado?: string
          ultimo_contato?: string | null
          updated_at?: string
          vendedor?: string | null
          visto?: boolean
          visto_admin?: boolean
        }
        Relationships: [
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
        ]
      }
      meta_notifications: {
        Row: {
          ano: number
          created_at: string
          id: string
          lida: boolean
          mes: number
          percentual_atingido: number
          tenant_id: string | null
          tipo_meta: string
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          lida?: boolean
          mes: number
          percentual_atingido: number
          tenant_id?: string | null
          tipo_meta: string
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          lida?: boolean
          mes?: number
          percentual_atingido?: number
          tenant_id?: string | null
          tipo_meta?: string
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
          tipo_ligacao: string | null
          tipo_telhado: string
          ultimo_contato: string | null
          updated_at: string
          vendedor: string | null
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
          tenant_id?: string | null
          tipo_ligacao?: string | null
          tipo_telhado: string
          ultimo_contato?: string | null
          updated_at?: string
          vendedor?: string | null
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
          tenant_id?: string | null
          tipo_ligacao?: string | null
          tipo_telhado?: string
          ultimo_contato?: string | null
          updated_at?: string
          vendedor?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cargo_solicitado: string | null
          created_at: string
          id: string
          nome: string
          status: string
          telefone: string | null
          tenant_id: string | null
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
          status?: string
          telefone?: string | null
          tenant_id?: string | null
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
          status?: string
          telefone?: string | null
          tenant_id?: string | null
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
      projetos: {
        Row: {
          cliente_id: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          data_comissionamento: string | null
          data_instalacao: string | null
          data_previsao_instalacao: string | null
          data_venda: string | null
          id: string
          instalador_id: string | null
          lead_id: string | null
          modelo_inversor: string | null
          modelo_modulos: string | null
          numero_modulos: number | null
          observacoes: string | null
          potencia_kwp: number | null
          status: Database["public"]["Enums"]["projeto_status"]
          tenant_id: string | null
          tipo_instalacao: string | null
          updated_at: string
          valor_equipamentos: number | null
          valor_mao_obra: number | null
          valor_total: number | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_comissionamento?: string | null
          data_instalacao?: string | null
          data_previsao_instalacao?: string | null
          data_venda?: string | null
          id?: string
          instalador_id?: string | null
          lead_id?: string | null
          modelo_inversor?: string | null
          modelo_modulos?: string | null
          numero_modulos?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          status?: Database["public"]["Enums"]["projeto_status"]
          tenant_id?: string | null
          tipo_instalacao?: string | null
          updated_at?: string
          valor_equipamentos?: number | null
          valor_mao_obra?: number | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          data_comissionamento?: string | null
          data_instalacao?: string | null
          data_previsao_instalacao?: string | null
          data_venda?: string | null
          id?: string
          instalador_id?: string | null
          lead_id?: string | null
          modelo_inversor?: string | null
          modelo_modulos?: string | null
          numero_modulos?: number | null
          observacoes?: string | null
          potencia_kwp?: number | null
          status?: Database["public"]["Enums"]["projeto_status"]
          tenant_id?: string | null
          tipo_instalacao?: string | null
          updated_at?: string
          valor_equipamentos?: number | null
          valor_mao_obra?: number | null
          valor_total?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
            foreignKeyName: "projetos_tenant_id_fkey"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          lead_id: string | null
          payback_meses: number | null
          potencia_recomendada_kwp: number | null
          tarifa_kwh_usada: number | null
          tenant_id: string | null
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
          lead_id?: string | null
          payback_meses?: number | null
          potencia_recomendada_kwp?: number | null
          tarifa_kwh_usada?: number | null
          tenant_id?: string | null
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
          lead_id?: string | null
          payback_meses?: number | null
          potencia_recomendada_kwp?: number | null
          tarifa_kwh_usada?: number | null
          tenant_id?: string | null
          tipo_conta?: string | null
          tipo_telhado?: string | null
          valor_conta?: number | null
        }
        Relationships: [
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      solar_market_clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          payload: Json
          phone: string | null
          phone_normalized: string | null
          sm_client_id: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          payload?: Json
          phone?: string | null
          phone_normalized?: string | null
          sm_client_id: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          payload?: Json
          phone?: string | null
          phone_normalized?: string | null
          sm_client_id?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          auth_email: string | null
          auth_mode: string
          auth_password_encrypted: string | null
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          last_token: string | null
          last_token_expires_at: string | null
          tenant_id: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_token?: string | null
          auth_email?: string | null
          auth_mode?: string
          auth_password_encrypted?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_token?: string | null
          last_token_expires_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string | null
          auth_email?: string | null
          auth_mode?: string
          auth_password_encrypted?: string | null
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_token?: string | null
          last_token_expires_at?: string | null
          tenant_id?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_funnels: {
        Row: {
          created_at: string
          id: string
          payload: Json
          sm_project_id: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          sm_project_id: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          sm_project_id?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_funnels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solar_market_projects: {
        Row: {
          created_at: string
          id: string
          payload: Json
          sm_client_id: number
          sm_project_id: number
          status: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          sm_client_id: number
          sm_project_id: number
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          sm_client_id?: number
          sm_project_id?: number
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          created_at: string
          expiration_date: string | null
          generated_at: string | null
          id: string
          link_pdf: string | null
          payload: Json
          rejection_date: string | null
          sm_client_id: number
          sm_project_id: number
          sm_proposal_id: number
          status: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          acceptance_date?: string | null
          created_at?: string
          expiration_date?: string | null
          generated_at?: string | null
          id?: string
          link_pdf?: string | null
          payload?: Json
          rejection_date?: string | null
          sm_client_id: number
          sm_project_id: number
          sm_proposal_id: number
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          acceptance_date?: string | null
          created_at?: string
          expiration_date?: string | null
          generated_at?: string | null
          id?: string
          link_pdf?: string | null
          payload?: Json
          rejection_date?: string | null
          sm_client_id?: number
          sm_project_id?: number
          sm_proposal_id?: number
          status?: string | null
          tenant_id?: string | null
          updated_at?: string
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
          counts: Json | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          mode: string
          source: string
          started_at: string
          status: string
          tenant_id: string | null
          triggered_by: string | null
        }
        Insert: {
          counts?: Json | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          source?: string
          started_at?: string
          status?: string
          tenant_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          counts?: Json | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          source?: string
          started_at?: string
          status?: string
          tenant_id?: string | null
          triggered_by?: string | null
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
      solar_market_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          payload: Json
          processed: boolean
          received_at: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solar_market_webhook_events_tenant_id_fkey"
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
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          task_id: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          task_id?: string
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          ativo: boolean
          created_at: string
          dominio_customizado: string | null
          id: string
          nome: string
          plano: string
          slug: string
          subdominio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dominio_customizado?: string | null
          id?: string
          nome: string
          plano?: string
          slug: string
          subdominio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dominio_customizado?: string | null
          id?: string
          nome?: string
          plano?: string
          slug?: string
          subdominio?: string | null
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
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva?: number
          tenant_id?: string | null
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
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
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
      vendedor_achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          id: string
          metadata: Json | null
          tenant_id: string | null
          unlocked_at: string
          vendedor_id: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          unlocked_at?: string
          vendedor_id: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          unlocked_at?: string
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_metas: {
        Row: {
          ano: number
          comissao_percent: number | null
          created_at: string
          id: string
          mes: number
          meta_conversoes: number | null
          meta_orcamentos: number | null
          meta_valor: number | null
          observacoes: string | null
          progresso_notificado: Json | null
          tenant_id: string | null
          updated_at: string
          usa_meta_individual: boolean
          vendedor_id: string
        }
        Insert: {
          ano: number
          comissao_percent?: number | null
          created_at?: string
          id?: string
          mes: number
          meta_conversoes?: number | null
          meta_orcamentos?: number | null
          meta_valor?: number | null
          observacoes?: string | null
          progresso_notificado?: Json | null
          tenant_id?: string | null
          updated_at?: string
          usa_meta_individual?: boolean
          vendedor_id: string
        }
        Update: {
          ano?: number
          comissao_percent?: number | null
          created_at?: string
          id?: string
          mes?: number
          meta_conversoes?: number | null
          meta_orcamentos?: number | null
          meta_valor?: number | null
          observacoes?: string | null
          progresso_notificado?: Json | null
          tenant_id?: string | null
          updated_at?: string
          usa_meta_individual?: boolean
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_metricas: {
        Row: {
          ano: number
          created_at: string
          id: string
          leads_convertidos: number | null
          leads_perdidos: number | null
          leads_respondidos_24h: number | null
          mes: number
          taxa_resposta_rapida_percent: number | null
          taxa_retencao_percent: number | null
          tempo_medio_fechamento_dias: number | null
          tenant_id: string | null
          ticket_medio: number | null
          total_leads_atendidos: number | null
          updated_at: string
          valor_total_vendas: number | null
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          leads_convertidos?: number | null
          leads_perdidos?: number | null
          leads_respondidos_24h?: number | null
          mes: number
          taxa_resposta_rapida_percent?: number | null
          taxa_retencao_percent?: number | null
          tempo_medio_fechamento_dias?: number | null
          tenant_id?: string | null
          ticket_medio?: number | null
          total_leads_atendidos?: number | null
          updated_at?: string
          valor_total_vendas?: number | null
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          leads_convertidos?: number | null
          leads_perdidos?: number | null
          leads_respondidos_24h?: number | null
          mes?: number
          taxa_resposta_rapida_percent?: number | null
          taxa_retencao_percent?: number | null
          tempo_medio_fechamento_dias?: number | null
          tenant_id?: string | null
          ticket_medio?: number | null
          total_leads_atendidos?: number | null
          updated_at?: string
          valor_total_vendas?: number | null
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_performance_mensal: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          pontuacao_total: number
          posicao_ranking: number | null
          tempo_medio_resposta_horas: number | null
          tenant_id: string | null
          total_conversoes: number
          total_orcamentos: number
          updated_at: string
          valor_total_vendas: number
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          pontuacao_total?: number
          posicao_ranking?: number | null
          tempo_medio_resposta_horas?: number | null
          tenant_id?: string | null
          total_conversoes?: number
          total_orcamentos?: number
          updated_at?: string
          valor_total_vendas?: number
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          pontuacao_total?: number
          posicao_ranking?: number | null
          tempo_medio_resposta_horas?: number | null
          tenant_id?: string | null
          total_conversoes?: number
          total_orcamentos?: number
          updated_at?: string
          valor_total_vendas?: number
          vendedor_id?: string
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
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          email: string | null
          id: string
          nome: string
          percentual_comissao: number
          slug: string | null
          telefone: string
          tenant_id: string | null
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
          slug?: string | null
          telefone: string
          tenant_id?: string | null
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
          slug?: string | null
          telefone?: string
          tenant_id?: string | null
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
      webhook_config: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          id: string
          nome: string
          tenant_id: string | null
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome: string
          tenant_id?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome?: string
          tenant_id?: string | null
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
          tenant_id: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_token?: string | null
          ativo?: boolean
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
          tenant_id?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_token?: string | null
          ativo?: boolean
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
          tenant_id?: string | null
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
          lead_id: string | null
          mensagem_enviada: string
          servico_id: string | null
          status: string
          telefone: string
          template_id: string | null
          tenant_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          erro_detalhes?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada: string
          servico_id?: string | null
          status?: string
          telefone: string
          template_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          erro_detalhes?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada?: string
          servico_id?: string | null
          status?: string
          telefone?: string
          template_id?: string | null
          tenant_id?: string | null
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
      whatsapp_conversation_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          id: string
          is_internal_note: boolean
          media_url: string | null
          message_type: string
          sent_by_user_id: string | null
          tenant_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction?: string
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          message_type?: string
          sent_by_user_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          is_internal_note?: boolean
          media_url?: string | null
          message_type?: string
          sent_by_user_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          canal: string
          cliente_nome: string | null
          cliente_telefone: string
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          status: string
          tenant_id: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          canal?: string
          cliente_nome?: string | null
          cliente_telefone: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string
          tenant_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          canal?: string
          cliente_nome?: string | null
          cliente_telefone?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          status?: string
          tenant_id?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          enviado_por: string | null
          erro_detalhes: string | null
          id: string
          lead_id: string | null
          mensagem: string
          orcamento_id: string | null
          status: string
          telefone: string
          tenant_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          enviado_por?: string | null
          erro_detalhes?: string | null
          id?: string
          lead_id?: string | null
          mensagem: string
          orcamento_id?: string | null
          status?: string
          telefone: string
          tenant_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          enviado_por?: string | null
          erro_detalhes?: string | null
          id?: string
          lead_id?: string | null
          mensagem?: string
          orcamento_id?: string | null
          status?: string
          telefone?: string
          tenant_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_reminders: {
        Row: {
          created_at: string
          created_by: string | null
          data_agendada: string
          id: string
          lead_id: string
          mensagem: string | null
          orcamento_id: string | null
          status: string
          tenant_id: string | null
          tipo: string
          updated_at: string
          vendedor_nome: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_agendada: string
          id?: string
          lead_id: string
          mensagem?: string | null
          orcamento_id?: string | null
          status?: string
          tenant_id?: string | null
          tipo?: string
          updated_at?: string
          vendedor_nome?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_agendada?: string
          id?: string
          lead_id?: string
          mensagem?: string | null
          orcamento_id?: string | null
          status?: string
          tenant_id?: string | null
          tipo?: string
          updated_at?: string
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_reminders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_reminders_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: []
      }
      whatsapp_transfers: {
        Row: {
          conversation_id: string
          created_at: string
          from_user_id: string | null
          id: string
          reason: string | null
          tenant_id: string | null
          to_user_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          reason?: string | null
          tenant_id?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_phone_duplicate: { Args: { _telefone: string }; Returns: boolean }
      generate_vendedor_slug: { Args: { nome: string }; Returns: string }
      get_active_financing_banks: {
        Args: never
        Returns: {
          max_parcelas: number
          nome: string
          taxa_mensal: number
        }[]
      }
      get_calculator_config: {
        Args: never
        Returns: {
          custo_por_kwp: number
          geracao_mensal_por_kwp: number
          kg_co2_por_kwh: number
          percentual_economia: number
          tarifa_media_kwh: number
          vida_util_sistema: number
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
      get_dashboard_leads_estado: {
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
          estados_unicos: number
          media_consumo: number
          mes: string
          total_kwh: number
          total_leads: number
          vendedores_ativos: number
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
      get_dashboard_vendedor_performance: {
        Args: never
        Returns: {
          leads_com_status: number
          total_kwh: number
          total_leads: number
          vendedor: string
        }[]
      }
      get_fio_b_atual: {
        Args: never
        Returns: {
          ano: number
          percentual_nao_compensado: number
        }[]
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
      get_user_tenant_id: { Args: { _user_id?: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      refresh_dashboard_views: { Args: never; Returns: undefined }
      update_parcelas_atrasadas: { Args: never; Returns: undefined }
      validate_vendedor_code: {
        Args: { _codigo: string }
        Returns: {
          codigo: string
          nome: string
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
        | "vendedor"
        | "instalador"
        | "financeiro"
        | "super_admin"
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
      projeto_status:
        | "aguardando_documentacao"
        | "em_analise"
        | "aprovado"
        | "em_instalacao"
        | "instalado"
        | "comissionado"
        | "concluido"
        | "cancelado"
      servico_status:
        | "agendado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "reagendado"
      servico_tipo: "instalacao" | "manutencao" | "visita_tecnica" | "suporte"
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
        "vendedor",
        "instalador",
        "financeiro",
        "super_admin",
      ],
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
      projeto_status: [
        "aguardando_documentacao",
        "em_analise",
        "aprovado",
        "em_instalacao",
        "instalado",
        "comissionado",
        "concluido",
        "cancelado",
      ],
      servico_status: [
        "agendado",
        "em_andamento",
        "concluido",
        "cancelado",
        "reagendado",
      ],
      servico_tipo: ["instalacao", "manutencao", "visita_tecnica", "suporte"],
    },
  },
} as const
