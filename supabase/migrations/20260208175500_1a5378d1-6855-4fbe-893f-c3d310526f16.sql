
-- 1. Add super_admin role (must be in its own transaction - will be committed by this migration)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
