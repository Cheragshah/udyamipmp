-- Add missing RLS policy for admins to update trades
CREATE POLICY "Admins can update all trades"
ON public.trades
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));