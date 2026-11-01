import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getModelInfo, predictRisk } from "@/lib/ml.functions";
import { FEATURES } from "@/lib/ml/model";
import { DemoBadge, EmptyState, PageHeader, RiskBadge, SectionCard, riskColorVar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LABELS, type Label } from "@/lib/ml/random-forest";

export const Route = createFileRoute("/_authenticated/predict")({
  head: () => ({ meta: [{ title: "AI Risk Prediction — SafeRoute AI" }, { name: "description", content: "Estimate an area's risk class with the Random Forest model." }] }),
  component: PredictPage,
});

const EXPLAIN: Record<Label, string> = {
  Low: "These inputs look like the lower-risk areas in the training data.",
  Moderate: "These inputs fall in the middle range of the training data, where classes overlap the most.",
  High: "These inputs look like the higher-risk areas in the training data, mainly because of the incident rate.",
};

function PredictPage() {
  const qc = useQueryClient();
  const predict = useServerFn(predictRisk);
  const info = useQuery({ queryKey: ["model-info"], queryFn: () => getModelInfo(), staleTime: Infinity });
  const [values, setValues] = useState<Record<string, string>>({ population_density: "", incident_rate: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const history = useQuery({
    queryKey: ["predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("predictions").select("*").order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (d: { population_density: number; incident_rate: number }) => predict({ data: d }),
    onSuccess: (r) => {
      if (!r.savedToHistory) toast.warning("Prediction made, but it couldn't be saved to your history.");
      qc.invalidateQueries({ queryKey: ["predictions"] });
      qc.invalidateQueries({ queryKey: ["recent-activity"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Prediction failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("predictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["predictions"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const parsed: Record<string, number> = {};
    for (const f of FEATURES) {
      const raw = (values[f.key] ?? "").trim();
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) errs[f.key] = "Enter a number";
      else if (n < f.min || n > f.max) errs[f.key] = `Must be between ${f.min} and ${f.max}`;
      else parsed[f.key] = n;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    mutation.mutate(parsed as { population_density: number; incident_rate: number });
  }

  const r = mutation.data;
  return (
    <>
      <PageHeader title="AI risk prediction" description="Runs the Random Forest model on the server. Inputs are checked before they're sent." />
      <div className="grid gap-4 lg:grid-cols-5">
        <SectionCard title="Area inputs" className="lg:col-span-2" action={<DemoBadge>Trained on synthetic data</DemoBadge>}>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {FEATURES.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <FieldLabel htmlFor={f.key}>{f.label} <span className="text-muted-foreground">({f.unit})</span></FieldLabel>
                <Input
                  id={f.key}
                  inputMode="decimal"
                  placeholder={`${f.min} – ${f.max}`}
                  value={values[f.key]}
                  aria-invalid={!!errors[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                {errors[f.key] && <p className="text-xs text-destructive">{errors[f.key]}</p>}
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" />} Estimate risk
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Result" className="lg:col-span-3">
          {mutation.isPending ? (
            <Skeleton className="h-48" />
          ) : !r ? (
            <EmptyState title="No estimate yet">Enter both values and choose “Estimate risk”.</EmptyState>
          ) : (
            <div className="space-y-5 animate-fade-up">
              <div className="flex items-center gap-4">
                <div className="grid size-16 place-items-center rounded-full ring-4" style={{ background: `color-mix(in oklab, ${riskColorVar[r.label]} 18%, transparent)`, color: riskColorVar[r.label] }}>
                  <span className="font-display text-sm font-semibold">{r.label}</span>
                </div>
                <div>
                  <RiskBadge level={r.label} />
                  <p className="mt-1 text-sm text-muted-foreground">{EXPLAIN[r.label]}</p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Tree vote share (not a calibrated probability)</p>
                <div className="space-y-2">
                  {LABELS.map((l) => (
                    <div key={l} className="flex items-center gap-3 text-sm">
                      <span className="w-20">{l}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${r.voteShare[l] * 100}%`, background: riskColorVar[l] }} />
                      </div>
                      <span className="w-12 text-right font-mono">{(r.voteShare[l] * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                model {r.modelVersion}
                {info.data && ` · test accuracy on synthetic hold-out ${(info.data.metrics.accuracy * 100).toFixed(1)}%`}
              </p>
            </div>
          )}
          <div className="mt-5 flex gap-2 rounded-lg border border-risk-moderate/30 bg-demo p-3 text-xs text-demo-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            This is an analytical estimate from a model trained on synthetic data. It is not a guarantee of safety
            and doesn't predict whether a crime will happen at any specific place or time.
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Prediction history" className="mt-4">
        {history.isLoading ? <Skeleton className="h-24" /> : !history.data?.length ? (
          <EmptyState title="No saved predictions" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2">When</th><th>Density</th><th>Incident rate</th><th>Result</th><th>Model</th><th /></tr>
              </thead>
              <tbody>
                {history.data.map((h) => {
                  const inp = h.inputs as { population_density: number; incident_rate: number };
                  return (
                    <tr key={h.id} className="border-t">
                      <td className="py-2 text-muted-foreground">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="font-mono">{inp.population_density}</td>
                      <td className="font-mono">{inp.incident_rate}</td>
                      <td><RiskBadge level={h.predicted_label as Label} /></td>
                      <td className="font-mono text-xs text-muted-foreground">{h.model_version}</td>
                      <td className="text-right">
                        <Button size="icon" variant="ghost" aria-label="Delete prediction" onClick={() => remove.mutate(h.id)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
