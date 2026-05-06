import { Badge } from '@/components/ui/badge';
import { ProspectStatus } from '@/types/prospect';

interface StatusBadgeProps {
  status: ProspectStatus;
}

const statusLabels: Record<ProspectStatus, string> = {
  new: 'New',
  called: 'Called',
  contacted: 'Contacted',
  responded: 'Responded',
  qualified: 'Qualified',
  quoted: 'Quoted',
  closed: 'Closed',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={status}>
      {statusLabels[status]}
    </Badge>
  );
}
