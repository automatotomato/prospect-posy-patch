import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Phone, Target, CheckCircle2, Trophy } from 'lucide-react';
import { useTodayCallStats } from '@/hooks/useDailyActivity';

export function DailyGoalCard() {
  const { data: stats } = useTodayCallStats();
  const total = stats?.total ?? 0;
  const goal = stats?.goal ?? 50;
  const percent = stats?.percent ?? 0;
  const hit = total >= goal;

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <Target className="w-4 h-4" />
            Daily Call Goal
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">{total}</span>
            <span className="text-lg text-muted-foreground">/ {goal} calls</span>
            {hit && (
              <span className="ml-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-500">
                <Trophy className="w-4 h-4" /> Goal hit
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat icon={<Phone className="w-3.5 h-3.5" />} label="dialed" value={total} />
          <Stat icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="connected" value={stats?.connected ?? 0} cls="text-emerald-500" />
          <Stat icon={<Trophy className="w-3.5 h-3.5" />} label="meetings" value={stats?.meetings ?? 0} cls="text-primary" />
        </div>
      </div>
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-muted-foreground mt-2">
        {hit
          ? `Crushed it — ${total - goal} extra dial${total - goal === 1 ? '' : 's'} above goal.`
          : `${goal - total} more call${goal - total === 1 ? '' : 's'} to hit your daily minimum.`}
      </p>
    </Card>
  );
}

function Stat({ icon, label, value, cls = '' }: { icon: React.ReactNode; label: string; value: number; cls?: string }) {
  return (
    <div className="min-w-[60px]">
      <div className={`flex items-center justify-center gap-1 text-xs ${cls || 'text-muted-foreground'}`}>
        {icon}
        <span className="font-semibold tabular-nums text-base text-foreground">{value}</span>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
