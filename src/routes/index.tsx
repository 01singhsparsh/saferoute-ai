import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  BrainCircuit,
  Database,
  FileWarning,
  Map as MapIcon,
  Scale,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { PublicLayout } from "@/components/site-chrome";
import { DemoBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafeRoute AI — AI-Powered Area Risk Estimation" },
      {
        name: "description",
        content: "Analyse crime-related datasets, estimate area-level risk with a Random Forest model, and see exactly where the data comes from.",
      },
      { property: "og:title", content: "SafeRoute AI — Understand Your Surroundings" },
      { property: "og:description", content: "Transparent, AI-assisted area risk estimation and crime data analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CAPS = [
  { icon: BrainCircuit, title: "Random Forest risk model", text: "Classifies areas into Low, Moderate or High risk from two input features." },
  { icon: MapIcon, title: "Interactive risk map", text: "Plots your uploaded records that include verified coordinates, with filters and area details." },
  { icon: BarChart3, title: "Analytics & reports", text: "Risk distribution, area comparisons and time trends computed from the loaded data, exportable as CSV." },
  { icon: Database, title: "Dataset management", text: "Upload CSVs, check columns, missing values and duplicates, and track where each file came from." },
  { icon: Siren, title: "SOS demonstration", text: "A simulated alert flow with emergency contact setup. It does not contact anyone." },
  { icon: Scale, title: "Transparent by default", text: "Every chart shows its data source. Synthetic and unverified data are always labelled." },
];

function HeroVisual() {
  const nodes = [
    [60, 70, "low"], [150, 40, "moderate"], [240, 95, "low"], [320, 50, "high"],
    [90, 170, "moderate"], [200, 180, "low"], [300, 160, "moderate"], [370, 210, "low"],
    [130, 250, "high"], [250, 260, "low"],
  ] as const;
  const color = { low: "var(--risk-low)", moderate: "var(--risk-moderate)", high: "var(--risk-high)" };
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Illustration · not real locations</span>
        <DemoBadge>Illustrative</DemoBadge>
      </div>
      <svg viewBox="0 0 420 300" className="bg-grid w-full rounded-lg bg-surface" role="img" aria-label="Illustrative risk network">
        {nodes.map(([x, y], i) =>
          nodes.slice(i + 1, i + 3).map(([x2, y2], j) => (
            <line key={`${i}-${j}`} x1={x} y1={y} x2={x2} y2={y2} stroke="var(--primary)" strokeOpacity="0.25" />
          )),
        )}
        {nodes.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="14" fill={color[r]} opacity="0.15">
              <animate attributeName="r" values="8;18;8" dur={`${2.5 + (i % 3)}s`} repeatCount="indefinite" />
            </circle>
            <circle cx={x} cy={y} r="5" fill={color[r]} />
          </g>
        ))}
      </svg>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        {(["low", "moderate", "high"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5 capitalize">
            <span className="size-2 rounded-full" style={{ background: color[k] }} /> {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  return (
    <PublicLayout>
      <section className="bg-grid">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
          <div className="animate-fade-up">
            <p className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs text-muted-foreground">
              AI-assisted crime data analysis · academic project
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Understand Your Surroundings. <span className="text-gradient">Make Informed Decisions.</span>
            </h1>
            <p className="mt-5 max-w-lg text-muted-foreground">
              SafeRoute AI analyses crime-related datasets and estimates area-level risk with a Random Forest
              classifier, and always shows where its data comes from.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/dashboard">Explore Dashboard</Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#how-it-works">How It Works</a></Button>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <h2 className="text-3xl font-semibold">Platform capabilities</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c) => (
            <div key={c.title} className="glass rounded-xl p-5 transition-transform hover:-translate-y-0.5">
              <c.icon className="size-5 text-cyan" />
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-semibold">How the AI model works</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["Input", "Population density and reported incident rate for an area."],
              ["Ensemble", "100 decision trees, each trained on a random sample of the training data."],
              ["Vote", "Each tree votes Low, Moderate or High. The majority wins."],
              ["Explain", "You see the class, the share of trees agreeing, and the model version."],
            ].map(([t, d], i) => (
              <li key={t} className="glass rounded-xl p-5">
                <span className="font-mono text-sm text-primary">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
          <Button asChild variant="link" className="mt-6 px-0"><Link to="/methodology">Read the full methodology →</Link></Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-20 md:grid-cols-2">
        <div className="glass rounded-xl p-6">
          <FileWarning className="size-5 text-risk-moderate" />
          <h2 className="mt-3 text-xl font-semibold">Data transparency</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The built-in model is trained on 240 <strong className="text-foreground">synthetic</strong> records.
            Uploaded datasets are marked <em>unverified</em> until an administrator verifies them. Every page
            names its active data source.
          </p>
        </div>
        <div className="glass rounded-xl p-6">
          <ShieldAlert className="size-5 text-risk-high" />
          <h2 className="mt-3 text-xl font-semibold">Limitations & responsible use</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Risk classes are analytical estimates. They do not predict whether a crime will happen at a specific
            place or time, and they cannot guarantee anyone's safety. Do not use them to profile people or
            communities.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
