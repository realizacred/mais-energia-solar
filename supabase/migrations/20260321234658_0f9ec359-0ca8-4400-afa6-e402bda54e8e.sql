-- Add unit_id to recebimentos for direct UC billing linkage
ALTER TABLE recebimentos
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units_consumidoras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recebimentos_unit ON recebimentos(unit_id);