-- Allow admins to DELETE irradiance data for purge operations
-- These are global (no tenant_id) tables managed by admins

CREATE POLICY "Admins can delete irradiance_points_monthly"
  ON public.irradiance_points_monthly
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete irradiance_dataset_versions"
  ON public.irradiance_dataset_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete irradiance_lookup_cache"
  ON public.irradiance_lookup_cache
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete solar_import_jobs"
  ON public.solar_import_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );