-- Remove user's ability to insert their own attendance (only admin/coach can)
DROP POLICY IF EXISTS "Users can insert their own attendance" ON public.attendance;

-- Allow admins to insert attendance for any user
CREATE POLICY "Admins can insert attendance for any user" 
ON public.attendance 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow coaches to insert attendance for assigned participants
CREATE POLICY "Coaches can insert attendance for assigned participants" 
ON public.attendance 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'coach'::app_role) AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = attendance.user_id 
    AND profiles.assigned_coach_id = auth.uid()
  )
);

-- Allow admins to update any attendance record
CREATE POLICY "Admins can update any attendance" 
ON public.attendance 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow coaches to update assigned participants attendance
CREATE POLICY "Coaches can update assigned participants attendance" 
ON public.attendance 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'coach'::app_role) AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = attendance.user_id 
    AND profiles.assigned_coach_id = auth.uid()
  )
);

-- Allow admins to delete attendance records
CREATE POLICY "Admins can delete attendance" 
ON public.attendance 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow coaches to delete assigned participants attendance
CREATE POLICY "Coaches can delete assigned participants attendance" 
ON public.attendance 
FOR DELETE 
USING (
  has_role(auth.uid(), 'coach'::app_role) AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = attendance.user_id 
    AND profiles.assigned_coach_id = auth.uid()
  )
);