-- Add attachment_url column to task_submissions
ALTER TABLE public.task_submissions 
ADD COLUMN attachment_url TEXT DEFAULT NULL;

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own task attachments
CREATE POLICY "Users can upload their own task attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own attachments
CREATE POLICY "Users can view their own task attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own attachments
CREATE POLICY "Users can update their own task attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'task-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete their own task attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'task-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow coaches to view attachments of their assigned participants
CREATE POLICY "Coaches can view participant task attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-attachments' 
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id::text = (storage.foldername(name))[1]
    AND profiles.assigned_coach_id = auth.uid()
  )
);

-- Allow admins to view all task attachments
CREATE POLICY "Admins can view all task attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-attachments' 
  AND public.has_role(auth.uid(), 'admin')
);