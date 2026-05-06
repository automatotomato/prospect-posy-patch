import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PhoneCall, Sparkles, ChevronDown, ChevronUp, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ColdCallScriptProps {
  businessName: string;
  contactName?: string | null;
  industry?: string | null;
  location: string;
  phone?: string | null;
  notes?: string | null;
  website?: string | null;
}

export function ColdCallScript({ businessName, contactName, industry, location, phone, notes, website }: ColdCallScriptProps) {
  const [script, setScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-call-script', {
        body: { businessName, contactName, industry, location, phone, notes, website },
      });
      if (error) throw error;
      setScript(data.script);
      setIsOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate script');
    } finally {
      setIsLoading(false);
    }
  };

  const copyScript = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    toast.success('Script copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!script) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Call Script</h3>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={generate}
          disabled={isLoading}
        >
          {isLoading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4" />Generate Call Script</>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Call Script</h3>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-medium">
              <PhoneCall className="w-4 h-4 text-primary" />
              AI Call Script
            </div>
            {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 border-t border-border">
              <pre className="text-sm whitespace-pre-wrap leading-relaxed mt-3 font-sans">{script}</pre>
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyScript}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={generate} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Regenerate
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
