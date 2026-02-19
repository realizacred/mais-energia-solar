
-- ═══════════════════════════════════════════════════════════
-- PARTE 1: wa_ops_events — Monitoramento operacional (append-only)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.wa_ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  instance_id uuid REFERENCES wa_instances(id),
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_ops_events_tenant_type ON wa_ops_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_wa_ops_events_created ON wa_ops_events(created_at DESC);

ALTER TABLE wa_ops_events ENABLE ROW LEVEL SECURITY;

-- Admin read-only (uses existing is_admin helper)
CREATE POLICY "wa_ops_events_select" ON wa_ops_events
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

-- No direct insert/update/delete from frontend; only service_role or SECURITY DEFINER
-- (Edge Functions use service_role)

-- ═══════════════════════════════════════════════════════════
-- PARTE 2: wa_internal_threads + wa_internal_messages
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.wa_internal_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id),
  title text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_internal_threads_conv ON wa_internal_threads(conversation_id);
CREATE INDEX idx_wa_internal_threads_tenant ON wa_internal_threads(tenant_id, created_at DESC);

ALTER TABLE wa_internal_threads ENABLE ROW LEVEL SECURITY;

-- Users who can access the conversation can see internal threads
CREATE POLICY "wa_internal_threads_select" ON wa_internal_threads
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "wa_internal_threads_insert" ON wa_internal_threads
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ) AND created_by = auth.uid());

CREATE POLICY "wa_internal_threads_update" ON wa_internal_threads
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

CREATE TABLE public.wa_internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  thread_id uuid NOT NULL REFERENCES wa_internal_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_internal_messages_thread ON wa_internal_messages(thread_id, created_at);
CREATE INDEX idx_wa_internal_messages_tenant ON wa_internal_messages(tenant_id);

ALTER TABLE wa_internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_internal_messages_select" ON wa_internal_messages
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "wa_internal_messages_insert" ON wa_internal_messages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ) AND sender_id = auth.uid());

-- No update/delete on internal messages (audit trail)

-- ═══════════════════════════════════════════════════════════
-- PARTE 3: wa_conversation_participants + wa_participant_events
-- ═══════════════════════════════════════════════════════════

CREATE TYPE public.wa_participant_role AS ENUM ('owner', 'collaborator', 'viewer');

CREATE TABLE public.wa_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role wa_participant_role NOT NULL DEFAULT 'viewer',
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_wa_conv_participants_conv ON wa_conversation_participants(conversation_id) WHERE is_active = true;
CREATE INDEX idx_wa_conv_participants_user ON wa_conversation_participants(user_id) WHERE is_active = true;
CREATE INDEX idx_wa_conv_participants_tenant ON wa_conversation_participants(tenant_id);

ALTER TABLE wa_conversation_participants ENABLE ROW LEVEL SECURITY;

-- Same-tenant users can see participants
CREATE POLICY "wa_conv_participants_select" ON wa_conversation_participants
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

-- Only admins or conversation owner can add participants
CREATE POLICY "wa_conv_participants_insert" ON wa_conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid())
    AND added_by = auth.uid()
  );

-- Only admins or the one who added can update (deactivate)
CREATE POLICY "wa_conv_participants_update" ON wa_conversation_participants
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

-- Audit trail for participant changes
CREATE TABLE public.wa_participant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN ('added', 'removed', 'role_changed')),
  role wa_participant_role,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_participant_events_conv ON wa_participant_events(conversation_id, created_at DESC);

ALTER TABLE wa_participant_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_participant_events_select" ON wa_participant_events
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "wa_participant_events_insert" ON wa_participant_events
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid())
    AND performed_by = auth.uid()
  );

-- No update/delete (immutable audit)

-- ═══════════════════════════════════════════════════════════
-- Triggers for updated_at
-- ═══════════════════════════════════════════════════════════

CREATE TRIGGER update_wa_internal_threads_updated_at
  BEFORE UPDATE ON wa_internal_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
