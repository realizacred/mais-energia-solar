
-- ═══════════════════════════════════════════════════════════
-- Post-Sale Reports table + Storage policies (idempotent)
-- ═══════════════════════════════════════════════════════════

-- 1) Table: post_sale_reports
CREATE TABLE IF NOT EXISTS public.post_sale_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT get_user_tenant_id(),
  visit_id uuid NOT NULL REFERENCES public.post_sale_visits(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for post_sale_reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_sale_reports' AND policyname='ps_reports_select') THEN
    CREATE POLICY ps_reports_select ON public.post_sale_reports FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_sale_reports' AND policyname='ps_reports_insert') THEN
    CREATE POLICY ps_reports_insert ON public.post_sale_reports FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_sale_reports' AND policyname='ps_reports_delete') THEN
    CREATE POLICY ps_reports_delete ON public.post_sale_reports FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());
  END IF;
END $$;

-- 2) Storage bucket: post_sale_reports (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post_sale_reports', 'post_sale_reports', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage RLS policies for both buckets
DO $$ BEGIN
  -- post_sale_attachments bucket
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_attach_insert') THEN
    CREATE POLICY ps_attach_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'post_sale_attachments' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_attach_select') THEN
    CREATE POLICY ps_attach_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'post_sale_attachments' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_attach_delete') THEN
    CREATE POLICY ps_attach_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'post_sale_attachments' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;

  -- post_sale_reports bucket
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_reports_storage_insert') THEN
    CREATE POLICY ps_reports_storage_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'post_sale_reports' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_reports_storage_select') THEN
    CREATE POLICY ps_reports_storage_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'post_sale_reports' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='ps_reports_storage_delete') THEN
    CREATE POLICY ps_reports_storage_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'post_sale_reports' AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text));
  END IF;
END $$;
