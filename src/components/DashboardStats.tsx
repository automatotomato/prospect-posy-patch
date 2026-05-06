import { Card } from '@/components/ui/card';
import { Prospect } from '@/types/prospect';
import { Users, Clock, CheckCircle2, AlertCircle, TrendingUp, FileCheck, BarChart3, Target } from 'lucide-react';
import { isToday, isThisWeek, isBefore, startOfDay } from 'date-fns';

interface DashboardStatsProps {
  prospects: Prospect[];
}

export function DashboardStats({ prospects }: DashboardStatsProps) {
  const now = new Date();
  const today = startOfDay(now);
  
  // Basic counts
  const newLeads = prospects.filter(p => p.status === 'new').length;
  const todayFollowUps = prospects.filter(p => 
    p.nextFollowUp && isToday(p.nextFollowUp)
  ).length;
  const overdueCount = prospects.filter(p => 
    p.nextFollowUp && isBefore(p.nextFollowUp, today) && !['closed'].includes(p.status)
  ).length;
  const inQuoting = prospects.filter(p => p.movedToQuoting).length;

  // Conversion metrics
  const closedWon = prospects.filter(p => p.status === 'closed').length;
  const totalLeads = prospects.length;
  const conversionRate = totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0;

  // This week's activity
  const leadsThisWeek = prospects.filter(p => isThisWeek(new Date(p.createdAt))).length;
  
  // Pipeline by status
  const contacted = prospects.filter(p => p.status === 'contacted').length;
  const qualified = prospects.filter(p => p.status === 'qualified').length;
  const quoted = prospects.filter(p => p.status === 'quoted').length;

  // Follow-up completion rate
  const completedTasks = prospects.reduce((acc, p) => 
    acc + p.tasks.filter(t => t.completed).length, 0
  );
  const totalTasks = prospects.reduce((acc, p) => acc + p.tasks.length, 0);
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const primaryStats = [
    {
      label: 'New Leads',
      value: newLeads,
      icon: Users,
      color: 'text-status-new',
      bgColor: 'bg-[hsl(var(--status-new)/0.1)]',
    },
    {
      label: "Today's Follow-ups",
      value: todayFollowUps,
      icon: Clock,
      color: 'text-status-contacted',
      bgColor: 'bg-[hsl(var(--status-contacted)/0.1)]',
    },
    {
      label: 'Overdue',
      value: overdueCount,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'In Quoting',
      value: inQuoting,
      icon: FileCheck,
      color: 'text-status-quoted',
      bgColor: 'bg-[hsl(var(--status-quoted)/0.1)]',
    },
  ];

  const secondaryStats = [
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      subtext: `${closedWon} of ${totalLeads} leads`,
      icon: Target,
      color: 'text-status-closed',
    },
    {
      label: 'This Week',
      value: leadsThisWeek,
      subtext: 'new leads added',
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      label: 'Task Completion',
      value: `${taskCompletionRate}%`,
      subtext: `${completedTasks} of ${totalTasks} tasks`,
      icon: CheckCircle2,
      color: 'text-status-qualified',
    },
    {
      label: 'Pipeline',
      value: contacted + qualified + quoted,
      subtext: 'active prospects',
      icon: BarChart3,
      color: 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryStats.map((stat) => (
          <Card key={stat.label} className="p-4 border-border/60">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {secondaryStats.map((stat) => (
          <Card key={stat.label} className="p-3 border-border/40 bg-muted/30">
            <div className="flex items-start gap-2.5">
              <stat.icon className={`w-4 h-4 mt-0.5 ${stat.color}`} />
              <div>
                <p className="text-lg font-display font-semibold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.subtext}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
