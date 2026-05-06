import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { Shield } from 'lucide-react';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { data: role, isLoading } = useCurrentRole();

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!role?.isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
