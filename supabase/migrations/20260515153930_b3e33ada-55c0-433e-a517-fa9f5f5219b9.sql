
CREATE OR REPLACE FUNCTION public.fn_cheque_reverse_compensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_settings public.financial_settings%ROWTYPE;
  v_data_ref date;
  v_lock_days int;
  v_allow_override boolean;
  v_block_reason text;
BEGIN
  IF NOT (OLD.status = 'compensado' AND NEW.status IN ('devolvido','cancelado')) THEN
    RETURN NEW;
  END IF;

  -- Motivo obrigatório
  IF coalesce(trim(NEW.motivo_status), '') = '' THEN
    RAISE EXCEPTION 'Motivo é obrigatório para devolver/cancelar cheque compensado.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Carregar settings do tenant
  SELECT * INTO v_settings
  FROM public.financial_settings
  WHERE tenant_id = NEW.tenant_id
  LIMIT 1;

  v_lock_days := coalesce(v_settings.audit_lock_days, 0);
  v_allow_override := coalesce(v_settings.audit_allow_hard_delete, false);

  -- Data de referência: data de compensação (ou hoje como fallback seguro)
  v_data_ref := coalesce(NEW.data_compensacao, CURRENT_DATE);

  -- Bloqueio 1: janela de lock_days
  IF v_lock_days > 0 AND NOT v_allow_override THEN
    IF v_data_ref < (CURRENT_DATE - v_lock_days) THEN
      v_block_reason := format(
        'Compensação em %s está fora da janela de %s dias permitida para reversão.',
        v_data_ref, v_lock_days
      );

      INSERT INTO public.financial_audit_logs (
        tenant_id, actor_id, entity_type, entity_id, action,
        before_data, after_data, reason
      ) VALUES (
        NEW.tenant_id, auth.uid(), 'cheque', NEW.id, 'reverse_blocked',
        jsonb_build_object('status', OLD.status, 'data_compensacao', v_data_ref),
        jsonb_build_object('status', NEW.status, 'lock_days', v_lock_days),
        v_block_reason
      );

      RAISE EXCEPTION 'Cheque compensado não pode ser devolvido porque o pagamento está em período financeiro bloqueado (lock_days=%).', v_lock_days
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Bloqueio 2: fechamento de caixa fechado cobrindo a data
  IF NOT v_allow_override THEN
    IF EXISTS (
      SELECT 1 FROM public.fechamentos_caixa
      WHERE tenant_id = NEW.tenant_id
        AND status = 'fechado'
        AND v_data_ref BETWEEN data_inicio AND data_fim
    ) THEN
      v_block_reason := format(
        'Compensação em %s está dentro de período de fechamento de caixa já fechado.',
        v_data_ref
      );

      INSERT INTO public.financial_audit_logs (
        tenant_id, actor_id, entity_type, entity_id, action,
        before_data, after_data, reason
      ) VALUES (
        NEW.tenant_id, auth.uid(), 'cheque', NEW.id, 'reverse_blocked',
        jsonb_build_object('status', OLD.status, 'data_compensacao', v_data_ref),
        jsonb_build_object('status', NEW.status, 'fechamento', 'fechado'),
        v_block_reason
      );

      RAISE EXCEPTION 'Cheque compensado não pode ser devolvido porque o pagamento está em período financeiro bloqueado (fechamento de caixa).'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Sem pagamento vinculado: apenas log e segue
  IF NEW.pagamento_id IS NULL THEN
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

  -- Idempotência
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
