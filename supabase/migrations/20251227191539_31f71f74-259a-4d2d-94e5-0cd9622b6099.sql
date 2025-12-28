-- Deactivate Stage 6 (Document Verification) - merging into Stage 5
UPDATE journey_stages SET is_active = false WHERE stage_order = 6;

-- Create ecommerce_setups table
CREATE TABLE public.ecommerce_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_name TEXT,
  store_url TEXT,
  platform TEXT,
  store_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ecommerce_setups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ecommerce_setups
CREATE POLICY "Admins can manage all ecommerce setups"
ON public.ecommerce_setups FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Ecommerce team can manage all ecommerce setups"
ON public.ecommerce_setups FOR ALL
USING (has_role(auth.uid(), 'ecommerce'));

CREATE POLICY "Coaches can manage assigned users ecommerce setups"
ON public.ecommerce_setups FOR ALL
USING (
  has_role(auth.uid(), 'coach') AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = ecommerce_setups.user_id 
    AND profiles.assigned_coach_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own ecommerce setups"
ON public.ecommerce_setups FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ecommerce_setups_updated_at
BEFORE UPDATE ON public.ecommerce_setups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Finance team RLS policies for participant_progress
CREATE POLICY "Finance team can view all participant progress"
ON public.participant_progress FOR SELECT
USING (has_role(auth.uid(), 'finance'));

CREATE POLICY "Finance team can update participant progress"
ON public.participant_progress FOR UPDATE
USING (has_role(auth.uid(), 'finance'));

CREATE POLICY "Finance team can insert participant progress"
ON public.participant_progress FOR INSERT
WITH CHECK (has_role(auth.uid(), 'finance'));

-- Ecommerce team can view/update participant progress
CREATE POLICY "Ecommerce team can view participant progress"
ON public.participant_progress FOR SELECT
USING (has_role(auth.uid(), 'ecommerce'));

CREATE POLICY "Ecommerce team can update participant progress"
ON public.participant_progress FOR UPDATE
USING (has_role(auth.uid(), 'ecommerce'));

-- Allow coaches to insert enrollment for assigned users
CREATE POLICY "Coaches can insert enrollment for assigned users"
ON public.enrollment_submissions FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'coach') AND
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = enrollment_submissions.user_id 
    AND profiles.assigned_coach_id = auth.uid()
  )
);