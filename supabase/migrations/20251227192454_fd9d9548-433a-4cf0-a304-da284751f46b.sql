-- Delete the inactive stage 6 (Document Verification) 
DELETE FROM journey_stages WHERE stage_order = 6;

-- Renumber remaining stages (7-11 become 6-10)
UPDATE journey_stages SET stage_order = 6 WHERE name = 'Special Session';
UPDATE journey_stages SET stage_order = 7 WHERE name = '32 Tasks';
UPDATE journey_stages SET stage_order = 8 WHERE name = 'OHM Offline Meet';
UPDATE journey_stages SET stage_order = 9 WHERE name = 'Udyami AI Access';
UPDATE journey_stages SET stage_order = 10 WHERE name = 'E-Commerce Setup';

-- Add notification settings columns to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_api_key TEXT,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT false;