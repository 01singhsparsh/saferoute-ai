import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — SafeRoute AI" },
      { name: "description", content: "Choose a new SafeRoute AI password." },
      { property: "og:title", content: "Reset password — SafeRoute AI" },
      { property: "og:description", content: "Choose a new SafeRoute AI password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pw = String(new FormData(e.currentTarget).get("password") ?? "");
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <Logo className="mb-6" />
        <h1 className="mb-4 text-xl font-semibold">Set a new password</h1>
        {ready ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>Update password</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email.</p>
        )}
      </div>
    </div>
  );
}
