-- Allow anon to read calculadora_config when accessed via a valid UC client token
CREATE POLICY "Anon can read tarifa via token context"
ON public.calculadora_config
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM public.uc_client_tokens t
    JOIN public.units_consumidoras u ON u.id = t.unit_id
    WHERE u.tenant_id = calculadora_config.tenant_id
      AND t.is_active = true
      AND (t.expires_at IS NULL OR t.expires_at > now())
  )
);