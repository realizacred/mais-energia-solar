-- Trigger: auto-sync tenant_premises when its linked concessionária is updated
CREATE OR REPLACE FUNCTION public.sync_premises_from_concessionaria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bt RECORD;
  v_mt RECORD;
BEGIN
  -- Only act on relevant tariff field changes
  IF (
    NEW.tarifa_energia IS NOT DISTINCT FROM OLD.tarifa_energia AND
    NEW.tarifa_fio_b IS NOT DISTINCT FROM OLD.tarifa_fio_b AND
    NEW.aliquota_icms IS NOT DISTINCT FROM OLD.aliquota_icms
  ) THEN
    RETURN NEW;
  END IF;

  -- Find BT (B1) subgrupo for this concessionária
  SELECT * INTO v_bt
  FROM concessionaria_tarifas_subgrupo
  WHERE concessionaria_id = NEW.id AND is_active = true AND subgrupo LIKE 'B1%'
  LIMIT 1;

  -- Find MT (A4/A3) subgrupo
  SELECT * INTO v_mt
  FROM concessionaria_tarifas_subgrupo
  WHERE concessionaria_id = NEW.id AND is_active = true AND (subgrupo LIKE 'A4%' OR subgrupo LIKE 'A3%')
  LIMIT 1;

  -- Update all tenant_premises that reference this concessionária
  UPDATE tenant_premises SET
    tarifa = COALESCE(
      CASE WHEN v_bt.id IS NOT NULL THEN (COALESCE(v_bt.tarifa_energia, 0) + COALESCE(v_bt.tarifa_fio_b, 0)) ELSE NULL END,
      (COALESCE(NEW.tarifa_energia, 0) + COALESCE(NEW.tarifa_fio_b, 0))
    ),
    tusd_fio_b_bt = COALESCE(v_bt.tarifa_fio_b, NEW.tarifa_fio_b, tusd_fio_b_bt),
    imposto_energia = COALESCE(NEW.aliquota_icms, imposto_energia),
    tarifacao_compensada_bt = COALESCE(v_bt.tarifacao_bt, tarifacao_compensada_bt),
    tusd_fio_b_fora_ponta = COALESCE(v_bt.fio_b_fora_ponta, tusd_fio_b_fora_ponta),
    tusd_fio_b_ponta = COALESCE(v_bt.fio_b_ponta, tusd_fio_b_ponta),
    tarifa_te_ponta = COALESCE(v_mt.te_ponta, tarifa_te_ponta),
    tarifa_tusd_ponta = COALESCE(v_mt.tusd_ponta, tarifa_tusd_ponta),
    tarifa_te_fora_ponta = COALESCE(v_mt.te_fora_ponta, tarifa_te_fora_ponta),
    tarifa_tusd_fora_ponta = COALESCE(v_mt.tusd_fora_ponta, tarifa_tusd_fora_ponta),
    tarifacao_compensada_fora_ponta = COALESCE(v_mt.tarifacao_fora_ponta, tarifacao_compensada_fora_ponta),
    tarifacao_compensada_ponta = COALESCE(v_mt.tarifacao_ponta, tarifacao_compensada_ponta),
    preco_demanda = COALESCE(v_mt.demanda_consumo_rs, preco_demanda),
    preco_demanda_geracao = COALESCE(v_mt.demanda_geracao_rs, preco_demanda_geracao),
    updated_at = now()
  WHERE concessionaria_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Attach to concessionarias table
DROP TRIGGER IF EXISTS trg_sync_premises_on_conc_update ON concessionarias;
CREATE TRIGGER trg_sync_premises_on_conc_update
  AFTER UPDATE ON concessionarias
  FOR EACH ROW
  EXECUTE FUNCTION sync_premises_from_concessionaria();