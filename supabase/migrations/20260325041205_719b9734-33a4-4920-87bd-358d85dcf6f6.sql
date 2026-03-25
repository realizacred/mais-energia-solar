
-- 1. Update registrar_view_proposta to log proposal_events
CREATE OR REPLACE FUNCTION public.registrar_view_proposta(
  p_token uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token proposta_aceite_tokens%ROWTYPE;
  v_is_first boolean;
  v_deal_id uuid;
BEGIN
  SELECT * INTO v_token FROM proposta_aceite_tokens
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'token_invalido');
  END IF;

  IF v_token.tipo = 'public' THEN
    RETURN jsonb_build_object(
      'ok', true, 'first_view', false,
      'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id, 'skipped', true
    );
  END IF;

  v_is_first := (v_token.first_viewed_at IS NULL);

  UPDATE proposta_aceite_tokens SET
    view_count = COALESCE(view_count, 0) + 1,
    first_viewed_at = COALESCE(first_viewed_at, now()),
    last_viewed_at = now()
  WHERE id = v_token.id;

  INSERT INTO proposta_views (tenant_id, token_id, proposta_id, versao_id, ip_address, user_agent, referrer)
  VALUES (v_token.tenant_id, v_token.id, v_token.proposta_id, v_token.versao_id, p_ip, p_user_agent, p_referrer);

  UPDATE propostas_nativas SET
    primeiro_acesso_em = COALESCE(primeiro_acesso_em, now()),
    ultimo_acesso_em = now(),
    total_aberturas = total_aberturas + 1,
    status_visualizacao = 'aberto'
  WHERE id = v_token.proposta_id;

  IF v_is_first THEN
    UPDATE proposta_versoes SET viewed_at = now() WHERE id = v_token.versao_id;

    SELECT p.deal_id INTO v_deal_id
    FROM propostas_nativas pn
    LEFT JOIN projetos p ON p.proposta_id = pn.id
    WHERE pn.id = v_token.proposta_id LIMIT 1;

    IF v_deal_id IS NOT NULL THEN
      INSERT INTO project_events (tenant_id, deal_id, event_type, metadata)
      VALUES (v_token.tenant_id, v_deal_id, 'proposal.viewed', jsonb_build_object(
        'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id, 'token_id', v_token.id
      ));
    END IF;
  END IF;

  -- Log proposal_event: proposta_visualizada
  INSERT INTO proposal_events (proposta_id, tipo, payload, tenant_id)
  VALUES (
    v_token.proposta_id, 'proposta_visualizada',
    jsonb_build_object(
      'versao_id', v_token.versao_id, 'token_id', v_token.id,
      'view_count', COALESCE(v_token.view_count, 0) + 1,
      'first_view', v_is_first, 'ip_address', p_ip
    ),
    v_token.tenant_id
  );

  RETURN jsonb_build_object('ok', true, 'first_view', v_is_first,
    'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id);
END;
$function$;

-- 2. Create webhook dispatch trigger function
CREATE OR REPLACE FUNCTION public.dispatch_proposal_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_webhook record;
  v_proposta record;
  v_payload jsonb;
BEGIN
  IF NEW.tipo NOT IN ('proposta_enviada', 'proposta_visualizada', 'proposta_aceita', 'proposta_recusada') THEN
    RETURN NEW;
  END IF;

  SELECT pn.id, pn.titulo, pn.codigo, pn.status, c.nome as cliente_nome,
         pv.valor_total, pv.potencia_kwp, pv.economia_mensal
  INTO v_proposta
  FROM propostas_nativas pn
  LEFT JOIN clientes c ON c.id = pn.cliente_id
  LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
  WHERE pn.id = NEW.proposta_id
  ORDER BY pv.versao_numero DESC NULLS LAST LIMIT 1;

  v_payload := jsonb_build_object(
    'event', NEW.tipo, 'proposta_id', NEW.proposta_id,
    'tenant_id', NEW.tenant_id, 'timestamp', NEW.created_at,
    'proposta', jsonb_build_object(
      'titulo', v_proposta.titulo, 'codigo', v_proposta.codigo,
      'status', v_proposta.status, 'cliente_nome', v_proposta.cliente_nome,
      'valor_total', v_proposta.valor_total, 'potencia_kwp', v_proposta.potencia_kwp,
      'economia_mensal', v_proposta.economia_mensal
    ),
    'metadata', NEW.payload
  );

  FOR v_webhook IN
    SELECT url FROM webhook_config
    WHERE tenant_id = NEW.tenant_id AND ativo = true
      AND (eventos @> ARRAY[NEW.tipo] OR eventos @> ARRAY['*'])
  LOOP
    PERFORM net.http_post(
      url := v_webhook.url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := v_payload::jsonb
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_proposal_webhook ON proposal_events;
CREATE TRIGGER trg_dispatch_proposal_webhook
  AFTER INSERT ON proposal_events
  FOR EACH ROW EXECUTE FUNCTION dispatch_proposal_webhook();

-- 3. Commercial dashboard RPC: funnel metrics
CREATE OR REPLACE FUNCTION public.get_proposal_funnel_metrics(p_tenant_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_since timestamptz;
  v_total_geradas int; v_total_enviadas int; v_total_vistas int;
  v_total_aceitas int; v_total_recusadas int;
  v_avg_tempo_abertura interval; v_propostas_quentes int;
BEGIN
  v_since := now() - (p_days || ' days')::interval;

  SELECT
    COUNT(*) FILTER (WHERE status NOT IN ('rascunho','excluida')),
    COUNT(*) FILTER (WHERE status IN ('enviada','vista','aceita','recusada')),
    COUNT(*) FILTER (WHERE status IN ('vista','aceita') OR primeiro_acesso_em IS NOT NULL),
    COUNT(*) FILTER (WHERE status = 'aceita'),
    COUNT(*) FILTER (WHERE status = 'recusada')
  INTO v_total_geradas, v_total_enviadas, v_total_vistas, v_total_aceitas, v_total_recusadas
  FROM propostas_nativas WHERE tenant_id = p_tenant_id AND created_at >= v_since;

  SELECT AVG(primeiro_acesso_em - enviada_at) INTO v_avg_tempo_abertura
  FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND created_at >= v_since
    AND primeiro_acesso_em IS NOT NULL AND enviada_at IS NOT NULL;

  SELECT COUNT(DISTINCT id) INTO v_propostas_quentes
  FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND created_at >= v_since
    AND total_aberturas >= 2
    AND status NOT IN ('aceita','recusada','cancelada','expirada','excluida');

  RETURN jsonb_build_object(
    'total_geradas', v_total_geradas, 'total_enviadas', v_total_enviadas,
    'total_vistas', v_total_vistas, 'total_aceitas', v_total_aceitas,
    'total_recusadas', v_total_recusadas,
    'taxa_visualizacao', CASE WHEN v_total_enviadas > 0 THEN ROUND((v_total_vistas::numeric / v_total_enviadas) * 100, 1) ELSE 0 END,
    'taxa_conversao', CASE WHEN v_total_geradas > 0 THEN ROUND((v_total_aceitas::numeric / v_total_geradas) * 100, 1) ELSE 0 END,
    'propostas_quentes', v_propostas_quentes,
    'avg_tempo_abertura_horas', CASE WHEN v_avg_tempo_abertura IS NOT NULL THEN ROUND(EXTRACT(EPOCH FROM v_avg_tempo_abertura) / 3600, 1) ELSE NULL END,
    'period_days', p_days
  );
END;
$$;

-- 4. Proposals by vendor RPC
CREATE OR REPLACE FUNCTION public.get_proposals_by_vendor(p_tenant_id uuid, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_result jsonb; v_since timestamptz;
BEGIN
  v_since := now() - (p_days || ' days')::interval;
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pr.full_name as vendedor, pr.user_id as vendedor_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE pn.status = 'aceita') as aceitas,
      COUNT(*) FILTER (WHERE pn.status IN ('enviada','vista')) as pendentes,
      COALESCE(SUM(pv.valor_total) FILTER (WHERE pn.status = 'aceita'), 0) as valor_aceito,
      ROUND(CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE pn.status = 'aceita')::numeric / COUNT(*)) * 100 ELSE 0 END, 1) as taxa_conversao
    FROM propostas_nativas pn
    LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
      AND pv.versao_numero = (SELECT MAX(pv2.versao_numero) FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id)
    LEFT JOIN leads l ON l.id = pn.lead_id
    LEFT JOIN profiles pr ON pr.user_id = l.consultor_id
    WHERE pn.tenant_id = p_tenant_id AND pn.created_at >= v_since AND pn.status != 'excluida'
    GROUP BY pr.full_name, pr.user_id ORDER BY total DESC
  ) r;
  RETURN v_result;
END;
$$;

-- 5. Hot proposals RPC
CREATE OR REPLACE FUNCTION public.get_hot_proposals(p_tenant_id uuid, p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT pn.id, pn.titulo, pn.codigo, pn.status, pn.total_aberturas,
      pn.primeiro_acesso_em, pn.ultimo_acesso_em, pn.enviada_at,
      c.nome as cliente_nome, pv.valor_total, pv.potencia_kwp,
      pr.full_name as vendedor
    FROM propostas_nativas pn
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
      AND pv.versao_numero = (SELECT MAX(pv2.versao_numero) FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id)
    LEFT JOIN leads l ON l.id = pn.lead_id
    LEFT JOIN profiles pr ON pr.user_id = l.consultor_id
    WHERE pn.tenant_id = p_tenant_id
      AND pn.total_aberturas >= 2
      AND pn.status NOT IN ('aceita','recusada','cancelada','expirada','excluida')
    ORDER BY pn.total_aberturas DESC, pn.ultimo_acesso_em DESC
    LIMIT p_limit
  ) r;
  RETURN v_result;
END;
$$;
