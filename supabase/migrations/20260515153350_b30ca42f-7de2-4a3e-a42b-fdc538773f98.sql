
-- 1. Adicionar campos de estorno a pagamentos
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS estornado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_estorno text;

CREATE INDEX IF NOT EXISTS idx_pagamentos_estornado ON public.pagamentos(estornado) WHERE estornado = false;

-- 2. Adicionar campo motivo_status no cheque para guardar motivo de devolução/cancelamento
ALTER TABLE public.cheques
  ADD COLUMN IF NOT EXISTS motivo_status text;

-- 3. Atualizar sync_recebimento_total_pago para ignorar pagamentos estornados
CREATE OR REPLACE FUNCTION public.sync_recebimento_total_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_recebimento_id uuid := coalesce(new.recebimento_id, old.recebimento_id);
  v_total numeric(10,2);
  v_ultimo timestamptz;
BEGIN
  SELECT coalesce(sum(valor_pago),0), max(data_pagamento::timestamptz)
    INTO v_total, v_ultimo
  FROM public.pagamentos
  WHERE recebimento_id = v_recebimento_id
    AND coalesce(estornado, false) = false;

  UPDATE public.recebimentos r
  SET total_pago = v_total,
      ultimo_pagamento_em = v_ultimo,
      status = CASE
        WHEN v_total <= 0 THEN 'pendente'
        WHEN v_total >= r.valor_total THEN 'quitado'
        ELSE 'parcial'
      END
  WHERE r.id = v_recebimento_id;

  RETURN coalesce(new, old);
END;
$function$;

-- 4. Atualizar fn_cheque_compensacao_integra:
--    - Bloquear compensar cheque já devolvido/cancelado
--    - Vincular pagamento_id de volta no cheque
CREATE OR REPLACE FUNCTION public.fn_cheque_compensacao_integra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pagamento_id uuid;
BEGIN
  -- Bloqueio: não permitir voltar para 'compensado' se já estava devolvido/cancelado
  IF (NEW.status = 'compensado' AND OLD.status IN ('devolvido','cancelado')) THEN
    RAISE EXCEPTION 'Cheque % está % e não pode ser recompensado. Crie um novo cheque.', NEW.numero_cheque, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'compensado') THEN
    -- Idempotência: se já existe pagamento vinculado a este cheque, não recriar
    IF NEW.pagamento_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF (NEW.recebimento_id IS NOT NULL) THEN
      INSERT INTO public.pagamentos (
        tenant_id, recebimento_id, parcela_id, valor_pago,
        forma_pagamento, data_pagamento, numero_cheque, observacoes
      ) VALUES (
        NEW.tenant_id, NEW.recebimento_id, NEW.parcela_id, NEW.valor,
        'cheque', COALESCE(NEW.data_compensacao, CURRENT_DATE),
        NEW.numero_cheque,
        'Compensação automática de cheque: ' || NEW.numero_cheque
      ) RETURNING id INTO v_pagamento_id;

      -- Vínculo reverso (sem disparar trigger de log de status)
      UPDATE public.cheques SET pagamento_id = v_pagamento_id WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Função de reversão: cheque compensado -> devolvido/cancelado estorna pagamento
CREATE OR REPLACE FUNCTION public.fn_cheque_reverse_compensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
BEGIN
  IF NOT (OLD.status = 'compensado' AND NEW.status IN ('devolvido','cancelado')) THEN
    RETURN NEW;
  END IF;

  -- Motivo obrigatório
  IF coalesce(trim(NEW.motivo_status), '') = '' THEN
    RAISE EXCEPTION 'Motivo é obrigatório para devolver/cancelar cheque compensado.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.pagamento_id IS NULL THEN
    -- Sem pagamento vinculado, nada a estornar
    INSERT INTO public.financial_audit_logs (
      tenant_id, actor_id, entity_type, entity_id, action,
      before_data, after_data, reason
    ) VALUES (
      NEW.tenant_id, auth.uid(), 'cheque', NEW.id, 'reverse_no_payment',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      'Reversão de cheque sem pagamento vinculado: ' || NEW.motivo_status
    );
    RETURN NEW;
  END IF;

  SELECT * INTO v_pagamento FROM public.pagamentos WHERE id = NEW.pagamento_id;

  -- Idempotência: pagamento já estornado
  IF v_pagamento.id IS NULL OR coalesce(v_pagamento.estornado, false) = true THEN
    RETURN NEW;
  END IF;

  UPDATE public.pagamentos
  SET estornado = true,
      estornado_em = now(),
      estornado_por = auth.uid(),
      motivo_estorno = 'Cheque ' || NEW.numero_cheque || ' ' || NEW.status || ': ' || NEW.motivo_status
  WHERE id = NEW.pagamento_id
    AND coalesce(estornado, false) = false;

  -- Auditoria
  INSERT INTO public.financial_audit_logs (
    tenant_id, actor_id, entity_type, entity_id, action,
    before_data, after_data, reason
  ) VALUES (
    NEW.tenant_id, auth.uid(), 'pagamento', NEW.pagamento_id, 'estorno_cheque',
    jsonb_build_object('estornado', false, 'cheque_id', NEW.id, 'cheque_status_anterior', OLD.status),
    jsonb_build_object('estornado', true, 'cheque_id', NEW.id, 'cheque_status_novo', NEW.status),
    'Estorno automático por reversão de cheque ' || NEW.numero_cheque || ': ' || NEW.motivo_status
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_cheque_reverse_compensacao ON public.cheques;
CREATE TRIGGER tr_cheque_reverse_compensacao
AFTER UPDATE ON public.cheques
FOR EACH ROW EXECUTE FUNCTION public.fn_cheque_reverse_compensacao();
