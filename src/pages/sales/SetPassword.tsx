import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const APP_URL = "https://zrmcconsultants.automateplanet.com";

export default function SetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkError, setLinkError] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    let mounted = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = query.get("error_code") || hash.get("error_code");
    const errorDescription = query.get("error_description") || hash.get("error_description");
    const emailFromUrl = query.get("email") || hash.get("email") || "";
    const tokenHash = query.get("token_hash") || hash.get("token_hash");
    const type = query.get("type") || hash.get("type");

    if (emailFromUrl) setEmail(emailFromUrl);
    if (errorCode) {
      setLinkError(errorDescription?.replace(/\+/g, " ") || "This password reset link is invalid or has expired.");
      setCheckingLink(false);
    }

    if (tokenHash && type === "recovery") {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setLinkError(error.message);
          setCheckingLink(false);
          return;
        }
        if (data.session?.user) {
          setEmail(data.session.user.email || emailFromUrl);
          setReady(true);
        }
        setCheckingLink(false);
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEmail(session.user.email || "");
        setReady(true);
      }
      setCheckingLink(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setEmail(data.session.user.email || "");
        setReady(true);
      }
      setCheckingLink(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    const token = code.replace(/\s/g, "");
    if (!target) return toast.error("Enter your email");
    if (!token) return toast.error("Enter the recovery code from your email");
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: target, token, type: "recovery" });
    setLoading(false);
    if (error) return toast.error(error.message);
    setEmail(data.user?.email || target);
    setReady(true);
    setLinkError("");
    toast.success("Code verified — choose a new password");
  };

  const sendReset = async () => {
    const target = email.trim().toLowerCase();
    if (!target) return toast.error("Enter your email first");
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${APP_URL}/sales/set-password`,
    });
    setSendingReset(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for a new recovery code");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password set — you're signed in");
    navigate("/sales", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            {ready
              ? `Create a password for ${email} to finish setting up your account.`
              : checkingLink
                ? "Verifying your password setup link…"
                : "Enter the recovery code from your newest email to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving…" : "Set password & sign in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="space-y-4">
              {linkError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {linkError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Recovery code</Label>
                <Input id="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading || checkingLink}>
                {loading ? "Verifying…" : "Verify code"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={sendReset} disabled={sendingReset}>
                {sendingReset ? "Sending…" : "Send a new code"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
