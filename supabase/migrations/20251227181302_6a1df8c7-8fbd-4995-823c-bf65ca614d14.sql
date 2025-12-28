-- Add policy for admins to insert participant progress for any user
CREATE POLICY "Admins can insert participant progress"
ON public.participant_progress
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to update participant progress for any user
CREATE POLICY "Admins can update all progress"
ON public.participant_progress
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for coaches to update assigned participants progress
CREATE POLICY "Coaches can update assigned participants progress"
ON public.participant_progress
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = participant_progress.user_id
  AND profiles.assigned_coach_id = auth.uid()
));

-- Add policy for coaches to insert progress for assigned participants
CREATE POLICY "Coaches can insert assigned participants progress"
ON public.participant_progress
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = participant_progress.user_id
  AND profiles.assigned_coach_id = auth.uid()
));