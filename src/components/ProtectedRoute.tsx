import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sales/login" replace />;
  }

  // Force new invited users to set a password before they can use the app.
  const mustSetPassword = (user.user_metadata as any)?.must_set_password === true;
  const onSetupRoute = location.pathname.startsWith('/sales/set-password');
  if (mustSetPassword && !onSetupRoute) {
    return <Navigate to="/sales/set-password" replace />;
  }

  return <>{children}</>;
}
