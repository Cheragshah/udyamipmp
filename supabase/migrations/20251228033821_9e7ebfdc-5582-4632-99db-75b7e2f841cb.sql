-- Add is_custom and custom_label columns to role_navigation_settings
ALTER TABLE public.role_navigation_settings 
ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN custom_label TEXT,
ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT false;