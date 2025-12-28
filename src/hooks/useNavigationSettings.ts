import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/database';
import {
  LayoutDashboard,
  Route,
  CheckSquare,
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  Users,
  Shield,
  Store,
  DollarSign,
  Link as LinkIcon,
  ExternalLink,
  BookOpen,
  Video,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Gift,
  Award,
  Target,
} from 'lucide-react';

interface NavigationSetting {
  page_path: string;
  label_key: string;
  icon_name: string;
  is_visible: boolean;
  is_default: boolean;
  display_order: number;
  is_custom: boolean;
  custom_label: string | null;
  is_external: boolean;
}

export interface NavigationLink {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  isCustom?: boolean;
  customLabel?: string;
  isExternal?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Route,
  CheckSquare,
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  Users,
  Shield,
  Store,
  DollarSign,
  LinkIcon,
  ExternalLink,
  BookOpen,
  Video,
  MessageSquare,
  HelpCircle,
  Megaphone,
  Gift,
  Award,
  Target,
};

// Fallback navigation for when DB is not available
const fallbackNavigation: Record<AppRole, NavigationLink[]> = {
  participant: [
    { to: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
    { to: '/journey', labelKey: 'sidebar.myJourney', icon: Route },
    { to: '/tasks', labelKey: 'sidebar.tasks', icon: CheckSquare },
    { to: '/documents', labelKey: 'sidebar.documents', icon: FileText },
    { to: '/attendance', labelKey: 'sidebar.attendance', icon: Calendar },
    { to: '/trades', labelKey: 'sidebar.tradeUpdates', icon: TrendingUp },
  ],
  coach: [
    { to: '/coach', labelKey: 'sidebar.verification', icon: CheckSquare },
    { to: '/analytics', labelKey: 'sidebar.analytics', icon: BarChart3 },
  ],
  admin: [
    { to: '/journey', labelKey: 'sidebar.myJourney', icon: Route },
    { to: '/tasks', labelKey: 'sidebar.tasks', icon: CheckSquare },
    { to: '/documents', labelKey: 'sidebar.documents', icon: FileText },
    { to: '/attendance', labelKey: 'sidebar.attendance', icon: Calendar },
    { to: '/trades', labelKey: 'sidebar.tradeUpdates', icon: TrendingUp },
    { to: '/coach', labelKey: 'sidebar.verification', icon: Users },
    { to: '/ecommerce', labelKey: 'sidebar.ecommerce', icon: Store },
    { to: '/finance', labelKey: 'sidebar.finance', icon: DollarSign },
    { to: '/analytics', labelKey: 'sidebar.analytics', icon: BarChart3 },
    { to: '/admin', labelKey: 'sidebar.adminPanel', icon: Shield },
  ],
  ecommerce: [
    { to: '/ecommerce', labelKey: 'sidebar.ecommerce', icon: Store },
  ],
  finance: [
    { to: '/finance', labelKey: 'sidebar.finance', icon: DollarSign },
  ],
};

const fallbackDefaultPage: Record<AppRole, string> = {
  participant: '/dashboard',
  coach: '/coach',
  admin: '/journey',
  ecommerce: '/ecommerce',
  finance: '/finance',
};

export function useNavigationSettings(role: AppRole | null) {
  const [links, setLinks] = useState<NavigationLink[]>([]);
  const [defaultPage, setDefaultPage] = useState<string>('/dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        // Fetch visible navigation links
        const { data: visibleData, error: visibleError } = await supabase
          .from('role_navigation_settings')
          .select('page_path, label_key, icon_name, is_visible, is_default, display_order, is_custom, custom_label, is_external')
          .eq('role', role)
          .eq('is_visible', true)
          .order('display_order', { ascending: true });

        // Fetch the default page separately (it might not be visible)
        const { data: defaultData, error: defaultError } = await supabase
          .from('role_navigation_settings')
          .select('page_path, is_external')
          .eq('role', role)
          .eq('is_default', true)
          .eq('is_external', false)
          .limit(1)
          .single();

        if (visibleError) throw visibleError;

        if (visibleData && visibleData.length > 0) {
          const navLinks: NavigationLink[] = (visibleData as NavigationSetting[]).map(setting => ({
            to: setting.page_path,
            labelKey: setting.label_key,
            icon: iconMap[setting.icon_name] || LayoutDashboard,
            isCustom: setting.is_custom,
            customLabel: setting.custom_label || undefined,
            isExternal: setting.is_external,
          }));

          setLinks(navLinks);

          // Use the default page from the dedicated query
          if (defaultData && !defaultError) {
            setDefaultPage(defaultData.page_path);
          } else {
            // Fallback: find first non-external visible link
            const firstInternal = navLinks.find(l => !l.isExternal);
            if (firstInternal) {
              setDefaultPage(firstInternal.to);
            } else {
              setDefaultPage(fallbackDefaultPage[role] || '/dashboard');
            }
          }
        } else {
          // Use fallback if no settings in DB
          setLinks(fallbackNavigation[role] || []);
          setDefaultPage(fallbackDefaultPage[role] || '/dashboard');
        }
      } catch (error) {
        console.error('Error fetching navigation settings:', error);
        // Use fallback on error
        setLinks(fallbackNavigation[role] || []);
        setDefaultPage(fallbackDefaultPage[role] || '/dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [role]);

  return { links, defaultPage, loading };
}
