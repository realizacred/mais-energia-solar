
-- =============================================================
-- P0: RATE LIMITING NO BANCO DE DADOS
-- Proteção contra spam/DoS em tabelas com INSERT público
-- =============================================================

-- 1) Função de rate limiting por telefone normalizado (leads)
CREATE OR REPLACE FUNCTION public.check_lead_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone TEXT;
  recent_count INTEGER;
BEGIN
  -- Normaliza telefone removendo não-dígitos
  normalized_phone := regexp_replace(COALESCE(NEW.telefone, ''), '[^0-9]', '', 'g');
  
  -- Preenche telefone_normalized automaticamente
  NEW.telefone_normalized := normalized_phone;
  
  -- Verifica quantos leads foram criados com esse telefone na última hora
  SELECT COUNT(*) INTO recent_count
  FROM leads
  WHERE telefone_normalized = normalized_phone
    AND created_at > (now() - interval '1 hour');
  
  -- Máximo 5 inserts por telefone por hora
  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many submissions from this phone number'
      USING ERRCODE = 'P0429';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplica trigger BEFORE INSERT em leads
DROP TRIGGER IF EXISTS check_lead_rate_limit_trigger ON leads;
CREATE TRIGGER check_lead_rate_limit_trigger
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION check_lead_rate_limit();

-- 2) Função de rate limiting para simulações (por IP/sessão - limita por volume global)
CREATE OR REPLACE FUNCTION public.check_simulacao_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  -- Verifica quantas simulações foram criadas nos últimos 5 minutos (global)
  -- Como simulações são anônimas, limitamos por volume global
  SELECT COUNT(*) INTO recent_count
  FROM simulacoes
  WHERE created_at > (now() - interval '5 minutes');
  
  -- Máximo 50 simulações a cada 5 minutos (proteção contra DoS)
  IF recent_count >= 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many simulations'
      USING ERRCODE = 'P0429';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplica trigger BEFORE INSERT em simulações
DROP TRIGGER IF EXISTS check_simulacao_rate_limit_trigger ON simulacoes;
CREATE TRIGGER check_simulacao_rate_limit_trigger
  BEFORE INSERT ON simulacoes
  FOR EACH ROW
  EXECUTE FUNCTION check_simulacao_rate_limit();

-- 3) Índice para performance do rate limiting em leads
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized_created 
  ON leads(telefone_normalized, created_at DESC);

-- 4) Índice para performance do rate limiting em simulações
CREATE INDEX IF NOT EXISTS idx_simulacoes_created_at 
  ON simulacoes(created_at DESC);
