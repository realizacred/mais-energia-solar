
DROP FUNCTION IF EXISTS public.get_calculator_config();

CREATE OR REPLACE FUNCTION public.get_calculator_config()
 RETURNS TABLE(tarifa_media_kwh numeric, custo_por_kwp numeric, geracao_mensal_por_kwp integer, kg_co2_por_kwh numeric, percentual_economia integer, vida_util_sistema integer, fator_perdas_percentual numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tarifa_media_kwh, custo_por_kwp, geracao_mensal_por_kwp,
         kg_co2_por_kwh, percentual_economia, vida_util_sistema, fator_perdas_percentual
  FROM calculadora_config
  WHERE tenant_id = get_user_tenant_id()
  LIMIT 1;
$function$;
