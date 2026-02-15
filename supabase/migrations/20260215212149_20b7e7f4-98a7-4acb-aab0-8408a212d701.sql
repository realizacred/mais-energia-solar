
-- Trigger: when concessionaria tariff data is updated, propagate to all tenant_premises linked to it
CREATE OR REPLACE FUNCTION public.sync_concessionaria_to_premises()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if relevant tariff fields changed
  IF (
    OLD.tarifa_energia IS DISTINCT FROM NEW.tarifa_energia OR
    OLD.tarifa_fio_b IS DISTINCT FROM NEW.tarifa_fio_b OR
    OLD.aliquota_icms IS DISTINCT FROM NEW.aliquota_icms
  ) THEN
    UPDATE public.tenant_premises
    SET
      tarifa = COALESCE(NEW.tarifa_energia, tarifa),
      tusd_fio_b_bt = COALESCE(NEW.tarifa_fio_b, tusd_fio_b_bt),
      imposto_energia = COALESCE(NEW.aliquota_icms, imposto_energia),
      updated_at = now()
    WHERE concessionaria_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_concessionaria_to_premises ON public.concessionarias;
CREATE TRIGGER trg_sync_concessionaria_to_premises
  AFTER UPDATE ON public.concessionarias
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_concessionaria_to_premises();
