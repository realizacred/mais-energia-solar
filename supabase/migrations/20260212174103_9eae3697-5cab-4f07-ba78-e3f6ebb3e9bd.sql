
-- 1) Drop duplicate SELECT policy
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.push_subscriptions;

-- 2) Add tenant_id to push_sent_log for auditability
ALTER TABLE public.push_sent_log ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- 3) Index for future cleanup queries by tenant
CREATE INDEX idx_push_sent_log_tenant ON public.push_sent_log(tenant_id, sent_at);
