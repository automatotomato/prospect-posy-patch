import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { Play, Loader2 } from 'lucide-react';

interface AgentControlPanelProps {
  isRunning: boolean;
  onRunAgent: () => void;
}

export function AgentControlPanel({ isRunning, onRunAgent }: AgentControlPanelProps) {
  const { data: settings } = useAgentSettings();

  const locations = settings?.discovery?.locations || [settings?.discovery?.location || 'Las Vegas, NV'];
  const targetCount = settings?.discovery?.targetCount || 50;
  const businessTypes = settings?.business_types || [];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            Run Agent
          </CardTitle>
          <CardDescription>
            Uses your configured settings from the Settings tab
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Locations</span>
              <span className="font-medium text-right max-w-[60%] truncate">{locations.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Target</span>
              <span className="font-medium">{targetCount} businesses</span>
            </div>
            {businessTypes.length > 0 && (
              <div className="pt-2">
                <span className="text-muted-foreground text-xs">Business types</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {businessTypes.slice(0, 8).map((type) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {businessTypes.length > 8 && (
                    <Badge variant="secondary" className="text-xs">+{businessTypes.length - 8} more</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
          <Button 
            onClick={onRunAgent} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Agent Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Discovery
              </>
            )}
          </Button>
        </CardContent>
      </Card>
  );
}
