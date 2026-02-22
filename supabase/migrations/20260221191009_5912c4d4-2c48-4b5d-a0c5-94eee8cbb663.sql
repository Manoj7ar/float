
-- Add currency column to accounts
ALTER TABLE public.accounts ADD COLUMN currency text NOT NULL DEFAULT 'EUR';
