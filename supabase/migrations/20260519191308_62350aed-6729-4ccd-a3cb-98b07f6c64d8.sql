-- 1. Refatorar proposal_update_status para remover dependência de proposal_status_history
-- e implementar governança de eventos
CREATE OR REPLACE FUNCTION public.proposal_update_status(p_proposta_id uuid, p_new_status text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_status proposta_nativa_status;
  v_canonical_status proposta_nativa_status;
  v_deal_id uuid;
  v_projeto_id uuid;
  v_tenant_id uuid;
  v_latest_versao record;
  v_normalized text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  -- Normalize status names
  v_normalized := CASE lower(coalesce(p_new_status, ''))
    WHEN 'rascunho'  THEN 'draft'
    WHEN 'gerada'    THEN 'generated'
    WHEN 'enviada'   THEN 'sent'
    WHEN 'vista'     THEN 'viewed'
    WHEN 'aceita'    THEN 'accepted'
    WHEN 'recusada'  THEN 'rejected'
    WHEN 'expirada'  THEN 'expired'
    WHEN 'cancelada' THEN 'cancelled'
    ELSE p_new_status
  END;

  BEGIN
    v_canonical_status := v_normalized::proposta_nativa_status;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido: ' || p_new_status);
  END;

  SELECT status, deal_id, projeto_id, tenant_id INTO v_old_status, v_deal_id, v_projeto_id, v_tenant_id
  FROM propostas_nativas
  WHERE id = p_proposta_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposta não encontrada');
  END IF;

  SELECT id, valor_total INTO v_latest_versao
  FROM proposta_versoes
  WHERE proposta_id = p_proposta_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update Proposal state
  UPDATE propostas_nativas
  SET status = v_canonical_status,
      aceita_at = CASE 
        WHEN v_canonical_status = 'accepted' THEN now() 
        WHEN v_old_status = 'accepted' AND v_canonical_status <> 'accepted' THEN NULL -- Limpa ao reverter
        ELSE aceita_at 
      END,
      updated_at = now()
  WHERE id = p_proposta_id;

  UPDATE proposta_versoes
  SET status = v_canonical_status,
      updated_at = now()
  WHERE proposta_id = p_proposta_id;

  -- Registrar evento unificado (SSOT para timeline e auditoria)
  INSERT INTO public.proposal_events (proposta_id, tenant_id, user_id, tipo, payload)
  VALUES (p_proposta_id, v_tenant_id, v_user_id, 'status_change', jsonb_build_object(
    'previous_status', v_old_status,
    'new_status', v_canonical_status,
    'reason', p_motivo
  ));

  -- Side effects on accept (APENAS se houver aceita_at, o que agora é garantido pelo UPDATE acima)
  IF v_canonical_status = 'accepted' THEN
    -- Side effects como Reject siblings agora são disparados via trigger ou mantidos aqui
    -- Mas a promoção de Deal é controlada pela trigger sync_deal_status_on_proposal_acceptance
    
    IF v_projeto_id IS NOT NULL AND v_latest_versao.valor_total IS NOT NULL THEN
      UPDATE projetos SET valor_total = v_latest_versao.valor_total, updated_at = now()
       WHERE id = v_projeto_id;
    END IF;

    -- Reject siblings on acceptance
    IF v_projeto_id IS NOT NULL THEN
      UPDATE propostas_nativas
         SET status = 'rejected'::proposta_nativa_status,
             recusa_motivo = 'Outra proposta aceita para este projeto',
             updated_at = now()
       WHERE projeto_id = v_projeto_id
         AND id <> p_proposta_id
         AND status IN ('generated'::proposta_nativa_status, 'sent'::proposta_nativa_status);

      UPDATE proposta_versoes pv
         SET status = 'rejected'::proposta_nativa_status,
             updated_at = now()
        FROM propostas_nativas pn
       WHERE pv.proposta_id = pn.id
         AND pn.projeto_id = v_projeto_id
         AND pn.id <> p_proposta_id
         AND pn.status = 'rejected'::proposta_nativa_status;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 2. Blindagem da trigger de Promoção Comercial (Deal Won)
-- Já existe uma versão no banco, vamos garantir que ela seja a mais restritiva possível
CREATE OR REPLACE FUNCTION public.sync_deal_status_on_proposal_acceptance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_deal_id uuid;
    v_pipeline_id uuid;
    v_won_stage_id uuid;
    v_current_status text;
    v_has_formal_event boolean;
    v_actor_id uuid;
BEGIN
    -- 1. SÓ age se for a PROPOSTA PRINCIPAL
    IF NOT COALESCE(NEW.is_principal, false) THEN
        RETURN NEW;
    END IF;

    -- 2. BLOQUEIO DE NORMALIZAÇÃO/BACKFILL:
    -- Só prossegue se o status mudou para 'accepted' E existe timestamp de aceite formal
    IF (LOWER(NEW.status) IN ('accepted', 'aceita')) AND 
       (OLD.status IS DISTINCT FROM NEW.status OR OLD.aceita_at IS NULL) AND
       (NEW.aceita_at IS NOT NULL) THEN
        
        -- 3. EVIDÊNCIA ADICIONAL (Governance Check):
        -- Verifica se existe um evento de aceite ou mudança de status para aceite nos últimos 5 minutos
        -- (Janela curta para evitar que backfills antigos disparem gatilhos agora)
        SELECT EXISTS (
            SELECT 1 FROM public.proposal_events 
            WHERE proposta_id = NEW.id 
              AND (tipo = 'proposta_aceita' OR (tipo = 'status_change' AND payload->>'new_status' IN ('aceita', 'accepted')))
              AND created_at >= (now() - interval '5 minutes')
        ) INTO v_has_formal_event;

        IF NOT v_has_formal_event THEN
            RETURN NEW;
        END IF;

        v_deal_id := COALESCE(NEW.deal_id, NEW.projeto_id);

        IF v_deal_id IS NOT NULL THEN
            SELECT status INTO v_current_status FROM public.deals WHERE id = v_deal_id;
            
            IF v_current_status IS DISTINCT FROM 'won' THEN
                v_actor_id := auth.uid();
                
                UPDATE public.deals 
                SET status = 'won', 
                    won_at = NEW.aceita_at,
                    won_by = COALESCE(v_actor_id, NEW.consultor_id),
                    updated_at = now() 
                WHERE id = v_deal_id;

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

                -- Registro de Auditoria Comercial
                INSERT INTO public.project_events (
                    deal_id,
                    event_type,
                    from_value,
                    to_value,
                    actor_user_id,
                    metadata
                ) VALUES (
                    v_deal_id,
                    'deal_won_by_proposal',
                    v_current_status,
                    'won',
                    v_actor_id,
                    jsonb_build_object(
                        'proposal_id', NEW.id,
                        'aceita_at', NEW.aceita_at,
                        'reason', 'Promoção automática via aceite formal de proposta principal'
                    )
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- 3. Blindagem de Comissões e Vendas (Process Proposta Aceita)
CREATE OR REPLACE FUNCTION public.process_proposta_aceita(p_proposta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta       public.propostas_nativas%ROWTYPE;
  v_versao         public.proposta_versoes%ROWTYPE;
  v_venda_id       uuid;
  v_obra_id        uuid;
  v_comissao_id    uuid;
  v_skipped        text[] := ARRAY[]::text[];
  v_valor_total    numeric := 0;
  v_consultor_id   uuid;
  v_plan           RECORD;
  v_percentual     NUMERIC;
  v_valor_comissao NUMERIC;
  v_bonus          RECORD;
  v_cliente_id     uuid;
BEGIN
  IF p_proposta_id IS NULL THEN RETURN jsonb_build_object('error','null_id'); END IF;
  
  SELECT * INTO v_proposta FROM public.propostas_nativas WHERE id = p_proposta_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','proposta_not_found'); END IF;

  -- GOVERNANÇA CRÍTICA: Impedir processamento se não houver aceite formal
  IF v_proposta.aceita_at IS NULL THEN
    RETURN jsonb_build_object('skipped','sem_evidencia_formal','status', v_proposta.status);
  END IF;

  -- Status check
  IF lower(coalesce(v_proposta.status::text,'')) NOT IN ('accepted','aceita','aceito','aceitado','aprovada','aprovado') THEN
    RETURN jsonb_build_object('skipped','status_not_aceita','status', v_proposta.status);
  END IF;

  -- Obter versão atual
  SELECT * INTO v_versao FROM public.proposta_versoes
  WHERE proposta_id = p_proposta_id
  ORDER BY (versao_numero = v_proposta.versao_atual) DESC, versao_numero DESC NULLS LAST, created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped','no_version'); END IF;

  v_valor_total := COALESCE(v_versao.valor_total, 0);
  IF v_valor_total <= 0 THEN RETURN jsonb_build_object('skipped','valor_zero'); END IF;

  -- Evitar duplicidade
  IF EXISTS (SELECT 1 FROM public.vendas WHERE proposta_id = p_proposta_id) THEN
    RETURN jsonb_build_object('skipped','venda_ja_existe');
  END IF;

  -- Criar Venda
  BEGIN
    v_venda_id := public.create_venda_from_proposta(v_versao.id);
  EXCEPTION WHEN OTHERS THEN
    v_skipped := array_append(v_skipped, 'venda_error:' || SQLERRM);
  END;

  IF v_venda_id IS NOT NULL THEN
    BEGIN
      v_obra_id := public.create_obra_from_venda(v_venda_id);
    EXCEPTION WHEN OTHERS THEN
      v_skipped := array_append(v_skipped, 'obra_error:' || SQLERRM);
    END;
  END IF;

  -- Criar Comissão
  IF v_proposta.projeto_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.comissoes WHERE projeto_id = v_proposta.projeto_id) THEN
    v_skipped := array_append(v_skipped, 'comissao_existente');
  ELSE
    v_consultor_id := v_proposta.consultor_id;
    IF v_consultor_id IS NOT NULL THEN
      SELECT * INTO v_plan FROM public.commission_plans
      WHERE tenant_id = v_proposta.tenant_id AND is_active = true LIMIT 1;
      
      IF v_plan.id IS NOT NULL THEN
        v_percentual := COALESCE((v_plan.parameters->>'percentual')::numeric, 3.0);
        v_valor_comissao := (v_valor_total * v_percentual) / 100;
        
        INSERT INTO public.comissoes (
          tenant_id, projeto_id, venda_id, consultor_id,
          valor_base, percentual, valor_comissao, status
        ) VALUES (
          v_proposta.tenant_id, v_proposta.projeto_id, v_venda_id, v_consultor_id,
          v_valor_total, v_percentual, v_valor_comissao, 'pendente'
        ) RETURNING id INTO v_comissao_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'venda_id', v_venda_id,
    'comissao_id', v_comissao_id,
    'skipped', v_skipped
  );
END;
$function$;
