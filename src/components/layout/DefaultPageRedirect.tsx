import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationSettings } from '@/hooks/useNavigationSettings';
import { Loader2 } from 'lucide-react';

export function DefaultPageRedirect() {
  const { role, isLoading: authLoading } = useAuth();
  const { defaultPage, loading: navLoading } = useNavigationSettings(role);

  if (authLoading || navLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <Navigate to={defaultPage} replace />;
}
