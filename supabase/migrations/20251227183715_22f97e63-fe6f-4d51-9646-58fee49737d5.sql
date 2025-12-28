-- Add is_completed column to special_session_links
ALTER TABLE public.special_session_links 
ADD COLUMN is_completed boolean DEFAULT false;