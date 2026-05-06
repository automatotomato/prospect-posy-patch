import { useState, useRef } from 'react';
import { Camera, Plus, X, Upload, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface QuickCaptureButtonProps {
  onCapture: (imageBase64: string) => void;
  isProcessing?: boolean;
}

export function QuickCaptureButton({ onCapture, isProcessing }: QuickCaptureButtonProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, useCamera: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onCapture(base64);
      setShowUploadDialog(false);
      setIsExpanded(false);
    };
    reader.readAsDataURL(file);
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const triggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e, false)}
        className="hidden"
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-20 right-4 z-50 md:bottom-6 flex flex-col-reverse items-center gap-3">
        {/* Expanded options */}
        {isExpanded && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full w-14 h-14 shadow-lg"
              onClick={triggerUpload}
            >
              <Upload className="w-7 h-7" />
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full w-14 h-14 shadow-lg"
              onClick={triggerCamera}
            >
              <Camera className="w-7 h-7" />
            </Button>
          </div>
        )}

        {/* Main FAB */}
        <Button
          size="lg"
          className={cn(
            "rounded-full w-16 h-16 shadow-xl transition-all duration-200",
            isExpanded ? "rotate-45 bg-muted text-muted-foreground hover:bg-muted" : "bg-primary hover:bg-primary/90"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Plus className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Backdrop when expanded */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}
