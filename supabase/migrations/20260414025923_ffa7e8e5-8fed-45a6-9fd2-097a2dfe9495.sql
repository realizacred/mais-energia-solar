
-- Fix: Set "Comercial" pipeline as default (required by SM migration fallback)
UPDATE public.pipelines 
SET is_default = true 
WHERE id = '25e400dd-1726-46b8-825e-472af4a28b7d' 
  AND name = 'Comercial';
