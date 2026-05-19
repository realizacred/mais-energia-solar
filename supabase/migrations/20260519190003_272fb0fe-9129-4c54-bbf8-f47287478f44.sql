CREATE OR REPLACE FUNCTION public.sync_deal_stage_on_proposal_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_deal_id uuid;
  v_pipeline_id uuid;
  v_target_stage_id uuid;
  v_target_position int;
  v_current_position int;
  v_stage_name text;
BEGIN
  -- 1. REGRA DE OURO: Só age se for a PROPOSTA PRINCIPAL
  IF NOT COALESCE(NEW.is_principal, false) THEN RETURN NEW; END IF;
  
  -- 2. BLOQUEIO: Só age se o status REALMENTE mudou
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  
  -- 3. BLOQUEIO: Exige projeto_id ou deal_id
  IF NEW.projeto_id IS NULL AND NEW.deal_id IS NULL THEN RETURN NEW; END IF;

  -- 4. MAPEAMENTO SEMÂNTICO (Governança Enterprise)
  CASE NEW.status::text
    WHEN 'generated', 'gerada'    THEN v_stage_name := 'Enviar Proposta';
    WHEN 'sent',      'enviada'   THEN v_stage_name := 'Proposta enviada';
    WHEN 'viewed',    'vista'     THEN v_stage_name := 'Negociação';
    WHEN 'accepted',  'aceita'    THEN v_stage_name := 'Ganho';
    WHEN 'rejected',  'recusada'  THEN v_stage_name := 'Perdido';
    WHEN 'excluida',  'arquivada' THEN v_stage_name := 'Perdido';
    ELSE RETURN NEW;
  END CASE;

  -- Resolve Deal ID (Múltiplos contextos)
  v_deal_id := COALESCE(NEW.deal_id, (SELECT id FROM deals WHERE projeto_id = NEW.projeto_id LIMIT 1));
  IF v_deal_id IS NULL THEN RETURN NEW; END IF;

  SELECT pipeline_id INTO v_pipeline_id FROM deals WHERE id = v_deal_id;
  IF v_pipeline_id IS NULL THEN RETURN NEW; END IF;

  -- Busca etapa alvo no funil atual
  SELECT id, position INTO v_target_stage_id, v_target_position
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id AND name = v_stage_name LIMIT 1;
  
  -- Fallback se a etapa não existir com o nome exato (Legacy support)
  IF v_target_stage_id IS NULL THEN RETURN NEW; END IF;

  SELECT ps.position INTO v_current_position
  FROM deals d JOIN pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = v_deal_id;

  -- 5. REGRA DE PROGRESSÃO: Não retrocede o funil por automação de status de proposta, 
  -- exceto se for aceite ou recusa (Estados Terminais)
  IF v_current_position IS NOT NULL
     AND v_target_position <= v_current_position
     AND NEW.status::text NOT IN (
       'accepted','aceita','rejected','recusada','excluida','arquivada'
     )
  THEN RETURN NEW; END IF;

  -- 6. REGRA DE EVIDÊNCIA: Se for aceite, EXIGE aceita_at (mesma trava da trigger de Won)
  IF NEW.status::text IN ('accepted', 'aceita') AND NEW.aceita_at IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE deals SET stage_id = v_target_stage_id, updated_at = now() WHERE id = v_deal_id;
  RETURN NEW;
END;
$function$;
