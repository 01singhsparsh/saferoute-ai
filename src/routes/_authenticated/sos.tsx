import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Circle, FlaskConical, Loader2, Phone, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, PageHeader, SectionCard } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/sos")({
  head: () => ({ meta: [{ title: "SOS Demonstration — SafeRoute AI" }, { name: "description", content: "Simulated emergency alert workflow. No one is contacted." }] }),
  component: SosPage,
});

const STEPS = [
  "Confirming request",
  "Reading device location (simulated)",
  "Preparing alert message",
  "Simulating delivery to contacts",
  "Recording demonstration log",
];

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Enter a valid phone number"),
  relation: z.string().trim().max(40).optional(),
});

function SosPage() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [step, setStep] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emergency_contacts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const logs = useQuery({
    queryKey: ["sos-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sos_logs").select("*").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const addContact = useMutation({
    mutationFn: async (v: z.infer<typeof contactSchema>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("emergency_contacts").insert({ ...v, relation: v.relation || null, user_id: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success("Contact saved"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  async function runSimulation() {
    const n = contacts.data?.length ?? 0;
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      if (i === STEPS.length - 1) {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("sos_logs").insert({
          user_id: u.user!.id, status: "simulated", contacts_count: n,
          note: "Demonstration only. No messages were sent and no emergency services were contacted.",
        });
        if (error) { toast.error(error.message); setStep(-1); return; }
      } else {
        await new Promise((r) => { timer.current = setTimeout(r, 900); });
      }
    }
    setStep(STEPS.length);
    qc.invalidateQueries({ queryKey: ["sos-logs"] });
    qc.invalidateQueries({ queryKey: ["recent-activity"] });
    toast.success("Simulation complete. No one was contacted.");
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = contactSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid contact details");
      return;
    }
    addContact.mutate(parsed.data);
    e.currentTarget.reset();
  }

  const running = step >= 0 && step < STEPS.length;
  return (
    <>
      <PageHeader title="SOS demonstration" description="A simulated alert workflow for demonstration. It doesn't contact emergency services or your contacts." />
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-risk-moderate/30 bg-demo px-4 py-3 text-sm text-demo-foreground">
        <FlaskConical className="size-4" /> DEMONSTRATION MODE. In a real emergency, call your local emergency number.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Trigger simulated alert">
          <div className="flex flex-col items-center py-6">
            <div className="relative">
              {!running && <span className="absolute inset-0 rounded-full bg-risk-high/40 animate-pulse-ring" />}
              <Button variant="sos" className="relative size-40 text-2xl" disabled={running} onClick={() => setConfirm(true)} aria-label="Trigger SOS demonstration">
                {running ? <Loader2 className="size-8 animate-spin" /> : "SOS"}
              </Button>
            </div>
            <ol className="mt-8 w-full max-w-sm space-y-2 text-sm">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                  {i < step || step === STEPS.length ? <CheckCircle2 className="size-4 text-risk-low" /> : i === step ? <Loader2 className="size-4 animate-spin text-primary" /> : <Circle className="size-4" />}
                  {s}
                </li>
              ))}
            </ol>
            {step === STEPS.length && (
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                Simulation finished. {contacts.data?.length ?? 0} contact(s) would have been notified if a real messaging service were connected.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Emergency contacts" description="Saved privately to your account.">
          <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="c-name">Name</Label><Input id="c-name" name="name" maxLength={80} required /></div>
            <div className="space-y-1"><Label htmlFor="c-phone">Phone</Label><Input id="c-phone" name="phone" type="tel" maxLength={20} required /></div>
            <div className="space-y-1"><Label htmlFor="c-rel">Relation</Label><Input id="c-rel" name="relation" maxLength={40} /></div>
            <Button type="submit" className="sm:col-span-3" disabled={addContact.isPending}><UserPlus /> Add contact</Button>
          </form>
          <ul className="mt-4 divide-y">
            {contacts.data?.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2"><Phone className="size-4 text-primary" /> {c.name} <span className="text-muted-foreground">{c.phone}{c.relation ? ` · ${c.relation}` : ""}</span></span>
                <Button size="icon" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => removeContact.mutate(c.id)}><Trash2 /></Button>
              </li>
            ))}
          </ul>
          {contacts.data?.length === 0 && <EmptyState title="No contacts yet" />}
        </SectionCard>
      </div>

      <SectionCard title="Demonstration log" className="mt-4">
        {!logs.data?.length ? <EmptyState title="No simulations run yet" /> : (
          <ul className="space-y-2 text-sm">
            {logs.data.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 border-t pt-2">
                <span>Simulated alert · {l.contacts_count} contact(s)</span>
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start SOS simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a demonstration only. No messages will be sent, and emergency services will not be contacted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runSimulation}>Run simulation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
