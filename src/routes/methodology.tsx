import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PublicLayout } from "@/components/site-chrome";
import { DemoBadge, SectionCard } from "@/components/brand";
import { getModelInfo } from "@/lib/ml.functions";

const modelInfoQuery = queryOptions({ queryKey: ["model-info"], queryFn: () => getModelInfo(), staleTime: Infinity });

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology & Limitations — SafeRoute AI" },
      { name: "description", content: "How SafeRoute AI's Random Forest model is trained, evaluated, and where its limits are." },
      { property: "og:title", content: "Methodology — SafeRoute AI" },
      { property: "og:description", content: "Training data, evaluation metrics, architecture and limitations of SafeRoute AI." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(modelInfoQuery),
  component: Methodology,
});

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Methodology() {
  const { data: m } = useSuspenseQuery(modelInfoQuery);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-14">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">About & methodology</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            SafeRoute AI is an academic project that classifies area-level crime risk into Low, Moderate or High.
            This page explains how the model works, how it was tested, and what it cannot do.
          </p>
        </div>

        <SectionCard title="Data flow">
          <div className="grid gap-3 text-sm md:grid-cols-5">
            {["CSV upload / synthetic set", "Validation & cleaning", "Random Forest (server)", "Risk class + vote share", "Dashboard, map, analytics"].map((s, i, a) => (
              <div key={s} className="flex items-center gap-3 md:flex-col md:items-stretch">
                <div className="flex-1 rounded-lg border bg-surface px-3 py-3 text-center">{s}</div>
                {i < a.length - 1 && <span className="text-primary md:text-center">→</span>}
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Random Forest classification">
            <p className="text-sm text-muted-foreground">
              A Random Forest is a group of decision trees. Each tree learns from a random sample of the training
              records (bootstrap) and looks at one randomly chosen feature at each split, using the Gini impurity
              measure. The final class is the majority vote of {m.hyperparameters.nTrees} trees (maximum depth{" "}
              {m.hyperparameters.maxDepth}).
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{m.implementation}.</p>
          </SectionCard>
          <SectionCard title="Input features" action={<DemoBadge>Provisional</DemoBadge>}>
            <ul className="space-y-2 text-sm">
              {m.features.map((f, i) => (
                <li key={f.key} className="flex justify-between gap-3">
                  <span>{f.label} <span className="text-muted-foreground">({f.unit})</span></span>
                  <span className="font-mono text-muted-foreground">split share {pct(m.featureImportance[i]?.share ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              The original project's exact features were not supplied, so these two features are assumptions.
              They will be replaced when the original dataset and training script are provided.
            </p>
          </SectionCard>
        </div>

        <SectionCard title="Training & evaluation" description={m.trainingData} action={<DemoBadge />}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="text-sm">
              <p className="text-muted-foreground">
                Preprocessing: numeric features are used as-is (trees don't need scaling), and labels are encoded
                as Low=0, Moderate=1, High=2. Split: seeded random 80/20 train/test.
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-3 font-mono">
                <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Train</dt><dd className="text-lg">{m.metrics.trainSize}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Test</dt><dd className="text-lg">{m.metrics.testSize}</dd></div>
                <div className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">Accuracy</dt><dd className="text-lg">{pct(m.metrics.accuracy)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                These numbers are computed live from the held-out test set. High accuracy here only means the
                model learned the rule used to generate the synthetic data. It says nothing about real-world
                performance.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="py-1 text-left">Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>n</th></tr>
                </thead>
                <tbody className="font-mono">
                  {m.metrics.perClass.map((c) => (
                    <tr key={c.label} className="border-t text-center">
                      <td className="py-1.5 text-left font-sans">{c.label}</td>
                      <td>{pct(c.precision)}</td><td>{pct(c.recall)}</td><td>{pct(c.f1)}</td><td>{c.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 mb-1 text-xs text-muted-foreground">Confusion matrix (rows = actual, cols = predicted)</p>
              <table className="font-mono text-sm">
                <tbody>
                  {m.metrics.confusion.map((row, i) => (
                    <tr key={i}>
                      <td className="pr-3 font-sans text-xs text-muted-foreground">{m.labels[i]}</td>
                      {row.map((v, j) => (
                        <td key={j} className={`h-9 w-12 border text-center ${i === j ? "bg-primary/15" : ""}`}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 md:grid-cols-2">
          <SectionCard title="Synthetic vs official data">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Synthetic:</strong> generated by a formula with random noise. Useful for demonstrating the pipeline, but it shows no real place.</li>
              <li><strong className="text-foreground">Unverified upload:</strong> your own CSV. The app checks its structure, but cannot check whether it's true.</li>
              <li><strong className="text-foreground">Verified:</strong> only an administrator can mark a dataset as verified, after checking where it came from.</li>
            </ul>
          </SectionCard>
          <SectionCard title="Limitations">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Only two input features. Real risk depends on many more factors.</li>
              <li>Vote shares are not calibrated probabilities.</li>
              <li>It can't predict individual crime events, times or places.</li>
              <li>Reported-crime data reflects reporting and policing patterns as well as actual crime.</li>
              <li>It doesn't guarantee safety. The SOS module is a simulation only.</li>
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Future development">
          <p className="text-sm text-muted-foreground">
            Retrain on verified official open data with more features (time of day, land use, lighting), add
            calibrated probabilities and per-prediction explanations, test for fairness across neighbourhoods,
            and add a real, consented emergency notification integration.
          </p>
        </SectionCard>
      </div>
    </PublicLayout>
  );
}
