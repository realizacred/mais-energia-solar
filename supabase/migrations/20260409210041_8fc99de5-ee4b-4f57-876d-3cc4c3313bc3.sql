-- Step 1: Fix Escritório trailing space
UPDATE public.consultores 
SET nome = 'Escritório' 
WHERE id = '67153740-7b73-406a-83e8-41ce8d9e456d' AND nome != 'Escritório';

-- Step 2: Reassign deals from Ricardo → Escritório
UPDATE public.deals 
SET owner_id = '67153740-7b73-406a-83e8-41ce8d9e456d'
WHERE owner_id = 'c29d032d-db93-4994-b93f-7b2cab7fb8eb';

-- Step 3: Reassign deals from Rogerio → Escritório
UPDATE public.deals 
SET owner_id = '67153740-7b73-406a-83e8-41ce8d9e456d'
WHERE owner_id = '69afb307-1d3c-4793-8766-0a95da221d84';

-- Step 4: Update kanban projection
UPDATE public.deal_kanban_projection 
SET owner_id = '67153740-7b73-406a-83e8-41ce8d9e456d',
    owner_name = 'Escritório'
WHERE owner_id IN ('c29d032d-db93-4994-b93f-7b2cab7fb8eb', '69afb307-1d3c-4793-8766-0a95da221d84');

-- Step 5: Deactivate ghost consultants
UPDATE public.consultores 
SET ativo = false 
WHERE id IN ('c29d032d-db93-4994-b93f-7b2cab7fb8eb', '69afb307-1d3c-4793-8766-0a95da221d84');