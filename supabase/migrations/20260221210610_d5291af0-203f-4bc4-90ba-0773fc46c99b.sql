
-- Seed pricing_config with column defaults for the active tenant
INSERT INTO public.pricing_config (tenant_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Seed proposta_config with column defaults for the active tenant
INSERT INTO public.proposta_config (tenant_id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;
