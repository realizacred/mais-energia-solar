
-- ============================================================
-- AUDIT_LOGS: Tornar tabela imutável (append-only)
-- Bloquear UPDATE e DELETE mesmo para SECURITY DEFINER
-- ============================================================

-- Trigger que impede UPDATE em audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é imutável: UPDATE não permitido'
    USING ERRCODE = 'P0403';
END;
$$;

CREATE TRIGGER prevent_audit_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_update();

-- Trigger que impede DELETE em audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é imutável: DELETE não permitido'
    USING ERRCODE = 'P0403';
END;
$$;

CREATE TRIGGER prevent_audit_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_delete();

-- Trigger que impede INSERT direto (fora do trigger de auditoria)
-- Apenas a função audit_log_trigger_fn deve poder inserir.
-- Usamos uma variável de sessão como "token" de autorização.
CREATE OR REPLACE FUNCTION public.guard_audit_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Se a variável de sessão 'app.audit_trigger_active' não estiver setada,
  -- bloqueia o INSERT direto
  IF current_setting('app.audit_trigger_active', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'audit_logs: INSERT direto não permitido. Use apenas triggers de auditoria.'
      USING ERRCODE = 'P0403';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_audit_insert
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_audit_log_insert();

-- Atualizar a função de auditoria para setar o token antes do INSERT
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id UUID;
  _user_email TEXT;
  _old_data JSONB;
  _new_data JSONB;
  _record_id UUID;
BEGIN
  -- Captura user_id e email do contexto de autenticação
  _user_id := auth.uid();
  _user_email := COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'email',
    'anonymous'
  );

  -- Determina dados antigos e novos
  IF TG_OP = 'DELETE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := NULL;
    _record_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    _old_data := NULL;
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    _old_data := to_jsonb(OLD);
    _new_data := to_jsonb(NEW);
    _record_id := NEW.id;
  END IF;

  -- Ativa o token de autorização para o guard_audit_insert
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  -- Insere registro de auditoria
  INSERT INTO audit_logs (
    user_id,
    user_email,
    tabela,
    acao,
    registro_id,
    dados_anteriores,
    dados_novos,
    created_at
  ) VALUES (
    _user_id,
    _user_email,
    TG_TABLE_NAME,
    TG_OP,
    _record_id,
    _old_data,
    _new_data,
    now()
  );

  -- Desativa o token
  PERFORM set_config('app.audit_trigger_active', 'false', true);

  -- Retorna o registro apropriado
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
