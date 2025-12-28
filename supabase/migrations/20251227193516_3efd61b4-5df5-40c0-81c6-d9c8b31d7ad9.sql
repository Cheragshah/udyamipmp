-- Finance can view all profiles
CREATE POLICY "Finance can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'finance'));

-- E-Commerce can view all profiles
CREATE POLICY "Ecommerce can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'ecommerce'));

-- Coaches can insert documents for assigned participants
CREATE POLICY "Coaches can insert documents for assigned participants"
ON public.documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = documents.user_id AND profiles.assigned_coach_id = auth.uid()
));

-- Coaches can delete documents for assigned participants
CREATE POLICY "Coaches can delete documents for assigned participants"
ON public.documents FOR DELETE
USING (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = documents.user_id AND profiles.assigned_coach_id = auth.uid()
));

-- Coaches can update trades for assigned participants (approve/reject)
CREATE POLICY "Coaches can update assigned participants trades"
ON public.trades FOR UPDATE
USING (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = trades.user_id AND profiles.assigned_coach_id = auth.uid()
));

-- Coaches can insert task submissions for assigned participants
CREATE POLICY "Coaches can insert task submissions for assigned participants"
ON public.task_submissions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = task_submissions.user_id AND profiles.assigned_coach_id = auth.uid()
));

-- Coaches can delete task submissions for assigned participants
CREATE POLICY "Coaches can delete task submissions for assigned participants"
ON public.task_submissions FOR DELETE
USING (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = task_submissions.user_id AND profiles.assigned_coach_id = auth.uid()
));

-- Coaches can delete participant progress for assigned participants
CREATE POLICY "Coaches can delete assigned participants progress"
ON public.participant_progress FOR DELETE
USING (has_role(auth.uid(), 'coach') AND EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = participant_progress.user_id AND profiles.assigned_coach_id = auth.uid()
));