-- Remove API key columns from app_settings table
-- API keys should be stored as server-side secrets, not in the database
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS resend_api_key;
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS whatsapp_api_key;