
-- proposal_events: Event sourcing for proposal lifecycle
CREATE TABLE public.proposal_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposta_id UUID NOT NULL REFERENCES public.propostas_nativas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID NOT NULL DEFAULT (public.current_tenant_id()) REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_proposal_events_proposta ON public.proposal_events(proposta_id);
CREATE INDEX idx_proposal_events_tenant ON public.proposal_events(tenant_id);
CREATE INDEX idx_proposal_events_tipo ON public.proposal_events(tipo);

-- Unique index for idempotency on transitions
CREATE UNIQUE INDEX idx_proposal_events_idempotent_transition 
  ON public.proposal_events(proposta_id, tipo) 
  WHERE tipo IN ('aceita', 'recusada', 'cancelada');

-- RLS
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.proposal_events
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Comment
COMMENT ON TABLE public.proposal_events IS 'Event log for proposal lifecycle transitions and actions';
