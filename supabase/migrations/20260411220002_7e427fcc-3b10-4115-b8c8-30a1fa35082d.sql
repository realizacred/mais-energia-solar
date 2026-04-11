-- Fix sm_proposal_id=1 stuck in infinite loop (already migrated but migrado_em never set)
UPDATE solar_market_proposals
SET migrado_em = NOW()
WHERE sm_proposal_id = 1
AND migrado_em IS NULL;