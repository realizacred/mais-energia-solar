-- Layout learning events: detected document layouts
CREATE TABLE IF NOT EXISTS public.invoice_layout_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text,
  concessionaria_code text NOT NULL,
  concessionaria_nome text NOT NULL DEFAULT '',
  source_invoice_id uuid REFERENCES public.unit_invoices(id) ON DELETE SET NULL,
  source_extraction_run_id uuid,
  layout_signature text NOT NULL,
  file_type text DEFAULT 'pdf',
  original_filename text,
  sample_storage_path text,
  sample_text_excerpt text,
  extraction_status text NOT NULL DEFAULT 'failed',
  parser_used text,
  parser_version text,
  required_fields_found_json jsonb DEFAULT '[]'::jsonb,
  required_fields_missing_json jsonb DEFAULT '[]'::jsonb,
  warnings_json jsonb DEFAULT '[]'::jsonb,
  errors_json jsonb DEFAULT '[]'::jsonb,
  raw_extraction_json jsonb,
  occurrences_count integer NOT NULL DEFAULT 1,
  learning_status text NOT NULL DEFAULT 'new',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_events_signature ON public.invoice_layout_learning_events (tenant_id, concessionaria_code, layout_signature);
CREATE INDEX IF NOT EXISTS idx_layout_events_status ON public.invoice_layout_learning_events (tenant_id, learning_status);

-- Layout learning rules: reusable extraction rules per layout
CREATE TABLE IF NOT EXISTS public.invoice_layout_learning_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text,
  concessionaria_code text NOT NULL,
  layout_signature text,
  rule_name text NOT NULL,
  field_name text NOT NULL,
  extraction_type text NOT NULL DEFAULT 'regex',
  pattern text NOT NULL,
  fallback_pattern text,
  priority_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  last_success_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_layout_rules_lookup ON public.invoice_layout_learning_rules (tenant_id, concessionaria_code, layout_signature, active) WHERE active = true;

ALTER TABLE public.invoice_layout_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_layout_learning_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for layout events" ON public.invoice_layout_learning_events FOR ALL TO authenticated USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text) WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text);

CREATE POLICY "Tenant isolation for layout rules" ON public.invoice_layout_learning_rules FOR ALL TO authenticated USING (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text) WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::text);