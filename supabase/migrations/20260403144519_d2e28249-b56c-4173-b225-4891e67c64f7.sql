CREATE POLICY "Authenticated users can delete SM sync logs"
ON public.solar_market_sync_logs
FOR DELETE
TO authenticated
USING (
  tenant_id = (
    SELECT p.tenant_id
    FROM profiles p
    WHERE p.user_id = auth.uid()
  )
);