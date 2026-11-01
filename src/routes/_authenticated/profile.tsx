import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionCard } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — SafeRoute AI" }, { name: "description", content: "Your SafeRoute AI account." }] }),
  component: Profile,
});

function Profile() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user!.id),
      ]);
      if (p.error) throw p.error;
      return { email: u.user!.email, id: u.user!.id, profile: p.data, roles: (r.data ?? []).map((x) => x.role) };
    },
  });
  const [name, setName] = useState("");
  useEffect(() => { if (q.data?.profile?.display_name) setName(q.data.profile.display_name); }, [q.data]);

  const save = useMutation({
    mutationFn: async () => {
      const v = name.trim();
      if (!v || v.length > 80) throw new Error("Display name must be 1–80 characters");
      const { error } = await supabase.from("profiles").upsert({ id: q.data!.id, display_name: v, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (q.error) return <p className="text-destructive">{(q.error as Error).message}</p>;
  return (
    <>
      <PageHeader title="Profile" />
      <SectionCard className="max-w-xl">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="space-y-1.5"><Label>Email</Label><Input value={q.data?.email ?? ""} disabled /></div>
          <div className="space-y-1.5"><Label htmlFor="dn">Display name</Label><Input id="dn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <p className="text-sm text-muted-foreground">Roles: {q.data?.roles.join(", ") || "none"}</p>
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </form>
      </SectionCard>
    </>
  );
}
