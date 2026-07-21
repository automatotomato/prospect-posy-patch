import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const APP_URL = "https://zrmcconsultants.automateplanet.com";

export default function SalesLogin() {
  const { user, signInWithPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("management@z-cconsultants.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (user) navigate("/sales", { replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithPassword(email.trim(), password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/sales", { replace: true });
    }
  };

  const sendReset = async () => {
    const target = email.trim();
    if (!target) return toast.error("Enter your email first");
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${APP_URL}/sales/set-password`,
    });
    setSendingReset(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for a password setup link");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Outbound Sales</CardTitle>
          <CardDescription>Sign in to your sales dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={sendReset}
              disabled={sendingReset}
              className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {sendingReset ? "Sending…" : "First time here or forgot password? Email me a setup link"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
