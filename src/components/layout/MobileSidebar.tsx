import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationSettings } from '@/hooks/useNavigationSettings';
import { cn } from '@/lib/utils';
import { Settings, ExternalLink } from 'lucide-react';
import { SheetClose } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

export function MobileSidebar() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const location = useLocation();
  const { links, loading } = useNavigationSettings(role);

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-card">
        <div className="flex h-16 shrink-0 items-center px-6 border-b">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            PMP Journey
          </h1>
        </div>
        <nav className="flex flex-1 flex-col p-4">
          <ul className="flex flex-1 flex-col gap-y-1">
            {[...Array(5)].map((_, i) => (
              <li key={i}>
                <Skeleton className="h-10 w-full rounded-lg" />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-6 border-b">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          PMP Journey
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col p-4">
        <ul className="flex flex-1 flex-col gap-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            const label = link.isCustom && link.customLabel ? link.customLabel : t(link.labelKey);

            // External links render as anchor tags
            if (link.isExternal) {
              return (
                <li key={link.to}>
                  <SheetClose asChild>
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
                  </SheetClose>
                </li>
              );
            }

            return (
              <li key={link.to}>
                <SheetClose asChild>
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
                </SheetClose>
              </li>
            );
          })}
        </ul>

        {/* Settings at bottom */}
        <div className="mt-auto">
          <SheetClose asChild>
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
              {t('sidebar.settings')}
            </NavLink>
          </SheetClose>
        </div>
      </nav>
    </div>
  );
}
