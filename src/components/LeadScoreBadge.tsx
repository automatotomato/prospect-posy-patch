import { Flame, ThermometerSun, Snowflake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ScoreBreakdown } from '@/types/prospect';

interface LeadScoreBadgeProps {
  score?: number;
  breakdown?: ScoreBreakdown;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function LeadScoreBadge({ score, breakdown, size = 'sm', showLabel = false, className }: LeadScoreBadgeProps) {
  if (score === undefined || score === null) return null;

  const bucket: 'hot' | 'warm' | 'cold' =
    breakdown?.bucket ?? (score >= 70 ? 'hot' : score >= 40 ? 'warm' : 'cold');

  const config = {
    hot:  { Icon: Flame,         label: 'Hot',  cls: 'bg-destructive/10 text-destructive border-destructive/30' },
    warm: { Icon: ThermometerSun, label: 'Warm', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    cold: { Icon: Snowflake,     label: 'Cold', cls: 'bg-muted text-muted-foreground border-border' },
  }[bucket];

  const Badge_ = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        size === 'sm' ? 'text-[10px] px-1.5 py-0 h-5' : 'text-xs px-2 py-0.5',
        config.cls,
        className,
      )}
    >
      <config.Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{score}</span>
      {showLabel && <span className="ml-0.5">{config.label}</span>}
    </Badge>
  );

  if (!breakdown) return Badge_;

  return (
    <Tooltip>
      <TooltipTrigger asChild><span>{Badge_}</span></TooltipTrigger>
      <TooltipContent className="text-xs">
        <div className="font-semibold mb-1">Lead Score: {score}/100 ({config.label})</div>
        <div className="space-y-0.5">
          <div>Engagement: {breakdown.engagement}/40</div>
          <div>Intent / Fit: {breakdown.intentFit}/25</div>
          <div>Recency: {breakdown.recency}/20</div>
          <div>Stage: {breakdown.stageProgress}/15</div>
          {breakdown.negative !== 0 && <div className="text-destructive">Penalty: {breakdown.negative}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
