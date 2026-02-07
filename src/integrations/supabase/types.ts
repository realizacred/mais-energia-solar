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
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          updated_at?: string
          vida_util_sistema?: number
        }
        Relationships: []
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
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: []
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
          ativo: boolean
          created_at: string
          estado: string | null
          id: string
          nome: string
          sigla: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          estado?: string | null
          id?: string
          nome: string
          sigla?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          estado?: string | null
          id?: string
          nome?: string
          sigla?: string | null
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
          updated_at: string
        }
        Insert: {
          amperagem: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          amperagem?: number
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      financiamento_api_config: {
        Row: {
          api_key: string | null
          ativo: boolean
          created_at: string
          id: string
          nome: string
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
          ultima_sincronizacao?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
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
          ultima_sync?: string | null
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
          updated_at?: string
        }
        Relationships: []
      }
      instagram_config: {
        Row: {
          access_token: string | null
          ativo: boolean
          created_at: string
          id: string
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
          ultima_sincronizacao?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
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
          thumbnail_url?: string | null
          timestamp?: string | null
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: []
      }
      instalador_metas: {
        Row: {
          created_at: string
          id: string
          instalador_id: string
          meta_avaliacoes_positivas: number
          meta_servicos_mensal: number
          meta_tempo_medio_minutos: number
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
          updated_at?: string
          usar_metas_individuais?: boolean
        }
        Relationships: []
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
          total_servicos?: number
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
      lead_status: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem: number
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
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
          tipo_meta?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_notifications_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
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
          rua: string | null
          status_id: string | null
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
          lead_id: string
          media_consumo: number
          numero?: string | null
          observacoes?: string | null
          orc_code?: string | null
          proxima_acao?: string | null
          rede_atendimento: string
          rua?: string | null
          status_id?: string | null
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
          lead_id?: string
          media_consumo?: number
          numero?: string | null
          observacoes?: string | null
          orc_code?: string | null
          proxima_acao?: string | null
          rede_atendimento?: string
          rua?: string | null
          status_id?: string | null
          tipo_telhado?: string
          ultimo_contato?: string | null
          updated_at?: string
          vendedor?: string | null
          visto?: boolean
          visto_admin?: boolean
        }
        Relationships: [
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
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          created_at: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
        ]
      }
      transformadores: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          potencia_kva: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          potencia_kva?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedor_achievements: {
        Row: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          id: string
          metadata: Json | null
          unlocked_at: string
          vendedor_id: string
        }
        Insert: {
          achievement_type: Database["public"]["Enums"]["achievement_type"]
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          vendedor_id: string
        }
        Update: {
          achievement_type?: Database["public"]["Enums"]["achievement_type"]
          id?: string
          metadata?: Json | null
          unlocked_at?: string
          vendedor_id?: string
        }
        Relationships: [
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
          updated_at?: string
          usa_meta_individual?: boolean
          vendedor_id?: string
        }
        Relationships: [
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
          ticket_medio?: number | null
          total_leads_atendidos?: number | null
          updated_at?: string
          valor_total_vendas?: number | null
          vendedor_id?: string
        }
        Relationships: [
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
          total_conversoes?: number
          total_orcamentos?: number
          updated_at?: string
          valor_total_vendas?: number
          vendedor_id?: string
        }
        Relationships: [
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
          telefone: string
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
          telefone: string
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
          telefone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          ativo: boolean
          created_at: string
          eventos: string[]
          id: string
          nome: string
          updated_at: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome: string
          updated_at?: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          eventos?: string[]
          id?: string
          nome?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
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
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
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
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_phone_duplicate: { Args: { _telefone: string }; Returns: boolean }
      get_active_financing_banks: {
        Args: never
        Returns: {
          max_parcelas: number
          nome: string
          taxa_mensal: number
        }[]
      }
      get_active_utilities: {
        Args: never
        Returns: {
          estado: string
          nome: string
          sigla: string
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
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_vendedor_nome: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
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
      app_role: "admin" | "gerente" | "vendedor" | "instalador" | "financeiro"
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
      app_role: ["admin", "gerente", "vendedor", "instalador", "financeiro"],
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
