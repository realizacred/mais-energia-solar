
-- Add tracking detail columns to proposta_views
ALTER TABLE proposta_views 
  ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS screen_width integer,
  ADD COLUMN IF NOT EXISTS session_id text;

-- Create proposal notifications table
CREATE TABLE IF NOT EXISTS public.proposal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  proposta_id uuid NOT NULL,
  view_id uuid REFERENCES proposta_views(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'view',
  titulo text NOT NULL,
  descricao text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast unread count
CREATE INDEX IF NOT EXISTS idx_proposal_notifications_unread 
  ON proposal_notifications (tenant_id, lida, created_at DESC) 
  WHERE lida = false;

CREATE INDEX IF NOT EXISTS idx_proposal_notifications_proposta 
  ON proposal_notifications (proposta_id, created_at DESC);

-- Enable RLS
ALTER TABLE proposal_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read their tenant's notifications
CREATE POLICY "Users can read own tenant notifications"
  ON proposal_notifications FOR SELECT TO authenticated
  USING (tenant_id = (SELECT t.id FROM tenants t INNER JOIN profiles p ON p.tenant_id = t.id WHERE p.id = auth.uid() LIMIT 1));

-- RLS: authenticated users can update (mark as read) their tenant's notifications
CREATE POLICY "Users can update own tenant notifications"
  ON proposal_notifications FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT t.id FROM tenants t INNER JOIN profiles p ON p.tenant_id = t.id WHERE p.id = auth.uid() LIMIT 1));

-- Trigger: auto-create notification when a view is inserted
CREATE OR REPLACE FUNCTION trg_proposta_view_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proposta_nome text;
  _device text;
BEGIN
  -- Get proposal name
  SELECT COALESCE(pn.titulo, pn.codigo, 'Proposta')
  INTO _proposta_nome
  FROM propostas_nativas pn
  WHERE pn.id = NEW.proposta_id
  LIMIT 1;

  _device := COALESCE(NEW.device_type, 'Desconhecido');

  INSERT INTO proposal_notifications (tenant_id, proposta_id, view_id, tipo, titulo, descricao)
  VALUES (
    NEW.tenant_id,
    NEW.proposta_id,
    NEW.id,
    'view',
    'Proposta visualizada',
    _proposta_nome || ' foi aberta em ' || _device
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proposta_view_notify ON proposta_views;
CREATE TRIGGER trg_proposta_view_notify
  AFTER INSERT ON proposta_views
  FOR EACH ROW
  EXECUTE FUNCTION trg_proposta_view_notify();
