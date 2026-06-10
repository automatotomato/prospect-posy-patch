import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, RefreshCw, Sparkles, X, ImagePlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Extracted = {
  business_name?: string | null;
  contact_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  notes?: string | null;
  confidence?: "high" | "medium" | "low";
};

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.85;

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = dataUrl;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function ScanCardDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (leadId: string) => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Extracted | null>(null);

  const reset = () => {
    setImageUrl(null);
    setData(null);
    setExtracting(false);
    setSaving(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageUrl(dataUrl);
      setData(null);
      // Auto-extract
      await extract(dataUrl);
    } catch (e: any) {
      toast.error(`Couldn't read image: ${e?.message || e}`);
    }
  };

  const extract = async (dataUrl?: string) => {
    const img = dataUrl || imageUrl;
    if (!img) return;
    setExtracting(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("extract-business-card", {
        body: { image: img },
      });
      if (error) throw error;
      if (resp?.error) throw new Error(resp.error);
      const extracted: Extracted = resp?.extracted || {};
      setData(extracted);
      toast.success("Details extracted");
    } catch (e: any) {
      toast.error(`Extraction failed: ${e?.message || e}`);
    } finally {
      setExtracting(false);
    }
  };

  const update = (patch: Partial<Extracted>) => setData((d) => ({ ...(d || {}), ...patch }));

  const save = async () => {
    if (!user) return toast.error("Sign in required");
    if (!data?.business_name?.trim()) return toast.error("Business name is required");
    setSaving(true);
    const noteParts: string[] = [];
    if (data.title) noteParts.push(`Title: ${data.title}`);
    if (data.address) noteParts.push(`Address: ${data.address}`);
    if (data.notes) noteParts.push(data.notes);

    const { data: row, error } = await supabase
      .from("sales_leads")
      .insert({
        owner_id: user.id,
        business_name: data.business_name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        website: data.website?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        industry: data.industry?.trim() || null,
        notes: [data.contact_name ? `Contact: ${data.contact_name}` : null, ...noteParts]
          .filter(Boolean).join("\n") || null,
        source: "business_card",
        stage: "new",
        status: "new",
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead added to pipeline");
    onCreated?.(row.id);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />Scan a business card
          </DialogTitle>
          <DialogDescription>
            Take a photo or upload an image. AI extracts the details into a pipeline-ready lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!imageUrl ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="group border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors rounded-xl p-6 flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold">Take a photo</div>
                <div className="text-[11px] text-muted-foreground">Uses your device camera</div>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="group border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors rounded-xl p-6 flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ImagePlus className="w-5 h-5" />
                </div>
                <div className="text-sm font-semibold">Upload an image</div>
                <div className="text-[11px] text-muted-foreground">JPG / PNG / HEIC</div>
              </button>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-border bg-black/40">
              <img src={imageUrl} alt="Business card" className="w-full max-h-72 object-contain" />
              <Button
                size="sm"
                variant="secondary"
                onClick={reset}
                className="absolute top-2 right-2 gap-1 h-8"
              >
                <X className="w-3.5 h-3.5" />Change
              </Button>
              {extracting && (
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    Reading card…
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {data && (
            <div className="space-y-3 border border-border rounded-xl p-4 bg-secondary/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Extracted — review before saving</span>
                </div>
                {data.confidence && (
                  <Badge variant="outline" className="text-[10px] capitalize">{data.confidence} confidence</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Business name *" value={data.business_name} onChange={(v) => update({ business_name: v })} />
                <Field label="Contact name" value={data.contact_name} onChange={(v) => update({ contact_name: v })} />
                <Field label="Title" value={data.title} onChange={(v) => update({ title: v })} />
                <Field label="Industry" value={data.industry} onChange={(v) => update({ industry: v })} />
                <Field label="Email" value={data.email} onChange={(v) => update({ email: v })} type="email" />
                <Field label="Phone" value={data.phone} onChange={(v) => update({ phone: v })} />
                <Field label="Website" value={data.website} onChange={(v) => update({ website: v })} />
                <Field label="Address" value={data.address} onChange={(v) => update({ address: v })} />
                <Field label="City" value={data.city} onChange={(v) => update({ city: v })} />
                <Field label="State" value={data.state} onChange={(v) => update({ state: v })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</Label>
                <Textarea
                  value={data.notes || ""}
                  onChange={(e) => update({ notes: e.target.value })}
                  className="bg-background border-border mt-1 min-h-[70px]"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {imageUrl && !extracting && (
            <Button variant="outline" onClick={() => extract()} className="gap-2">
              <RefreshCw className="w-4 h-4" />Re-extract
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!data || saving || extracting} className="gap-2">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</> : <><Upload className="w-4 h-4" />Add to pipeline</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border-border mt-1 h-9"
      />
    </div>
  );
}
