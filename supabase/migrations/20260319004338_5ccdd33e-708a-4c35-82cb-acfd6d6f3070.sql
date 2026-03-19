
-- Expand intelligence_config with new feature control columns
ALTER TABLE intelligence_config
ADD COLUMN IF NOT EXISTS ia_analise_sentimento_habilitada boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ia_provedor varchar(20) DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS ia_chave_api_encrypted text,
ADD COLUMN IF NOT EXISTS ia_timeout_ms int DEFAULT 10000,
ADD COLUMN IF NOT EXISTS ia_max_tokens int DEFAULT 500,
ADD COLUMN IF NOT EXISTS ia_fallback_heuristica boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ia_custo_maximo_mes decimal(10,2) DEFAULT 500.00,

ADD COLUMN IF NOT EXISTS reaquecimento_habilitado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reaquecimento_horario_cron varchar(20) DEFAULT '0 9 * * *',
ADD COLUMN IF NOT EXISTS reaquecimento_batch_size int DEFAULT 50,
ADD COLUMN IF NOT EXISTS reaquecimento_criar_rascunho_only boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS reaquecimento_template_mensagem text DEFAULT 'Olá {{nome}}, desde nossa conversa você deixou de economizar {{valor_perdido}}. Posso rever seu projeto de {{potencia}}kWp?',

ADD COLUMN IF NOT EXISTS whatsapp_realtime_habilitado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_analisar_toda_mensagem boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_notificar_mudanca_temperamento boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS wa_notificar_nova_dor boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS wa_auto_sugerir_resposta boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS wa_notificar_consultor_se_urgencia_acima int DEFAULT 70,
ADD COLUMN IF NOT EXISTS wa_notificar_gerente_se_urgencia_acima int DEFAULT 90,

ADD COLUMN IF NOT EXISTS notificacao_email_alertas boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notificacao_push_temperamento boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notificacao_resumo_diario_gerente boolean DEFAULT false;
