import { Users, Mail, BarChart3, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingCount?: number;
}

export function MobileNav({ activeTab, onTabChange, pendingCount = 0 }: MobileNavProps) {
  const tabs = [
    { id: 'leads', icon: Users, label: 'Leads' },
    { id: 'emails', icon: Mail, label: 'Emails', badge: pendingCount },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'settings', icon: Settings2, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border px-2 pb-safe md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]",
              activeTab === tab.id ? "text-primary" : "text-muted-foreground"
            )}
          >
            <tab.icon className={cn(
              "w-5 h-5 transition-transform",
              activeTab === tab.id && "scale-110"
            )} />
            <span className="text-[10px] font-medium">{tab.label}</span>
            {tab.badge && tab.badge > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-medium rounded-full flex items-center justify-center">
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
