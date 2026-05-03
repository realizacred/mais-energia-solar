
DO $$ BEGIN
  CREATE TYPE public.equipment_image_category AS ENUM ('modulo', 'inversor', 'stringbox', 'cabo', 'estrutura', 'otimizador', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tenant_equipment_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category public.equipment_image_category NOT NULL,
  fabricante TEXT,
  modelo TEXT,
  label TEXT,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_equipment_images_tenant_cat
  ON public.tenant_equipment_images (tenant_id, category, ordem);

ALTER TABLE public.tenant_equipment_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant view equipment images" ON public.tenant_equipment_images;
CREATE POLICY "tenant view equipment images"
  ON public.tenant_equipment_images FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant insert equipment images" ON public.tenant_equipment_images;
CREATE POLICY "tenant insert equipment images"
  ON public.tenant_equipment_images FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant update equipment images" ON public.tenant_equipment_images;
CREATE POLICY "tenant update equipment images"
  ON public.tenant_equipment_images FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant delete equipment images" ON public.tenant_equipment_images;
CREATE POLICY "tenant delete equipment images"
  ON public.tenant_equipment_images FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_tenant_equipment_images_updated_at ON public.tenant_equipment_images;
CREATE TRIGGER trg_tenant_equipment_images_updated_at
  BEFORE UPDATE ON public.tenant_equipment_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Equipment images publicly readable" ON storage.objects;
CREATE POLICY "Equipment images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'equipment-images');

DROP POLICY IF EXISTS "Tenant can upload equipment images" ON storage.objects;
CREATE POLICY "Tenant can upload equipment images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'equipment-images'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "Tenant can update equipment images" ON storage.objects;
CREATE POLICY "Tenant can update equipment images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'equipment-images'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

DROP POLICY IF EXISTS "Tenant can delete equipment images" ON storage.objects;
CREATE POLICY "Tenant can delete equipment images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'equipment-images'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
