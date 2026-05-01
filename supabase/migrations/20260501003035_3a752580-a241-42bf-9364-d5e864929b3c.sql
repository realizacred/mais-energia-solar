UPDATE public.deals
SET pipeline_id = 'bda9bfe3-015d-4b06-adfc-820fca13777e',
    stage_id   = 'ac2f7778-feb5-45b5-8514-343a81838c63'
WHERE id IN ('31deca82-1d82-4032-a99f-defef672c1ef', '44efe491-fc6a-4fc9-90cf-204e62acc705')
  AND pipeline_id = '4c1c757b-b9e0-441d-97af-197aa7a5409b';