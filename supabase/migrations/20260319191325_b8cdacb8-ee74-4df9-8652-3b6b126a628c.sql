
-- Add FK constraint on monitor_plants.client_id → clientes.id
ALTER TABLE public.monitor_plants
  ADD CONSTRAINT monitor_plants_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clientes(id)
  ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_monitor_plants_client_id ON public.monitor_plants(client_id);
