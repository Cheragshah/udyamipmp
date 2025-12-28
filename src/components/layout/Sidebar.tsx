import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationSettings } from '@/hooks/useNavigationSettings';
import { cn } from '@/lib/utils';
import { Settings, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function Sidebar() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const location = useLocation();
  const { links, loading } = useNavigationSettings(role);

  if (loading) {
    return (
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {t('sidebar.pmpJourney')}
            </h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-1">
              {[...Array(5)].map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-10 w-full rounded-lg" />
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            {t('sidebar.pmpJourney')}
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              const label = link.isCustom && link.customLabel ? link.customLabel : t(link.labelKey);

              // External links render as anchor tags
              if (link.isExternal) {
                return (
                  <li key={link.to}>
                    <a
                      href={link.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                        'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  </li>
                );
              }

              return (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    className={cn(
                      'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </NavLink>
                </li>
              );
            })}
          </ul>

          {/* Settings at bottom */}
          <div className="mt-auto">
            <NavLink
              to="/settings"
              className={cn(
                'group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                location.pathname === '/settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              {t('settings.profileSettings')}
            </NavLink>
          </div>
        </nav>
      </div>
    </aside>
  );
}
