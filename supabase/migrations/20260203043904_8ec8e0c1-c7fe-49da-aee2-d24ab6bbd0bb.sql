-- Add 'visto' (seen/verified) column to leads table
ALTER TABLE public.leads ADD COLUMN visto boolean NOT NULL DEFAULT false;