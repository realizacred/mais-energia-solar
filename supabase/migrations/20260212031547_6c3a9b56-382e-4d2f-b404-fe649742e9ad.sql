-- Add settings JSONB column to profiles for UI preferences (sidebar, etc.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.settings IS 'User UI preferences: sidebar favorites, section order, collapsed sections. Synced from frontend with localStorage fallback.';
