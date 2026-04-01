ALTER TABLE tenant_premises
  ADD COLUMN IF NOT EXISTS wa_notif_pagamento boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS wa_notif_quitado boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS wa_notif_numero text;