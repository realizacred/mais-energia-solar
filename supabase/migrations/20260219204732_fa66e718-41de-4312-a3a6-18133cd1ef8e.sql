
-- ============================================================
-- P0: Normalize Brazilian phone numbers in wa_conversations
-- P1: Add optimistic lock version for transfers
-- P2: Add normalized phone for cross-instance visual merge
-- ============================================================

-- 1) Function to normalize BR phone numbers to canonical E.164 format
-- Ensures the 9th digit is present for mobile numbers (55 + DDD + 9 + 8 digits = 13 digits)
CREATE OR REPLACE FUNCTION public.normalize_br_phone(phone text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  digits text;
BEGIN
  IF phone IS NULL THEN RETURN NULL; END IF;
  -- Strip everything except digits
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  -- Remove @s.whatsapp.net suffix if present in raw input
  digits := replace(digits, 's', '');
  
  -- Brazilian mobile: 55 + 2-digit DDD + 8 or 9 digits
  IF digits LIKE '55%' AND length(digits) = 12 THEN
    -- Missing 9th digit: 55 + DD + 8digits → add 9
    digits := substring(digits from 1 for 4) || '9' || substring(digits from 5);
  END IF;
  
  RETURN digits;
END;
$$;

-- 2) Add version column for optimistic locking on transfers
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 3) Add telefone_normalized for cross-instance merge visual
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS telefone_normalized text;

-- 4) Backfill telefone_normalized for existing conversations
UPDATE public.wa_conversations
SET telefone_normalized = normalize_br_phone(cliente_telefone)
WHERE telefone_normalized IS NULL;

-- 5) Create index for cross-instance merge lookups
CREATE INDEX IF NOT EXISTS idx_wa_conv_telefone_normalized
  ON public.wa_conversations (tenant_id, telefone_normalized)
  WHERE telefone_normalized IS NOT NULL AND is_group = false;

-- 6) Trigger to auto-normalize on insert/update
CREATE OR REPLACE FUNCTION public.trg_normalize_wa_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.telefone_normalized := normalize_br_phone(NEW.cliente_telefone);
  -- Auto-increment version on update
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_conversations_normalize_phone ON public.wa_conversations;
CREATE TRIGGER trg_wa_conversations_normalize_phone
  BEFORE INSERT OR UPDATE ON public.wa_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_normalize_wa_phone();
