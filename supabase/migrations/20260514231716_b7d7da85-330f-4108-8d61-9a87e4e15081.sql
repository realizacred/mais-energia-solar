-- BUG 1: Melhorar trigger de log de documentos
CREATE OR REPLACE FUNCTION public.fn_log_project_document_event()
RETURNS TRIGGER AS $$
DECLARE
    v_label TEXT;
    v_count INT := 1;
BEGIN
    v_label := NEW.categoria;
    
    -- Se vier de campo customizado, tenta resolver um nome amigável
    IF NEW.categoria = 'custom-fields' THEN
        SELECT label INTO v_label 
        FROM public.etapa_documentos_obrigatorios 
        WHERE categoria = (NEW.metadata->>'field_key')
        LIMIT 1;
        
        IF v_label IS NULL THEN
            v_label := COALESCE(NEW.metadata->>'field_key', 'Documento');
            v_label := REPLACE(REPLACE(REPLACE(v_label, 'cap_', ''), 'pre_', ''), '_', ' ');
            v_label := INITCAP(v_label);
        END IF;
    END IF;

    -- Tenta pegar contagem de arquivos se vier no metadata (pode ser útil no futuro)
    -- Por enquanto, registramos o upload individual
    
    INSERT INTO public.project_events (
        tenant_id, deal_id, event_type, 
        from_value, to_value, metadata
    ) VALUES (
        NEW.tenant_id, NEW.deal_id, 'document_uploaded',
        NULL, v_label, 
        jsonb_build_object(
            'file_name', NEW.file_name, 
            'bucket', NEW.bucket,
            'categoria', NEW.categoria,
            'field_key', NEW.metadata->>'field_key'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 3: Ignorar estágios "Falta Documentos" / "Bloqueado" no histórico de auditoria
CREATE OR REPLACE FUNCTION public.audit_deal_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_pipeline_name text;
  v_from_stage    text;
  v_to_stage      text;
  v_reason        text;
BEGIN
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'pipeline_changed', OLD.pipeline_id::text, NEW.pipeline_id::text);
  END IF;

  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_pipeline_name FROM pipelines       WHERE id = NEW.pipeline_id;
    SELECT name INTO v_from_stage    FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_to_stage      FROM pipeline_stages WHERE id = NEW.stage_id;

    -- FILTRO BUG 3: Ignorar etapas de bloqueio
    IF NOT (
        (LOWER(v_from_stage) ILIKE '%falta documento%' OR LOWER(v_from_stage) ILIKE '%bloqueado%') OR
        (LOWER(v_to_stage)   ILIKE '%falta documento%' OR LOWER(v_to_stage)   ILIKE '%bloqueado%')
    ) THEN
      INSERT INTO project_events (
        tenant_id, deal_id, actor_user_id, event_type, from_value, to_value, metadata
      ) VALUES (
        NEW.tenant_id, NEW.id, auth.uid(), 'stage_changed',
        OLD.stage_id::text, NEW.stage_id::text,
        jsonb_build_object(
          'pipeline_id',   NEW.pipeline_id,
          'pipeline_name', v_pipeline_name,
          'from_stage',    v_from_stage,
          'to_stage',      v_to_stage,
          'source',        'deals'
        )
      );
    END IF;
  END IF;

  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'consultant_changed', OLD.owner_id::text, NEW.owner_id::text);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF OLD.value IS DISTINCT FROM NEW.value THEN
    v_reason := NULLIF(current_setting('app.value_change_reason', true), '');
    INSERT INTO project_events (
      tenant_id, deal_id, actor_user_id, event_type,
      from_value, to_value, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, auth.uid(), 'value_changed',
      OLD.value::text, NEW.value::text,
      CASE
        WHEN v_reason IS NOT NULL
          THEN jsonb_build_object('reason', v_reason)
        ELSE jsonb_build_object('reason', 'manual_edit')
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 3: Repetir lógica em audit_deal_pipeline_stage_change
CREATE OR REPLACE FUNCTION public.audit_deal_pipeline_stage_change()
RETURNS TRIGGER AS $$
DECLARE
  v_pipeline_name text;
  v_from_stage    text;
  v_to_stage      text;
BEGIN
  IF current_setting('app.audit_trigger_active', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_pipeline_name FROM pipelines        WHERE id = NEW.pipeline_id;
  SELECT name INTO v_from_stage    FROM pipeline_stages  WHERE id = OLD.stage_id;
  SELECT name INTO v_to_stage      FROM pipeline_stages  WHERE id = NEW.stage_id;

  -- FILTRO BUG 3: Ignorar etapas de bloqueio
  IF NOT (
      (LOWER(v_from_stage) ILIKE '%falta documento%' OR LOWER(v_from_stage) ILIKE '%bloqueado%') OR
      (LOWER(v_to_stage)   ILIKE '%falta documento%' OR LOWER(v_to_stage)   ILIKE '%bloqueado%')
  ) THEN
    INSERT INTO project_events (
      tenant_id, deal_id, actor_user_id, event_type, from_value, to_value, metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.deal_id,
      auth.uid(),
      'stage_changed',
      OLD.stage_id::text,
      NEW.stage_id::text,
      jsonb_build_object(
        'pipeline_id',   NEW.pipeline_id,
        'pipeline_name', v_pipeline_name,
        'from_stage',    v_from_stage,
        'to_stage',      v_to_stage,
        'source',        'deal_pipeline_stages'
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 2: Limitar sincronização apenas a propostas principais
CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
    v_current_status text;
BEGIN
    -- SÓ age se for a PROPOSTA PRINCIPAL (BUG 2)
    IF NOT COALESCE(NEW.is_principal, false) THEN
        RETURN NEW;
    END IF;

    -- Só age se o status mudar para um estado de aceite e for REALMENTE uma mudança
    IF (LOWER(NEW.status) IN ('aceita', 'aceito', 'aprovada', 'ganha')) AND 
       (OLD.status IS DISTINCT FROM NEW.status) THEN
        
        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            -- Verifica status atual para evitar redundância
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            IF v_current_status IS DISTINCT FROM 'won' THEN
                UPDATE public.deals SET status = 'won' WHERE id = v_deal_id;

                SELECT pipeline_id INTO v_pipeline_id FROM public.deals WHERE id = v_deal_id;
                
                IF v_pipeline_id IS NOT NULL THEN
                    SELECT id INTO v_won_stage_id 
                    FROM public.pipeline_stages 
                    WHERE pipeline_id = v_pipeline_id AND is_won = true 
                    LIMIT 1;

                    IF v_won_stage_id IS NOT NULL THEN
                        UPDATE public.deals 
                        SET stage_id = v_won_stage_id 
                        WHERE id = v_deal_id AND pipeline_id = v_pipeline_id;
                    END IF;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- BUG 2: Repetir trava is_principal em sync_deal_stage_on_proposal_status
CREATE OR REPLACE FUNCTION public.sync_deal_stage_on_proposal_status()
RETURNS TRIGGER AS $$
DECLARE
  v_deal_id uuid;
  v_pipeline_id uuid;
  v_target_stage_id uuid;
  v_target_position int;
  v_current_position int;
  v_proposal_status text;
  v_stage_name text;
BEGIN
  -- SÓ age se for a PROPOSTA PRINCIPAL (BUG 2)
  IF NOT COALESCE(NEW.is_principal, false) THEN
    RETURN NEW;
  END IF;

  -- Only act on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only act if proposal is linked to a project
  IF NEW.projeto_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_proposal_status := NEW.status;

  -- Map proposal status to target stage name in Comercial pipeline
  CASE v_proposal_status
    WHEN 'gerada' THEN v_stage_name := 'Enviar Proposta';
    WHEN 'enviada' THEN v_stage_name := 'Proposta enviada';
    WHEN 'vista' THEN v_stage_name := 'Negociação';
    WHEN 'aceita' THEN v_stage_name := 'Ganho';
    WHEN 'recusada' THEN v_stage_name := 'Perdido';
    WHEN 'cancelada' THEN v_stage_name := 'Perdido';
    ELSE RETURN NEW; -- No mapping for other statuses
  END CASE;

  -- Find the deal linked to this project
  SELECT id, pipeline_id INTO v_deal_id, v_pipeline_id
  FROM deals
  WHERE projeto_id = NEW.projeto_id
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the target stage in the deal's pipeline
  SELECT id, position INTO v_target_stage_id, v_target_position
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id AND name = v_stage_name
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current stage position
  SELECT ps.position INTO v_current_position
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = v_deal_id;

  -- Only advance (never go backwards), EXCEPT for terminal states (aceita/recusada/cancelada)
  IF v_current_position IS NOT NULL 
     AND v_target_position <= v_current_position 
     AND v_proposal_status NOT IN ('aceita', 'recusada', 'cancelada') THEN
    RETURN NEW;
  END IF;

  -- Update the deal stage
  UPDATE deals
  SET stage_id = v_target_stage_id
  WHERE id = v_deal_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;