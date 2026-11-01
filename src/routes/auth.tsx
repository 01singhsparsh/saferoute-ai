import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — SafeRoute AI" },
      { name: "description", content: "Sign in or create a SafeRoute AI account." },
      { property: "og:title", content: "Sign in — SafeRoute AI" },
      { property: "og:description", content: "Access the SafeRoute AI analytics workspace." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : "/dashboard";
}

const creds = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [sentConfirm, setSentConfirm] = useState(false);
  const target = safePath(redirect);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: target });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: target });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    setBusy(true);
    try {
      if (mode === "forgot") {
        const v = z.string().email().safeParse(email);
        if (!v.success) {
          toast.error("Enter a valid email");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If an account exists, a reset link has been sent.");
        return;
      }
      const parsed = creds.safeParse({ email, password: fd.get("password") });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email and password");
        return;
      }
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: {
            emailRedirectTo: window.location.origin + target,
            data: { display_name: String(fd.get("name") ?? "").trim() || undefined },
          },
        });
        if (error) throw error;
        if (!data.session) setSentConfirm(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    sessionStorage.setItem("saferoute.postAuth", target);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message);
  }

  return (
    <div className="bg-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <Logo className="mb-6" />
        {sentConfirm ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link. Open it to activate your account, then sign in.
            </p>
            <Button variant="outline" onClick={() => { setSentConfirm(false); setMode("signin"); }}>Back to sign in</Button>
          </div>
        ) : (
          <>
            <Tabs value={mode === "forgot" ? "signin" : mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="mb-6 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value={mode === "forgot" ? "signin" : mode} forceMount>
                <form onSubmit={submit} className="space-y-4" noValidate>
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Display name</Label>
                      <Input id="name" name="name" maxLength={80} autoComplete="name" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                  {mode !== "forgot" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "signin" && (
                          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <Input id="password" name="password" type="password" required minLength={8}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                  </Button>
                  {mode === "forgot" && (
                    <button type="button" className="w-full text-xs text-muted-foreground hover:underline" onClick={() => setMode("signin")}>
                      Back to sign in
                    </button>
                  )}
                </form>
              </TabsContent>
            </Tabs>
            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => oauth("google")}>Continue with Google</Button>
              <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
                Continue with Lovable
              </button>
            </div>
          </>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
