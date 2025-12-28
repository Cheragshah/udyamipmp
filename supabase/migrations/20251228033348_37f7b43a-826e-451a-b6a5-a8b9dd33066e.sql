-- Create role_navigation_settings table to store which pages each role can see
CREATE TABLE public.role_navigation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  page_path TEXT NOT NULL,
  label_key TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, page_path)
);

-- Enable RLS
ALTER TABLE public.role_navigation_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage navigation settings
CREATE POLICY "Admins can manage navigation settings"
ON public.role_navigation_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view navigation settings (needed for sidebar rendering)
CREATE POLICY "Authenticated users can view navigation settings"
ON public.role_navigation_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_role_navigation_settings_updated_at
BEFORE UPDATE ON public.role_navigation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings for all roles
-- Participant pages
INSERT INTO public.role_navigation_settings (role, page_path, label_key, icon_name, is_visible, is_default, display_order) VALUES
('participant', '/dashboard', 'sidebar.dashboard', 'LayoutDashboard', true, true, 1),
('participant', '/journey', 'sidebar.myJourney', 'Route', true, false, 2),
('participant', '/tasks', 'sidebar.tasks', 'CheckSquare', true, false, 3),
('participant', '/documents', 'sidebar.documents', 'FileText', true, false, 4),
('participant', '/attendance', 'sidebar.attendance', 'Calendar', true, false, 5),
('participant', '/trades', 'sidebar.tradeUpdates', 'TrendingUp', true, false, 6);

-- Coach pages
INSERT INTO public.role_navigation_settings (role, page_path, label_key, icon_name, is_visible, is_default, display_order) VALUES
('coach', '/coach', 'sidebar.verification', 'CheckSquare', true, true, 1),
('coach', '/analytics', 'sidebar.analytics', 'BarChart3', true, false, 2);

-- Admin pages
INSERT INTO public.role_navigation_settings (role, page_path, label_key, icon_name, is_visible, is_default, display_order) VALUES
('admin', '/journey', 'sidebar.myJourney', 'Route', true, true, 1),
('admin', '/tasks', 'sidebar.tasks', 'CheckSquare', true, false, 2),
('admin', '/documents', 'sidebar.documents', 'FileText', true, false, 3),
('admin', '/attendance', 'sidebar.attendance', 'Calendar', true, false, 4),
('admin', '/trades', 'sidebar.tradeUpdates', 'TrendingUp', true, false, 5),
('admin', '/coach', 'sidebar.verification', 'Users', true, false, 6),
('admin', '/ecommerce', 'sidebar.ecommerce', 'Store', true, false, 7),
('admin', '/finance', 'sidebar.finance', 'DollarSign', true, false, 8),
('admin', '/analytics', 'sidebar.analytics', 'BarChart3', true, false, 9),
('admin', '/admin', 'sidebar.adminPanel', 'Shield', true, false, 10);

-- E-commerce pages
INSERT INTO public.role_navigation_settings (role, page_path, label_key, icon_name, is_visible, is_default, display_order) VALUES
('ecommerce', '/ecommerce', 'sidebar.ecommerce', 'Store', true, true, 1);

-- Finance pages
INSERT INTO public.role_navigation_settings (role, page_path, label_key, icon_name, is_visible, is_default, display_order) VALUES
('finance', '/finance', 'sidebar.finance', 'DollarSign', true, true, 1);