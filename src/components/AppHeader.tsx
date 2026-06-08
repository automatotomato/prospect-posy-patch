import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, LogOut, Sparkles, Sun, LayoutDashboard, MessageSquare, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { QuickEmailGenerator } from '@/components/QuickEmailGenerator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppHeaderProps {
  pendingCount?: number;
}

export function AppHeader({ pendingCount = 0 }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const { data: role } = useCurrentRole();
  const isAdmin = !!role?.isAdmin;
  const location = useLocation();
  const [quickEmailOpen, setQuickEmailOpen] = useState(false);

  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'AP';
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="hidden sm:block">
          <h1 className="font-display font-semibold text-lg leading-tight">Z &amp; C Consultants</h1>
          <p className="text-xs text-muted-foreground">Business Intelligence &amp; Process Automation</p>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-1 mr-2">
        <Button asChild variant={location.pathname === '/today' || location.pathname === '/' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5">
          <Link to="/today"><Sun className="w-4 h-4" />Today</Link>
        </Button>
        <Button asChild variant={location.pathname === '/pipeline' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5">
          <Link to="/pipeline"><LayoutDashboard className="w-4 h-4" />Pipeline</Link>
        </Button>
        {isAdmin && (
          <>
            <Button asChild variant={location.pathname === '/sms-templates' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5">
              <Link to="/sms-templates"><MessageSquare className="w-4 h-4" />SMS</Link>
            </Button>
            <Button asChild variant={location.pathname === '/team' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5">
              <Link to="/team"><Users className="w-4 h-4" />Team</Link>
            </Button>
          </>
        )}
      </nav>

      <div className="flex items-center gap-2">
        {role && (
          <Badge variant={isAdmin ? 'default' : 'secondary'} className="hidden sm:inline-flex">
            {isAdmin ? 'Admin' : 'Sales Rep'}
          </Badge>
        )}
        <Button
          variant="default"
          size="sm"
          onClick={() => setQuickEmailOpen(true)}
          className="gap-2 hidden sm:flex"
        >
          <Sparkles className="w-4 h-4" />
          Quick Compose
        </Button>
        <Button
          variant="default"
          size="icon"
          onClick={() => setQuickEmailOpen(true)}
          className="sm:hidden w-9 h-9"
        >
          <Sparkles className="w-4 h-4" />
        </Button>
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.user_metadata?.full_name || 'Team Member'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <QuickEmailGenerator
        open={quickEmailOpen}
        onOpenChange={setQuickEmailOpen}
      />
    </header>
  );
}
