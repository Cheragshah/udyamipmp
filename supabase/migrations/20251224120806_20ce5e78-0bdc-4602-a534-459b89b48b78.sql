-- Create enrollment_submissions table for enrollment workflow
CREATE TABLE public.enrollment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  address text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  date_of_birth date NOT NULL,
  notes text,
  attachment_url text,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enrollment_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view their own enrollment submissions"
ON public.enrollment_submissions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own submissions
CREATE POLICY "Users can insert their own enrollment submissions"
ON public.enrollment_submissions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own submissions (to update status to documents_sent_to_office)
CREATE POLICY "Users can update their own enrollment submissions"
ON public.enrollment_submissions
FOR UPDATE
USING (auth.uid() = user_id);

-- Coaches can view assigned participants' submissions
CREATE POLICY "Coaches can view assigned participants enrollment submissions"
ON public.enrollment_submissions
FOR SELECT
USING (
  has_role(auth.uid(), 'coach') AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = enrollment_submissions.user_id
    AND profiles.assigned_coach_id = auth.uid()
  )
);

-- Coaches can update assigned participants' submissions
CREATE POLICY "Coaches can update assigned participants enrollment submissions"
ON public.enrollment_submissions
FOR UPDATE
USING (
  has_role(auth.uid(), 'coach') AND 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = enrollment_submissions.user_id
    AND profiles.assigned_coach_id = auth.uid()
  )
);

-- Admins can view all submissions
CREATE POLICY "Admins can view all enrollment submissions"
ON public.enrollment_submissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all submissions
CREATE POLICY "Admins can update all enrollment submissions"
ON public.enrollment_submissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_enrollment_submissions_updated_at
BEFORE UPDATE ON public.enrollment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();