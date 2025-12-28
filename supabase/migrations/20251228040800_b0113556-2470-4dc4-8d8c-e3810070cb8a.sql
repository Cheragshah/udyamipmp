-- Add submission_notes column to documents table to store user-entered details
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS submission_notes text;