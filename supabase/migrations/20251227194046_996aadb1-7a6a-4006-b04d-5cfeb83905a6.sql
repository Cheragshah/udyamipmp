-- Drop the overly permissive policy that allows anyone to view app_settings (including API keys)
DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;

-- Create a new policy that only allows admins to view all app_settings (including sensitive API keys)
CREATE POLICY "Only admins can view app settings"
ON public.app_settings
FOR SELECT
USING (has_role(auth.uid(), 'admin'));